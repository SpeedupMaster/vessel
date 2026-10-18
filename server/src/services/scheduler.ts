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
        await cleanerService.runSafePrune();
      });
    }

    // 3. Image Updates Check
    if (maintenance.autoCheckUpdates && cron.validate(maintenance.checkSchedule)) {
      this.updateCheckJob = cron.schedule(maintenance.checkSchedule, async () => {
        console.log('[Scheduler] Inspecting remote image digests for updates...');
        await this.runUpdateCheck();
      });
    }

    // 4. Per-Database App Scheduled Backups
    const apps = db.get('apps') || [];
    for (const app of apps) {
      if (app.backupSchedule?.enabled && cron.validate(app.backupSchedule.cronSchedule)) {
        const job = cron.schedule(app.backupSchedule.cronSchedule, async () => {
          console.log(`[Scheduler] Executing scheduled database backup for ${app.name} (${app.id})...`);
          try {
            const current = db.get('apps').find(item => item.id === app.id);
            if (!current?.backupSchedule?.enabled) return;
            const res = await withAppLock(current.id, () => r2BackupService.runDatabaseBackup(current, {
              databaseName: current.backupSchedule?.targetDatabase || 'all',
            }));
            const freshApps = db.get('apps') || [];
            const freshApp = freshApps.find((a) => a.id === app.id);
            if (freshApp && freshApp.backupSchedule) {
              freshApp.backupSchedule.lastBackupAt = new Date().toISOString();
              freshApp.backupSchedule.lastBackupStatus = res.success ? 'success' : 'failed';
              db.set('apps', [...freshApps]);
            }
            if (!res.success) {
              void notifier.notify({ event: 'backup.failure', title: `${app.name} 数据库备份失败`, message: String(res.error || '未知错误'), appId: app.id, appName: app.name });
            }
          } catch (err: any) {
            console.error(`[Scheduler] Scheduled database backup failed for ${app.name}:`, err.message);
            void notifier.notify({ event: 'backup.failure', title: `${app.name} 数据库备份失败`, message: String(err?.message || err), appId: app.id, appName: app.name });
          }
        });
        this.appBackupJobs.set(app.id, job);
      }
    }
  }

  public async runUpdateCheck(): Promise<void> {
    if (this.checkingUpdates) return;
    this.checkingUpdates = true;
    try {
      db.set('maintenance', { ...db.get('maintenance'), lastCheckedAt: new Date().toISOString() });
      for (const { id } of db.get('apps')) {
        try {
          await withAppLock(id, async () => {
            const app = db.get('apps').find(item => item.id === id);
            if (!app) return;
            const result = await registryService.checkAppUpdate(app);
            if (!result.currentDigest || !result.newDigest) return;
            db.updateApp(id, { currentDigest: result.currentDigest, latestDigest: result.newDigest, updateAvailable: result.hasUpdate });
            if (result.hasUpdate && app.autoUpdate && app.status === 'running') {
              await deploymentService.run(id, 'rebuild', 'auto-update');
            } else if (result.hasUpdate && result.newDigest !== app.latestDigest && deploymentService.settings(id).notifyOnUpdate) {
              // Only announce a given remote version once
              void notifier.notify({ event: 'update.available', title: `${app.name} 有新版本镜像`, message: '远端镜像摘要已变化，可在应用页拉取并重建。', appId: id, appName: app.name });
            }
          });
        } catch (error) { console.warn(`[Scheduler] Skipped ${id}: ${String(error)}`); }
      }
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
