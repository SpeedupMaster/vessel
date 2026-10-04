import React from 'react';
import {
  HardDrives,
  Globe,
  CloudArrowUp,
  Cpu,
  ArrowsClockwise,
  CheckCircle,
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
    <div className="space-y-6">
      {/* Docker Warning Banner if Offline */}
      {!isDockerOnline && (
        <div className="bg-amber-950/40 border border-amber-700/60 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WarningCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-200">Docker Daemon 未响应或正在连接中</h4>
              <p className="text-xs text-amber-400/80 mt-0.5">
                Vessel 平台已就绪。请确认宿主机 Docker 服务（如 Docker Desktop 或 systemd docker）已启动并挂载 /var/run/docker.sock。
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 bg-amber-900/60 text-amber-300 rounded border border-amber-600/60">
            CONNECTING...
          </span>
        </div>
      )}

      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Apps Card */}
        <div
          onClick={() => onNavigate('apps')}
          className="card-vessel p-5 cursor-pointer hover:border-sky-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-mono uppercase tracking-wider">COMPOSE APPS</span>
            <HardDrives className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-ink tracking-tight">
              <RollingCounter value={apps.length} />
            </span>
            <span className="text-xs font-mono text-emerald-400">
              ({runningApps.length} 运行中)
            </span>
          </div>
          <div className="mt-2 text-xs text-ink-faint flex items-center justify-between">
            <span>容器总数: {metrics.runningContainers}</span>
            {updatesCount > 0 && (
              <span className="text-amber-400 font-mono font-medium">● {updatesCount} 项可更新</span>
            )}
          </div>
        </div>

        {/* Domains & SSL Card */}
        <div
          onClick={() => onNavigate('domains')}
          className="card-vessel p-5 cursor-pointer hover:border-sky-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-mono uppercase tracking-wider">DOMAINS & SSL</span>
            <Globe className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-ink tracking-tight">
              <RollingCounter value={domains.length} />
            </span>
            <span className="text-xs font-mono text-emerald-400">Caddy 自动证书</span>
          </div>
          <div className="mt-2 text-xs text-ink-faint">
            Let's Encrypt / ZeroSSL 静默自动续签
          </div>
        </div>

        {/* Cloudflare R2 Card */}
        <div
          onClick={() => onNavigate('backups')}
          className="card-vessel p-5 cursor-pointer hover:border-sky-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-mono uppercase tracking-wider">CLOUDFLARE R2</span>
            <CloudArrowUp className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-ink tracking-tight">
              <RollingCounter value={backups.length} />
            </span>
            <span className="text-xs font-mono text-sky-400">已存档版本</span>
          </div>
          <div className="mt-2 text-xs text-ink-faint flex items-center justify-between">
            <span>双层灾备保护</span>
            <span className={r2Config?.enabled ? 'text-emerald-400' : 'text-ink-faint'}>
              {r2Config?.enabled ? '定时已开启' : '未启用'}
            </span>
          </div>
        </div>

        {/* Maintenance / Prune Card */}
        <div
          onClick={() => onNavigate('maintenance')}
          className="card-vessel p-5 cursor-pointer hover:border-sky-500/50 transition-all group"
        >
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-mono uppercase tracking-wider">SAFETY PRUNE</span>
            <Broom className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-ink tracking-tight">
              72<span className="text-lg text-ink-muted font-normal">h</span>
            </span>
            <span className="text-xs font-mono text-amber-400">保留保护期</span>
          </div>
          <div className="mt-2 text-xs text-ink-faint flex items-center justify-between">
            <span>定时安全清理</span>
            <span className="text-emerald-400">悬空镜像自动修剪</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Applications Overview & SSL Routes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Deployed Applications Table */}
        <div className="lg:col-span-2 card-vessel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink font-mono">
                受管 Compose 应用
              </h3>
              <p className="text-xs text-ink-faint">原生 Docker Compose 编排托管</p>
            </div>
            <button
              onClick={() => onNavigate('apps')}
              className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
            >
              <span>查看全部 ({apps.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-line">
            {apps.map((app) => (
              <div key={app.id} className="py-3 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-ink">{app.name}</span>
                    <Badge variant={app.status}>{app.status}</Badge>
                    {app.updateAvailable && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        NEW IMAGE
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
        <div className="space-y-6">
          {/* Caddy Domains Card */}
          <div className="card-vessel p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink font-mono">
                Caddy 域名路由
              </h3>
              <button
                onClick={() => onNavigate('domains')}
                className="text-xs text-accent hover:text-accent-hover"
              >
                配置
              </button>
            </div>

            {domains.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-muted border border-dashed border-line rounded">
                尚未绑定域名，点击配置绑定
              </div>
            ) : (
              <div className="space-y-2.5">
                {domains.slice(0, 4).map((d) => (
                  <div key={d.id} className="p-2.5 rounded bg-paper-3/40 border border-line text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-ink font-semibold">{d.domain}</span>
                      <span className="text-emerald-400 text-[11px]">● HTTPS 有效</span>
                    </div>
                    <div className="mt-1 text-ink-faint text-[11px] flex justify-between">
                      <span>目标: {d.serviceName}:{d.targetPort}</span>
                      <span>Let's Encrypt</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Maintenance Hub */}
          <div className="card-vessel p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink font-mono mb-3">
              运维快捷动作
            </h3>
            <div className="space-y-2">
              <Button8State
                size="sm"
                variant="secondary"
                className="w-full justify-start"
                icon={<CloudArrowUp className="w-4 h-4 text-sky-400" />}
                onClick={onTriggerBackup}
              >
                立即创建系统 R2 灾备快照
              </Button8State>
              <Button8State
                size="sm"
                variant="secondary"
                className="w-full justify-start"
                icon={<Broom className="w-4 h-4 text-amber-400" />}
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
