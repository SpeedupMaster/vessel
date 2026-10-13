import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { randomUUID } from 'node:crypto';
import { runDocker } from './process.js';
import { pipeline } from 'node:stream/promises';
import { PassThrough, Readable } from 'node:stream';
import { exportVolumes, importVolumes } from './volumeBackup.js';
import { validateCompose, validateDomain } from '../middleware/validation.js';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import YAML from 'yaml';
import { parse as parseEnv } from 'dotenv';
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

export function backupObjectKey(record: Pick<BackupRecord, 'type' | 'targetId' | 'fileName'>): string {
  const prefix = record.type === 'system' ? 'system' : `${record.type === 'app_db' ? 'databases' : 'apps'}/${record.targetId}`;
  return `${prefix}/${record.fileName}`;
}

export class R2BackupService {
  private databaseImage(app: AppItem, service: string): string {
    return String(YAML.parse(app.composeYaml)?.services?.[service]?.image || '').split('/').pop()!.toLowerCase();
  }

  private databaseService(app: AppItem): string {
    const services = YAML.parse(app.composeYaml)?.services || {};
    const candidates = Object.entries(services).filter(([, value]: [string, any]) => /(?:^|\/)(postgres|mysql|mariadb|mongo|redis)(?::|@|$)/i.test(value?.image || ''));
    if (candidates.length === 1) return candidates[0][0];
    if (services.database) return 'database';
    throw new Error('无法唯一确定数据库服务，请使用独立数据库应用');
  }

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
        output.on('error', reject);
      archive.on('error', (err) => reject(err));

