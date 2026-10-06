import React, { useState } from 'react';
import clsx from 'clsx';
import {
  Broom,
  Sparkle,
  ArrowsClockwise,
  CheckCircle,
  HardDrive,
  Info,
  CaretDown,
  CaretUp,
  Clock,
  FloppyDiskBack,
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

const PRUNE_PRESETS = [
  { label: '每周日 4:00', expr: '0 4 * * 0' },
  { label: '每天 4:00', expr: '0 4 * * *' },
  { label: '周一/四 3:00', expr: '0 3 * * 1,4' },
  { label: '每月 1号 4:00', expr: '0 4 1 * *' },
];

const CHECK_PRESETS = [
  { label: '每 6 小时', expr: '0 */6 * * *' },
  { label: '每 12 小时', expr: '0 */12 * * *' },
  { label: '每天 2:00', expr: '0 2 * * *' },
  { label: '每小时', expr: '0 * * * *' },
];

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenance,
  apps,
  onSaveMaintenance,
  onTriggerPrune,
  onTriggerCheckUpdates,
}) => {
  const { toast } = useNotification();
  const [isTipsExpanded, setIsTipsExpanded] = useState(false);

  const [autoPrune, setAutoPrune] = useState(maintenance?.autoPrune ?? true);
  const [pruneSchedule, setPruneSchedule] = useState(maintenance?.pruneSchedule || '0 4 * * 0');
  const [pruneDangling, setPruneDangling] = useState(maintenance?.pruneDangling ?? true);
  const [pruneBuilderCache, setPruneBuilderCache] = useState(maintenance?.pruneBuilderCache ?? true);
  const [unusedRetentionHours, setUnusedRetentionHours] = useState(maintenance?.unusedRetentionHours || 72);

  const [autoCheckUpdates, setAutoCheckUpdates] = useState(maintenance?.autoCheckUpdates ?? true);
  const [checkSchedule, setCheckSchedule] = useState(maintenance?.checkSchedule || '0 */6 * * *');

  const [isPruning, setIsPruning] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isSavingPrune, setIsSavingPrune] = useState(false);
  const [isSavingCheck, setIsSavingCheck] = useState(false);

  const [pruneFeedback, setPruneFeedback] = useState<string | null>(null);
  const [freedMb, setFreedMb] = useState<number>(
    maintenance?.lastFreedBytes ? maintenance.lastFreedBytes / (1024 * 1024) : 0
  );

  const handlePruneClick = async () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 40]);
    }
    setIsPruning(true);
    setPruneFeedback(null);
    try {
      const res = await onTriggerPrune();
      if (res && res.freedBytes !== undefined) {
        setFreedMb(res.freedBytes / (1024 * 1024));
      }
      const msg = res?.summary || '安全清理已执行完成！';
      setPruneFeedback(msg);
      toast.success(msg);
    } catch (e: any) {
      toast.error(`清理失败: ${e.message}`);
    } finally {
      setIsPruning(false);
    }
  };

  const handleCheckUpdatesClick = async () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 40]);
    }
    setIsCheckingUpdates(true);
    try {
      const res = await onTriggerCheckUpdates();
      toast.success(res?.message || '镜像巡检完成！');
    } catch (e: any) {
      toast.error(`巡检失败: ${e.message}`);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleSavePruneSettings = async () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    setIsSavingPrune(true);
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
      toast.success('安全清理策略已成功保存！');
    } catch (e: any) {
      toast.error(`保存失败: ${e.message}`);
    } finally {
      setIsSavingPrune(false);
    }
  };

  const handleSaveCheckSettings = async () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    setIsSavingCheck(true);
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
      toast.success('镜像巡检策略已成功保存！');
    } catch (e: any) {
      toast.error(`保存失败: ${e.message}`);
    } finally {
      setIsSavingCheck(false);
    }
  };

  const appsWithUpdates = apps.filter((a) => a.updateAvailable);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header (De-boxed, modern SaaS standard with compressed mobile footprint) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-paper-2 dark:bg-white/[0.04] border border-line/60 dark:border-white/[0.08] flex items-center justify-center text-amber-500 flex-shrink-0 shadow-subtle mt-0.5">
            <Broom className="w-5 h-5" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-base sm:text-lg text-ink tracking-tight font-sans">
                自动镜像巡检更新与安全阶梯清理
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-2 dark:bg-white/[0.05] text-ink-muted border border-line/50 dark:border-white/[0.06] font-mono">
                自动运维守护
              </span>
            </div>

            {/* Compressed 1-line description with collapsible detailed explanation */}
            <div className="mt-1">
              <p className="text-xs text-ink-muted leading-relaxed inline">
                保持服务器磁盘精简与容器生命周期健康。
              </p>
              <button
                type="button"
                onClick={() => setIsTipsExpanded(!isTipsExpanded)}
                className="inline-flex items-center gap-0.5 text-xs text-accent hover:underline font-medium ml-1 cursor-pointer select-none"
              >
                <span>{isTipsExpanded ? '收起说明' : '详细说明'}</span>
                {isTipsExpanded ? (
                  <CaretUp className="w-3 h-3" weight="bold" />
                ) : (
                  <CaretDown className="w-3 h-3" weight="bold" />
                )}
              </button>
            </div>

            {/* Collapsible Guidance Box */}
            {isTipsExpanded && (
              <div className="mt-2.5 p-3 rounded-xl bg-paper-2/80 dark:bg-white/[0.03] border border-line/80 dark:border-white/[0.08] text-xs text-ink-muted space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Info className="w-3.5 h-3.5 text-accent flex-shrink-0" weight="fill" />
                  <span>自动运维与清理机制</span>
                </div>
                <p className="leading-relaxed">
                  Vessel 后台定时轮询远程 Registry Digest 发现新版本镜像，同时以阶梯式安全策略自动清理悬空镜像与过期缓存，杜绝磁盘爆满并防止误删热备镜像。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PANEL 1: SAFE DOCKER PRUNE */}
        <div className="card-vessel p-5 sm:p-7 flex flex-col justify-between space-y-5 shadow-subtle">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-line/50 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-5 h-5 text-amber-500" weight="bold" />
                <h4 className="font-semibold text-sm text-ink font-sans">安全阶梯磁盘瘦身</h4>
              </div>
              <Badge variant="running">防误删保护中</Badge>
            </div>

            {/* Freed space highlight counter (Responsive Mobile Stack) */}
            <div className="my-5 p-4 sm:p-5 rounded-xl bg-paper-2/60 dark:bg-white/[0.03] border border-line/60 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-end justify-between gap-4 shadow-subtle">
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
                className="w-full sm:w-auto min-h-[42px]"
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
              <label className="flex items-center gap-3 text-ink dark:text-zinc-200 cursor-pointer select-none min-h-[38px] p-2 rounded-lg hover:bg-paper-2/60 dark:hover:bg-white/[0.03] transition-colors border border-transparent hover:border-line/40">
                <input
                  type="checkbox"
                  checked={pruneDangling}
                  onChange={(e) => setPruneDangling(e.target.checked)}
                  className="rounded border-line bg-paper text-accent focus:ring-accent w-4 h-4"
                />
                <span className="text-xs leading-normal">自动清理悬空镜像 (dangling &lt;none&gt;:&lt;none&gt;)</span>
              </label>

              <label className="flex items-center gap-3 text-ink dark:text-zinc-200 cursor-pointer select-none min-h-[38px] p-2 rounded-lg hover:bg-paper-2/60 dark:hover:bg-white/[0.03] transition-colors border border-transparent hover:border-line/40">
                <input
                  type="checkbox"
                  checked={pruneBuilderCache}
                  onChange={(e) => setPruneBuilderCache(e.target.checked)}
                  className="rounded border-line bg-paper text-accent focus:ring-accent w-4 h-4"
                />
                <span className="text-xs leading-normal">自动清理废弃的构建缓存 (BuildKit Cache)</span>
              </label>

              {/* Retention hours with numeric keypad constraint */}
              <div className="pt-1">
                <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                  未使用镜像安全冷却保留期 (小时):
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  value={unusedRetentionHours}
                  onChange={(e) => setUnusedRetentionHours(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 min-h-[42px] text-xs text-ink focus:border-accent focus:outline-none transition-colors"
                />
                <span className="text-[11px] text-ink-muted/70 dark:text-zinc-500 block mt-1">
                  只有超过该时长且未被任何容器引用的镜像才会被清理，防止误删热备镜像。
                </span>
              </div>

              {/* CRON expression with quick-pick chips */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal">
                  定时清理 Cron 表达式:
                </label>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={pruneSchedule}
                  onChange={(e) => setPruneSchedule(e.target.value)}
                  placeholder="0 4 * * 0"
                  className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 min-h-[42px] text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
                />
                {/* Horizontal Quick-pick Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-[11px] text-ink-muted/70 flex-shrink-0 flex items-center gap-1 mr-0.5">
                    <Clock className="w-3 h-3 text-ink-muted/80" />
                    快捷填入:
                  </span>
                  {PRUNE_PRESETS.map((preset) => {
                    const isSelected = pruneSchedule.trim() === preset.expr;
                    return (
                      <button
                        key={preset.expr}
                        type="button"
                        onClick={() => {
                          setPruneSchedule(preset.expr);
                          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                            navigator.vibrate(10);
                          }
                        }}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all select-none flex-shrink-0 border',
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-sm font-medium'
                            : 'bg-paper-2/80 hover:bg-paper-3 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-ink-muted hover:text-ink border-line/60 dark:border-white/[0.08]'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Full-width action button */}
          <div className="pt-4 border-t border-line/50 dark:border-white/[0.06]">
            <Button8State
              variant="primary"
              size="md"
              icon={<FloppyDiskBack className="w-4 h-4" weight="bold" />}
              state={isSavingPrune ? 'loading' : 'default'}
              onClick={handleSavePruneSettings}
              className="w-full min-h-[44px]"
            >
              保存清理策略
            </Button8State>
          </div>
        </div>

        {/* PANEL 2: IMAGE UPDATES INSPECTION */}
        <div className="card-vessel p-5 sm:p-7 flex flex-col justify-between space-y-5 shadow-subtle">
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

            {/* Inspection status card (Responsive Mobile Stack) */}
            <div className="my-5 p-4 sm:p-5 rounded-xl bg-paper-2/60 dark:bg-white/[0.03] border border-line/60 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
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
                className="w-full sm:w-auto min-h-[42px]"
              >
                立即巡检镜像
              </Button8State>
            </div>

            <div className="space-y-3.5 mt-5 text-xs">
              <label className="flex items-center gap-3 text-ink dark:text-zinc-200 cursor-pointer select-none min-h-[38px] p-2 rounded-lg hover:bg-paper-2/60 dark:hover:bg-white/[0.03] transition-colors border border-transparent hover:border-line/40">
                <input
                  type="checkbox"
                  checked={autoCheckUpdates}
                  onChange={(e) => setAutoCheckUpdates(e.target.checked)}
                  className="rounded border-line bg-paper text-accent focus:ring-accent w-4 h-4"
                />
                <span className="text-xs leading-normal">启用后台定时镜像 Digest 自动比对巡检</span>
              </label>

              {/* CRON expression with quick-pick chips */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal">
                  巡检周期 Cron 表达式:
                </label>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={checkSchedule}
                  onChange={(e) => setCheckSchedule(e.target.value)}
                  placeholder="0 */6 * * *"
                  className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 min-h-[42px] text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
                />
                {/* Horizontal Quick-pick Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-[11px] text-ink-muted/70 flex-shrink-0 flex items-center gap-1 mr-0.5">
                    <Clock className="w-3 h-3 text-ink-muted/80" />
                    快捷填入:
                  </span>
                  {CHECK_PRESETS.map((preset) => {
                    const isSelected = checkSchedule.trim() === preset.expr;
                    return (
                      <button
                        key={preset.expr}
                        type="button"
                        onClick={() => {
                          setCheckSchedule(preset.expr);
                          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                            navigator.vibrate(10);
                          }
                        }}
                        className={clsx(
                          'text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all select-none flex-shrink-0 border',
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-sm font-medium'
                            : 'bg-paper-2/80 hover:bg-paper-3 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-ink-muted hover:text-ink border-line/60 dark:border-white/[0.08]'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-ink-muted/70 dark:text-zinc-500 block">
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

          {/* Full-width action button */}
          <div className="pt-4 border-t border-line/50 dark:border-white/[0.06]">
            <Button8State
              variant="primary"
              size="md"
              icon={<FloppyDiskBack className="w-4 h-4" weight="bold" />}
              state={isSavingCheck ? 'loading' : 'default'}
              onClick={handleSaveCheckSettings}
              className="w-full min-h-[44px]"
            >
              保存巡检策略
            </Button8State>
          </div>
        </div>
      </div>
    </div>
  );
};
