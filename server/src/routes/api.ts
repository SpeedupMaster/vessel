import { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { checkedRouter, validateRequest, apiErrorHandler, BadRequest } from '../middleware/validation.js';
import { assertAppIdle, withAppLock, appEvents } from '../services/appOperations.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import { DATA_DIR, db } from '../db/index.js';
import { dockerService } from '../services/docker.js';
import { caddyService } from '../services/caddy.js';
import { r2BackupService } from '../services/r2Backup.js';
import { registryService } from '../services/registry.js';
import { cleanerService } from '../services/cleaner.js';
import { schedulerService } from '../services/scheduler.js';
import { authService } from '../services/auth.js';
import { requireAuth, requirePasswordChanged, loginRateLimit, AuthenticatedRequest } from '../middleware/auth.js';
import { wsHub } from '../ws/wsHub.js';
import { AppItem, DomainItem, R2Config, RegistryItem, MaintenanceConfig } from '../types/index.js';

export const apiRouter = checkedRouter();

// ======================= AUTH =======================
apiRouter.get('/auth/status', (_req: Request, res: Response) => {
  res.json({
    initialized: true,
    isDefaultPassword: authService.isDefaultPassword(),
  });
});

apiRouter.post('/auth/login', loginRateLimit, (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const result = authService.login(username, password);
  if (!result.success) {
    return res.status(401).json({ error: result.error });
  }
  res.json({
    success: true,
    token: result.token,
    user: { username: result.username },
    isDefaultPassword: result.isDefaultPassword,
  });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.json({ authenticated: false, user: null, isDefaultPassword: false });
  }

  const result = authService.verifyToken(token);
  if (!result.valid || !result.username) {
    return res.json({ authenticated: false, user: null, isDefaultPassword: false });
  }

  res.json({
    authenticated: true,
    user: { username: result.username },
    isDefaultPassword: authService.isDefaultPassword(),
  });
});

apiRouter.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  const result = authService.changePassword(currentPassword, newPassword);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({
    success: true,
    token: result.token,
    isDefaultPassword: false,
    message: '密码修改成功',
  });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: '已安全登出' });
});

// All management endpoints are private by default.
apiRouter.use(requireAuth, requirePasswordChanged, validateRequest);
apiRouter.use((req, _res, next) => {
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) assertAppIdle('*');
    next();
  } catch (error) { next(error); }
});

function checkDomainBinding(domain: string, appId: string, exceptId?: string) {
  if (appId !== 'vessel-system' && !db.get('apps').some(app => app.id === appId)) {
    throw new BadRequest('关联的应用不存在');
  }
  if (db.get('domains').some(item => item.id !== exceptId && item.domain.toLowerCase() === domain.toLowerCase())) {
    throw new BadRequest('该域名已绑定，请编辑现有记录');
  }
}