      archive.pipe(output);
      if (fs.statSync(sourcePath).isDirectory()) {
        archive.directory(sourcePath, false);
      } else {
        archive.file(sourcePath, { name: path.basename(sourcePath) });
      }
      archive.finalize().catch(reject);
    });
  }

  /**
   * Run System Disaster Recovery Backup (Database + Compose files)
   */
  public async runSystemBackup(): Promise<{ success: boolean; record?: BackupRecord; error?: string }> {
    const r2Config = db.get('r2Config');
    const client = this.getS3Client(r2Config);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `vessel_system_${timestamp}_${randomUUID()}.zip`;
    const backupsDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const localZipPath = path.join(backupsDir, fileName);

    try {
      // Create zip of DATA_DIR excluding backups
      const sizeBytes = await new Promise<number>((resolve, reject) => {
        const output = fs.createWriteStream(localZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(archive.pointer()));
      output.on('error', reject);
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        const dbFile = path.join(DATA_DIR, 'vessel_db.json');
        if (fs.existsSync(dbFile)) {
          archive.file(dbFile, { name: 'vessel_db.json' });
        }
        if (fs.existsSync(APPS_DATA_DIR)) {
          archive.directory(APPS_DATA_DIR, 'apps');
        }
        archive.finalize().catch(reject);
      });

      let status: 'completed' | 'failed' = 'completed';

      // If R2 is enabled and configured, upload to Cloudflare R2
      if (client && r2Config.enabled && r2Config.bucketName) {
        await client.send(
          new PutObjectCommand({
            Bucket: r2Config.bucketName,
            Key: `system/${fileName}`,
            Body: fs.createReadStream(localZipPath),
            ContentType: 'application/zip',
          })
        );
      }

      const record: BackupRecord = {
        id: `sys-${randomUUID()}`,
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
      db.set('r2Config', { ...db.get('r2Config'), lastBackupAt: new Date().toISOString(), lastBackupStatus: 'success',
        lastBackupMessage: `Backup created (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)` });

      await this.enforceRetention(record);
      return { success: true, record };
    } catch (e: any) {
      db.set('r2Config', { ...db.get('r2Config'), lastBackupStatus: 'failed', lastBackupMessage: e.message });
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
    const fileName = `vessel_app_${app.id}_${timestamp}_${randomUUID()}.zip`;
    const backupsDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const localZipPath = path.join(backupsDir, fileName);
    const appDir = fs.mkdtempSync(path.join(backupsDir, 'app-stage-'));

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

      await exportVolumes(app, appDir);
      const sizeBytes = await this.createArchive(appDir, localZipPath);

      if (client && r2Config.enabled && r2Config.bucketName) {
        await client.send(
          new PutObjectCommand({
            Bucket: r2Config.bucketName,
            Key: `apps/${app.id}/${fileName}`,
            Body: fs.createReadStream(localZipPath),
            ContentType: 'application/zip',
          })
        );
      }

      const record: BackupRecord = {
        id: `app-${randomUUID()}`,
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

      await this.enforceRetention(record);
      return { success: true, record };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      fs.rmSync(appDir, { recursive: true, force: true });
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
    const databaseService = this.databaseService(app);
    const { composePath, appDir, envPath } = dockerService.prepareAppFiles(app);

    const envVars = parseEnv(app.envContent || '');
    const yamlLower = this.databaseImage(app, databaseService);
    const isPostgres = yamlLower.includes('postgres');
    const isMariaDB = yamlLower.includes('mariadb');
    const isMySQL = !isMariaDB && yamlLower.includes('mysql');
    const isMongo = yamlLower.includes('mongo');
    const isRedis = yamlLower.includes('redis');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = isMongo ? 'archive.gz' : isRedis ? 'rdb.gz' : 'sql.gz';
    const dbTag = targetDb === 'all' ? 'all' : targetDb.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `vessel_db_${app.id}_${dbTag}_${timestamp}_${randomUUID()}.${ext}`;
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
      const saveArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T'];
      if (envVars.REDIS_PASSWORD) saveArgs.push('-e', `REDISCLI_AUTH=${envVars.REDIS_PASSWORD}`);
      saveArgs.push(databaseService, 'redis-cli', 'SAVE');
      const saved = await runDocker(saveArgs, { cwd: appDir });
      if (saved.stdout.trim() !== 'OK') return { success: false, error: 'Redis SAVE failed: ' + saved.stdout };
      dumpArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', databaseService, 'cat', '/data/dump.rdb'];
    } else {
      return { success: false, error: '此数据库不支持逻辑导出，请使用应用数据卷备份' };
    }

    const dumpServiceIndex = dumpArgs.indexOf('database', dumpArgs.indexOf('exec') + 1);
    if (dumpServiceIndex !== -1) dumpArgs[dumpServiceIndex] = databaseService;

    try {
      const gzip = zlib.createGzip();
      const sink = fs.createWriteStream(localGzPath);
      const written = pipeline(gzip, sink);
      const dumped = runDocker(dumpArgs, { cwd: appDir, output: gzip, timeout: 30 * 60 * 1000 });
      await Promise.all([dumped, written]);
      const sizeBytes = fs.statSync(localGzPath).size;
      const r2Config = db.get('r2Config');
      const client = this.getS3Client(r2Config);
      const record: BackupRecord = {
        id: `db-${randomUUID()}`, type: 'app_db', targetId: app.id,
        targetName: `${app.name} (${targetDb})`, fileName, fileSizeBytes: sizeBytes,
        createdAt: new Date().toISOString(), status: 'completed', databaseName: targetDb,
      };
      if (client && r2Config.bucketName) {
        await client.send(new PutObjectCommand({ Bucket: r2Config.bucketName, Key: backupObjectKey(record),
          Body: fs.createReadStream(localGzPath), ContentType: 'application/gzip' }));
      }
      db.set('backups', [record, ...db.get('backups')]);
      await this.enforceRetention(record);
      return { success: true, record };
    } catch (error: any) {
      fs.rmSync(localGzPath, { force: true });
      return { success: false, error: error.message };
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
          backupObjectKey(record);
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
        backupObjectKey(record);
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: r2Config.bucketName,
            Key: key,
          })
        );
      } catch (err: any) {
        return { success: false, error: `R2 删除失败，保留本地备份与记录以便重试: ${err.message}` };
      }
    }

    // Delete local file
    const localPath = path.join(DATA_DIR, 'backups', record.fileName);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (error: any) {
        return { success: false, error: `本地备份删除失败，保留记录以便重试: ${error.message}` };
      }
    }

    // Update DB
    db.set(
      'backups',
      db.get('backups').filter((b) => b.id !== id)
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
            backupObjectKey(record);
          const res = await client.send(
            new GetObjectCommand({
              Bucket: r2Config.bucketName,
              Key: key,
            })
          );
          if (res.Body) {
            if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
            const partialPath = localPath + '.partial';
            try {
              await pipeline(res.Body as Readable, fs.createWriteStream(partialPath));
              fs.renameSync(partialPath, localPath);
            } finally { fs.rmSync(partialPath, { force: true }); }
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

    if (record.type !== 'system') {
      const existing = db.get('apps').find(app => app.id === record.targetId);
      const app: AppItem = existing || {
        id: record.targetId, name: record.targetName, description: '', composeYaml: '', envContent: '',
        autoUpdate: false, status: 'stopped', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), containers: [],
      };
      return this.restoreAppFromFile(app, localPath);
    }
    const stage = fs.mkdtempSync(path.join(DATA_DIR, 'restore-system-'));
    const databasePath = path.join(DATA_DIR, 'vessel_db.json');
    const previousDatabase = fs.readFileSync(databasePath);
    const changedApps: { destination: string; rollback: string; existed: boolean }[] = [];
    let databaseReplaced = false;
    let preserveRecovery = false;
    try {
      this.extractValidatedZip(localPath, stage);
      const restored = JSON.parse(fs.readFileSync(path.join(stage, 'vessel_db.json'), 'utf8'));
      if (!Array.isArray(restored.apps) || !Array.isArray(restored.domains)) throw new Error('Invalid system snapshot');
      const restoredIds = new Set<string>();
      for (const app of restored.apps) {
        if (!app || typeof app.id !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(app.id) || restoredIds.has(app.id.toLowerCase())) throw new Error('Invalid or duplicate application ID');
        restoredIds.add(app.id.toLowerCase());
        validateCompose(app.composeYaml);
      }
      for (const domain of restored.domains) {
        validateDomain(domain.domain);
        if (!Number.isInteger(domain.targetPort) || domain.targetPort < 1 || domain.targetPort > 65535 ||
          !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(domain.serviceName)) throw new Error('Invalid domain target');
      }
      restored.admin = db.get('admin');
      restored.backups = db.get('backups');
      const rollbackDirectory = fs.mkdtempSync(path.join(stage, 'rollback-'));
      // Restore build contexts and support files as well as generated Compose/.env files.
      for (const app of restored.apps) {
        const destination = path.join(APPS_DATA_DIR, app.id);
        const rollback = path.join(rollbackDirectory, app.id);
        const existed = fs.existsSync(destination);
        if (existed) fs.cpSync(destination, rollback, { recursive: true });
        changedApps.push({ destination, rollback, existed });
        const archivedApp = path.join(stage, 'apps', app.id);
        if (fs.existsSync(archivedApp)) {
          fs.cpSync(archivedApp, destination, { recursive: true });
        }
        dockerService.prepareAppFiles(app);
      }
      fs.copyFileSync(databasePath, databasePath + '.before-restore');
      const temporary = databasePath + '.restore';
      fs.writeFileSync(temporary, JSON.stringify(restored, null, 2), { mode: 0o600 });
      fs.renameSync(temporary, databasePath);
      databaseReplaced = true;
      db.reload();
      caddyService.syncCaddyfile();
      return { success: true, message: '系统配置快照已恢复；管理员凭据保持不变，应用卷数据需从应用备份单独恢复。' };
    } catch (error: any) {
      const failures: string[] = [];
      for (const item of changedApps.reverse()) {
        try {
          fs.rmSync(item.destination, { recursive: true, force: true });
          if (item.existed) fs.cpSync(item.rollback, item.destination, { recursive: true });
        } catch (rollbackError) { failures.push(String(rollbackError)); }
      }
      if (databaseReplaced) {
        try {
          fs.writeFileSync(databasePath + '.restore', previousDatabase, { mode: 0o600 });
          fs.renameSync(databasePath + '.restore', databasePath);
          db.reload();
          caddyService.syncCaddyfile();
        } catch (rollbackError) { failures.push(String(rollbackError)); }
      }
      preserveRecovery = failures.length > 0;
      return { success: false, error: `恢复失败: ${error.message}${preserveRecovery ? `；回滚失败，原文件保留在 ${stage} 与 ${databasePath}.before-restore: ${failures.join('; ')}` : ''}` };
    } finally { if (!preserveRecovery) fs.rmSync(stage, { recursive: true, force: true }); }
  }

  private extractValidatedZip(file: string, directory: string): void {
    const zip = new AdmZip(file);
    let size = 0;
    for (const entry of zip.getEntries()) {
      const name = entry.entryName.replaceAll(String.fromCharCode(92), '/');
      size += entry.header.size;
      if (name.startsWith('/') || name.split('/').includes('..') || name.includes(':') ||
          ((entry.header.attr >>> 16) & 0xf000) === 0xa000 || size > 20 * 1024 ** 3) throw new Error('Unsafe or oversized archive');
    }
    zip.extractAllTo(directory, false);
  }

  /**
   * Enforce retention limits on older backups
   */
  private async enforceRetention(record: BackupRecord): Promise<void> {
    const app = db.get('apps').find(item => item.id === record.targetId);
    const maxKeep = app?.backupSchedule?.retentionCount || db.get('r2Config').retentionCount || 7;
    const expired = db.get('backups').filter(item => item.targetId === record.targetId && item.type === record.type &&
      (record.type !== 'app_db' || (item.databaseName || 'all') === (record.databaseName || 'all')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(maxKeep);
    for (const item of expired) {
      const result = await this.deleteBackup(item.id);
      if (!result.success) console.warn(`[Retention] ${result.error}`);
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
    const databaseService = this.databaseService(app);

    const { composePath, appDir, envPath } = dockerService.prepareAppFiles(app);
    const envVars = parseEnv(app.envContent || '');
    const yamlLower = this.databaseImage(app, databaseService);
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
      restoreArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', '-e', `PGPASSWORD=${pass}`, 'database', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', targetDb];
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
      const sourceDb = record.databaseName || 'all';
      const targetDb = options?.databaseName?.trim() || sourceDb;
      if (sourceDb === 'all' && targetDb !== 'all') {
        return { success: false, error: '完整 MongoDB 归档必须恢复全部数据库；请清空目标数据库或填写 all' };
      }
      restoreArgs = ['compose', '-f', composePath, '--env-file', envPath, 'exec', '-T', 'database', 'mongorestore'];
      if (user && pass) {
        restoreArgs.push('-u', user, '-p', pass, '--authenticationDatabase', 'admin');
      }
      if (sourceDb !== 'all') {
        restoreArgs.push('--nsInclude', `${sourceDb}.*`);
        if (targetDb !== 'all' && targetDb !== sourceDb) {
          restoreArgs.push('--nsFrom', `${sourceDb}.*`, '--nsTo', `${targetDb}.*`);
        }
      }
      restoreArgs.push('--archive', '--stopOnError');
    } else {
      return { success: false, error: '此类型数据库暂不支持直接还原，请手动导入' };
    }

    const restoreServiceIndex = restoreArgs.indexOf('database', restoreArgs.indexOf('exec') + 1);
    if (restoreServiceIndex !== -1) restoreArgs[restoreServiceIndex] = databaseService;
    try {
      const source = fs.createReadStream(localPath);
      const input = localPath.endsWith('.gz') ? zlib.createGunzip() : new PassThrough();
      const read = pipeline(source, input);
      const restored = runDocker(restoreArgs, { cwd: appDir, input, timeout: 30 * 60 * 1000 });
      await Promise.all([read, restored]);
      return { success: true, message: `数据库快照 ${record.fileName} 已成功导入恢复至容器！` };
    } catch (error: any) {
      return { success: false, error: `恢复失败: ${error.message}` };
    }
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

  /**
   * Restore application from uploaded zip file (Compose, .env, volumes)
   */
  public async restoreAppFromFile(
    app: AppItem,
    filePath: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const stage = fs.mkdtempSync(path.join(DATA_DIR, 'restore-app-'));
    let preserveRecovery = false;
    try {
      this.extractValidatedZip(filePath, stage);
      const metadataPath = path.join(stage, 'app_metadata.json');
      const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : {};
      const compose = fs.existsSync(path.join(stage, 'docker-compose.yml'))
        ? fs.readFileSync(path.join(stage, 'docker-compose.yml'), 'utf8') : metadata.composeYaml;
      validateCompose(compose);
      const restored: AppItem = { ...app, name: typeof metadata.name === 'string' ? metadata.name : app.name,
        description: typeof metadata.description === 'string' ? metadata.description : app.description,
        composeYaml: compose, envContent: fs.existsSync(path.join(stage, '.env')) ? fs.readFileSync(path.join(stage, '.env'), 'utf8') : '',
        updatedAt: new Date().toISOString() };
      const hasVolumes = fs.existsSync(path.join(stage, 'volumes.json'));
      if (hasVolumes) await importVolumes(restored, stage);
      dockerService.prepareAppFiles(restored);
      if (!db.updateApp(app.id, restored)) db.set('apps', [...db.get('apps'), restored]);
      if (hasVolumes) await dockerService.syncAppContainers(app.id);
      return { success: true, message: hasVolumes ? `应用 ${app.name} 的配置与数据卷已恢复` : `应用 ${app.name} 的配置已恢复；此旧版备份不包含 Docker 数据卷` };
    } catch (error: any) {
      preserveRecovery = !!error.preserveRecovery;
      if (app.composeYaml) dockerService.prepareAppFiles(app);
      return { success: false, error: `从备份恢复失败: ${error.message}` };
    } finally { if (!preserveRecovery) fs.rmSync(stage, { recursive: true, force: true }); }
  }
}

export const r2BackupService = new R2BackupService();
