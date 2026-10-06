import cron, { ScheduledTask } from 'node-cron';
import { db } from '../db/index.js';
import { r2BackupService } from './r2Backup.js';
import { cleanerService } from './cleaner.js';
import { registryService } from './registry.js';
import { dockerService } from './docker.js';

export class SchedulerService {
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
        await r2BackupService.runSystemBackup();
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
            const res = await r2BackupService.runDatabaseBackup(app, {
              databaseName: app.backupSchedule?.targetDatabase || 'all',
            });
            const freshApps = db.get('apps') || [];
            const freshApp = freshApps.find((a) => a.id === app.id);
            if (freshApp && freshApp.backupSchedule) {
              freshApp.backupSchedule.lastBackupAt = new Date().toISOString();
              freshApp.backupSchedule.lastBackupStatus = res.success ? 'success' : 'failed';
              db.set('apps', [...freshApps]);
            }
          } catch (err: any) {
            console.error(`[Scheduler] Scheduled database backup failed for ${app.name}:`, err.message);
          }
        });
        this.appBackupJobs.set(app.id, job);
      }
    }
  }

  public async runUpdateCheck(): Promise<void> {
    const apps = db.get('apps');
    const maintenance = db.get('maintenance');
    maintenance.lastCheckedAt = new Date().toISOString();
    db.set('maintenance', { ...maintenance });

    for (const app of apps) {
      const { hasUpdate, newDigest } = await registryService.checkAppUpdate(app);
      if (hasUpdate) {
        app.updateAvailable = true;
        app.latestDigest = newDigest;

        // Auto update if enabled for this app
        if (app.autoUpdate && app.status === 'running') {
          console.log(`[Scheduler] Auto-updating app: ${app.name} (${app.id})...`);
          await dockerService.pullAndRebuild(app);
          app.updateAvailable = false;
          app.currentDigest = newDigest;
        }
      }
    }
    db.set('apps', [...apps]);
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
