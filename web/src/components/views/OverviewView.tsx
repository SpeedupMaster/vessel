import React from 'react';
import {
  HardDrives,
  Globe,
  CloudArrowUp,
  WarningCircle,
  Broom,
  ArrowRight,
  Play,
} from '@phosphor-icons/react';
import { AppItem, DomainItem, R2Config, SystemMetrics, BackupRecord } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { Badge } from '../common/Badge.js';

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
  const isDockerOnline = metrics.dockerStatus === 'running';
  const runningApps = apps.filter((a) => a.status === 'running');
  const updatesCount = apps.filter((a) => a.updateAvailable).length;

  return (
    <div className="space-y-8">
      {/* Docker Warning Banner if Offline */}
      {!isDockerOnline && (
        <div className="bg-amber-50/90 border border-amber-200/90 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-200 rounded-xl p-5 flex items-center justify-between shadow-subtle">
          <div className="flex items-center gap-3.5">
            <WarningCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" weight="fill" />
            <div>
              <h4 className="text-sm font-semibold tracking-tight">Docker Daemon 未响应或正在连接中</h4>
              <p className="text-xs text-amber-700/90 dark:text-amber-400/80 mt-0.5">
                Vessel 平台已就绪。请确认宿主机 Docker 服务（如 Docker Desktop 或 systemd docker）已启动并挂载 /var/run/docker.sock。
              </p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
            连接中...
          </span>
        </div>
      )}

      {/* Top Telemetry KPI Cards - Clean, Borderless & Grouped Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Apps Card */}
        <div
          onClick={() => onNavigate('apps')}
          className="card-vessel p-6 sm:p-7 cursor-pointer hover:border-ink-muted/30 dark:hover:border-white/20 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">Compose 应用</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <HardDrives className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
              <RollingCounter value={apps.length} />
            </div>
            <div className="mt-2 text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
              <span className={runningApps.length > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-muted'}>
                {runningApps.length} 运行中
              </span>
              <span className="text-ink-faint">·</span>
              <span>{metrics.runningContainers} 活跃容器</span>
              {updatesCount > 0 && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{updatesCount} 项可更新</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Domains & SSL Card */}
        <div
          onClick={() => onNavigate('domains')}
          className="card-vessel p-6 sm:p-7 cursor-pointer hover:border-ink-muted/30 dark:hover:border-white/20 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">域名与 SSL 证书</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
              <Globe className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
              <RollingCounter value={domains.length} />
            </div>
            <div className="mt-2 text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Caddy 自动证书</span>
              <span className="text-ink-faint">·</span>
              <span className="text-ink-faint">Let's Encrypt 自动续签</span>
            </div>
          </div>
        </div>

        {/* Cloudflare R2 Card */}
        <div
          onClick={() => onNavigate('backups')}
          className="card-vessel p-6 sm:p-7 cursor-pointer hover:border-ink-muted/30 dark:hover:border-white/20 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">Cloudflare R2 灾备</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <CloudArrowUp className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
              <RollingCounter value={backups.length} />
            </div>
            <div className="mt-2 text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
              <span className="text-ink font-medium">已存快照</span>
              <span className="text-ink-faint">·</span>
              <span className={r2Config?.enabled ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-faint'}>
                {r2Config?.enabled ? '定时已开启' : '双层灾备未配置'}
              </span>
            </div>
          </div>
        </div>

        {/* Maintenance / Prune Card */}
        <div
          onClick={() => onNavigate('maintenance')}
          className="card-vessel p-6 sm:p-7 cursor-pointer hover:border-ink-muted/30 dark:hover:border-white/20 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">安全镜像瘦身</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
              <Broom className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">
              72<span className="text-lg text-ink-muted font-normal ml-0.5">h</span>
            </div>
            <div className="mt-2 text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
              <span className="text-amber-600 dark:text-amber-400 font-medium">保留保护期</span>
              <span className="text-ink-faint">·</span>
              <span className="text-ink-faint">悬空层安全修剪</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Applications Overview & SSL Routes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Deployed Applications Table */}
        <div className="lg:col-span-2 card-vessel p-6 sm:p-7 shadow-subtle">
          <div className="flex items-center justify-between pb-4 border-b border-line/30 dark:border-white/[0.04] mb-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-ink font-sans">
                受管 Compose 应用
              </h3>
              <p className="text-xs text-ink-faint mt-0.5">原生 Docker Compose 编排托管容器组</p>
            </div>
            <button
              onClick={() => onNavigate('apps')}
              className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>查看全部 ({apps.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-line/20 dark:divide-white/[0.04]">
            {apps.map((app) => (
              <div
                key={app.id}
                className="py-3.5 flex items-center justify-between hover:bg-paper-3/40 px-3 -mx-3 rounded-lg transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-ink">{app.name}</span>
                    <Badge variant={app.status}>{app.status === 'running' ? '运行中' : app.status === 'stopped' ? '已停止' : app.status}</Badge>
                    {app.updateAvailable && (
                      <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                        可更新镜像
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted font-mono">{app.id}</p>
                </div>

                <div className="flex items-center gap-2">
                  {app.status !== 'running' ? (
                    <button
                      type="button"
                      disabled={!isDockerOnline}
                      data-tooltip={!isDockerOnline ? '请等待 Docker Daemon 连接后再操作' : '快捷启动此应用'}
                      onClick={() => isDockerOnline && onDeploy(app.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shadow-subtle ${
                        !isDockerOnline
                          ? 'bg-paper-2 text-ink-muted/40 border-line/40 cursor-not-allowed opacity-50'
                          : 'bg-paper-2 hover:bg-paper-3 text-accent border-line hover:border-accent/40 active:translate-y-px cursor-pointer'
                      }`}
                    >
                      <Play className={`w-3 h-3 ${!isDockerOnline ? 'text-ink-muted/40' : 'text-accent'}`} weight="fill" />
                      <span>启动上线</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigate('apps')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-colors cursor-pointer"
                    >
                      <span>详情 / 终端</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Bound Domains & Quick Actions */}
        <div className="space-y-6">
          {/* Caddy Domains Card - Flat, Borderless List */}
          <div className="card-vessel p-6 sm:p-7 shadow-subtle">
            <div className="flex items-center justify-between pb-3.5 border-b border-line/30 dark:border-white/[0.04] mb-3">
              <h3 className="text-sm font-semibold tracking-tight text-ink font-sans">
                Caddy 域名路由
              </h3>
              <button
                onClick={() => onNavigate('domains')}
                className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>管理</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {domains.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted">
                尚未绑定域名，点击上方管理进入配置
              </div>
            ) : (
              <div className="divide-y divide-line/20 dark:divide-white/[0.04]">
                {domains.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="py-3 first:pt-0 last:pb-0 hover:bg-paper-3/30 -mx-2 px-2 rounded-lg transition-colors space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-ink font-semibold text-xs tracking-tight">{d.domain}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-[10.5px] font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        HTTPS 有效
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span>目标:</span>
                        <code className="font-mono text-[10.5px] bg-paper-3/60 dark:bg-white/[0.05] px-1.5 py-0.2 rounded text-ink dark:text-zinc-200 border border-line/40 dark:border-white/[0.06]">
                          {d.targetType === 'internal' ? `${d.serviceName}:${d.targetPort}` : `127.0.0.1:${d.targetPort}`}
                        </code>
                      </span>
                      <span className="text-ink-faint">·</span>
                      <span className="text-ink-faint font-mono text-[10.5px]">
                        {d.sslIssuer || "Let's Encrypt (Auto-Renew)"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Maintenance Hub - Solid Secondary Buttons with Clear Affordance */}
          <div className="card-vessel p-6 sm:p-7 shadow-subtle">
            <h3 className="text-sm font-semibold tracking-tight text-ink font-sans pb-3.5 border-b border-line/30 dark:border-white/[0.04] mb-3.5">
              运维快捷动作
            </h3>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onTriggerBackup}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-paper-2/80 hover:bg-paper-3 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-line/80 hover:border-ink-muted/30 dark:border-white/10 dark:hover:border-white/20 transition-all text-left shadow-subtle group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-paper-3 dark:bg-white/[0.06] flex items-center justify-center text-accent group-hover:scale-105 transition-transform flex-shrink-0">
                    <CloudArrowUp className="w-4 h-4" weight="bold" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-ink group-hover:text-accent transition-colors">
                      立即创建系统 R2 灾备快照
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5">全量打包应用编排与环境数据并推送云端</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                disabled={!isDockerOnline}
                data-tooltip={!isDockerOnline ? '请等待 Docker Daemon 连接后再操作' : '清理无用镜像与悬空层'}
                onClick={() => isDockerOnline && onTriggerPrune()}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left shadow-subtle group ${
                  !isDockerOnline
                    ? 'bg-paper-2/40 dark:bg-white/[0.02] border-line/40 dark:border-white/[0.04] opacity-50 cursor-not-allowed'
                    : 'bg-paper-2/80 hover:bg-paper-3 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-line/80 hover:border-ink-muted/30 dark:border-white/10 dark:hover:border-white/20 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-paper-3 dark:bg-white/[0.06] flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform flex-shrink-0">
                    <Broom className="w-4 h-4" weight="bold" />
                  </div>
                  <div>
                    <div className={`text-xs font-semibold ${!isDockerOnline ? 'text-ink-muted' : 'text-ink group-hover:text-amber-500'} transition-colors`}>
                      执行安全 Docker 镜像瘦身
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5">一键修剪已废弃的孤立层与未引用镜像缓存</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
