import fs from 'fs';
import path from 'path';
import { runDocker } from './process.js';
import { DATA_DIR, db } from '../db/index.js';
import { hostPathService } from './hostPaths.js';

// Pruning large hosts routinely takes minutes; killing the CLI early only reports a false failure
const PRUNE_TIMEOUT = 10 * 60 * 1000;
// buildx `builder prune` prints "Total:	1.2GB"
const RECLAIMED = /Total(?: reclaimed space)?:\s*([0-9.]+)\s*([kKMGTP]?B)/;
// When each image was first seen without any container referencing it: { [imageId]: ISO time }
const USAGE_FILE = path.join(DATA_DIR, 'image-usage.json');
const OBSERVE_INTERVAL = 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NEVER = '0001-01-01T00:00:00Z';

export interface DiskUsageRow {
  type: string;
  totalCount: number;
  active: number;
  size: string;
  reclaimable: string;
}

export interface ContainerLogUsage {
  id: string;
  name: string;
  sizeBytes: number;
}

const lines = (stdout: string) => stdout.split('\n').map(line => line.trim()).filter(Boolean);

/** Docker formats sizes with decimal (SI) units: kB = 1000 B. */
function parseSize(num: number, unit: string): number {
  const exponent = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'].indexOf(unit.toUpperCase());
  return num * 1000 ** Math.max(exponent, 0);
}

export class CleanerService {
  private observeTimer: NodeJS.Timeout | null = null;

