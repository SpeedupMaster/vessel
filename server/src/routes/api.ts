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
import { MIN_PASSPHRASE_LENGTH, isEncryptedBackup } from '../services/backupCrypto.js';
import { registryService } from '../services/registry.js';
import { cleanerService } from '../services/cleaner.js';
import { schedulerService } from '../services/scheduler.js';
import { authService } from '../services/auth.js';
import { requireAuth, requirePasswordChanged, loginRateLimit, AuthenticatedRequest } from '../middleware/auth.js';
import { wsHub } from '../ws/wsHub.js';
import { deploymentService, newWebhookToken } from '../services/deployments.js';
import { selfUpdateService } from '../services/selfUpdate.js';
import { notifier, maskChannel, isMasked, CHANNEL_TYPES, NOTIFICATION_EVENTS } from '../services/notifier.js';
import { timingSafeEqual, generateKeyPairSync, sign } from 'node:crypto';
import { AppItem, DomainItem, R2Config, RegistryItem, MaintenanceConfig, AppDeploySettings, DeploymentAction, DeploymentRecord, DeploymentTrigger, NotificationChannel } from '../types/index.js';

export const apiRouter = checkedRouter();

/** Start a recorded deployment in the background; returns the record created for it. */
function startDeployment(appId: string, action: DeploymentAction, trigger: DeploymentTrigger, source?: DeploymentRecord) {
  const task = withAppLock(appId, () => deploymentService.run(appId, action, trigger, { source }));
  task.catch(error => { console.error('[Deployment]', error); wsHub.broadcastLog(appId, `[vessel] ${error.message}\n`); });
  // run() registers the record synchronously, before its first await
  return deploymentService.list(appId)[0];
}

function tokensMatch(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

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

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) authService.logout(header.slice(7).trim());
  res.json({ success: true, message: '已安全登出' });
});