// ======================= SYSTEM =======================
apiRouter.get('/system/status', async (req: Request, res: Response) => {
  const daemon = await dockerService.checkDaemon();
  res.json({
    dockerAvailable: daemon.available,
    dockerVersion: daemon.version || null,
    dockerError: daemon.error || null,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ======================= APPS =======================
apiRouter.get('/apps', async (req: Request, res: Response) => {
  const apps = db.get('apps') || [];
  res.json(apps);
});

apiRouter.get('/apps/:id', async (req: Request, res: Response) => {
  const apps = db.get('apps') || [];
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  res.json(app);
});

apiRouter.post('/apps', requireAuth, async (req: Request, res: Response) => {
  const { name, description, composeYaml, envContent, autoUpdate, domainBinding } = req.body;
  if (!name || !composeYaml) {
    return res.status(400).json({ error: 'Name and composeYaml are required' });
  }

  try {
    YAML.parse(composeYaml);
  } catch (err: any) {
    return res.status(400).json({ error: `Invalid Docker Compose YAML: ${err.message}` });
  }

  const customId = req.body.id;
  if (customId && !/^[a-z0-9][a-z0-9_-]*$/i.test(customId)) throw new BadRequest('Invalid application ID');
  const id = (customId && typeof customId === 'string' && /^[a-z0-9_-]+$/i.test(customId))
    ? customId.toLowerCase()
    : (name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 32) || 'app') + '-' + uuidv4().slice(0, 8);
  const newApp: AppItem = {
    id,
    name,
    description: description || '',
    status: 'stopped',
    composeYaml,
    envContent: envContent || '',
    autoUpdate: !!autoUpdate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    containers: [],
  };

  const apps = db.get('apps') || [];
  if (apps.some(app => app.id === id)) return res.status(409).json({ error: 'App ID already exists' });
  assertAppIdle(id);
  if (domainBinding && db.get('domains').some(item => item.domain.toLowerCase() === domainBinding.domain.toLowerCase())) {
    throw new BadRequest('该域名已绑定，请编辑现有记录');
  }
  dockerService.prepareAppFiles(newApp);
  db.set('apps', [...apps, newApp]);

  // If domainBinding is provided, bind domain immediately and sync Caddy
  if (domainBinding && domainBinding.domain && domainBinding.targetPort) {
    const cleanDomain = String(domainBinding.domain).trim().toLowerCase();
    const newDomain: DomainItem = {
      id: uuidv4(),
      domain: cleanDomain,
      appId: id,
      serviceName: domainBinding.serviceName || 'web',
      targetPort: Number(domainBinding.targetPort),
      targetType: domainBinding.targetType === 'host' ? 'host' : 'internal',
      sslStatus: 'unknown',
      sslIssuer: '未知',
      createdAt: new Date().toISOString(),
    };

    db.set('domains', [...db.get('domains'), newDomain]);
    caddyService.syncCaddyfile();
  }

  res.status(201).json(newApp);
});

apiRouter.put('/apps/:id', requireAuth, async (req: Request, res: Response) => {
  assertAppIdle(String(req.params.id));
  const apps = db.get('apps') || [];
  const idx = apps.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'App not found' });

  const { name, description, composeYaml, envContent, autoUpdate } = req.body;
  if (composeYaml) {
    try {
      YAML.parse(composeYaml);
    } catch (err: any) {
      return res.status(400).json({ error: `Invalid Docker Compose YAML: ${err.message}` });
    }
  }

  const updatedApp: AppItem = {
    ...apps[idx],
    name: name ?? apps[idx].name,
    description: description ?? apps[idx].description,
    composeYaml: composeYaml ?? apps[idx].composeYaml,
    envContent: envContent ?? apps[idx].envContent,
    autoUpdate: autoUpdate !== undefined ? !!autoUpdate : apps[idx].autoUpdate,
    updatedAt: new Date().toISOString(),
  };

  dockerService.prepareAppFiles(updatedApp);
  db.updateApp(updatedApp.id, updatedApp);
  schedulerService.reload();
  appEvents.emit('changed', String(req.params.id));
  res.json(updatedApp);
});

apiRouter.delete('/apps/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await withAppLock(id, async () => {
    const app = db.get('apps').find(item => item.id === id);
    if (!app) { res.status(404).json({ error: 'App not found' }); return; }
    const result = await dockerService.stopApp(app);
    if (!result.success) throw new Error(result.error || 'Failed to stop application');
    db.set('apps', db.get('apps').filter(item => item.id !== id));
    db.set('domains', db.get('domains').filter(domain => domain.appId !== id));
    caddyService.syncCaddyfile();
    schedulerService.reload();
    res.json({ success: true, message: 'App deleted' });
  });
});

