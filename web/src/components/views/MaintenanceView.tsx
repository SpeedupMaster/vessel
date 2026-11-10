import React, { useState } from 'react';
import clsx from 'clsx';
import {
  ArrowsClockwise,
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  Database,
  Info,
  ShieldCheck,
  Stack,
} from '@phosphor-icons/react';
import { MaintenanceConfig, AppItem } from '../../types/index.js';
import { Switch } from '../common/Switch.js';
import { NumberInput } from '../common/NumberInput.js';
import { useNotification } from '../../context/NotificationContext.js';
import { formatBytes, formatRelative } from '../../utils/format.js';
import { isDatabaseApp } from '../../utils/appKind.js';
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
  { label: '每周日 04:00', expr: '0 4 * * 0' },
  { label: '每天 04:00', expr: '0 4 * * *' },
  { label: '周一、四 03:00', expr: '0 3 * * 1,4' },
  { label: '每月 1 日 04:00', expr: '0 4 1 * *' },
];

const CHECK_PRESETS = [
  { label: '每小时', expr: '0 * * * *' },
  { label: '每 6 小时', expr: '0 */6 * * *' },
  { label: '每 12 小时', expr: '0 */12 * * *' },
  { label: '每天 02:00', expr: '0 2 * * *' },
];

const presetLabel = (cron: string, presets: { label: string; expr: string }[]) =>
  presets.find((p) => p.expr === cron.trim())?.label ?? `自定义 · ${cron.trim()}`;

const shortDigest = (d?: string) => (d ? d.replace(/^sha256:/, '').slice(0, 12) : null);

const inputCls =
  'w-full bg-paper-2 border border-line-strong rounded-lg px-3 min-h-[40px] text-[13px] text-ink font-mono placeholder:text-ink-faint focus:outline-none focus:border-signal focus:ring-2 focus:ring-signal-ring';

