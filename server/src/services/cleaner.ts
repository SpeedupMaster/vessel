import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../db/index.js';

const execAsync = promisify(exec);

export class CleanerService {
  /**
   * Run safe tiered Docker prune
   */
  public async runSafePrune(): Promise<{ success: boolean; freedBytes: number; summary: string }> {
    const config = db.get('maintenance');
    let totalFreedBytes = 0;
    const logLines: string[] = [];

    try {
      // 1. Prune dangling images
      if (config.pruneDangling) {
        try {
          const { stdout } = await execAsync('docker image prune -f', { timeout: 15000 });
          const match = stdout.match(/Total reclaimed space:\s*([0-9.]+)\s*([KMGTP]?B)/i);
          if (match) {
            totalFreedBytes += this.parseSize(parseFloat(match[1]), match[2]);
          }
          logLines.push('Dangling images pruned.');
        } catch {}
      }

      // 2. Prune builder cache
      if (config.pruneBuilderCache) {
        try {
          const { stdout } = await execAsync('docker builder prune -f', { timeout: 15000 });
          const match = stdout.match(/Total reclaimed space:\s*([0-9.]+)\s*([KMGTP]?B)/i);
          if (match) {
            totalFreedBytes += this.parseSize(parseFloat(match[1]), match[2]);
          }
          logLines.push('Builder cache pruned.');
        } catch {}
      }

      // 3. Prune unused images older than retention hours
      const hours = config.unusedRetentionHours || 72;
      try {
        const { stdout } = await execAsync(`docker image prune -a -f --filter "until=${hours}h"`, { timeout: 20000 });
        const match = stdout.match(/Total reclaimed space:\s*([0-9.]+)\s*([KMGTP]?B)/i);
        if (match) {
          totalFreedBytes += this.parseSize(parseFloat(match[1]), match[2]);
        }
        logLines.push(`Unused images older than ${hours}h pruned.`);
      } catch {}

      config.lastPruneAt = new Date().toISOString();
      config.lastFreedBytes = totalFreedBytes;
      db.set('maintenance', { ...config });

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

  private parseSize(num: number, unit: string): number {
    const u = unit.toUpperCase();
    if (u === 'B') return num;
    if (u === 'KB') return num * 1024;
    if (u === 'MB') return num * 1024 * 1024;
    if (u === 'GB') return num * 1024 * 1024 * 1024;
    if (u === 'TB') return num * 1024 * 1024 * 1024 * 1024;
    return num * 1024 * 1024;
  }
}

export const cleanerService = new CleanerService();