const lifecycleActions = {
  deploy: (app: AppItem, log: (text: string) => void) => dockerService.deployApp(app, log),
  stop: (app: AppItem, log: (text: string) => void) => dockerService.stopApp(app, log),
  restart: (app: AppItem, log: (text: string) => void) => dockerService.restartApp(app, log),
  rebuild: (app: AppItem, log: (text: string) => void) => dockerService.pullAndRebuild(app, log),
  'fresh-volumes': (app: AppItem, log: (text: string) => void) => dockerService.freshVolumesRebuild(app, log),
};
for (const action of Object.keys(lifecycleActions) as (keyof typeof lifecycleActions)[]) {
  apiRouter.post(`/apps/:id/${action}`, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    assertAppIdle(id);
    const app = db.get('apps').find(item => item.id === id);
    if (!app) return res.status(404).json({ error: 'App not found' });
    const asynchronous = ['deploy', 'rebuild', 'fresh-volumes'].includes(action);
    const task = withAppLock(id, async () => {
      db.updateApp(id, { status: action === 'deploy' ? 'deploying' : 'rebuilding' });
      appEvents.emit('changed', id);
      try {
        const result = await lifecycleActions[action](app, text => wsHub.broadcastLog(id, text));
        if (!result.success) throw new Error(result.error || 'Docker operation failed');
        if (action !== 'stop') await registryService.captureAppDigest(app);
        db.updateApp(id, {
          ...(action === 'stop' ? { status: 'stopped' as const } : {}),
          ...(['deploy', 'rebuild', 'fresh-volumes'].includes(action) ? { lastDeployedAt: new Date().toISOString(), updateAvailable: false } : {}),
        });
        return result;
      } catch (error) {
        db.updateApp(id, { status: 'error' });
        throw error;
      }
    });
    if (asynchronous) {
      task.catch(error => { console.error('[App operation]', error); wsHub.broadcastLog(id, `[vessel] ${error.message}`); });
      res.status(202).json({ message: 'Operation started', appId: id });
    } else {
      await task;
      res.json({ success: true, app: db.get('apps').find(item => item.id === id) });
    }
  });
}

apiRouter.get('/apps/:id/logs', async (req: Request, res: Response) => {
  const apps = db.get('apps') || [];
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const service = req.query.service as string | undefined;
  const tail = req.query.tail ? parseInt(req.query.tail as string, 10) : 100;
  const logs = await dockerService.getAppLogs(app, {
    service,
    tail: isNaN(tail) ? 100 : tail,
    timestamps: true,
  });

  res.json({ logs });
});

apiRouter.post('/apps/:id/backup', requireAuth, async (req: Request, res: Response) => {
  const apps = db.get('apps') || [];
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });

  assertAppIdle(app.id);
  const { databaseName, schedule, runNow = true } = req.body || {};

  // If a schedule was provided, save it to the app and reload scheduler
  if (schedule !== undefined) {
    app.backupSchedule = {
      enabled: !!schedule.enabled,
      cronSchedule: schedule.cronSchedule || '0 2 * * *',
      targetDatabase: schedule.targetDatabase || databaseName || 'all',
      retentionCount: schedule.retentionCount ? Number(schedule.retentionCount) : 7,
      lastBackupAt: app.backupSchedule?.lastBackupAt,
      lastBackupStatus: app.backupSchedule?.lastBackupStatus,
    };
    db.set('apps', [...apps]);
    schedulerService.reload();
  }

  // If only saving schedule without running backup now
  if (runNow === false) {
    return res.json({
      success: true,
      message: '定时自动备份配置已保存',
      schedule: app.backupSchedule,
    });
  }

  const yamlLower = (app.composeYaml || '').toLowerCase();
  const desc = (app.description || '').toLowerCase();
  const name = (app.name || '').toLowerCase();

  const isDb =
    desc.includes('database') ||
    yamlLower.includes('database:') ||
    name.endsWith('-db') ||
    name.startsWith('postgres') ||
    name.startsWith('mysql') ||
    name.startsWith('mariadb') ||
    name.startsWith('mongo') ||
    name.startsWith('redis') ||
    name.startsWith('libsql');

  const result = await withAppLock(app.id, () => isDb
    ? r2BackupService.runDatabaseBackup(app, { databaseName })
    : r2BackupService.runAppBackup(app));

  if (result.success) {
    res.json({ success: true, record: result.record, schedule: app.backupSchedule });
  } else {
    res.status(500).json({ error: result.error });
  }
});

apiRouter.get('/apps/:id/databases', async (req: Request, res: Response) => {
  const apps = db.get('apps') || [];
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const databases = await dockerService.listDatabasesInApp(app);
  res.json({ databases });
});

