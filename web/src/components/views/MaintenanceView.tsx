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
  ShieldCheck,
  Check,
} from '@phosphor-icons/react';
import { MaintenanceConfig, AppItem } from '../../types/index.js';
import { Button8State } from '../common/Button8State.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { Badge } from '../common/Badge.js';
import { Switch } from '../common/Switch.js';
import { NumberInput } from '../common/NumberInput.js';
import { useNotification } from '../../context/NotificationContext.js';
import { DiskUsagePanel } from './DiskUsagePanel.js';

interface MaintenanceViewProps {
  maintenance: MaintenanceConfig | null;
  apps: AppItem[];
  onSaveMaintenance: (cfg: Partial<MaintenanceConfig>) => Promise<any>;
  onTriggerPrune: () => Promise<any>;
  onTriggerCheckUpdates: () => Promise<any>;
  onUpgradeApp?: (id: string) => Promise<{ updated: boolean; message: string }>;
  onUpdateApp?: (id: string, partial: Partial<AppItem>) => Promise<any>;
}

const PRUNE_PRESETS = [
  { label: '每周日 4:00', expr: '0 4 * * 0', desc: '每周日凌晨 04:00 自动执行安全清理' },
  { label: '每天 4:00', expr: '0 4 * * *', desc: '每天凌晨 04:00 自动执行安全清理' },
  { label: '周一/四 3:00', expr: '0 3 * * 1,4', desc: '每周一、四凌晨 03:00 自动执行安全清理' },
  { label: '每月 1号 4:00', expr: '0 4 1 * *', desc: '每月 1 号凌晨 04:00 自动执行安全清理' },
];

const CHECK_PRESETS = [
  { label: '每 6 小时', expr: '0 */6 * * *', desc: '每隔 6 小时自动对比远程 Registry 与本地镜像' },
  { label: '每 12 小时', expr: '0 */12 * * *', desc: '每隔 12 小时自动对比远程 Registry 与本地镜像' },
  { label: '每天 2:00', expr: '0 2 * * *', desc: '每天凌晨 02:00 自动对比远程 Registry 与本地镜像' },
  { label: '每小时', expr: '0 * * * *', desc: '每整点自动对比远程 Registry 与本地镜像' },
];

