import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  CloudArrowUp,
  Plus,
  Play,
  Warning,
  WarningCircle,
  Info,
  Icon,
} from '@phosphor-icons/react';
import {
  AppItem,
  DomainItem,
  R2Config,
  SystemMetrics,
  BackupRecord,
  MaintenanceConfig,
} from '../../types/index.js';
import { NavTab } from '../layout/Sidebar.js';
import { Badge } from '../common/Badge.js';
import { formatBytes, formatRelative } from '../../utils/format.js';
import { isDatabaseApp } from '../../utils/appKind.js';
import { useNotification } from '../../context/NotificationContext.js';

interface OverviewViewProps {
  metrics: SystemMetrics;
  apps: AppItem[];
  domains: DomainItem[];
  r2Config: R2Config | null;
  backups: BackupRecord[];
  maintenance?: MaintenanceConfig | null;
  onNavigate: (tab: NavTab) => void;
  onOpenApp: (appId: string) => void;
  onCreateApp?: () => void;
  onDeploy: (id: string) => Promise<unknown> | void;
  onTriggerBackup: () => Promise<unknown> | void;
  onTriggerPrune: () => Promise<unknown> | void;
}

const DAY = 86_400_000;
const CERT_WARN_DAYS = 14;
const DISK_WARN_PCT = 85;

type Tone = 'danger' | 'warn' | 'info';

interface Attention {
  key: string;
  tone: Tone;
  title: string;
  detail: string;
  action?: { label: string; run: () => void };
}

const TONE_RANK: Record<Tone, number> = { danger: 0, warn: 1, info: 2 };

const TONE_ICON: Record<Tone, { icon: Icon; className: string }> = {
  danger: { icon: WarningCircle, className: 'text-rose-600 dark:text-rose-400 bg-rose-500/[0.08]' },
  warn: { icon: Warning, className: 'text-amber-600 dark:text-amber-400 bg-amber-500/[0.10]' },
  info: { icon: Info, className: 'text-signal bg-signal-soft' },
};

const BACKUP_TYPE_LABEL: Record<BackupRecord['type'], string> = {
  system: '系统快照',
  app_db: '数据库',
  app_volume: '数据卷',
};

const pct = (used?: number | null, total?: number | null) =>
  used != null && total ? Math.min(100, (used / total) * 100) : null;

/* ---------- small building blocks ---------- */

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <section className={clsx('card-vessel !cursor-default', className)}>{children}</section>
);

const CardHeader: React.FC<{ title: string; meta?: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  meta,
  action,
}) => (
  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 h-14 border-b border-line-subtle">
    <div className="flex items-center gap-2 min-w-0">
      <h2 className="text-sm font-semibold text-ink truncate">{title}</h2>
      {meta}
    </div>
    {action}
  </div>
);

const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-[40px] -mr-2 px-2 inline-flex items-center gap-1 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
  >
    {children}
    <ArrowRight className="w-3.5 h-3.5" />
  </button>
);

