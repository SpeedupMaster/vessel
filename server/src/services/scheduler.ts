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
  }

  public reload(): void {
    this.initJobs();
  }
}

export const schedulerService = new SchedulerService();