function getCronDescription(cron: string, presets: { expr: string; desc: string }[]): string {
  const trimmed = cron.trim();
  const match = presets.find((p) => p.expr === trimmed);
  if (match) return match.desc;
  return `自定义计划: ${trimmed}`;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  maintenance,
  apps,
  onSaveMaintenance,
  onTriggerPrune,
  onTriggerCheckUpdates,
  onUpgradeApp,
  onUpdateApp,
}) => {
  const { toast } = useNotification();
  const [isTipsExpanded, setIsTipsExpanded] = useState(false);

  const [autoPrune, setAutoPrune] = useState(maintenance?.autoPrune ?? true);
  const [pruneSchedule, setPruneSchedule] = useState(maintenance?.pruneSchedule || '0 4 * * 0');
  const [pruneDangling, setPruneDangling] = useState(maintenance?.pruneDangling ?? true);
  const [pruneBuilderCache, setPruneBuilderCache] = useState(maintenance?.pruneBuilderCache ?? true);
  const [unusedRetentionHours, setUnusedRetentionHours] = useState(maintenance?.unusedRetentionHours || 72);
  const [pruneStoppedContainers, setPruneStoppedContainers] = useState(maintenance?.pruneStoppedContainers ?? false);
  const [stoppedContainerDays, setStoppedContainerDays] = useState(maintenance?.stoppedContainerDays || 7);

  const [autoCheckUpdates, setAutoCheckUpdates] = useState(maintenance?.autoCheckUpdates ?? true);
  const [checkSchedule, setCheckSchedule] = useState(maintenance?.checkSchedule || '0 */6 * * *');

  const [isPruning, setIsPruning] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isSavingPrune, setIsSavingPrune] = useState(false);
  const [isSavingCheck, setIsSavingCheck] = useState(false);

  const [rebuildingAppId, setRebuildingAppId] = useState<string | null>(null);
  const [togglingAppId, setTogglingAppId] = useState<string | null>(null);
  const [showPolicyList, setShowPolicyList] = useState(false);

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
      if (res?.success === false) toast.warning(res.message || '部分镜像巡检失败，未执行升级');
      else toast.success(res?.message || '镜像巡检完成！');
    } catch (e: any) {
      toast.error(`巡检失败: ${e.message}`);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleUpgradeApp = async (appId: string) => {
    if (!onUpgradeApp) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }
    setRebuildingAppId(appId);
    try {
      const result = await onUpgradeApp(appId);
      if (result.updated) toast.success(result.message);
      else toast.info(result.message);
    } catch (err: any) {
      toast.error(`升级触发失败: ${err.message}`);
    } finally {
      setRebuildingAppId(null);
    }
  };

  const handleToggleAutoUpdate = async (app: AppItem) => {
    if (!onUpdateApp) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    setTogglingAppId(app.id);
    try {
      await onUpdateApp(app.id, { autoUpdate: !app.autoUpdate });
      toast.success(`已${!app.autoUpdate ? '开启' : '关闭'} ${app.name} 的自动升级`);
    } catch (err: any) {
      toast.error(`更新策略失败: ${err.message}`);
    } finally {
      setTogglingAppId(null);
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
        pruneStoppedContainers,
        stoppedContainerDays,
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
        pruneStoppedContainers,
        stoppedContainerDays,
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
  const autoUpdateCount = apps.filter((a) => a.autoUpdate).length;
  const manualUpdateCount = apps.length - autoUpdateCount;

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Broom className="w-5 h-5" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base sm:text-lg text-ink tracking-tight font-sans">
                自动镜像巡检更新与安全阶梯清理
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-paper-3 border border-line text-ink-muted font-mono select-none font-medium">
                自动运维守护
              </span>
            </div>

            <div className="mt-1 flex items-center flex-wrap gap-1">
              <p className="text-xs text-ink-muted leading-relaxed">
                自动化管理服务器磁盘空间与镜像生命周期，保障容器集群持续健康。
              </p>
              <button
                type="button"
                onClick={() => setIsTipsExpanded(!isTipsExpanded)}
                className="inline-flex items-center gap-0.5 text-xs text-accent hover:underline font-medium cursor-pointer select-none"
              >
                <span>{isTipsExpanded ? '收起机制说明' : '详细机制说明'}</span>
                {isTipsExpanded ? (
                  <CaretUp className="w-3 h-3" weight="bold" />
                ) : (
                  <CaretDown className="w-3 h-3" weight="bold" />
                )}
              </button>
            </div>

            {/* Collapsible Guidance Box */}
            {isTipsExpanded && (
              <div className="mt-3 p-4 rounded-2xl bg-paper-2 border border-line text-xs text-ink-muted space-y-2 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" weight="fill" />
                  <span>自动化运维与清理工作机制</span>
                </div>
                <p className="leading-relaxed text-ink-muted">
                  <strong className="text-ink font-medium">阶梯磁盘安全防误删：</strong>
                  镜像从失去最后一个容器引用（包括已停止的容器）时开始计时，满设定的冷却期（默认 72 小时）后才会删除，应用更新后被替换的旧镜像因此可在冷却期内用于回滚；构建缓存按最后使用时间计算。数据卷与 Vessel 应用的容器从不清理。
                </p>
                <p className="leading-relaxed text-ink-muted">
                  <strong className="text-ink font-medium">镜像巡检与自动升级：</strong>
                  后台定时轮询远程 Registry Digest。开启「自动升级」且状态为运行中的应用将自动拉取最新镜像并热重载；数据库等关键基础服务默认保持手动确认，可在各应用列表独立切换。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Panel Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* ================= PANEL 1: SAFE DOCKER PRUNE ================= */}
        <div className="card-vessel p-5 sm:p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4" weight="bold" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-ink tracking-tight font-sans">
                    安全阶梯磁盘瘦身
                  </h4>
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    按失去引用时长清理镜像、构建缓存与停止的容器
                  </span>
                </div>
              </div>
              <Badge variant="running">防误删保护中</Badge>
            </div>

            {/* Top Metric Highlight Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-paper-3/50 dark:bg-paper-2 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">
                    上次清理释放空间
                  </span>
                  <span className="status-dot shrink-0 text-emerald-500" />
                </div>
                <div className="text-[26px] sm:text-[30px] leading-tight font-semibold text-ink tracking-[-0.03em]">
                  <RollingCounter value={freedMb} precision={1} />
                  <span className="ml-1 text-sm font-medium text-ink-muted tracking-normal">MB</span>
                </div>
                <p className="text-[11px] text-ink-muted font-mono">
                  {maintenance?.lastPruneAt
                    ? `上次清理: ${new Date(maintenance.lastPruneAt).toLocaleString('zh-CN', { hour12: false })} · 阶梯保护已激活`
                    : '尚未执行清理 · 阶梯保护已激活'}
                </p>
              </div>

              <Button8State
                variant="secondary"
                size="sm"
                icon={<Broom className="w-4 h-4 text-amber-500" weight="bold" />}
                state={isPruning ? 'loading' : 'default'}
                onClick={handlePruneClick}
                className="btn-vessel-secondary w-full sm:w-auto min-h-[38px] px-4 font-medium"
              >
                立即安全释放磁盘
              </Button8State>
            </div>

            {/* Feedback alert (if triggered) */}
            {pruneFeedback && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" weight="fill" />
                <span className="font-medium">{pruneFeedback}</span>
              </div>
            )}

            {/* Strategy Setting Items */}
            <div className="space-y-3">
              {/* Toggle 1 */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line transition-colors">
                <div className="pr-3">
                  <span className="text-xs font-semibold text-ink block">
                    包含悬空镜像
                  </span>
                  <span className="text-[11px] text-ink-muted mt-0.5 block leading-relaxed">
                    无标签镜像 (&lt;none&gt;:&lt;none&gt;)，例如更新后被新版本替换的旧镜像，同样满冷却期后清理
                  </span>
                </div>
                <Switch
                  checked={pruneDangling}
                  onChange={setPruneDangling}
                  size="sm"
                  aria-label="自动清理悬空镜像"
                />
              </div>

              {/* Toggle 2 */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line transition-colors">
                <div className="pr-3">
                  <span className="text-xs font-semibold text-ink block">
                    清理构建缓存
                  </span>
                  <span className="text-[11px] text-ink-muted mt-0.5 block leading-relaxed">
                    清理超过冷却期未被使用的 BuildKit 构建缓存，近期构建用到的缓存保留
                  </span>
                </div>
                <Switch
                  checked={pruneBuilderCache}
                  onChange={setPruneBuilderCache}
                  size="sm"
                  aria-label="自动清理废弃构建缓存"
                />
              </div>

              {/* Retention Hours */}
              <div className="p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-semibold text-ink block">
                      未使用镜像安全冷却保留期
                    </label>
                    <span className="text-[11px] text-ink-muted block mt-0.5">
                      镜像从不再被任何容器引用时开始计时，满冷却期后才会被清理，保留回滚余地
                    </span>
                  </div>
                  <div className="w-full sm:w-36 shrink-0">
                    <NumberInput
                      min={1}
                      value={unusedRetentionHours}
                      onChange={setUnusedRetentionHours}
                      unit="小时"
                    />
                  </div>
                </div>
              </div>

              {/* Stopped containers */}
              <div className="p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-3">
                    <span className="text-xs font-semibold text-ink block">
                      清理长期停止的容器
                    </span>
                    <span className="text-[11px] text-ink-muted mt-0.5 block leading-relaxed">
                      删除不属于 Vessel 应用、停止超过设定天数的容器（如一次性 docker run 遗留），数据卷保留
                    </span>
                  </div>
                  <Switch
                    checked={pruneStoppedContainers}
                    onChange={setPruneStoppedContainers}
                    size="sm"
                    aria-label="清理长期停止的容器"
                  />
                </div>
                {pruneStoppedContainers && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-ink-muted">停止超过</span>
                    <div className="w-full sm:w-36 shrink-0">
                      <NumberInput
                        min={1}
                        value={stoppedContainerDays}
                        onChange={setStoppedContainerDays}
                        unit="天"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cron Expression */}
              <div className="p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-ink">
                    定时清理 Cron 表达式
                  </label>
                  <span className="text-[11px] text-accent font-mono truncate font-medium">
                    {getCronDescription(pruneSchedule, PRUNE_PRESETS)}
                  </span>
                </div>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={pruneSchedule}
                  onChange={(e) => setPruneSchedule(e.target.value)}
                  placeholder="0 4 * * 0"
                  className="w-full bg-paper-2 dark:bg-paper border border-line-strong rounded-xl px-3.5 py-2 min-h-[38px] text-xs text-ink font-mono placeholder:text-ink-muted focus:outline-none transition-colors shadow-sm"
                />
                {/* Horizontal Quick-pick Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[11px] text-ink-muted flex-shrink-0 flex items-center gap-1 mr-0.5">
                    <Clock className="w-3 h-3 text-ink-muted" />
                    快捷预设:
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
                          'text-[11px] font-mono px-2.5 py-0.5 rounded-full whitespace-nowrap transition-all select-none flex-shrink-0 cursor-pointer',
                          isSelected
                            ? 'bg-accent text-accent-contrast shadow-sm font-semibold'
                            : 'bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink border border-line'
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

          {/* Card Footer Action */}
          <div className="pt-4 border-t border-line flex items-center justify-between gap-3">
            <span className="text-[11px] text-ink-muted hidden sm:inline">
              修改配置后点击保存即刻生效
            </span>
            <Button8State
              variant="primary"
              size="sm"
              icon={<FloppyDiskBack className="w-4 h-4" weight="bold" />}
              state={isSavingPrune ? 'loading' : 'default'}
              onClick={handleSavePruneSettings}
              className="w-full sm:w-auto min-h-[38px] px-5 text-xs font-semibold"
            >
              保存清理策略
            </Button8State>
          </div>
        </div>

        {/* ================= PANEL 2: IMAGE UPDATES INSPECTION ================= */}
        <div className="card-vessel p-5 sm:p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-accent flex items-center justify-center shrink-0">
                  <Sparkle className="w-4 h-4" weight="bold" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-ink tracking-tight font-sans">
                    镜像更新巡检与自动升级
                  </h4>
                  <span className="text-[11px] text-ink-muted block mt-0.5">
                    定时比对远程 Digest 并提示升级
                  </span>
                </div>
              </div>
              <Badge variant={appsWithUpdates.length > 0 ? 'expired' : 'active'}>
                {appsWithUpdates.length > 0 ? `${appsWithUpdates.length} 项可更新` : '所有镜像为最新'}
              </Badge>
            </div>

            {/* Top Metric Highlight Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-paper-3/50 dark:bg-paper-2 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">
                    镜像巡检状态
                  </span>
                  <span
                    className={clsx(
                      'status-dot shrink-0',
                      appsWithUpdates.length > 0 ? 'text-amber-500' : 'text-emerald-500'
                    )}
                    data-live={appsWithUpdates.length === 0}
                  />
                </div>
                <div className="text-[26px] sm:text-[30px] leading-tight font-semibold text-ink tracking-[-0.03em]">
                  {appsWithUpdates.length > 0 ? (
                    <>
                      <span className="tabular-nums">{appsWithUpdates.length}</span>
                      <span className="ml-1.5 text-sm font-medium text-ink-muted tracking-normal">个应用待升级</span>
                    </>
                  ) : (
                    '已是最新'
                  )}
                </div>
                <p className="text-[11px] text-ink-muted font-mono">
                  {maintenance?.lastCheckedAt
                    ? `上次检查: ${new Date(maintenance.lastCheckedAt).toLocaleString('zh-CN', { hour12: false })}`
                    : '尚未执行巡检 · 点击右侧立即检查'}
                </p>
              </div>

              <Button8State
                variant="secondary"
                size="sm"
                icon={<ArrowsClockwise className="w-4 h-4 text-accent" />}
                state={isCheckingUpdates ? 'loading' : 'default'}
                onClick={handleCheckUpdatesClick}
                className="btn-vessel-secondary w-full sm:w-auto min-h-[38px] px-4 font-medium"
              >
                立即巡检镜像
              </Button8State>
            </div>

            {/* Strategy Setting Items */}
            <div className="space-y-3">
              {/* Toggle 1 */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line transition-colors">
                <div className="pr-3">
                  <span className="text-xs font-semibold text-ink block">
                    启用定时镜像巡检与自动升级
                  </span>
                  <span className="text-[11px] text-ink-muted mt-0.5 block leading-relaxed">
                    后台定时比对远程 Digest，并在检测到新版时对开启自动升级的运行中应用拉取重载
                  </span>
                </div>
                <Switch
                  checked={autoCheckUpdates}
                  onChange={setAutoCheckUpdates}
                  size="sm"
                  aria-label="启用定时镜像巡检与自动升级"
                />
              </div>

              {/* Cron Expression */}
              <div className="p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-ink">
                    巡检周期 Cron 表达式
                  </label>
                  <span className="text-[11px] text-accent font-mono truncate font-medium">
                    {getCronDescription(checkSchedule, CHECK_PRESETS)}
                  </span>
                </div>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={checkSchedule}
                  onChange={(e) => setCheckSchedule(e.target.value)}
                  placeholder="0 */6 * * *"
                  className="w-full bg-paper-2 dark:bg-paper border border-line-strong rounded-xl px-3.5 py-2 min-h-[38px] text-xs text-ink font-mono placeholder:text-ink-muted focus:outline-none transition-colors shadow-sm"
                />
                {/* Horizontal Quick-pick Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[11px] text-ink-muted flex-shrink-0 flex items-center gap-1 mr-0.5">
                    <Clock className="w-3 h-3 text-ink-muted" />
                    快捷预设:
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
                          'text-[11px] font-mono px-2.5 py-0.5 rounded-full whitespace-nowrap transition-all select-none flex-shrink-0 cursor-pointer',
                          isSelected
                            ? 'bg-accent text-accent-contrast shadow-sm font-semibold'
                            : 'bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink border border-line'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Overview / Pending Updates List */}
              {appsWithUpdates.length > 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Sparkle className="w-4 h-4" weight="fill" />
                      检测到可更新的应用 ({appsWithUpdates.length})
                    </span>
                    <span className="text-[11px] text-ink-muted font-mono">
                      发现远程新 Digest
                    </span>
                  </div>

                  <div className="space-y-2">
                    {appsWithUpdates.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-lg bg-paper-2 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink truncate block">{a.name}</span>
                            <Badge variant={a.autoUpdate ? 'active' : 'default'}>
                              {a.autoUpdate ? '自动升级已启用' : '需手动确认'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-ink-muted font-mono truncate">
                            当前标签: {a.currentImageTag || 'latest'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {onUpdateApp && (
                            <button
                              type="button"
                              disabled={togglingAppId === a.id}
                              onClick={() => handleToggleAutoUpdate(a)}
                              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-line hover:bg-paper-3 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                              title={a.autoUpdate ? '点击切换为手动升级' : '点击开启此应用自动升级'}
                            >
                              {a.autoUpdate ? '设为手动升级' : '开启动态自动升级'}
                            </button>
                          )}
                          {onUpgradeApp && (
                            <Button8State
                              variant="primary"
                              size="sm"
                              state={rebuildingAppId === a.id ? 'loading' : 'default'}
                              onClick={() => handleUpgradeApp(a.id)}
                              className="text-[11px] min-h-[30px] px-3 font-medium cursor-pointer"
                            >
                              立即升级应用
                            </Button8State>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-paper-3/40 dark:bg-paper-3/50 border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" weight="fill" />
                      <span>受管镜像版本监控一览</span>
                    </div>
                    {apps.length > 0 && onUpdateApp && (
                      <button
                        type="button"
                        onClick={() => setShowPolicyList(!showPolicyList)}
                        className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer select-none font-medium"
                      >
                        <span>升级策略管理 ({autoUpdateCount}/{apps.length} 自动)</span>
                        {showPolicyList ? <CaretUp className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    已监听当前系统所有受管 Compose 应用栈，所有容器镜像摘要与远程 Registry 保持一致，无需手动拉取更新。
                  </p>

                  <div className="pt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{autoUpdateCount} 个应用已开启自动升级</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-ink-faint shrink-0" />
                      <span>{manualUpdateCount} 个保持手动确认</span>
                    </span>
                  </div>

                  {showPolicyList && apps.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-line space-y-2">
                      <p className="text-[11px] font-medium text-ink">
                        各应用自动升级策略（可即时切换）：
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {apps.map((app) => (
                          <div
                            key={app.id}
                            className="p-2.5 rounded-lg bg-paper-2 dark:bg-paper flex items-center justify-between text-xs border border-line shadow-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-medium text-ink truncate block">{app.name}</span>
                              <span className="text-[10px] text-ink-muted font-mono truncate block">
                                {app.currentImageTag || 'latest'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-ink-muted font-medium">
                                {app.autoUpdate ? '自动升级' : '仅巡检'}
                              </span>
                              <Switch
                                checked={app.autoUpdate}
                                onChange={() => handleToggleAutoUpdate(app)}
                                size="sm"
                                disabled={togglingAppId === app.id}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card Footer Action */}
          <div className="pt-4 border-t border-line flex items-center justify-between gap-3">
            <span className="text-[11px] text-ink-muted hidden sm:inline">
              巡检计划随配置保存即时生效
            </span>
            <Button8State
              variant="primary"
              size="sm"
              icon={<FloppyDiskBack className="w-4 h-4" weight="bold" />}
              state={isSavingCheck ? 'loading' : 'default'}
              onClick={handleSaveCheckSettings}
              className="w-full sm:w-auto min-h-[38px] px-5 text-xs font-semibold"
            >
              保存巡检策略
            </Button8State>
          </div>
        </div>
      </div>

      <DiskUsagePanel />
    </div>
  );
};