apiRouter.post('/apps/:id/exec', requireAuth, async (req: Request, res: Response) => {
  const apps = db.get('apps') || [];
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });

  const { command, mode, service } = req.body;
  if (typeof command !== 'string') {
    return res.status(400).json({ error: 'Command string is required' });
  }

  const result = await withAppLock(app.id, () => dockerService.execInApp(app, { command, mode, service }));
  res.json(result);
});

// ======================= DOMAINS & SSL =======================
apiRouter.get('/domains', async (req: Request, res: Response) => {
  await caddyService.refreshCertificateStatuses();
  const domains = db.get('domains') || [];
  res.json(domains);
});

apiRouter.post('/domains', requireAuth, async (req: Request, res: Response) => {
  const { domain, appId, serviceName, targetPort, targetType } = req.body;
  if (!domain || !appId || !targetPort) {
    return res.status(400).json({ error: 'domain, appId, and targetPort are required' });
  }

  checkDomainBinding(domain, appId);
  const newDomain: DomainItem = {
    id: uuidv4(),
    domain: domain.trim().toLowerCase(),
    appId,
    serviceName: serviceName || 'web',
    targetPort: Number(targetPort),
    targetType: targetType === 'host' ? 'host' : 'internal',
    sslStatus: 'unknown',
    sslIssuer: '未知',
    createdAt: new Date().toISOString(),
  };

  db.set('domains', [...db.get('domains'), newDomain]);

  caddyService.syncCaddyfile();
  res.status(201).json(newDomain);
});

apiRouter.put('/domains/:id', requireAuth, async (req: Request, res: Response) => {
  const { domain, appId, serviceName, targetPort, targetType } = req.body;
  const domains = db.get('domains') || [];
  const index = domains.findIndex((d) => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Domain not found' });
  }

  const existing = domains[index];
  const cleanDomain = domain ? String(domain).trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '') : existing.domain;
  if (!cleanDomain) {
    return res.status(400).json({ error: 'Domain name cannot be empty' });
  }
  checkDomainBinding(cleanDomain, appId || existing.appId, existing.id);

  let sslStatus = existing.sslStatus;
  let sslIssuer = existing.sslIssuer;
  let sslExpiresAt = existing.sslExpiresAt;
  if (cleanDomain !== existing.domain) {
    sslStatus = 'unknown';
    sslIssuer = '未知';
    sslExpiresAt = undefined;
  }

  const updatedDomain: DomainItem = {
    ...existing,
    domain: cleanDomain,
    appId: appId || existing.appId,
    serviceName: serviceName !== undefined ? serviceName : existing.serviceName,
    targetPort: targetPort !== undefined ? Number(targetPort) : existing.targetPort,
    targetType: targetType !== undefined ? (targetType === 'host' ? 'host' : 'internal') : existing.targetType,
    sslStatus,
    sslIssuer,
    sslExpiresAt,
  };

  db.set('domains', domains.map(item => item.id === updatedDomain.id ? updatedDomain : item));
  caddyService.syncCaddyfile();

  res.json(updatedDomain);
});

apiRouter.delete('/domains/:id', requireAuth, (req: Request, res: Response) => {
  const domains = db.get('domains') || [];
  const updated = domains.filter((d) => d.id !== req.params.id);
  db.set('domains', updated);
  caddyService.syncCaddyfile();
  res.json({ success: true, message: 'Domain deleted' });
});

apiRouter.post('/domains/:id/renew', requireAuth, async (req: Request, res: Response) => {
  const domains = db.get('domains') || [];
  const domain = domains.find((d) => d.id === req.params.id);
  if (!domain) return res.status(404).json({ error: 'Domain not found' });

  domain.sslStatus = 'issuing';
  db.set('domains', [...domains]);

  const cert = await caddyService.checkCertStatus(domain.domain);
  domain.sslStatus = cert.status;
  domain.sslIssuer = cert.issuer;
  domain.sslExpiresAt = cert.expiresAt;
  db.set('domains', db.get('domains').map(current => current.id === domain.id && current.domain === domain.domain ? { ...current, sslStatus: cert.status, sslIssuer: cert.issuer, sslExpiresAt: cert.expiresAt } : current));

  res.json(db.get('domains').find(current => current.id === domain.id));
});