  private readUsage(): Record<string, string> {
    try {
      const parsed = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf-8'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeUsage(usage: Record<string, string>) {
    const temp = `${USAGE_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(usage, null, 2));
    fs.renameSync(temp, USAGE_FILE);
  }

  private async inspectContainers(ids: string[], size = false): Promise<any[]> {
    if (!ids.length) return [];
    const { stdout } = await runDocker(['container', 'inspect', ...(size ? ['--size'] : []), ...ids], { timeout: 60000 });
    return JSON.parse(stdout);
  }

  /**
   * Record when images lose their last container reference. Docker only knows when an image was
   * built, so the cooldown would otherwise start at build time and an image replaced by an update
   * would be deleted on the next run.
   */
  async observeImages(now = new Date()) {
    const images = lines((await runDocker(['image', 'ls', '-q', '--no-trunc'], { timeout: 60000 })).stdout);
    const containerIds = lines((await runDocker(['container', 'ls', '-a', '-q', '--no-trunc'], { timeout: 60000 })).stdout);
    const referenced = new Set((await this.inspectContainers(containerIds)).map(container => container.Image));
    const previous = this.readUsage();
    const usage: Record<string, string> = {};
    for (const id of new Set(images)) {
      if (referenced.has(id)) continue;
      usage[id] = previous[id] || now.toISOString();
    }
    this.writeUsage(usage);
    return usage;
  }

  start() {
    const observe = () => this.observeImages().catch(() => { /* Docker offline: retried next hour */ });
    void observe();
    this.observeTimer = setInterval(observe, OBSERVE_INTERVAL);
    this.observeTimer.unref?.();
  }

  /** Stopped containers outside Vessel-managed apps, stopped for longer than the given days. */
  private async pruneStoppedContainers(days: number, now: Date) {
    const ids = lines((await runDocker(['container', 'ls', '-a', '-q', '--no-trunc',
      '--filter', 'status=exited', '--filter', 'status=created', '--filter', 'status=dead'], { timeout: 60000 })).stdout);
    // App containers stay: Vessel shows and restarts them, and removing them would lose their state
    const protectedProjects = new Set(['vessel', ...db.get('apps').map(app => app.id)]);
    let freed = 0;
    let removed = 0;
    for (const container of await this.inspectContainers(ids, true)) {
      const project = container.Config?.Labels?.['com.docker.compose.project'];
      if (project && protectedProjects.has(project)) continue;
      if (container.Name === '/vessel-updater') continue;
      const finished = container.State?.FinishedAt && container.State.FinishedAt !== NEVER ? container.State.FinishedAt : container.Created;
      if (now.getTime() - new Date(finished).getTime() < days * DAY) continue;
      try {
        // Without -v: anonymous volumes are kept and remain visible as unused volumes
        await runDocker(['container', 'rm', container.Id], { timeout: 60000 });
        freed += Number(container.SizeRw) || 0;
        removed += 1;
      } catch { /* started again or removed meanwhile */ }
    }
    return { freed, removed };
  }

  /** Remove images that have been unreferenced for at least the cooldown. */
  private async pruneUnusedImages(usage: Record<string, string>, hours: number, includeDangling: boolean, now: Date) {
    const dangling = includeDangling ? new Set<string>()
      : new Set(lines((await runDocker(['image', 'ls', '-q', '--no-trunc', '--filter', 'dangling=true'], { timeout: 60000 })).stdout));
    let freed = 0;
    let removed = 0;
    for (const [id, since] of Object.entries(usage)) {
      if (dangling.has(id) || now.getTime() - new Date(since).getTime() < hours * HOUR) continue;
      try {
        const { stdout } = await runDocker(['image', 'inspect', '--format', '{{json .}}', id], { timeout: 30000 });
        const image = JSON.parse(stdout);
        // Removing by ID refuses images with several tags; untagging each removes it with the last.
        // Not forced: an image still used as a parent or by a new container is left alone.
        const refs: string[] = image.RepoTags?.length ? image.RepoTags : [id];
        await runDocker(['image', 'rm', ...refs], { timeout: PRUNE_TIMEOUT });
        freed += Number(image.Size) || 0;
        removed += 1;
      } catch { /* in use, shared with a child image, or already gone */ }
    }
    return { freed, removed };
  }

  /**
   * Run safe tiered Docker prune
   */
  public async runSafePrune(): Promise<{ success: boolean; freedBytes: number; summary: string }> {
    const config = db.get('maintenance');
    const hours = config.unusedRetentionHours || 72;
    const now = new Date();
    let totalFreedBytes = 0;
    const done: string[] = [];
    const failures: string[] = [];

    try {
      // 1. Stopped containers first, so the images they held start their cooldown
      if (config.pruneStoppedContainers) {
        try {
          const result = await this.pruneStoppedContainers(config.stoppedContainerDays || 7, now);
          totalFreedBytes += result.freed;
          if (result.removed) done.push(`${result.removed} 个停止的容器`);
        } catch (error: any) { failures.push(error.message); }
      }

      // 2. Images unreferenced for the whole cooldown; dangling ones only when enabled
      try {
        const usage = await this.observeImages(now);
        const result = await this.pruneUnusedImages(usage, hours, !!config.pruneDangling, now);
        totalFreedBytes += result.freed;
        if (result.removed) done.push(`${result.removed} 个镜像`);
      } catch (error: any) { failures.push(error.message); }

      // 3. Build cache not used within the cooldown, including cache still reachable from tags
      if (config.pruneBuilderCache) {
        try {
          const { stdout } = await runDocker(['builder', 'prune', '-a', '-f', '--filter', `until=${hours}h`], { timeout: PRUNE_TIMEOUT });
          const match = stdout.match(RECLAIMED);
          if (match) totalFreedBytes += parseSize(parseFloat(match[1]), match[2]);
        } catch (error: any) { failures.push(error.message); }
      }

      if (failures.length) return { success: false, freedBytes: totalFreedBytes, summary: failures.join('; ') };
      db.set('maintenance', { ...db.get('maintenance'),
        lastPruneAt: new Date().toISOString(), lastFreedBytes: totalFreedBytes });

      const freedMb = (totalFreedBytes / 1024 / 1024).toFixed(1);
      const summary = totalFreedBytes > 0 || done.length
        ? `成功安全释放约 ${freedMb} MB 磁盘空间${done.length ? `（清理了 ${done.join('、')}）` : ''}。`
        : '磁盘已处于最佳状态，未发现超过冷却期的无用镜像、构建缓存或停止的容器。';

      return { success: true, freedBytes: totalFreedBytes, summary };
    } catch (e: any) {
      return { success: false, freedBytes: 0, summary: e.message || 'Prune operation failed.' };
    }
  }

  async diskUsage(): Promise<DiskUsageRow[]> {
    const { stdout } = await runDocker(['system', 'df', '--format', '{{json .}}'], { timeout: 30000 });
    return lines(stdout).map(line => {
      const row = JSON.parse(line);
      return { type: row.Type, totalCount: Number(row.TotalCount) || 0, active: Number(row.Active) || 0, size: row.Size, reclaimable: row.Reclaimable };
    });
  }

  /**
   * Container log files live under the daemon's root directory, outside this container, so a
   * short-lived helper from Vessel's own image stats them.
   */
  async containerLogs(limit = 10): Promise<ContainerLogUsage[]> {
    const image = await hostPathService.selfImage();
    if (!image) throw new Error('仅在 Vessel 容器中运行时可读取容器日志大小');
    const root = (await runDocker(['info', '--format', '{{.DockerRootDir}}'], { timeout: 15000 })).stdout.trim();
    if (!root.startsWith('/')) throw new Error('无法确定 Docker 数据目录');
    const script = `const fs=require('fs');for(const id of fs.readdirSync('/c')){for(const f of [id+'-json.log','local-logs/container.log']){try{console.log(id+' '+fs.statSync('/c/'+id+'/'+f).size)}catch{}}}`;
    const { stdout } = await runDocker(['run', '--rm', '--network', 'none', '--entrypoint', 'node',
      '-v', `${path.posix.join(root, 'containers')}:/c:ro`, image, '-e', script], { timeout: 60000 });
    const sizes = new Map<string, number>();
    for (const line of lines(stdout)) {
      const [id, size] = line.split(' ');
      if (/^[0-9a-f]{64}$/.test(id)) sizes.set(id, (sizes.get(id) || 0) + Number(size));
    }
    const names = new Map(lines((await runDocker(['container', 'ls', '-a', '--no-trunc', '--format', '{{.ID}}\t{{.Names}}'], { timeout: 30000 })).stdout)
      .map(line => line.split('\t') as [string, string]));
    return [...sizes.entries()]
      .filter(([id]) => names.has(id))
      .map(([id, sizeBytes]) => ({ id: id.slice(0, 12), name: names.get(id)!, sizeBytes }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, limit);
  }
}

export const cleanerService = new CleanerService();
