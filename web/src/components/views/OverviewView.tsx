import React, { useState } from 'react';
import {
  HardDrives,
  Globe,
  CloudArrowUp,
  WarningCircle,
  Broom,
  ArrowRight,
  ArrowUpRight,
  Play,
  CircleNotch,
  Plus,
  LockSimple,
  Icon,
} from '@phosphor-icons/react';
import { AppItem, DomainItem, R2Config, SystemMetrics, BackupRecord } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { Badge } from '../common/Badge.js';
import clsx from 'clsx';

interface OverviewViewProps {
  metrics: SystemMetrics;
  apps: AppItem[];
  domains: DomainItem[];
  r2Config: R2Config | null;
  backups: BackupRecord[];
  onNavigate: (tab: any) => void;
  onDeploy: (id: string) => void;
  onTriggerBackup: () => void;
  onTriggerPrune: () => void;
}

const TONE: Record<'ink' | 'emerald' | 'amber' | 'signal', string> = {
  ink: 'text-ink',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  signal: 'text-signal',
};

const KpiCard: React.FC<{
  label: string;
  icon: Icon;
  tone: keyof typeof TONE;
  onClick: () => void;
  value: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon: KpiIcon, tone, onClick, value, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="card-vessel group text-left p-4 sm:p-5 lg:p-6 flex flex-col justify-between min-h-[132px]"
  >
    <div className="flex items-start justify-between gap-2 w-full">
      {/* Wrap rather than truncate: the 4-up grid leaves little room around 800px */}
      <span className="eyebrow min-w-0 pt-2 leading-snug line-clamp-2 break-words" title={label}>{label}</span>
      <div
        className={clsx(
          'w-8 h-8 rounded-[10px] bg-paper-3 border border-line-subtle flex items-center justify-center shrink-0 transition-transform duration-300 ease-spring group-hover:scale-110 group-hover:-rotate-6',
          TONE[tone]
        )}
      >
        <KpiIcon className="w-4 h-4" weight="duotone" />
      </div>
    </div>
    <div className="mt-5 w-full">
      <div className="text-[28px] sm:text-[32px] lg:text-[38px] leading-none font-semibold text-ink tracking-[-0.03em] tabular-nums">
        {value}
      </div>
      <div className="mt-2.5 text-[11px] sm:text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
    <ArrowUpRight className="absolute right-4 bottom-4 w-3.5 h-3.5 text-ink-faint opacity-0 -translate-x-1 translate-y-1 transition-all duration-300 ease-out-expo group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0" />
  </button>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 pb-4">
    <div className="min-w-0">
      <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      {subtitle && <p className="text-xs text-ink-faint mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="group shrink-0 min-h-[36px] sm:min-h-0 px-2.5 py-1 -mr-1.5 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center gap-1 transition-colors cursor-pointer"
  >
    <span>{children}</span>
    <ArrowRight className="w-3 h-3 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
  </button>
);

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  apps,
  domains,
  r2Config,
  backups,
  onNavigate,
  onDeploy,
  onTriggerBackup,
  onTriggerPrune,
}) => {
  const [deployingAppId, setDeployingAppId] = useState<string | null>(null);

  const isDockerOnline = metrics.dockerStatus === 'running';
  const runningApps = apps.filter((a) => a.status === 'running');
  const updatesCount = apps.filter((a) => a.updateAvailable).length;

  const handleDeploy = async (id: string) => {
    if (!isDockerOnline) return;
    try {
      setDeployingAppId(id);
      await onDeploy(id);
    } finally {
      setDeployingAppId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Docker offline banner */}
      {!isDockerOnline && (
        <div
          role="alert"
          className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/[0.09] via-amber-500/[0.05] to-transparent p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-4"
        >
          <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
            <div className="w-8 h-8 rounded-[10px] bg-amber-500/15 flex items-center justify-center shrink-0">
              <WarningCircle className="w-[18px] h-[18px] text-amber-600 dark:text-amber-400" weight="fill" />
            </div>
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-semibold tracking-tight text-amber-900 dark:text-amber-200 break-words">
                Docker Daemon 未响应或正在连接中
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70 leading-relaxed break-words">
                Vessel 平台已就绪。请确认宿主机 Docker 服务（如 Docker Desktop 或 systemd docker）已启动并挂载 /var/run/docker.sock。
              </p>
            </div>
          </div>
          <span className="w-full sm:w-auto shrink-0 min-h-[36px] sm:min-h-0 text-xs px-3.5 py-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-medium inline-flex items-center justify-center gap-2">
            <CircleNotch className="w-3.5 h-3.5 animate-spin" />
            连接中
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Compose 应用" icon={HardDrives} tone="ink" onClick={() => onNavigate('apps')} value={<RollingCounter value={apps.length} />}>
          <span className={runningApps.length > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
            {runningApps.length} 运行中
          </span>
          <span className="text-ink-faint">·</span>
          <span>{metrics.runningContainers ?? '—'} 容器</span>
          {updatesCount > 0 && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">{updatesCount} 待更新</span>
            </>
          )}
        </KpiCard>

        <KpiCard label="域名与 SSL" icon={Globe} tone="emerald" onClick={() => onNavigate('domains')} value={<RollingCounter value={domains.length} />}>
          <LockSimple className="w-3 h-3 text-emerald-600 dark:text-emerald-400" weight="fill" />
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Caddy 自动证书</span>
        </KpiCard>

        <KpiCard label="R2 备份" icon={CloudArrowUp} tone="signal" onClick={() => onNavigate('backups')} value={<RollingCounter value={backups.length} />}>
          <span>已存快照</span>
          <span className="text-ink-faint">·</span>
          <span className={r2Config?.enabled ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-faint'}>
            {r2Config?.enabled ? '已开启' : '未配置'}
          </span>
        </KpiCard>

        <KpiCard
          label="安全镜像瘦身"
          icon={Broom}
          tone="amber"
          onClick={() => onNavigate('maintenance')}
          value={
            <>
              72<span className="text-base sm:text-lg text-ink-faint font-normal ml-0.5 tracking-normal">h</span>
            </>
          }
        >
          <span className="text-amber-600 dark:text-amber-400 font-medium">镜像保留保护期</span>
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Managed applications */}
        <div className="lg:col-span-2 card-vessel p-5 sm:p-6 lg:p-7 flex flex-col">
          <SectionHeader
            title="受管 Compose 应用"
            subtitle="原生 Docker Compose 编排托管容器组"
            action={<LinkButton onClick={() => onNavigate('apps')}>查看全部 ({apps.length})</LinkButton>}
          />

          {apps.length === 0 ? (
            <div className="flex-1 min-h-[240px] relative rounded-xl border border-dashed border-line overflow-hidden flex flex-col items-center justify-center text-center px-6 py-10">
              <div className="absolute inset-0 bg-dot-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
              <div className="relative w-11 h-11 rounded-xl bg-paper-2 border border-line shadow-card flex items-center justify-center text-ink mb-4">
                <HardDrives className="w-5 h-5" weight="duotone" />
              </div>
              <p className="relative text-sm font-semibold text-ink">还没有受管应用</p>
              <p className="relative text-xs text-ink-muted mt-1.5 max-w-xs leading-relaxed">
                粘贴一份 docker-compose.yml 即可创建第一个应用，Vessel 会接管它的部署、日志与备份。
              </p>
              <button
                type="button"
                onClick={() => onNavigate('apps')}
                className="relative btn-vessel-primary mt-5 text-xs px-3.5 py-2"
              >
                <Plus className="w-3.5 h-3.5" weight="bold" />
                前往应用编排
              </button>
            </div>
          ) : (
            <div className="-mx-2 space-y-0.5">
              {apps.map((app) => {
                const isDeploying = deployingAppId === app.id;
                return (
                  <div
                    key={app.id}
                    className="group p-3 sm:py-3 sm:px-3.5 rounded-xl hover:bg-paper-3/60 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-[10px] bg-paper-3 border border-line-subtle flex items-center justify-center text-ink-muted font-mono text-xs font-semibold uppercase shrink-0">
                        {app.name.slice(0, 2)}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[13px] text-ink truncate">{app.name}</span>
                          <Badge variant={app.status}>{app.status === 'running' ? '运行中' : app.status === 'stopped' ? '已停止' : app.status}</Badge>
                          {app.updateAvailable && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                              可更新镜像
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-faint font-mono truncate">{app.id}</p>
                      </div>
                    </div>

                    <div className="w-full sm:w-auto shrink-0">
                      {app.status !== 'running' ? (
                        <button
                          type="button"
                          disabled={!isDockerOnline || isDeploying}
                          data-tooltip={!isDockerOnline ? '请等待 Docker Daemon 连接后再操作' : '快捷启动此应用'}
                          onClick={() => handleDeploy(app.id)}
                          className={clsx(
                            'btn-vessel-primary w-full sm:w-auto min-h-[40px] sm:min-h-[32px] px-3.5 py-1.5 rounded-xl text-xs',
                            isDeploying && 'cursor-wait'
                          )}
                        >
                          {isDeploying ? (
                            <>
                              <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                              <span>启动中...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" weight="fill" />
                              <span>启动上线</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigate('apps')}
                          className="btn-vessel-secondary w-full sm:w-auto min-h-[40px] sm:min-h-[32px] px-3.5 py-1.5 rounded-xl"
                        >
                          <span>详情 / 终端</span>
                          <ArrowRight className="w-3 h-3 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Domains */}
          <div className="card-vessel p-5 sm:p-6 lg:p-7">
            <SectionHeader title="Caddy 域名路由" action={<LinkButton onClick={() => onNavigate('domains')}>管理</LinkButton>} />

            {domains.length === 0 ? (
              <div className="py-7 flex flex-col items-center text-center">
                <div className="w-9 h-9 rounded-[10px] bg-paper-3 border border-line-subtle flex items-center justify-center text-ink-faint mb-3">
                  <Globe className="w-[18px] h-[18px]" weight="duotone" />
                </div>
                <p className="text-xs text-ink-muted">尚未绑定域名</p>
                <p className="text-[11px] text-ink-faint mt-1">点击上方「管理」进入配置</p>
              </div>
            ) : (
              <div className="-mx-2 space-y-0.5">
                {domains.slice(0, 4).map((d) => (
                  <div key={d.id} className="p-2.5 px-3 rounded-xl hover:bg-paper-3/60 transition-colors space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="status-dot text-emerald-500 !w-1.5 !h-1.5" />
                      <span className="text-ink font-medium text-xs tracking-tight break-all">{d.domain}</span>
                    </div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-2 flex-wrap pl-3.5">
                      <code className="font-mono text-[10.5px] bg-paper-3 border border-line-subtle px-1.5 py-0.5 rounded-md text-ink break-all">
                        {d.targetType === 'internal' ? `${d.serviceName}:${d.targetPort}` : `127.0.0.1:${d.targetPort}`}
                      </code>
                      <span className="text-ink-faint font-mono text-[10.5px]">{d.sslIssuer || "Let's Encrypt"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="card-vessel p-5 sm:p-6 lg:p-7">
            <SectionHeader title="运维快捷动作" />
            <div className="space-y-2">
              {[
                {
                  key: 'backup',
                  icon: CloudArrowUp,
                  tone: 'text-signal',
                  title: '立即创建系统 R2 灾备快照',
                  desc: '全量打包应用编排与环境数据并推送云端',
                  disabled: false,
                  tooltip: undefined as string | undefined,
                  onClick: onTriggerBackup,
                },
                {
                  key: 'prune',
                  icon: Broom,
                  tone: 'text-amber-500',
                  title: '执行安全 Docker 镜像瘦身',
                  desc: '一键修剪已废弃的孤立层与未引用镜像缓存',
                  disabled: !isDockerOnline,
                  tooltip: !isDockerOnline ? '请等待 Docker Daemon 连接后再操作' : '清理无用镜像与悬空层',
                  onClick: () => isDockerOnline && onTriggerPrune(),
                },
              ].map(({ key, icon: ActionIcon, tone, title, desc, disabled, tooltip, onClick }) => (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  data-tooltip={tooltip}
                  onClick={onClick}
                  className={clsx(
                    'w-full min-h-[56px] flex items-center justify-between p-3 sm:p-3.5 rounded-xl border text-left group transition-all duration-200',
                    disabled
                      ? 'border-transparent bg-paper-3/30 opacity-50 cursor-not-allowed'
                      : 'border-line-subtle bg-paper-3/40 hover:bg-paper-3 hover:border-line cursor-pointer active:scale-[0.99]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={clsx(
                        'w-9 h-9 rounded-[10px] bg-paper-2 border border-line shadow-subtle flex items-center justify-center shrink-0 transition-transform duration-300 ease-spring',
                        !disabled && 'group-hover:scale-110',
                        tone
                      )}
                    >
                      <ActionIcon className="w-4 h-4" weight="duotone" />
                    </div>
                    <div className="min-w-0">
                      <div className={clsx('text-xs font-semibold truncate', disabled ? 'text-ink-muted' : 'text-ink')}>{title}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-1 sm:line-clamp-none">{desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-faint group-hover:text-ink group-hover:translate-x-0.5 transition-all duration-300 ease-spring shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