// ======================= CLOUDFLARE R2 BACKUPS =======================
apiRouter.get('/r2/config', (req: Request, res: Response) => {
  const config = db.get('r2Config');
  res.json({
    ...config,
    secretAccessKey: config.secretAccessKey ? '••••••••••••••••' : '',
  });
});

apiRouter.post('/r2/config', requireAuth, (req: Request, res: Response) => {
  const current = db.get('r2Config');
  const { enabled, endpoint, bucketName, accessKeyId, secretAccessKey, cronSchedule, retentionCount } = req.body;

  const updated: R2Config = {
    enabled: enabled !== undefined ? !!enabled : current.enabled,
    endpoint: endpoint ?? current.endpoint,
    bucketName: bucketName ?? current.bucketName,
    accessKeyId: accessKeyId ?? current.accessKeyId,
    secretAccessKey: secretAccessKey && !secretAccessKey.includes('••') ? secretAccessKey : current.secretAccessKey,
    cronSchedule: cronSchedule ?? current.cronSchedule,
    retentionCount: retentionCount ? Number(retentionCount) : current.retentionCount,
    lastBackupStatus: current.lastBackupStatus,
    lastBackupAt: current.lastBackupAt,
    lastBackupMessage: current.lastBackupMessage,
  };

  db.set('r2Config', updated);
  schedulerService.reload();
  res.json({ success: true, config: { ...updated, secretAccessKey: '••••••••••••••••' } });
});

apiRouter.post('/r2/test', requireAuth, async (req: Request, res: Response) => {
  const current = db.get('r2Config');
  const payload = req.body;
  const configToTest: R2Config = {
    ...current,
    ...payload,
    secretAccessKey: payload.secretAccessKey && !payload.secretAccessKey.includes('••')
      ? payload.secretAccessKey
      : current.secretAccessKey,
  };

  const result = await r2BackupService.testConnection(configToTest);
  res.json(result);
});

apiRouter.get('/r2/backups', (req: Request, res: Response) => {
  const backups = db.get('backups') || [];
  res.json(backups);
});

