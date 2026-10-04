import React from 'react';
import {
  HardDrives,
  Globe,
  CloudArrowUp,
  WarningCircle,
  Broom,
  ArrowRight,
} from '@phosphor-icons/react';
import { AppItem, DomainItem, R2Config, SystemMetrics, BackupRecord } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';

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
          <span className="text-xs font-mono px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
            连接中...
          </span>
        </div>
      )}

      {/* Top Telemetry KPI Cards - Spacious Magazine Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Apps Card */}
        <div
          onClick={() => onNavigate('apps')}
          className="card-vessel p-7 sm:p-8 cursor-pointer hover:border-accent/40 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">Compose 应用</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <HardDrives className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="my-5 flex items-baseline gap-2.5">
            <span className="text-4xl sm:text-5xl font-bold font-mono text-ink tracking-tight">
              <RollingCounter value={apps.length} />
            </span>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              ({runningApps.length} 运行中)
            </span>
          </div>
          <div className="pt-3 border-t border-line/60 text-xs text-ink-faint flex items-center justify-between">
            <span>活跃容器: {metrics.runningContainers}</span>
            {updatesCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-mono font-medium">
                ● {updatesCount} 项可更新
              </span>
            )}
          </div>
        </div>

        {/* Domains & SSL Card */}
        <div
          onClick={() => onNavigate('domains')}
          className="card-vessel p-7 sm:p-8 cursor-pointer hover:border-accent/40 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">域名与 SSL 证书</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
              <Globe className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="my-5 flex items-baseline gap-2.5">
            <span className="text-4xl sm:text-5xl font-bold font-mono text-ink tracking-tight">
              <RollingCounter value={domains.length} />
            </span>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
              Caddy 自动证书
            </span>
          </div>
          <div className="pt-3 border-t border-line/60 text-xs text-ink-faint">
            Let's Encrypt / ZeroSSL 自动签发
          </div>
        </div>

        {/* Cloudflare R2 Card */}
        <div
          onClick={() => onNavigate('backups')}
          className="card-vessel p-7 sm:p-8 cursor-pointer hover:border-accent/40 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">Cloudflare R2 灾备</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
              <CloudArrowUp className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="my-5 flex items-baseline gap-2.5">
            <span className="text-4xl sm:text-5xl font-bold font-mono text-ink tracking-tight">
              <RollingCounter value={backups.length} />
            </span>
            <span className="text-xs font-mono text-accent font-medium">已存档快照</span>
          </div>
          <div className="pt-3 border-t border-line/60 text-xs text-ink-faint flex items-center justify-between">
            <span>双层灾备保护</span>
            <span className={r2Config?.enabled ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-ink-faint'}>
              {r2Config?.enabled ? '定时已开启' : '未配置'}
            </span>
          </div>
        </div>

        {/* Maintenance / Prune Card */}
        <div
          onClick={() => onNavigate('maintenance')}
          className="card-vessel p-7 sm:p-8 cursor-pointer hover:border-accent/40 transition-all group shadow-subtle hover:shadow-card flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-sans tracking-wide text-ink-faint">安全镜像瘦身</span>
            <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
              <Broom className="w-4 h-4" weight="bold" />
            </div>
          </div>
          <div className="my-5 flex items-baseline gap-2.5">
            <span className="text-4xl sm:text-5xl font-bold font-mono text-ink tracking-tight">
              72<span className="text-xl text-ink-muted font-normal ml-0.5">h</span>
            </span>
            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-medium">保留保护期</span>
          </div>
          <div className="pt-3 border-t border-line/60 text-xs text-ink-faint flex items-center justify-between">
            <span>定时安全清理</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">悬空镜像修剪</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Applications Overview & SSL Routes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Deployed Applications Table */}
        <div className="lg:col-span-2 card-vessel p-7 sm:p-8 shadow-subtle">
          <div className="flex items-center justify-between pb-5 border-b border-line mb-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-ink font-sans">
                受管 Compose 应用
              </h3>
              <p className="text-xs text-ink-faint mt-0.5">原生 Docker Compose 编排托管容器组</p>
            </div>
            <button
              onClick={() => onNavigate('apps')}
              className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors"
            >
              <span>查看全部 ({apps.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-line">
            {apps.map((app) => (
              <div
                key={app.id}
                className="py-4 flex items-center justify-between hover:bg-paper-3/40 px-3 -mx-3 rounded-lg transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-sm text-ink">{app.name}</span>
                    <Badge variant={app.status}>{app.status}</Badge>
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
                    <Button8State
                      size="sm"
                      variant="primary"
                      onClick={() => onDeploy(app.id)}
                    >
                      启动上线
                    </Button8State>
                  ) : (
                    <Button8State
                      size="sm"
                      variant="ghost"
                      onClick={() => onNavigate('apps')}
                    >
                      详情 / 终端
                    </Button8State>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Bound Domains & Quick Actions */}
        <div className="space-y-8">
          {/* Caddy Domains Card */}
          <div className="card-vessel p-7 sm:p-8 shadow-subtle">
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <h3 className="text-sm font-semibold tracking-tight text-ink font-sans">
                Caddy 域名路由
              </h3>
              <button
                onClick={() => onNavigate('domains')}
                className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
              >
                配置
              </button>
            </div>

            {domains.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-muted border border-dashed border-line rounded-lg">
                尚未绑定域名，点击上方配置绑定
              </div>
            ) : (
              <div className="space-y-3">
                {domains.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-lg bg-paper-3/50 border border-line text-xs font-mono transition-colors hover:border-paper-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-ink font-semibold">{d.domain}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">● HTTPS 有效</span>
                    </div>
                    <div className="mt-1.5 text-ink-faint text-[11px] flex justify-between">
                      <span>目标: {d.serviceName}:{d.targetPort}</span>
                      <span>Let's Encrypt</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Maintenance Hub */}
          <div className="card-vessel p-7 sm:p-8 shadow-subtle">
            <h3 className="text-sm font-semibold tracking-tight text-ink font-sans pb-4 border-b border-line mb-4">
              运维快捷动作
            </h3>
            <div className="space-y-2.5">
              <Button8State
                size="sm"
                variant="secondary"
                className="w-full justify-start py-2.5 px-3.5"
                icon={<CloudArrowUp className="w-4 h-4 text-accent" weight="bold" />}
                onClick={onTriggerBackup}
              >
                立即创建系统 R2 灾备快照
              </Button8State>
              <Button8State
                size="sm"
                variant="secondary"
                className="w-full justify-start py-2.5 px-3.5"
                icon={<Broom className="w-4 h-4 text-amber-500" weight="bold" />}
                onClick={onTriggerPrune}
              >
                执行安全 Docker 镜像瘦身
              </Button8State>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
