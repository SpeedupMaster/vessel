import React, { useState } from 'react';
import {
  Broom,
  Sparkle,
  ArrowsClockwise,
  CheckCircle,
  HardDrive,
} from '@phosphor-icons/react';
import { MaintenanceConfig, AppItem } from '../../types/index.js';
import { Button8State } from '../common/Button8State.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { Badge } from '../common/Badge.js';
import { useNotification } from '../../context/NotificationContext.js';

interface MaintenanceViewProps {
  maintenance: MaintenanceConfig | null;
  apps: AppItem[];
  onSaveMaintenance: (cfg: Partial<MaintenanceConfig>) => Promise<any>;
  onTriggerPrune: () => Promise<any>;
  onTriggerCheckUpdates: () => Promise<any>;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenance,
  apps,
  onSaveMaintenance,
  onTriggerPrune,
  onTriggerCheckUpdates,
}) => {
  const { toast } = useNotification();
  const [autoPrune, setAutoPrune] = useState(maintenance?.autoPrune ?? true);
  const [pruneSchedule, setPruneSchedule] = useState(maintenance?.pruneSchedule || '0 4 * * 0');
  const [pruneDangling, setPruneDangling] = useState(maintenance?.pruneDangling ?? true);
  const [pruneBuilderCache, setPruneBuilderCache] = useState(maintenance?.pruneBuilderCache ?? true);
  const [unusedRetentionHours, setUnusedRetentionHours] = useState(maintenance?.unusedRetentionHours || 72);

  const [autoCheckUpdates, setAutoCheckUpdates] = useState(maintenance?.autoCheckUpdates ?? true);
  const [checkSchedule, setCheckSchedule] = useState(maintenance?.checkSchedule || '0 */6 * * *');

  const [isPruning, setIsPruning] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [pruneFeedback, setPruneFeedback] = useState<string | null>(null);
  const [freedMb, setFreedMb] = useState<number>(
    maintenance?.lastFreedBytes ? maintenance.lastFreedBytes / (1024 * 1024) : 0
  );

  const handlePruneClick = async () => {
    setIsPruning(true);
    setPruneFeedback(null);
    try {
      const res = await onTriggerPrune();
      if (res.freedBytes) {
        setFreedMb(res.freedBytes / (1024 * 1024));
      }
      const msg = res.summary || '安全清理已执行完成！';
      setPruneFeedback(msg);
      toast.success(msg);
    } catch (e: any) {
      toast.error(`清理失败: ${e.message}`);
    } finally {
      setIsPruning(false);
    }
  };

  const handleCheckUpdatesClick = async () => {
    setIsCheckingUpdates(true);
    try {
      const res = await onTriggerCheckUpdates();
      toast.success(res.message || '镜像巡检完成！');
    } catch (e: any) {
      toast.error(`巡检失败: ${e.message}`);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await onSaveMaintenance({
        autoPrune,
        pruneSchedule,
        pruneDangling,
        pruneBuilderCache,
        unusedRetentionHours,
        autoCheckUpdates,
        checkSchedule,
      });
      toast.success('运维与巡检策略保存成功！');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const appsWithUpdates = apps.filter((a) => a.updateAvailable);

  return (
    <div className="space-y-8">
      {/* Page Header (De-boxed, modern SaaS standard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-paper-2 dark:bg-white/[0.04] border border-line/60 dark:border-white/[0.08] flex items-center justify-center text-amber-500 flex-shrink-0 shadow-subtle">
            <Broom className="w-5 h-5" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-lg text-ink tracking-tight font-sans">
                自动镜像巡检更新与安全阶梯清理
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-2 dark:bg-white/[0.05] text-ink-muted border border-line/50 dark:border-white/[0.06] font-mono">
                自动运维守护
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1.5 max-w-2xl leading-relaxed">
              保持服务器磁盘精简与容器生命周期健康。Vessel 后台定时轮询远程 Registry Digest 发现新版本镜像，
              同时以阶梯式安全策略自动清理悬空镜像与过期缓存，杜绝磁盘爆满。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PANEL 1: SAFE DOCKER PRUNE */}
        <div className="card-vessel p-6 sm:p-7 flex flex-col justify-between space-y-5 shadow-subtle">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-line/50 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-amber-500" weight="bold" />
                <h4 className="font-semibold text-sm text-ink font-sans">安全阶梯磁盘瘦身</h4>
              </div>
              <Badge variant="running">防误删保护中</Badge>
            </div>

            {/* Freed space highlight counter */}
            <div className="my-5 p-5 rounded-xl bg-paper-2/60 dark:bg-white/[0.03] border border-line/60 dark:border-white/[0.06] flex items-center justify-between shadow-subtle">
              <div>
                <span className="text-[11px] text-ink-muted/80 dark:text-zinc-400 block uppercase font-medium tracking-wider">
                  上次清理释放空间
                </span>
                <div className="text-3xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
                  <RollingCounter value={freedMb} precision={1} suffix=" MB" />
                </div>
              </div>
              <Button8State
                variant="primary"
                size="sm"
                icon={<Broom className="w-4 h-4" weight="bold" />}
                state={isPruning ? 'loading' : 'default'}
                onClick={handlePruneClick}
              >
                立即安全释放磁盘
              </Button8State>
            </div>

            {pruneFeedback && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" weight="fill" />
                <span>{pruneFeedback}</span>
              </div>
            )}

            {/* Strategy Toggles */}
            <div className="space-y-3.5 mt-5 text-xs">
              <label className="flex items-center gap-2.5 text-ink dark:text-zinc-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pruneDangling}
                  onChange={(e) => setPruneDangling(e.target.checked)}
                  className="rounded border-line bg-paper text-accent focus:ring-accent"
                />
                <span>自动清理悬空镜像 (dangling &lt;none&gt;:&lt;none&gt;)</span>
              </label>

              <label className="flex items-center gap-2.5 text-ink dark:text-zinc-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pruneBuilderCache}
                  onChange={(e) => setPruneBuilderCache(e.target.checked)}
                  className="rounded border-line bg-paper text-accent focus:ring-accent"
                />
                <span>自动清理废弃的构建缓存 (BuildKit Cache)</span>
              </label>

              <div className="pt-2">
                <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                  未使用镜像安全冷却保留期 (小时):
                </label>
                <input
                  type="number"
                  value={unusedRetentionHours}
                  onChange={(e) => setUnusedRetentionHours(Number(e.target.value))}
                  className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink focus:border-accent focus:outline-none transition-colors"
                />
                <span className="text-[11px] text-ink-muted/70 dark:text-zinc-500 block mt-1">
                  只有超过该时长且未被任何容器引用的镜像才会被清理，防止误删热备镜像。
                </span>
              </div>

              <div>
                <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                  定时清理 Cron 表达式:
                </label>
                <input
                  type="text"
                  value={pruneSchedule}
                  onChange={(e) => setPruneSchedule(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-line/50 dark:border-white/[0.06] flex justify-end">
            <Button8State variant="secondary" size="sm" onClick={handleSaveSettings}>
              保存清理策略
            </Button8State>
          </div>
        </div>

        {/* PANEL 2: IMAGE UPDATES INSPECTION */}
        <div className="card-vessel p-6 sm:p-7 flex flex-col justify-between space-y-5 shadow-subtle">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-line/50 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <Sparkle className="w-5 h-5 text-accent" weight="bold" />
                <h4 className="font-semibold text-sm text-ink font-sans">镜像更新巡检与自动升级</h4>
              </div>
              <Badge variant={appsWithUpdates.length > 0 ? 'expired' : 'active'}>
                {appsWithUpdates.length > 0 ? `${appsWithUpdates.length} 项可更新` : '所有镜像为最新'}
              </Badge>
            </div>

            <div className="my-5 p-5 rounded-xl bg-paper-2/60 dark:bg-white/[0.03] border border-line/60 dark:border-white/[0.06] flex items-center justify-between shadow-subtle">
              <div>
                <span className="text-[11px] text-ink-muted/80 dark:text-zinc-400 block uppercase font-medium tracking-wider">
                  巡检状态
                </span>
                <span className="text-sm text-ink dark:text-zinc-100 font-semibold mt-1 block">
                  {maintenance?.lastCheckedAt
                    ? `上次检查: ${new Date(maintenance.lastCheckedAt).toLocaleTimeString()}`
                    : '尚未执行巡检'}
                </span>
              </div>
              <Button8State
                variant="secondary"
                size="sm"
                icon={<ArrowsClockwise className="w-4 h-4" />}
                state={isCheckingUpdates ? 'loading' : 'default'}
                onClick={handleCheckUpdatesClick}
              >
                立即巡检镜像
              </Button8State>
            </div>

            <div className="space-y-3.5 mt-5 text-xs">
              <label className="flex items-center gap-2.5 text-ink dark:text-zinc-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCheckUpdates}
                  onChange={(e) => setAutoCheckUpdates(e.target.checked)}
                  className="rounded border-line bg-paper text-accent focus:ring-accent"
                />
                <span>启用后台定时镜像 Digest 自动比对巡检</span>
              </label>

              <div>
                <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                  巡检周期 Cron 表达式:
                </label>
                <input
                  type="text"
                  value={checkSchedule}
                  onChange={(e) => setCheckSchedule(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
                />
                <span className="text-[11px] text-ink-muted/70 dark:text-zinc-500 block mt-1">
                  默认每 6 小时 (0 */6 * * *) 自动对比远程 Registry 与本地镜像 Digest。
                </span>
              </div>
            </div>

            {/* List of Apps with updates */}
            {appsWithUpdates.length > 0 && (
              <div className="mt-5 pt-4 border-t border-line/50 dark:border-white/[0.06] space-y-2.5">
                <span className="text-[11px] uppercase text-amber-600 dark:text-amber-400 font-bold block">
                  检测到新版本的应用:
                </span>
                {appsWithUpdates.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-ink dark:text-zinc-100">{a.name}</span>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">{a.currentImageTag}</p>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-medium">
                      发现新 Digest
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-line/50 dark:border-white/[0.06] flex justify-end">
            <Button8State variant="secondary" size="sm" onClick={handleSaveSettings}>
              保存巡检策略
            </Button8State>
          </div>
        </div>
      </div>
    </div>
  );
};