apiRouter.get('/r2/backups/:id/download', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await r2BackupService.getBackupDownload(id);
  if (!result) {
    return res.status(404).json({ error: '备份文件不存在或已被清除' });
  }

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`);
  res.setHeader('Content-Type', result.fileName.endsWith('.gz') ? 'application/gzip' : 'application/zip');
  if (result.contentLength) {
    res.setHeader('Content-Length', result.contentLength);
  }
  await pipeline(result.stream, res);
});

apiRouter.delete('/r2/backups/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const record = db.get('backups').find(item => item.id === id);
  if (!record) return res.status(404).json({ error: 'Backup not found' });
  const result = await withAppLock(record.type === 'system' ? '*' : record.targetId, () => r2BackupService.deleteBackup(id));
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json({ success: true });
});

apiRouter.post('/r2/backups/:id/restore', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { databaseName } = req.body || {};
  const record = db.get('backups').find(item => item.id === id);
  if (!record) return res.status(404).json({ error: 'Backup not found' });
  const result = await withAppLock(record.type === 'system' ? '*' : record.targetId, () => r2BackupService.restoreBackup(id, { databaseName }));
  if (result.success) schedulerService.reload();
  if (!result.success) {
    return res.status(500).json({ error: result.error });
  }
  res.json({ success: true, message: result.message });
});

apiRouter.post('/apps/:id/restore-file', requireAuth, async (req: Request, res: Response) => {
  const apps = db.get('apps') || [];
  const app = apps.find((a) => a.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });

  if (req.query.filename !== undefined && typeof req.query.filename !== 'string') throw new BadRequest('Invalid filename');
  if (req.query.databaseName !== undefined && typeof req.query.databaseName !== 'string') throw new BadRequest('Invalid databaseName');
  const fileName = (req.query.filename as string) || 'upload.sql';
  const databaseName = req.query.databaseName as string;
  const tempDir = path.join(DATA_DIR, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempFilePath = path.join(tempDir, `${uuidv4()}_${path.basename(fileName).toLowerCase()}`);

  await withAppLock(app.id, async () => {
    let bytes = 0;
    const limit = new Transform({ transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > 2 * 1024 ** 3 ? new BadRequest('上传文件不能超过 2 GiB') : null, chunk);
    } });
    try {
      await pipeline(req, limit, fs.createWriteStream(tempFilePath, { flags: 'wx' }));
      if (!bytes) throw new BadRequest('备份文件为空');
      const result = fileName.toLowerCase().endsWith('.zip')
        ? await r2BackupService.restoreAppFromFile(app, tempFilePath)
        : await r2BackupService.restoreDatabaseFromFile(app, tempFilePath, { databaseName });
      if (!result.success) return res.status(500).json({ error: result.error });
      schedulerService.reload();
      res.json({ success: true, message: result.message });
    } finally { fs.rmSync(tempFilePath, { force: true }); }
  });
});

apiRouter.post('/r2/backup-now', requireAuth, async (req: Request, res: Response) => {
  const result = await withAppLock('*', () => r2BackupService.runSystemBackup());
  if (result.success) {
    res.json({ success: true, record: result.record });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// ======================= REGISTRIES & GHCR =======================
apiRouter.get('/registries', (req: Request, res: Response) => {
  const registries = db.get('registries') || [];
  res.json(
    registries.map((r) => ({
      ...r,
      token: r.token ? '••••••••••••••••' : '',
    }))
  );
});

apiRouter.post('/registries', requireAuth, (req: Request, res: Response) => {
  const { id, name, server, username, token } = req.body;
  if (!id || !server) return res.status(400).json({ error: 'id and server are required' });

  const list = db.get('registries') || [];
  const idx = list.findIndex((r) => r.id === id);

  const regItem: RegistryItem = {
    id,
    name: name || id,
    server,
    username: username || '',
    token: token && !token.includes('••') ? token : idx !== -1 ? list[idx].token : '',
    status: idx !== -1 ? list[idx].status : 'unverified',
    lastTestedAt: idx !== -1 ? list[idx].lastTestedAt : undefined,
  };

  if (idx !== -1) {
    list[idx] = regItem;
  } else {
    list.push(regItem);
  }

  db.set('registries', [...list]);
  res.json({ success: true, registry: { ...regItem, token: '••••••••••••••••' } });
});

apiRouter.post('/registries/:id/test', requireAuth, async (req: Request, res: Response) => {
  const list = db.get('registries') || [];
  const reg = list.find((r) => r.id === req.params.id);
  if (!reg) return res.status(404).json({ error: 'Registry not found' });

  const result = await registryService.testAndLogin(reg);
  res.json(result);
});

// ======================= MAINTENANCE & CLEANER =======================
apiRouter.get('/maintenance/config', (req: Request, res: Response) => {
  const cfg = db.get('maintenance');
  res.json(cfg);
});

apiRouter.post('/maintenance/config', requireAuth, (req: Request, res: Response) => {
  const current = db.get('maintenance');
  const updated: MaintenanceConfig = {
    ...current,
    ...req.body,
  };
  db.set('maintenance', updated);
  schedulerService.reload();
  res.json(updated);
});

apiRouter.post('/maintenance/check-updates', requireAuth, async (req: Request, res: Response) => {
  await schedulerService.runUpdateCheck();
  const apps = db.get('apps') || [];
  const updatesCount = apps.filter((a) => a.updateAvailable).length;
  res.json({
    success: true,
    message: `Inspection completed. ${updatesCount} applications have newer image versions.`,
    apps,
  });
});

apiRouter.post('/maintenance/prune', requireAuth, async (req: Request, res: Response) => {
  const result = await cleanerService.runSafePrune();
  res.json(result);
});

apiRouter.get('/maintenance/disk-usage', async (req: Request, res: Response) => {
  const usage = await dockerService.getDiskUsage();
  res.json(usage);
});

apiRouter.use(apiErrorHandler);