const CronField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: { label: string; expr: string }[];
  hint?: React.ReactNode;
}> = ({ id, label, value, onChange, presets, hint }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-ink mb-1.5">
      {label}
    </label>
    <input
      id={id}
      type="text"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
    <div className="mt-2 flex flex-wrap gap-1.5">
      {presets.map((p) => {
        const on = value.trim() === p.expr;
        return (
          <button
            key={p.expr}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p.expr)}
            className={clsx(
              'min-h-[30px] px-2.5 rounded-md text-xs transition-colors cursor-pointer',
              on ? 'bg-accent text-accent-contrast' : 'bg-paper-3 text-ink-muted hover:text-ink'
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
    {hint && <p className="mt-1.5 text-[11px] text-ink-muted">{hint}</p>}
  </div>
);

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
  const [savingWhat, setSavingWhat] = useState<'prune' | 'check' | null>(null);
  const [upgradingIds, setUpgradingIds] = useState<string[]>([]);
  const [isUpgradingAll, setIsUpgradingAll] = useState(false);
  const [togglingAppId, setTogglingAppId] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [listMode, setListMode] = useState<'updates' | 'all'>('updates');

  const appsWithUpdates = apps.filter((a) => a.updateAvailable);
  const autoUpdateCount = apps.filter((a) => a.autoUpdate).length;
  const listed = listMode === 'updates' ? appsWithUpdates : [...apps].sort((a, b) => a.name.localeCompare(b.name));

  const handlePrune = async () => {
    setIsPruning(true);
    try {
      const res = await onTriggerPrune();
      toast.success(res?.summary || '安全清理已完成');
    } catch (e: any) {
      toast.error(`清理失败: ${e.message}`);
    } finally {
      setIsPruning(false);
    }
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const res = await onTriggerCheckUpdates();
      if (res?.success === false) toast.warning(res.message || '部分镜像巡检失败，未执行升级');
      else toast.success(res?.message || '镜像巡检完成');
    } catch (e: any) {
      toast.error(`巡检失败: ${e.message}`);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const upgradeOne = async (app: AppItem) => {
    if (!onUpgradeApp) return;
    setUpgradingIds((ids) => [...ids, app.id]);
    try {
      const result = await onUpgradeApp(app.id);
      if (result.updated) toast.success(result.message);
      else toast.info(result.message);
    } catch (err: any) {
      toast.error(`${app.name} 升级失败: ${err.message}`);
    } finally {
      setUpgradingIds((ids) => ids.filter((id) => id !== app.id));
    }
  };

  const handleUpgradeAll = async () => {
    setIsUpgradingAll(true);
    try {
      // One at a time: each upgrade pulls images and recreates containers.
      for (const app of appsWithUpdates) await upgradeOne(app);
    } finally {
      setIsUpgradingAll(false);
    }
  };

  const handleToggleAutoUpdate = async (app: AppItem) => {
    if (!onUpdateApp) return;
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

  const handleSave = async (what: 'prune' | 'check') => {
    setSavingWhat(what);
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
      toast.success(what === 'prune' ? '自动清理策略已保存' : '巡检计划已保存');
      if (what === 'check') setShowSchedule(false);
    } catch (e: any) {
      toast.error(`保存失败: ${e.message}`);
    } finally {
      setSavingWhat(null);
    }
  };

  const ruleCls = 'flex items-start gap-2.5 min-h-[36px] py-1.5 cursor-pointer';
  const checkboxCls = 'mt-0.5 w-4 h-4 rounded accent-[var(--color-accent)] cursor-pointer shrink-0';

  return (
    <div className="space-y-5 sm:space-y-6">
      <p className="text-sm text-ink-muted max-w-2xl">
        镜像更新巡检与磁盘安全清理。两者都按计划自动运行，也可以在这里手动触发。
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 sm:gap-6 items-start">
        <div className="space-y-5 sm:space-y-6 min-w-0">
          {/* ============ Image updates ============ */}
          <section aria-labelledby="updates-title" className="card-vessel !cursor-default overflow-hidden">
            <div className="min-h-14 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-subtle">
              <div className="min-w-0">
                <h2 id="updates-title" className="text-sm font-semibold text-ink flex items-center gap-2">
                  镜像更新
                  {appsWithUpdates.length > 0 && (
                    <span className="px-1.5 min-w-[20px] h-5 rounded-md bg-signal-soft text-signal text-xs font-medium inline-flex items-center justify-center">
                      {appsWithUpdates.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-ink-muted">
                  按平台比对远程 Digest
                  <span className="mx-1.5 text-ink-faint">·</span>
                  {autoCheckUpdates ? presetLabel(checkSchedule, CHECK_PRESETS) : '定时巡检已关闭'}
                  <span className="mx-1.5 text-ink-faint">·</span>
                  {maintenance?.lastCheckedAt ? `上次 ${formatRelative(maintenance.lastCheckedAt)}` : '尚未巡检'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSchedule((v) => !v)}
                  aria-expanded={showSchedule}
                  aria-controls="check-schedule"
                  className={clsx(
                    'btn-vessel-secondary min-h-[36px] !px-3 text-[13px] inline-flex items-center gap-1.5 rounded-lg cursor-pointer',
                    showSchedule && '!bg-paper-3'
                  )}
                >
                  <CalendarBlank className="w-4 h-4" />
                  巡检计划
                </button>
                <button
                  type="button"
                  onClick={handleCheckUpdates}
                  disabled={isCheckingUpdates}
                  className="btn-vessel-primary min-h-[36px] px-3 text-[13px] inline-flex items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  <ArrowsClockwise className={clsx('w-4 h-4', isCheckingUpdates && 'animate-spin')} />
                  {isCheckingUpdates ? '巡检中…' : '立即巡检'}
                </button>
              </div>
            </div>

            {showSchedule && (
              <div id="check-schedule" className="px-4 sm:px-5 py-4 bg-paper-3/40 border-b border-line-subtle space-y-4">
                <Switch
                  checked={autoCheckUpdates}
                  onChange={setAutoCheckUpdates}
                  size="sm"
                  label="定时巡检"
                  description="检测到新版本时，开启了自动升级且正在运行的应用会自动拉取并重建。"
                />
                {autoCheckUpdates && (
                  <CronField
                    id="check-cron"
                    label="巡检周期（Cron）"
                    value={checkSchedule}
                    onChange={setCheckSchedule}
                    presets={CHECK_PRESETS}
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSchedule(false)}
                    className="btn-vessel-secondary min-h-[36px] !px-3 text-[13px] rounded-lg cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave('check')}
                    disabled={savingWhat !== null}
                    className="btn-vessel-primary min-h-[36px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {savingWhat === 'check' && <CircleNotch className="w-4 h-4 animate-spin" />}
                    保存计划
                  </button>
                </div>
              </div>
            )}

            {/* List mode */}
            <div className="px-4 sm:px-5 pt-3 flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" aria-label="列表范围" className="inline-flex p-1 rounded-lg bg-paper-3">
                {(
                  [
                    ['updates', '可更新', appsWithUpdates.length],
                    ['all', '全部应用', apps.length],
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={listMode === key}
                    onClick={() => setListMode(key)}
                    className={clsx(
                      'min-h-[30px] px-3 rounded-md text-xs font-medium transition-colors cursor-pointer',
                      listMode === key ? 'bg-paper-2 text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    {label}
                    <span className="ml-1 text-ink-faint">{count}</span>
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-muted">
                {autoUpdateCount}/{apps.length} 个应用开启自动升级
              </span>
            </div>

            {listed.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle className="w-6 h-6 mx-auto text-emerald-600 dark:text-emerald-400" weight="fill" />
                <p className="mt-2 text-sm font-medium text-ink">
                  {listMode === 'updates' ? '所有镜像都是最新的' : '还没有应用'}
                </p>
                {listMode === 'updates' && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {maintenance?.lastCheckedAt
                      ? `${formatRelative(maintenance.lastCheckedAt)}巡检，没有发现新的 Digest。`
                      : '点击「立即巡检」比对一次远程镜像。'}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div
                  aria-hidden="true"
                  className="hidden md:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_96px_96px] gap-4 px-5 mt-3 h-9 items-center text-xs text-ink-faint border-y border-line-subtle"
                >
                  <span>应用</span>
                  <span>镜像 · Digest</span>
                  <span>自动升级</span>
                  <span className="text-right">操作</span>
                </div>
                <ul className="divide-y divide-line-subtle md:mt-0 mt-3 border-t md:border-t-0 border-line-subtle">
                  {listed.map((a) => {
                    const busy = upgradingIds.includes(a.id);
                    const from = shortDigest(a.currentDigest);
                    const to = shortDigest(a.latestDigest);
                    return (
                      <li
                        key={a.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_96px_96px] gap-x-4 gap-y-1.5 px-4 sm:px-5 py-3 items-center"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-paper-3 text-ink-muted flex items-center justify-center shrink-0">
                            {isDatabaseApp(a) ? <Database className="w-4 h-4" /> : <Stack className="w-4 h-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-ink truncate">{a.name}</p>
                            <p className="text-[11px] text-ink-faint">
                              {a.updateAvailable ? (
                                <span className="text-signal">有新版本</span>
                              ) : (
                                '已是最新'
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Mobile: switch at the right of the first row */}
                        <div className="md:hidden justify-self-end">
                          {onUpdateApp && (
                            <Switch
                              checked={a.autoUpdate}
                              onChange={() => handleToggleAutoUpdate(a)}
                              disabled={togglingAppId === a.id}
                              size="sm"
                              aria-label={`${a.name} 自动升级`}
                            />
                          )}
                        </div>

                        <div className="min-w-0 col-span-2 md:col-span-1">
                          <p className="font-mono text-xs text-ink-muted truncate">{a.currentImageTag || 'latest'}</p>
                          {from && (
                            <p className="font-mono text-[11px] text-ink-faint flex items-center gap-1 min-w-0">
                              <span className="truncate">{from}</span>
                              {a.updateAvailable && to && to !== from && (
                                <>
                                  <ArrowRight className="w-3 h-3 shrink-0" />
                                  <span className="truncate text-ink">{to}</span>
                                </>
                              )}
                            </p>
                          )}
                        </div>

                        <div className="hidden md:block">
                          {onUpdateApp && (
                            <Switch
                              checked={a.autoUpdate}
                              onChange={() => handleToggleAutoUpdate(a)}
                              disabled={togglingAppId === a.id}
                              size="sm"
                              aria-label={`${a.name} 自动升级`}
                            />
                          )}
                        </div>

                        <div className="col-span-2 md:col-span-1 flex justify-end">
                          {a.updateAvailable && onUpgradeApp && (
                            <button
                              type="button"
                              onClick={() => upgradeOne(a)}
                              disabled={busy || isUpgradingAll}
                              className="btn-vessel-secondary min-h-[34px] !px-3 text-xs inline-flex items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                            >
                              {busy && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                              {busy ? '升级中…' : '升级'}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-line-subtle">
              <p className="flex items-start gap-1.5 text-xs text-ink-muted">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                升级只拉取并替换有更新的服务；固定 Digest 的镜像不会被自动升级。
              </p>
              {appsWithUpdates.length > 1 && onUpgradeApp && (
                <button
                  type="button"
                  onClick={handleUpgradeAll}
                  disabled={isUpgradingAll}
                  className="btn-vessel-primary shrink-0 min-h-[36px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {isUpgradingAll && <CircleNotch className="w-4 h-4 animate-spin" />}
                  全部升级 ({appsWithUpdates.length})
                </button>
              )}
            </div>
          </section>

          {/* ============ Disk usage ============ */}
          <DiskUsagePanel onPrune={handlePrune} isPruning={isPruning} />
        </div>

        {/* ============ Auto-prune policy ============ */}
        <aside aria-labelledby="prune-title" className="card-vessel !cursor-default overflow-hidden xl:sticky xl:top-4">
          <div className="h-14 px-4 sm:px-5 flex items-center justify-between gap-3 border-b border-line-subtle">
            <h2 id="prune-title" className="text-sm font-semibold text-ink">
              自动清理策略
            </h2>
            <Switch checked={autoPrune} onChange={setAutoPrune} size="sm" aria-label="启用自动清理" />
          </div>

          <div className={clsx('p-4 sm:p-5 space-y-5', !autoPrune && 'opacity-60')}>
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">冷却期</label>
              <NumberInput min={1} value={unusedRetentionHours} onChange={setUnusedRetentionHours} unit="小时" />
              <p className="mt-1.5 text-[11px] text-ink-muted leading-relaxed">
                镜像从不再被任何容器引用时开始计时，满冷却期后才删除，更新后被替换的旧镜像在此期间仍可回滚。
              </p>
            </div>

            <fieldset>
              <legend className="text-xs font-medium text-ink mb-1">清理范围</legend>
              <label className={ruleCls}>
                <input type="checkbox" checked disabled className={checkboxCls} />
                <span className="text-[13px] text-ink">
                  未被引用的镜像
                  <span className="block text-[11px] text-ink-muted">始终包含，按冷却期计算</span>
                </span>
              </label>
              <label className={ruleCls}>
                <input
                  type="checkbox"
                  checked={pruneDangling}
                  onChange={(e) => setPruneDangling(e.target.checked)}
                  className={checkboxCls}
                />
                <span className="text-[13px] text-ink">
                  悬空镜像
                  <span className="block text-[11px] text-ink-muted">无标签的 &lt;none&gt; 镜像</span>
                </span>
              </label>
              <label className={ruleCls}>
                <input
                  type="checkbox"
                  checked={pruneBuilderCache}
                  onChange={(e) => setPruneBuilderCache(e.target.checked)}
                  className={checkboxCls}
                />
                <span className="text-[13px] text-ink">
                  构建缓存
                  <span className="block text-[11px] text-ink-muted">超过冷却期未被使用的 BuildKit 缓存</span>
                </span>
              </label>
              <label className={ruleCls}>
                <input
                  type="checkbox"
                  checked={pruneStoppedContainers}
                  onChange={(e) => setPruneStoppedContainers(e.target.checked)}
                  className={checkboxCls}
                />
                <span className="text-[13px] text-ink">
                  长期停止的容器
                  <span className="block text-[11px] text-ink-muted">不属于 Vessel 应用的，如 docker run 遗留</span>
                </span>
              </label>
              {pruneStoppedContainers && (
                <div className="pl-[26px] mt-1 flex items-center gap-2">
                  <span className="text-xs text-ink-muted shrink-0">停止超过</span>
                  <div className="w-36">
                    <NumberInput min={1} value={stoppedContainerDays} onChange={setStoppedContainerDays} unit="天" />
                  </div>
                </div>
              )}
            </fieldset>

            <CronField
              id="prune-cron"
              label="执行时间（Cron）"
              value={pruneSchedule}
              onChange={setPruneSchedule}
              presets={PRUNE_PRESETS}
              hint={
                maintenance?.lastPruneAt
                  ? `上次 ${formatRelative(maintenance.lastPruneAt)}，释放 ${formatBytes(maintenance.lastFreedBytes ?? 0)}`
                  : '尚未执行过清理'
              }
            />

            <p className="flex items-start gap-1.5 p-3 rounded-lg bg-paper-3 text-xs text-ink-muted">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" weight="fill" />
              数据卷和 Vessel 应用的容器永远不会被清理。
            </p>
          </div>

          <div className="px-4 sm:px-5 py-3 border-t border-line-subtle flex justify-end">
            <button
              type="button"
              onClick={() => handleSave('prune')}
              disabled={savingWhat !== null}
              className="btn-vessel-primary w-full sm:w-auto min-h-[40px] px-4 text-[13px] inline-flex items-center justify-center gap-1.5 rounded-xl cursor-pointer disabled:opacity-60"
            >
              {savingWhat === 'prune' && <CircleNotch className="w-4 h-4 animate-spin" />}
              保存策略
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