// ======================= DEPLOY WEBHOOK (token-authenticated) =======================
// POST /api/hooks/deploy/:appId/:token[?action=deploy] — default action pulls images and recreates.
apiRouter.post('/hooks/deploy/:id/:token', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const app = db.get('apps').find(item => item.id === id);
  const settings = app?.deploySettings;
  if (!app || !settings?.webhookEnabled || !settings.webhookToken || !tokensMatch(String(req.params.token), settings.webhookToken)) {
    return res.status(404).json({ error: 'Not found' });
  }
  const action: DeploymentAction = req.query.action === 'deploy' ? 'deploy' : 'rebuild';
  assertAppIdle(id);
  const record = startDeployment(id, action, 'webhook');
  res.status(202).json({ accepted: true, appId: id, action, deploymentId: record?.id, seq: record?.seq });
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

apiRouter.get('/system/update', async (_req: Request, res: Response) => {
  res.json(await selfUpdateService.status());
});

apiRouter.post('/system/update/check', async (_req: Request, res: Response) => {
  await selfUpdateService.check(true);
  res.json(await selfUpdateService.status());
});

apiRouter.post('/system/update', async (_req: Request, res: Response) => {
  res.status(202).json(await selfUpdateService.apply());
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

/**
 * Generate an Ed25519 key pair for a libSQL (sqld) instance: the public key goes into
 * SQLD_AUTH_JWT_KEY, the signed non-expiring JWT is the client authToken. The private
 * key is discarded, so new tokens require rotating the key.
 */
apiRouter.post('/databases/libsql-credentials', requireAuth, async (_req: Request, res: Response) => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const jwtKey = publicKey.export({ format: 'jwk' }).x as string;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${encode({ alg: 'EdDSA', typ: 'JWT' })}.${encode({ iat: Math.floor(Date.now() / 1000) })}`;
  const signature = sign(null, Buffer.from(signingInput), privateKey).toString('base64url');
  res.json({ jwtKey, authToken: `${signingInput}.${signature}` });
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
    deploymentService.purge(id);
    caddyService.syncCaddyfile();
    schedulerService.reload();
    res.json({ success: true, message: 'App deleted' });
  });
});

// Deploy-type actions are recorded as deployments; stop/restart are plain lifecycle operations.
for (const action of ['deploy', 'rebuild', 'fresh-volumes'] as const) {
  apiRouter.post(`/apps/:id/${action}`, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    assertAppIdle(id);
    if (!db.get('apps').some(item => item.id === id)) return res.status(404).json({ error: 'App not found' });
    const record = startDeployment(id, action, 'manual');
    res.status(202).json({ message: 'Operation started', appId: id, deploymentId: record?.id, seq: record?.seq });
  });
}

const lifecycleActions = {
  stop: (app: AppItem, log: (text: string) => void) => dockerService.stopApp(app, log),
  restart: (app: AppItem, log: (text: string) => void) => dockerService.restartApp(app, log),
};
for (const action of Object.keys(lifecycleActions) as (keyof typeof lifecycleActions)[]) {
  apiRouter.post(`/apps/:id/${action}`, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    assertAppIdle(id);
    const app = db.get('apps').find(item => item.id === id);
    if (!app) return res.status(404).json({ error: 'App not found' });
    await withAppLock(id, async () => {
      db.updateApp(id, { status: 'rebuilding' });
      appEvents.emit('changed', id);
      try {
        const result = await lifecycleActions[action](app, text => wsHub.broadcastLog(id, text));
        if (!result.success) throw new Error(result.error || 'Docker operation failed');
        if (action !== 'stop') await registryService.captureAppDigest(app);
        if (action === 'stop') db.updateApp(id, { status: 'stopped' });
        return result;
      } catch (error) {
        db.updateApp(id, { status: 'error' });
        throw error;
      }
    });
    res.json({ success: true, app: db.get('apps').find(item => item.id === id) });
  });
}

// ======================= DEPLOYMENT HISTORY & SETTINGS =======================
apiRouter.get('/apps/:id/deployments', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!db.get('apps').some(item => item.id === id)) return res.status(404).json({ error: 'App not found' });
  res.json(deploymentService.list(id));
});

apiRouter.get('/apps/:id/deployments/:deploymentId/log', (req: Request, res: Response) => {
  const record = deploymentService.get(String(req.params.id), String(req.params.deploymentId));
  if (!record) return res.status(404).json({ error: 'Deployment not found' });
  res.json({ log: deploymentService.readLog(record) });
});

apiRouter.post('/apps/:id/deployments/:deploymentId/rollback', (req: Request, res: Response) => {
  const id = String(req.params.id);
  assertAppIdle(id);
  const source = deploymentService.get(id, String(req.params.deploymentId));
  if (!source) return res.status(404).json({ error: 'Deployment not found' });
  if (source.status === 'running') throw new BadRequest('该部署仍在进行中，无法回滚');
  const record = startDeployment(id, 'rollback', 'manual', source);
  res.status(202).json({ message: 'Rollback started', appId: id, deploymentId: record?.id, seq: record?.seq });
});

apiRouter.get('/apps/:id/settings', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!db.get('apps').some(item => item.id === id)) return res.status(404).json({ error: 'App not found' });
  res.json(deploymentService.settings(id));
});

apiRouter.put('/apps/:id/settings', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!db.get('apps').some(item => item.id === id)) return res.status(404).json({ error: 'App not found' });
  const body = req.body || {};
  const current = deploymentService.settings(id);
  const next: AppDeploySettings = { ...current };
  for (const field of ['webhookEnabled', 'removeOrphans', 'waitHealthy', 'autoRollback', 'notifyOnSuccess', 'notifyOnFailure', 'notifyOnUpdate'] as const) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== 'boolean') throw new BadRequest(`${field} must be a boolean`);
    next[field] = body[field];
  }
  if (body.pullPolicy !== undefined) {
    if (!['missing', 'always'].includes(body.pullPolicy)) throw new BadRequest('Invalid pullPolicy');
    next.pullPolicy = body.pullPolicy;
  }
  for (const [field, min, max] of [['timeoutMinutes', 1, 120], ['historyLimit', 1, 100]] as const) {
    if (body[field] === undefined) continue;
    const value = Number(body[field]);
    if (!Number.isInteger(value) || value < min || value > max) throw new BadRequest(`${field} must be between ${min} and ${max}`);
    next[field] = value;
  }
  db.updateApp(id, { deploySettings: next });
  appEvents.emit('changed', id);
  res.json(next);
});

apiRouter.post('/apps/:id/settings/webhook-token', (req: Request, res: Response) => {
  const id = String(req.params.id);
  if (!db.get('apps').some(item => item.id === id)) return res.status(404).json({ error: 'App not found' });
  const next = { ...deploymentService.settings(id), webhookToken: newWebhookToken() };
  db.updateApp(id, { deploySettings: next });
  res.json(next);
});

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

apiRouter.get('/apps/:id/diagnostics', async (req: Request, res: Response) => {
  const app = db.get('apps').find(item => item.id === req.params.id);
  if (!app) return res.status(404).json({ error: 'App not found' });
  res.json(await dockerService.diagnoseApp(app));
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
    backupPassphrase: config.backupPassphrase ? '••••••••••••••••' : '',
  });
});

apiRouter.post('/r2/config', requireAuth, (req: Request, res: Response) => {
  const current = db.get('r2Config');
  const { enabled, endpoint, bucketName, accessKeyId, secretAccessKey, cronSchedule, retentionCount, backupPassphrase } = req.body;
  const passphraseChanged = typeof backupPassphrase === 'string' && backupPassphrase !== '' && !backupPassphrase.includes('••');
  if (backupPassphrase !== undefined && typeof backupPassphrase !== 'string') throw new BadRequest('backupPassphrase must be a string');
  if (passphraseChanged && backupPassphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new BadRequest(`备份口令至少需要 ${MIN_PASSPHRASE_LENGTH} 个字符`);
  }

  const updated: R2Config = {
    enabled: enabled !== undefined ? !!enabled : current.enabled,
    endpoint: endpoint ?? current.endpoint,
    bucketName: bucketName ?? current.bucketName,
    accessKeyId: accessKeyId ?? current.accessKeyId,
    secretAccessKey: secretAccessKey && !secretAccessKey.includes('••') ? secretAccessKey : current.secretAccessKey,
    cronSchedule: cronSchedule ?? current.cronSchedule,
    retentionCount: retentionCount ? Number(retentionCount) : current.retentionCount,
    backupPassphrase: passphraseChanged ? backupPassphrase : current.backupPassphrase,
    lastBackupStatus: current.lastBackupStatus,
    lastBackupAt: current.lastBackupAt,
    lastBackupMessage: current.lastBackupMessage,
  };

  db.set('r2Config', updated);
  schedulerService.reload();
  res.json({ success: true, config: { ...updated, secretAccessKey: '••••••••••••••••',
    backupPassphrase: updated.backupPassphrase ? '••••••••••••••••' : '' } });
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
  res.setHeader('Content-Type', isEncryptedBackup(result.fileName) ? 'application/octet-stream'
    : result.fileName.endsWith('.gz') ? 'application/gzip' : 'application/zip');
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
  const { databaseName, passphrase } = req.body || {};
  if (passphrase !== undefined && typeof passphrase !== 'string') throw new BadRequest('passphrase must be a string');
  const record = db.get('backups').find(item => item.id === id);
  if (!record) return res.status(404).json({ error: 'Backup not found' });
  const result = await withAppLock(record.type === 'system' ? '*' : record.targetId, () => r2BackupService.restoreBackup(id, { databaseName, passphrase }));
  if (result.success) schedulerService.reload();
  if (!result.success) {
    // The client prompts for the passphrase and retries on this code
    if (result.code) return res.status(400).json({ error: result.error, code: result.code });
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

// ======================= NOTIFICATION CHANNELS =======================
apiRouter.get('/notifications', (_req: Request, res: Response) => {
  res.json((db.get('notifications') || []).map(maskChannel));
});

apiRouter.post('/notifications', (req: Request, res: Response) => {
  const body = req.body || {};
  const list = db.get('notifications') || [];
  const existing = typeof body.id === 'string' ? list.find(item => item.id === body.id) : undefined;
  if (body.id !== undefined && !existing) return res.status(404).json({ error: 'Channel not found' });
  const type = body.type ?? existing?.type;
  if (!CHANNEL_TYPES.includes(type)) throw new BadRequest('不支持的通知渠道类型');
  const name = String(body.name ?? existing?.name ?? '').trim();
  if (!name || name.length > 60) throw new BadRequest('请填写 1-60 个字符的渠道名称');
  const events = body.events ?? existing?.events ?? NOTIFICATION_EVENTS.filter(event => event !== 'deploy.success');
  if (!Array.isArray(events) || events.some((event: unknown) => !NOTIFICATION_EVENTS.includes(event as any))) throw new BadRequest('Invalid events');
  for (const field of ['url', 'botToken', 'chatId'] as const) {
    if (body[field] !== undefined && typeof body[field] !== 'string') throw new BadRequest(`${field} must be a string`);
  }
  const keep = (value: unknown, previous = '') => value === undefined || isMasked(value) ? previous : String(value).trim();
  const channel: NotificationChannel = {
    id: existing?.id || uuidv4(),
    name,
    type,
    enabled: body.enabled !== undefined ? !!body.enabled : existing?.enabled ?? true,
    url: type === 'telegram' ? '' : keep(body.url, existing?.url),
    botToken: type === 'telegram' ? keep(body.botToken, existing?.botToken) : undefined,
    chatId: type === 'telegram' ? keep(body.chatId, existing?.chatId) : undefined,
    events: [...new Set(events as NotificationChannel['events'])],
    lastSentAt: existing?.lastSentAt,
    lastStatus: existing?.lastStatus,
    lastError: existing?.lastError,
  };
  if (type === 'telegram' ? !channel.botToken || !channel.chatId : !/^https?:\/\/\S+$/i.test(channel.url)) {
    throw new BadRequest(type === 'telegram' ? '请填写 Bot Token 和 Chat ID' : '请填写以 http(s):// 开头的通知地址');
  }
  db.set('notifications', existing ? list.map(item => item.id === channel.id ? channel : item) : [...list, channel]);
  res.status(existing ? 200 : 201).json(maskChannel(channel));
});

apiRouter.delete('/notifications/:id', (req: Request, res: Response) => {
  const list = db.get('notifications') || [];
  if (!list.some(item => item.id === req.params.id)) return res.status(404).json({ error: 'Channel not found' });
  db.set('notifications', list.filter(item => item.id !== req.params.id));
  res.json({ success: true });
});

apiRouter.post('/notifications/:id/test', async (req: Request, res: Response) => {
  const channel = (db.get('notifications') || []).find(item => item.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  const result = await notifier.send(channel, {
    event: 'deploy.success',
    title: '测试通知',
    message: `这是一条来自 Vessel 的测试消息，渠道「${channel.name}」已连通。`,
  });
  res.json({ ...result, channel: maskChannel(db.get('notifications').find(item => item.id === channel.id) || channel) });
});

// ======================= MAINTENANCE & CLEANER =======================
apiRouter.get('/maintenance/config', (req: Request, res: Response) => {
  const cfg = db.get('maintenance');
  res.json(cfg);
});

apiRouter.post('/maintenance/config', requireAuth, (req: Request, res: Response) => {
  const current = db.get('maintenance');
  const updated: MaintenanceConfig = { ...current };
  // Only user-editable fields; lastPruneAt / lastCheckedAt etc. are owned by the server
  for (const field of ['autoPrune', 'pruneSchedule', 'pruneDangling', 'pruneBuilderCache', 'unusedRetentionHours', 'pruneStoppedContainers', 'stoppedContainerDays', 'autoCheckUpdates', 'checkSchedule'] as const) {
    if (req.body?.[field] === undefined) continue;
    if (field === 'unusedRetentionHours' || field === 'stoppedContainerDays') {
      const value = Math.floor(Number(req.body[field]));
      if (!Number.isFinite(value) || value < 1) return res.status(400).json({ error: `${field} must be a positive integer` });
      updated[field] = value;
    } else {
      (updated as any)[field] = req.body[field];
    }
  }
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
  // Exclusive: `image prune -a` would delete an image a deployment has pulled but not yet started
  const result = await withAppLock('*', () => cleanerService.runSafePrune());
  res.json(result);
});

apiRouter.get('/maintenance/disk-usage', async (req: Request, res: Response) => {
  const [breakdown, logs] = await Promise.allSettled([cleanerService.diskUsage(), cleanerService.containerLogs()]);
  if (breakdown.status === 'rejected') return res.status(503).json({ error: `Docker 不可用: ${breakdown.reason?.message || breakdown.reason}` });
  res.json({
    breakdown: breakdown.value,
    logs: logs.status === 'fulfilled' ? logs.value : [],
    logsError: logs.status === 'rejected' ? String(logs.reason?.message || logs.reason) : null,
  });
});

apiRouter.use(apiErrorHandler);