const Kpi: React.FC<{
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  alert?: boolean;
  onClick: () => void;
}> = ({ label, value, sub, alert, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="card-vessel text-left p-4 sm:p-5 flex flex-col gap-3 min-h-[116px] group"
  >
    <span className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
      {label}
      {alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="需要注意" />}
    </span>
    <span className="text-[26px] sm:text-[30px] leading-none font-semibold text-ink tracking-[-0.03em] tabular-nums truncate">
      {value}
    </span>
    <span className="text-xs text-ink-muted truncate">{sub}</span>
  </button>
);

const Meter: React.FC<{ label: string; value: number | null; detail: string }> = ({ label, value, detail }) => {
  const high = value != null && value >= DISK_WARN_PCT;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className="font-mono text-ink-muted tabular-nums truncate">{detail}</span>
      </div>
      <div className={clsx('meter mt-2', high ? 'text-amber-500' : 'text-ink')}>
        <span style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
};

const AppAvatar: React.FC<{ name: string }> = ({ name }) => (
  <span
    aria-hidden="true"
    className="w-8 h-8 shrink-0 rounded-lg bg-paper-3 border border-line-subtle flex items-center justify-center text-[11px] font-semibold text-ink-muted uppercase font-mono"
  >
    {name.replace(/[^a-z0-9]/gi, '').slice(0, 2) || name.slice(0, 1)}
  </span>
);

/* ---------- view ---------- */

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  apps,
  domains,
  r2Config,
  backups,
  maintenance,
  onNavigate,
  onOpenApp,
  onCreateApp,
  onDeploy,
  onTriggerBackup,
}) => {
  const { toast } = useNotification();
  const [deployingAppId, setDeployingAppId] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const isDockerOnline = metrics.dockerStatus === 'running';
  const memPct = pct(metrics.memUsedBytes, metrics.memTotalBytes);
  const diskPct = pct(metrics.diskUsedBytes, metrics.diskTotalBytes);

  const running = apps.filter((a) => a.status === 'running').length;
  const failing = apps.filter((a) => a.status === 'error').length;
  const stopped = apps.filter((a) => a.status === 'stopped').length;

  const now = Date.now();
  const daysLeft = (iso?: string) => (iso ? Math.floor((new Date(iso).getTime() - now) / DAY) : null);
  const domainIssues = domains.filter((d) => {
    const left = daysLeft(d.sslExpiresAt);
    return d.sslStatus === 'error' || d.sslStatus === 'expired' || (left != null && left < CERT_WARN_DAYS);
  });

  const latestBackupAt = useMemo(() => {
    const times = [
      r2Config?.lastBackupAt,
      ...backups.filter((b) => b.status === 'completed').map((b) => b.createdAt),
    ].filter(Boolean) as string[];
    return times.sort().at(-1);
  }, [r2Config, backups]);

  /* Attention queue — everything here is derived from live data */
  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = [];

    if (!isDockerOnline) {
      items.push({
        key: 'docker',
        tone: 'danger',
        title: 'Docker 未连接',
        detail: '暂时无法部署或管理容器。请确认宿主机 Docker 服务已启动，并挂载了 /var/run/docker.sock。',
      });
    }

    for (const app of apps.filter((a) => a.status === 'error')) {
      items.push({
        key: `app-error:${app.id}`,
        tone: 'danger',
        title: `${app.name} 运行异常`,
        detail: '有容器启动失败或意外退出，查看日志了解原因。',
        action: { label: '查看应用', run: () => onOpenApp(app.id) },
      });
    }

    if (r2Config?.enabled && r2Config.lastBackupStatus === 'failed') {
      items.push({
        key: 'r2-failed',
        tone: 'danger',
        title: '系统备份失败',
        detail: r2Config.lastBackupMessage || `上次尝试于 ${formatRelative(r2Config.lastBackupAt)}`,
        action: { label: '查看备份', run: () => onNavigate('backups') },
      });
    }

    for (const app of apps) {
      const failed = (app.backupSchedules ?? []).filter((s) => s.enabled && s.lastBackupStatus === 'failed');
      if (failed.length) {
        items.push({
          key: `db-backup:${app.id}`,
          tone: 'danger',
          title: `${app.name} 数据库备份失败`,
          detail: `${failed.length} 个备份计划最近一次失败（${formatRelative(failed[0].lastBackupAt)}）。`,
          action: { label: '查看应用', run: () => onOpenApp(app.id) },
        });
      }
    }

    for (const d of domains) {
      const left = daysLeft(d.sslExpiresAt);
      if (d.sslStatus === 'error' || d.sslStatus === 'expired') {
        items.push({
          key: `cert:${d.id}`,
          tone: 'danger',
          title: `${d.domain} 证书${d.sslStatus === 'expired' ? '已过期' : '签发失败'}`,
          detail: '访客会看到安全警告。检查 DNS 解析是否指向本机，然后重新签发。',
          action: { label: '处理', run: () => onNavigate('domains') },
        });
      } else if (left != null && left < CERT_WARN_DAYS) {
        items.push({
          key: `cert-soon:${d.id}`,
          tone: 'warn',
          title: `${d.domain} 证书 ${Math.max(0, left)} 天后到期`,
          detail: '通常会自动续期；若临近到期仍未更新，请检查 Caddy 日志。',
          action: { label: '查看', run: () => onNavigate('domains') },
        });
      }
    }

    if (diskPct != null && diskPct >= DISK_WARN_PCT) {
      items.push({
        key: 'disk',
        tone: 'warn',
        title: `磁盘已使用 ${diskPct.toFixed(0)}%`,
        detail: '清理悬空镜像与构建缓存可以释放空间。',
        action: { label: '去清理', run: () => onNavigate('maintenance') },
      });
    }

    const outdated = apps.filter((a) => a.updateAvailable);
    if (outdated.length) {
      items.push({
        key: 'updates',
        tone: 'info',
        title: `${outdated.length} 个应用有镜像更新`,
        detail: outdated.map((a) => a.name).slice(0, 4).join('、') + (outdated.length > 4 ? ' 等' : ''),
        action: { label: '去更新', run: () => onNavigate('maintenance') },
      });
    }

    if (!r2Config?.enabled) {
      items.push({
        key: 'r2-off',
        tone: 'info',
        title: '尚未配置异地备份',
        detail: '启用 Cloudflare R2 后，系统快照与数据库会按计划自动上传。',
        action: { label: '去配置', run: () => onNavigate('backups') },
      });
    }

    return items.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDockerOnline, apps, domains, r2Config, diskPct]);

  const recentApps = useMemo(
    () =>
      [...apps]
        .sort((a, b) => (b.lastDeployedAt ?? b.updatedAt ?? '').localeCompare(a.lastDeployedAt ?? a.updatedAt ?? ''))
        .slice(0, 6),
    [apps]
  );

  const activity = useMemo(() => {
    const events: { key: string; at: string; text: string; failed?: boolean }[] = [];
    for (const b of backups) {
      events.push({
        key: `b:${b.id}`,
        at: b.createdAt,
        text: `${b.type === 'system' ? '' : `${b.targetName} `}${BACKUP_TYPE_LABEL[b.type]}备份${b.status === 'failed' ? '失败' : b.status === 'uploading' ? '上传中' : '完成'}`,
        failed: b.status === 'failed',
      });
    }
    for (const a of apps) {
      if (a.lastDeployedAt) events.push({ key: `d:${a.id}`, at: a.lastDeployedAt, text: `部署 ${a.name}` });
    }
    if (maintenance?.lastPruneAt) {
      events.push({
        key: 'prune',
        at: maintenance.lastPruneAt,
        text: `清理磁盘，释放 ${formatBytes(maintenance.lastFreedBytes ?? 0)}`,
      });
    }
    if (maintenance?.lastCheckedAt) {
      events.push({ key: 'check', at: maintenance.lastCheckedAt, text: '巡检镜像更新' });
    }
    return events.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 6);
  }, [backups, apps, maintenance]);

  const handleDeploy = async (id: string) => {
    if (!isDockerOnline) return;
    setDeployingAppId(id);
    try {
      await onDeploy(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '启动失败');
    } finally {
      setDeployingAppId(null);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await onTriggerBackup();
      toast.success('系统备份已开始');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '备份失败');
    } finally {
      setIsBackingUp(false);
    }
  };

  const dangerCount = attention.filter((a) => a.tone === 'danger').length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Intro + primary actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-muted">应用、域名与备份的当前状态，需要处理的事项排在最前。</p>
        <div className="flex items-center gap-2 shrink-0">
          {r2Config?.enabled && (
            <button
              type="button"
              onClick={handleBackup}
              disabled={isBackingUp}
              className="btn-vessel-secondary min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer disabled:opacity-60"
            >
              {isBackingUp ? (
                <CircleNotch className="w-4 h-4 animate-spin" />
              ) : (
                <CloudArrowUp className="w-4 h-4" />
              )}
              立即备份
            </button>
          )}
          {onCreateApp && (
            <button
              type="button"
              onClick={onCreateApp}
              className="btn-vessel-primary min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" weight="bold" />
              新建应用
            </button>
          )}
        </div>
      </div>

      {/* Attention queue */}
      <Card>
        <CardHeader
          title="需要处理"
          meta={
            attention.length > 0 && (
              <span
                className={clsx(
                  'min-w-[20px] px-1.5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center tabular-nums',
                  dangerCount ? 'bg-rose-500/[0.10] text-rose-700 dark:text-rose-400' : 'bg-paper-3 text-ink-muted'
                )}
              >
                {attention.length}
              </span>
            )
          }
        />
        {attention.length === 0 ? (
          <div className="px-4 sm:px-5 py-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" weight="fill" />
            <div>
              <p className="text-sm font-medium text-ink">一切正常</p>
              <p className="text-xs text-ink-muted mt-0.5">没有失败的备份、即将过期的证书或待更新的镜像。</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {attention.map((item) => {
              const { icon: ToneIcon, className } = TONE_ICON[item.tone];
              return (
                <li key={item.key} className="px-4 sm:px-5 py-3.5 flex items-start sm:items-center gap-3">
                  <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', className)}>
                    <ToneIcon className="w-[18px] h-[18px]" weight="fill" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-ink-muted mt-0.5 break-words">{item.detail}</p>
                  </div>
                  {item.action && (
                    <button
                      type="button"
                      onClick={item.action.run}
                      className="btn-vessel-secondary shrink-0 min-h-[36px] px-3 text-xs rounded-lg cursor-pointer"
                    >
                      {item.action.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="应用"
          value={apps.length}
          alert={failing > 0}
          sub={
            failing > 0
              ? `${running} 运行 · ${failing} 异常`
              : `${running} 运行 · ${stopped} 停止`
          }
          onClick={() => onNavigate('apps')}
        />
        <Kpi
          label="域名"
          value={domains.length}
          alert={domainIssues.length > 0}
          sub={domainIssues.length ? `${domainIssues.length} 个证书需关注` : domains.length ? '证书全部有效' : '尚未绑定域名'}
          onClick={() => onNavigate('domains')}
        />
        <Kpi
          label="最近备份"
          value={<span className="text-[22px] sm:text-[24px]">{formatRelative(latestBackupAt)}</span>}
          alert={r2Config?.lastBackupStatus === 'failed'}
          sub={r2Config?.enabled ? `R2 · ${r2Config.bucketName}` : '未配置异地备份'}
          onClick={() => onNavigate('backups')}
        />
        <Kpi
          label="磁盘"
          value={diskPct != null ? `${diskPct.toFixed(0)}%` : '—'}
          alert={diskPct != null && diskPct >= DISK_WARN_PCT}
          sub={
            maintenance?.lastFreedBytes
              ? `上次清理释放 ${formatBytes(maintenance.lastFreedBytes)}`
              : metrics.diskTotalBytes
              ? `${formatBytes(metrics.diskUsedBytes ?? 0)} / ${formatBytes(metrics.diskTotalBytes)}`
              : '暂无数据'
          }
          onClick={() => onNavigate('maintenance')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start">
        {/* Apps table */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader
            title="应用"
            meta={<span className="text-xs text-ink-faint tabular-nums">{apps.length}</span>}
            action={<LinkButton onClick={() => onNavigate('apps')}>全部应用</LinkButton>}
          />
          {apps.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-ink">还没有应用</p>
              <p className="text-xs text-ink-muted mt-1">粘贴一份 docker-compose.yml，就能部署第一个应用。</p>
              {onCreateApp && (
                <button
                  type="button"
                  onClick={onCreateApp}
                  className="btn-vessel-primary mt-4 min-h-[40px] px-4 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" weight="bold" />
                  新建应用
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-left text-xs text-ink-faint">
                    <th scope="col" className="font-medium px-4 sm:px-5 py-2.5">名称</th>
                    <th scope="col" className="font-medium px-3 py-2.5">类型</th>
                    <th scope="col" className="font-medium px-3 py-2.5">状态</th>
                    <th scope="col" className="font-medium px-3 py-2.5">域名</th>
                    <th scope="col" className="font-medium px-4 sm:px-5 py-2.5 text-right">部署</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle border-t border-line-subtle">
                  {recentApps.map((app) => {
                    const domain = domains.find((d) => d.appId === app.id);
                    const isDb = isDatabaseApp(app);
                    const canStart = app.status === 'stopped';
                    return (
                      <tr key={app.id} className="hover:bg-paper-3/50 transition-colors">
                        <td className="px-4 sm:px-5 py-2.5">
                          <button
                            type="button"
                            onClick={() => onOpenApp(app.id)}
                            className="flex items-center gap-2.5 min-h-[40px] text-left cursor-pointer group"
                          >
                            <AppAvatar name={app.name} />
                            <span className="min-w-0">
                              <span className="block font-medium text-ink truncate max-w-[180px] group-hover:text-signal transition-colors">
                                {app.name}
                              </span>
                              {app.updateAvailable && (
                                <span className="block text-[11px] text-signal">有可用更新</span>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-ink-muted whitespace-nowrap">
                          {isDb ? '数据库' : `Compose · ${app.containers.length} 容器`}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={app.status}>{app.status}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-ink-muted truncate max-w-[180px]">
                          {domain?.domain ?? <span className="text-ink-faint">—</span>}
                        </td>
                        <td className="px-4 sm:px-5 py-2.5 text-right whitespace-nowrap">
                          {canStart ? (
                            <button
                              type="button"
                              onClick={() => handleDeploy(app.id)}
                              disabled={!isDockerOnline || deployingAppId === app.id}
                              data-tooltip={!isDockerOnline ? '等待 Docker 连接后再操作' : undefined}
                              className="btn-vessel-secondary min-h-[34px] px-2.5 text-xs inline-flex items-center gap-1 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deployingAppId === app.id ? (
                                <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5" weight="fill" />
                              )}
                              启动
                            </button>
                          ) : (
                            <span className="text-xs text-ink-muted">{formatRelative(app.lastDeployedAt)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-5 sm:space-y-6">
          {/* Host resources */}
          <Card>
            <CardHeader
              title="主机资源"
              meta={
                <span className="text-xs text-ink-faint">
                  {isDockerOnline ? `${metrics.runningContainers} 个容器运行中` : 'Docker 未连接'}
                </span>
              }
            />
            <div className="px-4 sm:px-5 py-4 space-y-4">
              <Meter label="CPU" value={Math.min(100, metrics.cpuUsage)} detail={`${metrics.cpuUsage.toFixed(0)}%`} />
              <Meter
                label="内存"
                value={memPct}
                detail={`${formatBytes(metrics.memUsedBytes)} / ${formatBytes(metrics.memTotalBytes)}`}
              />
              <Meter
                label="磁盘"
                value={diskPct}
                detail={
                  metrics.diskTotalBytes
                    ? `${formatBytes(metrics.diskUsedBytes ?? 0)} / ${formatBytes(metrics.diskTotalBytes)}`
                    : '—'
                }
              />
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader title="最近活动" />
            {activity.length === 0 ? (
              <p className="px-5 py-6 text-xs text-ink-muted">部署、备份和清理记录会显示在这里。</p>
            ) : (
              <ol className="px-4 sm:px-5 py-3">
                {activity.map((ev, i) => (
                  <li key={ev.key} className="relative flex gap-3 py-2">
                    {i < activity.length - 1 && (
                      <span aria-hidden="true" className="absolute left-[3.5px] top-[18px] bottom-[-8px] w-px bg-line" />
                    )}
                    <span
                      aria-hidden="true"
                      className={clsx(
                        'mt-[6px] w-2 h-2 rounded-full shrink-0 ring-2 ring-paper-2',
                        ev.failed ? 'bg-rose-500' : 'bg-ink-faint'
                      )}
                    />
                    <div className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
                      <span className={clsx('text-[13px] truncate', ev.failed ? 'text-rose-700 dark:text-rose-400' : 'text-ink')}>
                        {ev.text}
                      </span>
                      <span className="text-[11px] text-ink-faint whitespace-nowrap">{formatRelative(ev.at)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
