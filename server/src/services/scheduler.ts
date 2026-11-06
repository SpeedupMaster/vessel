import cron, { ScheduledTask } from 'node-cron';
import { withAppLock, appEvents } from './appOperations.js';
import { db } from '../db/index.js';
import { r2BackupService } from './r2Backup.js';
import { cleanerService } from './cleaner.js';
import { registryService } from './registry.js';
import { deploymentService } from './deployments.js';
import { notifier } from './notifier.js';

export class SchedulerService {
  private checkingUpdates = false;
  private backupJob?: ScheduledTask;
  private pruneJob?: ScheduledTask;
  private updateCheckJob?: ScheduledTask;
  private appBackupJobs: Map<string, ScheduledTask> = new Map();

  constructor() {
    this.initJobs();
  }

  public initJobs(): void {
    this.stopJobs();

    const r2Config = db.get('r2Config');
    const maintenance = db.get('maintenance');

    // 1. R2 Scheduled Backup
    if (r2Config.enabled && cron.validate(r2Config.cronSchedule)) {
      this.backupJob = cron.schedule(r2Config.cronSchedule, async () => {
        console.log('[Scheduler] Executing scheduled R2 system backup...');
        try {
          const result = await withAppLock('*', () => r2BackupService.runSystemBackup());
          if (!result.success) void notifier.notify({ event: 'backup.failure', title: '系统快照备份失败', message: String(result.error || '未知错误') });
        } catch (error: any) {
          console.error('[Scheduler] System backup failed', error);
          void notifier.notify({ event: 'backup.failure', title: '系统快照备份失败', message: String(error?.message || error) });
        }
      });
    }

    // 2. Safe Docker Prune
    if (maintenance.autoPrune && cron.validate(maintenance.pruneSchedule)) {
      this.pruneJob = cron.schedule(maintenance.pruneSchedule, async () => {
        console.log('[Scheduler] Executing scheduled Docker prune...');
        try {
          // Exclusive: `image prune -a` would delete an image a deployment has pulled but not yet started
          const result = await withAppLock('*', () => cleanerService.runSafePrune());
          if (!result.success) console.warn(`[Scheduler] Docker prune failed: ${result.summary}`);
        } catch (error: any) {
          console.warn(`[Scheduler] Docker prune skipped: ${error?.message || error}`);
        }
      });
    }

    // 3. Image Updates Check
    if (maintenance.autoCheckUpdates && cron.validate(maintenance.checkSchedule)) {
      this.updateCheckJob = cron.schedule(maintenance.checkSchedule, async () => {
        console.log('[Scheduler] Inspecting remote image digests for updates...');
        await this.runUpdateCheck();
      });
    }

    // 4. Per-Database App Scheduled Backups (an app may carry several schedules)
    const apps = db.get('apps') || [];
    for (const app of apps) {
      for (const schedule of app.backupSchedules || []) {
        if (!schedule.enabled || !cron.validate(schedule.cronSchedule)) continue;
        const job = cron.schedule(schedule.cronSchedule, () => this.runScheduledDatabaseBackup(app.id, schedule.id));
        this.appBackupJobs.set(`${app.id}:${schedule.id}`, job);
      }
    }
  }

  private async runScheduledDatabaseBackup(appId: string, scheduleId: string): Promise<void> {
    const app = db.get('apps').find(item => item.id === appId);
    const schedule = app?.backupSchedules?.find(item => item.id === scheduleId);
    if (!app || !schedule?.enabled) return;
    const target = schedule.targetDatabase || 'all';
    console.log(`[Scheduler] Executing scheduled database backup for ${app.name} (${app.id}) → ${target}...`);
    let error: string | undefined;
    try {
      const res = await withAppLock(app.id, () => r2BackupService.runDatabaseBackup(app, { databaseName: target, scheduleId }));
      if (!res.success) error = String(res.error || '未知错误');
    } catch (err: any) {
      console.error(`[Scheduler] Scheduled database backup failed for ${app.name}:`, err.message);
      error = String(err?.message || err);
    }
    db.updateApp(appId, current => ({
      ...current,
      backupSchedules: (current.backupSchedules || []).map(item => item.id === scheduleId
        ? { ...item, lastBackupAt: new Date().toISOString(), lastBackupStatus: error ? 'failed' : 'success' }
        : item),
    }));
    if (error) {
      void notifier.notify({ event: 'backup.failure', title: `${app.name} 数据库备份失败 (${target})`, message: error, appId: app.id, appName: app.name });
    }
  }

  public async runUpdateCheck(): Promise<string[]> {
    if (this.checkingUpdates) return ['镜像巡检正在进行，请稍后重试'];
    this.checkingUpdates = true;
    const errors: string[] = [];
    try {
      db.set('maintenance', { ...db.get('maintenance'), lastCheckedAt: new Date().toISOString() });
      for (const { id } of db.get('apps')) {
        try {
          await withAppLock(id, async () => {
            const app = db.get('apps').find(item => item.id === id);
            if (!app) return;
            const result = await registryService.checkAppUpdate(app);
            if (result.errors.length) {
              errors.push(`${app.name}: ${result.errors.join('; ')}`);
              return;
            }
            if (!result.currentDigest || !result.newDigest) return;
            db.updateApp(id, { currentDigest: result.currentDigest, latestDigest: result.newDigest, updateAvailable: result.hasUpdate });
            if (result.hasUpdate && result.updatedServices.length && app.autoUpdate && app.status === 'running') {
              const record = await deploymentService.run(id, 'rebuild', 'auto-update', { updateServices: result.updatedServices });
              if (record.status === 'failed') errors.push(`${app.name}: ${record.error || '自动升级失败'}`);
            } else if (result.hasUpdate && result.newDigest !== app.latestDigest && deploymentService.settings(id).notifyOnUpdate) {
              // Only announce a given remote version once
              void notifier.notify({ event: 'update.available', title: `${app.name} 有新版本镜像`, message: '远端镜像摘要已变化，可在应用页拉取并重建。', appId: id, appName: app.name });
            }
          });
        } catch (error) {
          console.warn(`[Scheduler] Skipped ${id}: ${String(error)}`);
          errors.push(`${id}: ${String(error)}`);
        }
      }
      return errors;
    } finally { this.checkingUpdates = false; }
  }

  public stopJobs(): void {
    this.backupJob?.stop();
    this.pruneJob?.stop();
    this.updateCheckJob?.stop();
    for (const job of this.appBackupJobs.values()) {
      job.stop();
    }
    this.appBackupJobs.clear();
  }

  public reload(): void {
    this.initJobs();
  }
}

export const schedulerService = new SchedulerService();
