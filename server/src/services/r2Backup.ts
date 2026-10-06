import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawn } from 'child_process';
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
import { dockerService } from './docker.js';

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

      // Ensure compose configuration, environment and metadata exist in appDir before archiving
      const composePath = path.join(appDir, 'docker-compose.yml');
      const envPath = path.join(appDir, '.env');
      const metadataPath = path.join(appDir, 'app_metadata.json');

      fs.writeFileSync(composePath, app.composeYaml || '', 'utf-8');
      fs.writeFileSync(envPath, app.envContent || '', 'utf-8');
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(
          {
            id: app.id,
            name: app.name,
            description: app.description || '',
            status: app.status,
            composeYaml: app.composeYaml || '',
            envContent: app.envContent || '',
            createdAt: app.createdAt,
            backedUpAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf-8'
      );

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
   * Run targeted database dump backup (PostgreSQL, MySQL, MariaDB, MongoDB, Redis, libSQL)
   */
  public async runDatabaseBackup(
    app: AppItem,
    options?: { databaseName?: string }
  ): Promise<{ success: boolean; record?: BackupRecord; error?: string }> {
    const targetDb = options?.databaseName?.trim() || 'all';
    const { composePath, appDir, envPath } = dockerService.prepareAppFiles(app);

    const envVars: Record<string, string> = {};
    (app.envContent || '').split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
        }
      }
    });

    const yamlLower = (app.composeYaml || '').toLowerCase();
    const isPostgres = yamlLower.includes('postgres');
    const isMariaDB = yamlLower.includes('mariadb');
    const isMySQL = !isMariaDB && yamlLower.includes('mysql');
    const isMongo = yamlLower.includes('mongo');
    const isRedis = yamlLower.includes('redis');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = isMongo ? 'archive.gz' : isRedis ? 'rdb.gz' : 'sql.gz';
    const dbTag = targetDb === 'all' ? 'all' : targetDb.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `vessel_db_${app.name || app.id}_${dbTag}_${timestamp}.${ext}`;
    const backupsDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const localGzPath = path.join(backupsDir, fileName);

    let dumpArgs: string[] = [];

    if (isPostgres) {
      const user = envVars['POSTGRES_USER'] || 'postgres';
      const pass = envVars['POSTGRES_PASSWORD'] || '';
      if (targetDb === 'all') {
        dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', '-e', `PGPASSWORD=${pass}`, 'database', 'pg_dumpall', '-U', user];
      } else {
        dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', '-e', `PGPASSWORD=${pass}`, 'database', 'pg_dump', '-U', user, '-d', targetDb, '--clean', '--if-exists'];
      }
    } else if (isMariaDB) {
      const user = envVars['MARIADB_USER'] || 'root';
      const pass = envVars['MARIADB_PASSWORD'] || envVars['MARIADB_ROOT_PASSWORD'] || '';
      dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'mariadb-dump', '-u', user];
      if (pass) dumpArgs.push(`-p${pass}`);
      if (targetDb === 'all') {
        dumpArgs.push('--all-databases', '--single-transaction', '--quick');
      } else {
        dumpArgs.push('--databases', targetDb, '--single-transaction', '--quick');
      }
    } else if (isMySQL) {
      const user = envVars['MYSQL_USER'] || 'root';
      const pass = envVars['MYSQL_PASSWORD'] || envVars['MYSQL_ROOT_PASSWORD'] || '';
      dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'mysqldump', '-u', user];
      if (pass) dumpArgs.push(`-p${pass}`);
      if (targetDb === 'all') {
        dumpArgs.push('--all-databases', '--single-transaction', '--quick');
      } else {
        dumpArgs.push('--databases', targetDb, '--single-transaction', '--quick');
      }
    } else if (isMongo) {
      const user = envVars['MONGO_INITDB_ROOT_USERNAME'] || '';
      const pass = envVars['MONGO_INITDB_ROOT_PASSWORD'] || '';
      dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'mongodump'];
      if (user && pass) {
        dumpArgs.push('-u', user, '-p', pass, '--authenticationDatabase', 'admin');
      }
      if (targetDb !== 'all') {
        dumpArgs.push('-d', targetDb);
      }
      dumpArgs.push('--archive');
    } else if (isRedis) {
      dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'cat', '/data/dump.rdb'];
    } else {
      dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'sh', '-c', 'cat /data/*'];
    }

    return new Promise((resolve) => {
      const writeStream = fs.createWriteStream(localGzPath);
      const gzip = zlib.createGzip();
      let stderr = '';

      const child = spawn('docker', dumpArgs, { cwd: appDir, shell: true });
      child.stdout.pipe(gzip).pipe(writeStream);

      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', async (code) => {
        if (code === 0) {
          writeStream.on('finish', async () => {
            try {
              const stats = fs.statSync(localGzPath);
              const sizeBytes = stats.size;

              const r2Config = db.get('r2Config');
              const client = this.getS3Client(r2Config);
              if (client && r2Config.enabled && r2Config.bucketName) {
                const fileBuffer = fs.readFileSync(localGzPath);
                await client.send(
                  new PutObjectCommand({
                    Bucket: r2Config.bucketName,
                    Key: `databases/${app.id}/${fileName}`,
                    Body: fileBuffer,
                    ContentType: 'application/gzip',
                  })
                );
              }

              const record: BackupRecord = {
                id: `db-${Date.now()}`,
                type: 'app_db',
                targetId: app.id,
                targetName: `${app.name} (${targetDb === 'all' ? '全部数据库' : targetDb})`,
                fileName,
                fileSizeBytes: sizeBytes,
                createdAt: new Date().toISOString(),
                status: 'completed',
                databaseName: targetDb,
              };

              const backups = db.get('backups') || [];
              db.set('backups', [record, ...backups]);
              await this.enforceRetention(app.id);

              resolve({ success: true, record });
            } catch (err: any) {
              resolve({ success: false, error: err.message });
            }
          });
        } else {
          if (fs.existsSync(localGzPath)) {
            try { fs.unlinkSync(localGzPath); } catch {}
          }
          const cleanError = stderr.trim() || `数据库导出命令异常退出 (退出码 ${code})。请确认容器处于运行状态。`;
          resolve({ success: false, error: cleanError });
        }
      });

      child.on('error', (err) => {
        if (fs.existsSync(localGzPath)) {
          try { fs.unlinkSync(localGzPath); } catch {}
        }
        resolve({ success: false, error: `启动备份命令失败: ${err.message}` });
      });
    });
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
  public async restoreBackup(
    id: string,
    options?: { databaseName?: string }
  ): Promise<{ success: boolean; message?: string; error?: string }> {
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

    if (record.type === 'app_db' || record.fileName.endsWith('.sql.gz') || record.fileName.endsWith('.archive.gz') || record.fileName.endsWith('.rdb.gz')) {
      return this.restoreDatabaseDump(record, localPath, options);
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

        // Sync restored app entity in db
        const metadataPath = path.join(appDir, 'app_metadata.json');
        const composePath = path.join(appDir, 'docker-compose.yml');
        const envPath = path.join(appDir, '.env');

        const apps = db.get('apps') || [];
        const appIndex = apps.findIndex((a) => a.id === record.targetId);

        if (appIndex >= 0) {
          const app = { ...apps[appIndex] };
          if (fs.existsSync(metadataPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
              if (meta.name) app.name = meta.name;
              if (meta.description !== undefined) app.description = meta.description;
              if (meta.composeYaml) app.composeYaml = meta.composeYaml;
              if (meta.envContent !== undefined) app.envContent = meta.envContent;
            } catch {}
          } else if (fs.existsSync(composePath)) {
            app.composeYaml = fs.readFileSync(composePath, 'utf-8');
            if (fs.existsSync(envPath)) {
              app.envContent = fs.readFileSync(envPath, 'utf-8');
            }
          }
          app.updatedAt = new Date().toISOString();
          apps[appIndex] = app;
          db.set('apps', apps);
        } else if (fs.existsSync(metadataPath) || fs.existsSync(composePath)) {
          // Recreate deleted app if missing
          let meta: any = {};
          if (fs.existsSync(metadataPath)) {
            try {
              meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            } catch {}
          }
          const restoredApp: AppItem = {
            id: meta.id || record.targetId,
            name: meta.name || record.targetName,
            description: meta.description || '',
            status: 'stopped',
            composeYaml: meta.composeYaml || (fs.existsSync(composePath) ? fs.readFileSync(composePath, 'utf-8') : ''),
            envContent: meta.envContent || (fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''),
            autoUpdate: false,
            createdAt: meta.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            containers: [],
          };
          db.set('apps', [restoredApp, ...apps]);
        }

        return { success: true, message: `应用 ${record.targetName} 的数据卷与编排快照已成功恢复！` };
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

  /**
   * Restore database dump into running container
   */
  public async restoreDatabaseDump(
    record: BackupRecord,
    localPath: string,
    options?: { databaseName?: string }
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const apps = db.get('apps') || [];
    const app = apps.find((a) => a.id === record.targetId);
    if (!app) return { success: false, error: '关联的应用不存在，无法执行恢复' };

    const { composePath, appDir, envPath } = dockerService.prepareAppFiles(app);
    const envVars: Record<string, string> = {};
    (app.envContent || '').split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
        }
      }
    });

    const yamlLower = (app.composeYaml || '').toLowerCase();
    const isPostgres = yamlLower.includes('postgres');
    const isMariaDB = yamlLower.includes('mariadb');
    const isMySQL = !isMariaDB && yamlLower.includes('mysql');
    const isMongo = yamlLower.includes('mongo');

    let restoreArgs: string[] = [];

    if (isPostgres) {
      const user = envVars['POSTGRES_USER'] || 'postgres';
      const pass = envVars['POSTGRES_PASSWORD'] || '';
      const defaultDb = envVars['POSTGRES_DB'] || 'postgres';
      const targetDb = options?.databaseName?.trim() || (record.databaseName && record.databaseName !== 'all' ? record.databaseName : defaultDb);
      restoreArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', '-e', `PGPASSWORD=${pass}`, 'database', 'psql', '-U', user, '-d', targetDb];
    } else if (isMariaDB) {
      const user = envVars['MARIADB_USER'] || 'root';
      const pass = envVars['MARIADB_PASSWORD'] || envVars['MARIADB_ROOT_PASSWORD'] || '';
      const defaultDb = envVars['MARIADB_DATABASE'] || 'app_db';
      const targetDb = options?.databaseName?.trim() || (record.databaseName && record.databaseName !== 'all' ? record.databaseName : defaultDb);
      restoreArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'mariadb', '-u', user];
      if (pass) restoreArgs.push(`-p${pass}`);
      if (targetDb && targetDb !== 'all') restoreArgs.push(targetDb);
    } else if (isMySQL) {
      const user = envVars['MYSQL_USER'] || 'root';
      const pass = envVars['MYSQL_PASSWORD'] || envVars['MYSQL_ROOT_PASSWORD'] || '';
      const defaultDb = envVars['MYSQL_DATABASE'] || 'app_db';
      const targetDb = options?.databaseName?.trim() || (record.databaseName && record.databaseName !== 'all' ? record.databaseName : defaultDb);
      restoreArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'mysql', '-u', user];
      if (pass) restoreArgs.push(`-p${pass}`);
      if (targetDb && targetDb !== 'all') restoreArgs.push(targetDb);
    } else if (isMongo) {
      const user = envVars['MONGO_INITDB_ROOT_USERNAME'] || '';
      const pass = envVars['MONGO_INITDB_ROOT_PASSWORD'] || '';
      const defaultDb = envVars['MONGO_INITDB_DATABASE'] || 'app_db';
      const targetDb = options?.databaseName?.trim() || (record.databaseName && record.databaseName !== 'all' ? record.databaseName : defaultDb);
      restoreArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'mongorestore'];
      if (user && pass) {
        restoreArgs.push('-u', user, '-p', pass, '--authenticationDatabase', 'admin');
      }
      if (targetDb && targetDb !== 'all') {
        restoreArgs.push('-d', targetDb);
      }
      restoreArgs.push('--archive');
    } else {
      return { success: false, error: '此类型数据库暂不支持直接还原，请手动导入' };
    }

    return new Promise((resolve) => {
      const isGzip = localPath.endsWith('.gz');
      const readStream = fs.createReadStream(localPath);
      const child = spawn('docker', restoreArgs, { cwd: appDir, shell: true });

      if (isGzip) {
        const gunzip = zlib.createGunzip();
        readStream.pipe(gunzip).pipe(child.stdin);
      } else {
        readStream.pipe(child.stdin);
      }

      let stderr = '';
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: `数据库快照 ${record.fileName} 已成功导入恢复至容器！`,
          });
        } else {
          const cleanErr = stderr.trim() || `数据库导入退出码: ${code}。请确保容器处于运行状态。`;
          resolve({ success: false, error: cleanErr });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: `启动恢复失败: ${err.message}` });
      });
    });
  }

  /**
   * Restore database from uploaded file
   */
  public async restoreDatabaseFromFile(
    app: AppItem,
    filePath: string,
    options?: { databaseName?: string }
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const stats = fs.statSync(filePath);
    const syntheticRecord: BackupRecord = {
      id: `upload-${Date.now()}`,
      type: 'app_db',
      targetId: app.id,
      targetName: app.name,
      fileName: path.basename(filePath),
      fileSizeBytes: stats.size,
      databaseName: options?.databaseName || 'all',
      createdAt: new Date().toISOString(),
      status: 'completed',
    };
    return this.restoreDatabaseDump(syntheticRecord, filePath, options);
  }
}

export const r2BackupService = new R2BackupService();
