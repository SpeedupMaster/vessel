import { runDocker } from './process.js';
import { db } from '../db/index.js';

// Pruning large hosts routinely takes minutes; killing the CLI early only reports a false failure
const PRUNE_TIMEOUT = 10 * 60 * 1000;
// `image prune` prints "Total reclaimed space: 1.2GB", buildx `builder prune` prints "Total:	1.2GB"
const RECLAIMED = /Total(?: reclaimed space)?:\s*([0-9.]+)\s*([kKMGTP]?B)/;

export class CleanerService {
  /**
   * Run safe tiered Docker prune
   */
  public async runSafePrune(): Promise<{ success: boolean; freedBytes: number; summary: string }> {
    const config = db.get('maintenance');
    let totalFreedBytes = 0;
    const logLines: string[] = [];
    const failures: string[] = [];

    try {
      // 1. Prune dangling images
      if (config.pruneDangling) {
        try {
          const { stdout } = await runDocker(['image', 'prune', '-f'], { timeout: PRUNE_TIMEOUT });
          const match = stdout.match(RECLAIMED);
          if (match) {
            totalFreedBytes += this.parseSize(parseFloat(match[1]), match[2]);
          }
          logLines.push('Dangling images pruned.');
        } catch (error: any) { failures.push(error.message); }
      }

      // 2. Prune builder cache
      if (config.pruneBuilderCache) {
        try {
          const { stdout } = await runDocker(['builder', 'prune', '-f'], { timeout: PRUNE_TIMEOUT });
          const match = stdout.match(RECLAIMED);
          if (match) {
            totalFreedBytes += this.parseSize(parseFloat(match[1]), match[2]);
          }
          logLines.push('Builder cache pruned.');
        } catch (error: any) { failures.push(error.message); }
      }

      // 3. Prune unused images older than retention hours
      const hours = config.unusedRetentionHours || 72;
      try {
        const { stdout } = await runDocker(['image', 'prune', '-a', '-f', '--filter', `until=${hours}h`], { timeout: PRUNE_TIMEOUT });
        const match = stdout.match(RECLAIMED);
        if (match) {
          totalFreedBytes += this.parseSize(parseFloat(match[1]), match[2]);
        }
        logLines.push(`Unused images older than ${hours}h pruned.`);
      } catch (error: any) { failures.push(error.message); }

      if (failures.length) return { success: false, freedBytes: totalFreedBytes, summary: failures.join('; ') };
      db.set('maintenance', { ...db.get('maintenance'),
        lastPruneAt: new Date().toISOString(), lastFreedBytes: totalFreedBytes });

      const freedMb = (totalFreedBytes / 1024 / 1024).toFixed(1);
      const summary = totalFreedBytes > 0
        ? `成功安全释放 ${freedMb} MB 磁盘空间。`
        : '磁盘已处于最佳状态，未发现需要释放的无用镜像或历史构建缓存。';

      return {
        success: true,
        freedBytes: totalFreedBytes,
        summary,
      };
    } catch (e: any) {
      return {
        success: false,
        freedBytes: 0,
        summary: e.message || 'Prune operation failed.',
      };
    }
  }

  /** Docker formats sizes with decimal (SI) units: kB = 1000 B. */
  private parseSize(num: number, unit: string): number {
    const exponent = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'].indexOf(unit.toUpperCase());
    return num * 1000 ** Math.max(exponent, 0);
  }
}

export const cleanerService = new CleanerService();
