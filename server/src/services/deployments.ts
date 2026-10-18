import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR, db } from '../db/index.js';
import { dockerService } from './docker.js';
import { registryService } from './registry.js';
import { notifier } from './notifier.js';
import { appEvents } from './appOperations.js';
import { wsHub } from '../ws/wsHub.js';
import { AppDeploySettings, AppItem, DeploymentAction, DeploymentRecord, DeploymentTrigger } from '../types/index.js';

const LOG_DIR = path.join(DATA_DIR, 'deployments');
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const SAFE_ID = /^[a-z0-9][a-z0-9_-]*$/i;

export const ACTION_LABELS: Record<DeploymentAction, string> = {
  deploy: '部署',
  rebuild: '拉取并重建',
  'fresh-volumes': '重置数据卷重建',
  rollback: '回滚',
};

export const TRIGGER_LABELS: Record<DeploymentTrigger, string> = {
  manual: '手动',
  webhook: 'Webhook',
  'auto-update': '自动更新',
  'auto-rollback': '自动回滚',
};

export function newWebhookToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function defaultDeploySettings(): AppDeploySettings {
  return {
    webhookEnabled: false,
    webhookToken: newWebhookToken(),
    pullPolicy: 'missing',
    removeOrphans: true,
    waitHealthy: false,
    timeoutMinutes: 15,
    autoRollback: false,
    historyLimit: 20,
    notifyOnSuccess: false,
    notifyOnFailure: true,
    notifyOnUpdate: true,
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export class DeploymentService {
  /** Settings with defaults filled in; persists them the first time so the webhook token is stable. */
  public settings(appId: string): AppDeploySettings {
    const app = db.get('apps').find(item => item.id === appId);
    if (!app) throw new Error('App not found');
    if (app.deploySettings?.webhookToken) return { ...defaultDeploySettings(), ...app.deploySettings };
    const settings = { ...defaultDeploySettings(), ...app.deploySettings };
    db.updateApp(appId, { deploySettings: settings });
    return settings;
  }

  public list(appId: string): DeploymentRecord[] {
    return (db.get('deployments') || []).filter(item => item.appId === appId).sort((a, b) => b.seq - a.seq);
  }

  public get(appId: string, id: string): DeploymentRecord | undefined {
    return (db.get('deployments') || []).find(item => item.appId === appId && item.id === id);
  }

  public readLog(record: DeploymentRecord): string {
    try { return fs.readFileSync(this.logPath(record.appId, record.id), 'utf-8'); } catch { return ''; }
  }

  /** Drop all history for a deleted app */
  public purge(appId: string): void {
    db.set('deployments', (db.get('deployments') || []).filter(item => item.appId !== appId));
    if (SAFE_ID.test(appId)) fs.rmSync(path.join(LOG_DIR, appId), { recursive: true, force: true });
  }

  private logPath(appId: string, id: string): string {
    if (!SAFE_ID.test(appId) || !SAFE_ID.test(id)) throw new Error('Invalid deployment reference');
    return path.join(LOG_DIR, appId, `${id}.log`);
  }

  private insert(record: DeploymentRecord, historyLimit: number): void {
    const all = db.get('deployments') || [];
    const mine = [record, ...all.filter(item => item.appId === record.appId)].sort((a, b) => b.seq - a.seq);
    const dropped = mine.slice(Math.max(1, historyLimit)).filter(item => item.status !== 'running');
    const droppedIds = new Set(dropped.map(item => item.id));
    for (const item of dropped) fs.rmSync(this.logPath(item.appId, item.id), { force: true });
    db.set('deployments', [...all.filter(item => !droppedIds.has(item.id)), record]);
  }

  /** Update in place; a record purged mid-run (app deleted) stays gone. */
  private patch(id: string, update: Partial<DeploymentRecord>): void {
    const all = db.get('deployments') || [];
    if (!all.some(item => item.id === id)) return;
    db.set('deployments', all.map(item => item.id === id ? { ...item, ...update } : item));
  }

  private openLog(record: DeploymentRecord): (text: string) => void {
    const file = this.logPath(record.appId, record.id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let bytes = 0;
    let truncated = false;
    return (text: string) => {
      wsHub.broadcastLog(record.appId, text);
      if (truncated) return;
      bytes += Buffer.byteLength(text);
      try {
        if (bytes > MAX_LOG_BYTES) {
          truncated = true;
          fs.appendFileSync(file, '\n[vessel] 日志超过 2 MiB，后续输出仅在实时流中显示。\n');
        } else {
          fs.appendFileSync(file, text);
        }
      } catch { /* the live stream still works when the disk write fails */ }
    };
  }

  /**
   * Run a deployment and record it. Caller must hold withAppLock(appId).
   * Resolves with the finished record; failures are recorded, not thrown.
   */
  public async run(
    appId: string,
    action: DeploymentAction,
    trigger: DeploymentTrigger,
    options: { source?: DeploymentRecord } = {},
  ): Promise<DeploymentRecord> {
    let app = db.get('apps').find(item => item.id === appId);
    if (!app) throw new Error('App not found');
    const settings = this.settings(appId);

    if (action === 'rollback') {
      if (!options.source) throw new Error('Rollback requires a source deployment');
      app = db.updateApp(appId, {
        composeYaml: options.source.composeYaml,
        envContent: options.source.envContent,
        updatedAt: new Date().toISOString(),
      }) as AppItem;
    }

    const seq = this.list(appId).reduce((max, item) => Math.max(max, item.seq), 0) + 1;
    const record: DeploymentRecord = {
      id: crypto.randomUUID(),
      appId,
      seq,
      action,
      trigger,
      status: 'running',
      startedAt: new Date().toISOString(),
      composeYaml: app.composeYaml,
      envContent: app.envContent,
      rollbackOf: options.source?.id,
    };
    this.insert(record, settings.historyLimit);
    const log = this.openLog(record);
    const started = Date.now();
    const sourceNote = options.source ? ` → 恢复部署 #${options.source.seq} 的配置` : '';
    log(`[vessel] 部署 #${seq} · ${ACTION_LABELS[action]} · 触发方式: ${TRIGGER_LABELS[trigger]}${sourceNote}\n`);

    db.updateApp(appId, { status: action === 'deploy' || action === 'rollback' ? 'deploying' : 'rebuilding' });
    appEvents.emit('changed', appId);

    const deployOptions = {
      pullPolicy: settings.pullPolicy,
      removeOrphans: settings.removeOrphans,
      waitHealthy: settings.waitHealthy,
      timeoutMinutes: settings.timeoutMinutes,
    };
    let result: { success: boolean; error?: string };
    try {
      result = action === 'rebuild'
        ? await dockerService.pullAndRebuild(app, log, deployOptions)
        : action === 'fresh-volumes'
          ? await dockerService.freshVolumesRebuild(app, log, deployOptions)
          : await dockerService.deployApp(app, log, deployOptions);
    } catch (error: any) {
      result = { success: false, error: String(error?.message || error) };
    }

    const durationMs = Date.now() - started;
    const finishedAt = new Date().toISOString();
    const label = `#${seq} · ${ACTION_LABELS[action]} · ${TRIGGER_LABELS[trigger]} · 耗时 ${formatDuration(durationMs)}`;

    if (result.success) {
      await registryService.captureAppDigest(app);
      db.updateApp(appId, { lastDeployedAt: finishedAt, updateAvailable: false });
      const imageDigest = db.get('apps').find(item => item.id === appId)?.currentDigest;
      this.patch(record.id, { status: 'success', finishedAt, durationMs, imageDigest });
      log(`[vessel] 部署 #${seq} 成功，耗时 ${formatDuration(durationMs)}\n`);
      if (settings.notifyOnSuccess) {
        void notifier.notify({ event: 'deploy.success', title: `${app.name} 部署成功`, message: label, appId, appName: app.name });
      }
      return { ...record, status: 'success', finishedAt, durationMs, imageDigest };
    }

    const error = result.error || 'Docker operation failed';
    db.updateApp(appId, { status: 'error' });
    this.patch(record.id, { status: 'failed', finishedAt, durationMs, error });
    log(`[vessel] 部署 #${seq} 失败: ${error}\n`);
    if (settings.notifyOnFailure) {
      void notifier.notify({ event: 'deploy.failure', title: `${app.name} 部署失败`, message: `${label}\n${error.slice(-500)}`, appId, appName: app.name });
    }
    const failed: DeploymentRecord = { ...record, status: 'failed', finishedAt, durationMs, error };

    if (settings.autoRollback && trigger !== 'auto-rollback' && db.get('apps').some(item => item.id === appId)) {
      const previous = this.list(appId).find(item => item.status === 'success' && item.id !== record.id);
      if (previous) {
        log(`[vessel] 已开启失败自动回滚，正在恢复部署 #${previous.seq}...\n`);
        await this.run(appId, 'rollback', 'auto-rollback', { source: previous });
      } else {
        log('[vessel] 已开启失败自动回滚，但没有可回滚的成功部署。\n');
      }
    }
    return failed;
  }
}

export const deploymentService = new DeploymentService();
