import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { DATA_DIR, APPS_DATA_DIR, db } from '../db/index.js';
import { BackupRecord, R2Config, AppItem } from '../types/index.js';
import { caddyService } from './caddy.js';

export class R2BackupService {
  private getS3Client(config?: R2Config): S3Client | null {
    const cfg = config || db.get('r2Config');
    if (!cfg.enabled || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) {
      return null;
    }

    return new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint.startsWith('http') ? cfg.endpoint : `https://${cfg.endpoint}`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  /**
   * Test Cloudflare R2 connection credentials
   */
  public async testConnection(config: R2Config): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.getS3Client(config);
      if (!client) {
        return { success: false, message: 'R2 configuration is incomplete.' };
      }

      await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          MaxKeys: 1,
        })
      );

      return { success: true, message: 'Successfully connected to Cloudflare R2 bucket!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to authenticate with Cloudflare R2.' };
    }
  }

  /**
   * Create an archive zip file for system data or an app directory
   */
  private async createArchive(sourcePath: string, outputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(archive.pointer()));
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      if (fs.statSync(sourcePath).isDirectory()) {
        archive.directory(sourcePath, false);
      } else {
        archive.file(sourcePath, { name: path.basename(sourcePath) });
      }
      archive.finalize();
    });
  }

  /**
   * Run System Disaster Recovery Backup (Database + Compose files)
   */
  public async runSystemBackup(): Promise<{ success: boolean; record?: BackupRecord; error?: string }> {
    const r2Config = db.get('r2Config');
    const client = this.getS3Client(r2Config);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `vessel_system_${timestamp}.zip`;
    const backupsDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const localZipPath = path.join(backupsDir, fileName);

    try {
      // Create zip of DATA_DIR excluding backups
      const sizeBytes = await new Promise<number>((resolve, reject) => {
        const output = fs.createWriteStream(localZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(archive.pointer()));
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        const dbFile = path.join(DATA_DIR, 'vessel_db.json');
        if (fs.existsSync(dbFile)) {
          archive.file(dbFile, { name: 'vessel_db.json' });
        }
        if (fs.existsSync(APPS_DATA_DIR)) {
          archive.directory(APPS_DATA_DIR, 'apps');
        }
        archive.finalize();
      });

      let status: 'completed' | 'failed' = 'completed';

      // If R2 is enabled and configured, upload to Cloudflare R2
      if (client && r2Config.enabled && r2Config.bucketName) {
        const fileBuffer = fs.readFileSync(localZipPath);
        await client.send(
          new PutObjectCommand({
            Bucket: r2Config.bucketName,
            Key: `system/${fileName}`,
            Body: fileBuffer,
            ContentType: 'application/zip',
          })
        );
      }

      const record: BackupRecord = {
        id: `sys-${Date.now()}`,
        type: 'system',
        targetId: 'vessel_system',
        targetName: 'Vessel System Snapshot',
        fileName,
        fileSizeBytes: sizeBytes,
        createdAt: new Date().toISOString(),
        status,
      };

      const backups = db.get('backups');
      db.set('backups', [record, ...backups]);

      // Update R2 config status
      r2Config.lastBackupAt = new Date().toISOString();
      r2Config.lastBackupStatus = 'success';
      r2Config.lastBackupMessage = `Backup created (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`;
      db.set('r2Config', { ...r2Config });

      await this.enforceRetention('vessel_system');
      return { success: true, record };
    } catch (e: any) {
      r2Config.lastBackupStatus = 'failed';
      r2Config.lastBackupMessage = e.message;
      db.set('r2Config', { ...r2Config });
      return { success: false, error: e.message };
    }
  }

  /**
   * Run backup for a specific Application
   */
  public async runAppBackup(app: AppItem): Promise<{ success: boolean; record?: BackupRecord; error?: string }> {
    const r2Config = db.get('r2Config');
    const client = this.getS3Client(r2Config);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `vessel_app_${app.id}_${timestamp}.zip`;
    const backupsDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const localZipPath = path.join(backupsDir, fileName);
    const appDir = path.join(APPS_DATA_DIR, app.id);

    try {
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
      }

      const sizeBytes = await this.createArchive(appDir, localZipPath);

      if (client && r2Config.enabled && r2Config.bucketName) {
        const fileBuffer = fs.readFileSync(localZipPath);
        await client.send(
          new PutObjectCommand({
            Bucket: r2Config.bucketName,
            Key: `apps/${app.id}/${fileName}`,
            Body: fileBuffer,
            ContentType: 'application/zip',
          })
        );
      }

      const record: BackupRecord = {
        id: `app-${Date.now()}`,
        type: 'app_volume',
        targetId: app.id,
        targetName: app.name,
        fileName,
        fileSizeBytes: sizeBytes,
        createdAt: new Date().toISOString(),
        status: 'completed',
      };

      const backups = db.get('backups');
      db.set('backups', [record, ...backups]);

      await this.enforceRetention(app.id);
      return { success: true, record };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get a readable download stream for a backup
   */
  public async getBackupDownload(id: string): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    contentLength?: number;
  } | null> {
    const backups = db.get('backups') || [];
    const record = backups.find((b) => b.id === id);
    if (!record) return null;

    // Check local storage first
    const localPath = path.join(DATA_DIR, 'backups', record.fileName);
    if (fs.existsSync(localPath)) {
      const stat = fs.statSync(localPath);
      return {
        stream: fs.createReadStream(localPath),
        fileName: record.fileName,
        contentLength: stat.size,
      };
    }

    // If not local, stream from R2
    const r2Config = db.get('r2Config');
    const client = this.getS3Client(r2Config);
    if (client && r2Config.bucketName) {
      try {
        const key =
          record.type === 'system'
            ? `system/${record.fileName}`
            : `apps/${record.targetId}/${record.fileName}`;
        const res = await client.send(
          new GetObjectCommand({
            Bucket: r2Config.bucketName,
            Key: key,
          })
        );
        if (res.Body) {
          return {
            stream: res.Body as any,
            fileName: record.fileName,
            contentLength: res.ContentLength,
          };
        }
      } catch (err: any) {
        console.error(`[R2] Failed to fetch object for download: ${err.message}`);
      }
    }

    return null;
  }

  /**
   * Delete a backup archive both locally and from R2
   */
  public async deleteBackup(id: string): Promise<{ success: boolean; error?: string }> {
    const backups = db.get('backups') || [];
    const record = backups.find((b) => b.id === id);
    if (!record) return { success: false, error: '未找到该备份记录' };

    // Delete from R2
    const r2Config = db.get('r2Config');
    const client = this.getS3Client(r2Config);
    if (client && r2Config.bucketName) {
      const key =
        record.type === 'system'
          ? `system/${record.fileName}`
          : `apps/${record.targetId}/${record.fileName}`;
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: r2Config.bucketName,
            Key: key,
          })
        );
      } catch (err: any) {
        console.warn(`[R2] Failed to delete from R2: ${err.message}`);
      }
    }

    // Delete local file
    const localPath = path.join(DATA_DIR, 'backups', record.fileName);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {}
    }

    // Update DB
    db.set(
      'backups',
      backups.filter((b) => b.id !== id)
    );
    return { success: true };
  }

  /**
   * Restore a backup snapshot archive to system or app
   */
  public async restoreBackup(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const backups = db.get('backups') || [];
    const record = backups.find((b) => b.id === id);
    if (!record) return { success: false, error: '未找到该备份记录' };

    const backupsDir = path.join(DATA_DIR, 'backups');
    let localPath = path.join(backupsDir, record.fileName);

    // If local file does not exist, fetch from R2
    if (!fs.existsSync(localPath)) {
      const r2Config = db.get('r2Config');
      const client = this.getS3Client(r2Config);
      if (client && r2Config.bucketName) {
        try {
          const key =
            record.type === 'system'
              ? `system/${record.fileName}`
              : `apps/${record.targetId}/${record.fileName}`;
          const res = await client.send(
            new GetObjectCommand({
              Bucket: r2Config.bucketName,
              Key: key,
            })
          );
          if (res.Body) {
            if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
            const buffer = Buffer.from(await res.Body.transformToByteArray());
            fs.writeFileSync(localPath, buffer);
          }
        } catch (err: any) {
          return { success: false, error: `从 Cloudflare R2 拉取备份快照失败: ${err.message}` };
        }
      }
    }

    if (!fs.existsSync(localPath)) {
      return { success: false, error: '备份文件不存在，无法执行恢复' };
    }

    try {
      const zip = new AdmZip(localPath);

      if (record.type === 'system') {
        // Extract everything to DATA_DIR
        zip.extractAllTo(DATA_DIR, true);
        // Reload database in memory
        db.reload();
        // Sync Caddyfile reverse proxy rules
        caddyService.syncCaddyfile();
        return { success: true, message: `系统快照 ${record.fileName} 已成功恢复生效！` };
      } else {
        // App volume restore
        const appDir = path.join(APPS_DATA_DIR, record.targetId);
        if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });
        zip.extractAllTo(appDir, true);
        return { success: true, message: `应用 ${record.targetName} 数据卷快照已成功恢复！` };
      }
    } catch (err: any) {
      return { success: false, error: `解压并恢复快照失败: ${err.message}` };
    }
  }

  /**
   * Enforce retention limits on older backups
   */
  private async enforceRetention(targetId: string): Promise<void> {
    const r2Config = db.get('r2Config');
    const maxKeep = r2Config.retentionCount || 7;
    const backups = db.get('backups');

    const matching = backups.filter((b) => b.targetId === targetId);
    if (matching.length > maxKeep) {
      const toRemove = matching.slice(maxKeep);
      const keep = backups.filter((b) => !toRemove.includes(b));
      db.set('backups', keep);

      // Delete from local filesystem
      for (const item of toRemove) {
        const localPath = path.join(DATA_DIR, 'backups', item.fileName);
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch {}
        }
      }

      // Delete from R2
      const client = this.getS3Client(r2Config);
      if (client && r2Config.bucketName) {
        for (const item of toRemove) {
          const key =
            item.type === 'system'
              ? `system/${item.fileName}`
              : `apps/${item.targetId}/${item.fileName}`;
          client.send(new DeleteObjectCommand({ Bucket: r2Config.bucketName, Key: key })).catch(() => {});
        }
      }
    }
  }
}

export const r2BackupService = new R2BackupService();
