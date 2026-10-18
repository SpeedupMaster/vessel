import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import YAML from 'yaml';
import {
  ArrowsClockwise,
  CircleNotch,
  FirstAidKit,
  HardDrives,
  Info,
  Plugs,
  Stack,
  Terminal,
  Warning,
  WarningOctagon,
} from '@phosphor-icons/react';
import { AppDiagnostics, AppItem, ContainerDiagnostics } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';
import { formatRelative } from './DeploymentsPanel.js';

interface DatabaseMonitorPanelProps {
  app: AppItem;
  engine: string;
  onOpenLogs: () => void;
}

const POLL_MS = 10_000;

type Tone = 'ok' | 'warn' | 'bad' | 'idle';

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  bad: 'text-rose-500',
  idle: 'text-ink-faint',
};

const APP_STATUS_LABEL: Record<AppItem['status'], string> = {
  running: '运行中',
  stopped: '已停止',
  deploying: '部署中',
  rebuilding: '重建中',
  error: '异常',
};

/** What a non-zero exit code usually means for a database container */
function explainExit(code: number): string {
  switch (code) {
    case 0:
      return '进程正常退出';
    case 1:
      return '进程启动失败或运行时报错，请查看日志中的错误信息';
    case 125:
      return 'Docker 无法创建容器（配置错误）';
    case 126:
      return '启动命令不可执行';
    case 127:
      return '启动命令不存在';
    case 137:
      return '被 SIGKILL 强制终止，常见于内存不足或停止超时';
    case 139:
      return '进程段错误 (SIGSEGV)';
    case 143:
      return '收到 SIGTERM 后正常停止';
    default:
      return code > 128 ? `被信号 ${code - 128} 终止` : '进程以非零状态退出';
  }
}

function durationSince(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return '不到 1 分钟';
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时 ${m % 60} 分钟`;
  return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
}

const formatTime = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

interface ComposeFacts {
  service: string;
  image?: string;
  restart?: string;
  volumes: string[];
  networks: string[];
  ports: string[];
  hasHealthcheck: boolean;
}

/** Resolve ${VAR}, ${VAR:-default} and ${VAR-default} the way Compose does, using the app's .env */
function interpolate(value: string, env: Record<string, string>): string {
  // `$$` is Compose's escape for a literal `$` and must not be expanded
  return value.replace(/\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?-)([^}]*))?\}/g, (match, name: string | undefined, op: string | undefined, fallback = '') => {
    if (!name) return match;
    const set = Object.prototype.hasOwnProperty.call(env, name);
    if (op === ':-') return set && env[name] !== '' ? env[name] : fallback;
    if (op === '-') return set ? env[name] : fallback;
    return set ? env[name] : '';
  });
}

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const eq = trimmed.indexOf('=');
    if (!trimmed || trimmed.startsWith('#') || eq <= 0) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

/** Values declared in the saved Compose file for the primary service */
function readCompose(rawYaml: string, envContent: string): ComposeFacts | null {
  const env = parseEnv(envContent);
  const yaml = interpolate(rawYaml, env);
  try {
    const services = YAML.parse(yaml)?.services;
    if (!services || typeof services !== 'object') return null;
    const service = 'database' in services ? 'database' : Object.keys(services)[0];
    const def = services[service] || {};
    const list = (value: unknown) =>
      Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v : v?.target ? `${v.source ?? ''}:${v.target}` : JSON.stringify(v))) : [];
    return {
      service,
      image: typeof def.image === 'string' ? def.image : undefined,
      restart: typeof def.restart === 'string' ? def.restart : undefined,
      volumes: list(def.volumes),
      networks: Array.isArray(def.networks) ? def.networks.map(String) : def.networks ? Object.keys(def.networks) : ['default'],
      ports: list(def.ports),
      hasHealthcheck: !!def.healthcheck && def.healthcheck.disable !== true,
    };
  } catch {
    return null;
  }
}

function describeState(c: ContainerDiagnostics | undefined, app: AppItem): { label: string; tone: Tone; detail: string; live: boolean } {
  if (!c) {
    const busy = app.status === 'deploying' || app.status === 'rebuilding';
    return { label: busy ? APP_STATUS_LABEL[app.status] : '未创建', tone: busy ? 'warn' : 'idle', detail: '尚无容器，部署后开始监控', live: busy };
  }
  if (c.state === 'running') {
    if (c.health?.status === 'unhealthy') return { label: '运行中 · 不健康', tone: 'warn', detail: `已运行 ${durationSince(c.startedAt)}`, live: true };
    if (c.health?.status === 'starting') return { label: '启动中', tone: 'warn', detail: `已运行 ${durationSince(c.startedAt)}`, live: true };
    return { label: c.health ? '运行中 · 健康' : '运行中', tone: 'ok', detail: `已运行 ${durationSince(c.startedAt)}`, live: true };
  }
  if (c.state === 'restarting') return { label: '反复重启', tone: 'bad', detail: `已重启 ${c.restartCount} 次`, live: true };
  if (c.state === 'exited' || c.state === 'dead') {
    return {
      label: `已退出 · ${c.exitCode}`,
      tone: c.exitCode === 0 || c.exitCode === 143 ? 'idle' : 'bad',
      detail: c.finishedAt ? `${formatRelative(c.finishedAt)}停止` : '已停止',
      live: false,
    };
  }
  if (c.state === 'created') return { label: '已创建未启动', tone: 'idle', detail: '容器从未成功启动', live: false };
  if (c.state === 'paused') return { label: '已暂停', tone: 'warn', detail: '进程被冻结', live: false };
  return { label: c.state, tone: 'idle', detail: '', live: false };
}

const Kpi: React.FC<{ label: string; value: React.ReactNode; detail?: React.ReactNode; icon: React.ReactNode }> = ({ label, value, detail, icon }) => (
  <div className="card-vessel p-4 min-w-0">
    <div className="flex items-center justify-between">
      <span className="eyebrow">{label}</span>
      <span className="text-ink-faint">{icon}</span>
    </div>
    <div className="mt-2.5 text-[15px] font-semibold text-ink truncate">{value}</div>
    {detail && <div className="mt-1 text-[11px] text-ink-muted truncate">{detail}</div>}
  </div>
);

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-6 px-3 py-2.5 rounded-xl hover:bg-paper-3/50 transition-colors text-xs">
    <span className="text-ink-muted shrink-0">{label}</span>
    <div className="min-w-0 sm:text-right text-ink break-all">{children}</div>
  </div>
);

export const DatabaseMonitorPanel: React.FC<DatabaseMonitorPanelProps> = ({ app, engine, onOpenLogs }) => {
  const [diag, setDiag] = useState<AppDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDiag(await (await apiFetch(`/api/apps/${app.id}/diagnostics`)).json());
    } catch (err: any) {
      setDiag({ dockerAvailable: false, error: err.message, containers: [], checkedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }, [app.id]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load, app.status, app.lastDeployedAt]);

  const compose = useMemo(() => readCompose(app.composeYaml, app.envContent || ''), [app.composeYaml, app.envContent]);
  const container = useMemo(
    () => diag?.containers.find((c) => c.service === compose?.service) ?? diag?.containers[0],
    [diag, compose?.service]
  );
  const state = describeState(container, app);
  const live = !!container;

  // Problems worth explaining, most specific first
  const problems = useMemo(() => {
    const list: { tone: 'bad' | 'warn'; title: string; body?: string }[] = [];
    if (!container) return list;
    if (container.oomKilled) list.push({ tone: 'bad', title: '容器因内存不足被内核终止 (OOMKilled)', body: '为数据库预留更多内存，或在 Compose 中调整内存限制与缓存参数。' });
    if (!container.running && container.exitCode !== 0 && container.exitCode !== 143 && !container.oomKilled) {
      list.push({ tone: 'bad', title: `退出码 ${container.exitCode}：${explainExit(container.exitCode)}`, body: container.error || undefined });
    }
    if (container.health?.status === 'unhealthy') {
      list.push({ tone: 'warn', title: `健康检查连续失败 ${container.health.failingStreak} 次`, body: container.health.lastOutput });
    }
    if (container.restartCount >= 3) {
      list.push({ tone: container.state === 'restarting' ? 'bad' : 'warn', title: `容器已自动重启 ${container.restartCount} 次`, body: '频繁重启通常意味着启动即崩溃，请查看日志定位首次报错。' });
    }
    return list;
  }, [container]);

  const healthValue = container?.health
    ? { starting: '检查中', healthy: '健康', unhealthy: '不健康' }[container.health.status]
    : compose?.hasHealthcheck
      ? '等待容器'
      : '未配置';
  const healthDetail = container?.health
    ? container.health.lastCheckAt
      ? `上次检查 ${formatRelative(container.health.lastCheckAt)}`
      : '尚未完成首次检查'
    : compose?.hasHealthcheck
      ? '容器启动后开始检查'
      : 'Compose 中未定义 healthcheck';

  const publishedPorts = live
    ? container!.ports.filter((p) => p.hostPort).map((p) => `${p.hostPort} → ${p.container}`)
    : compose?.ports ?? [];
  const restartPolicy = live ? container!.restartPolicy : compose?.restart ?? 'no';
  const networks = live ? container!.networks : compose?.networks ?? [];

  if (!diag) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[104px] rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-[280px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!diag.dockerAvailable && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] text-[12px] text-amber-800 dark:text-amber-300">
          <Plugs className="w-4 h-4 shrink-0 mt-px" />
          <div className="min-w-0">
            <div className="font-medium">无法连接 Docker 引擎，以下为 Compose 配置中的声明值</div>
            {diag.error && <div className="mt-0.5 text-[11px] opacity-80 break-words line-clamp-2">{diag.error}</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi
          label="运行状态"
          icon={<span className={clsx('status-dot', TONE_TEXT[state.tone])} data-live={state.live && state.tone === 'ok'} />}
          value={state.label}
          detail={state.detail}
        />
        <Kpi
          label="健康检查"
          icon={<FirstAidKit className="w-4 h-4" />}
          value={
            <span className={clsx(container?.health?.status === 'unhealthy' && 'text-amber-600 dark:text-amber-400')}>{healthValue}</span>
          }
          detail={healthDetail}
        />
        <Kpi
          label="自动重启"
          icon={<ArrowsClockwise className="w-4 h-4" />}
          value={live ? `${container!.restartCount} 次` : '—'}
          detail={`策略 ${restartPolicy}`}
        />
        <Kpi
          label="外部端口"
          icon={<HardDrives className="w-4 h-4" />}
          value={<span className="font-mono">{publishedPorts.length ? publishedPorts[0] : '未映射'}</span>}
          detail={publishedPorts.length > 1 ? `另有 ${publishedPorts.length - 1} 个映射` : publishedPorts.length ? '已暴露到宿主机' : '仅限容器内网访问'}
        />
      </div>

      {problems.length > 0 && (
        <div className="card-vessel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line-subtle">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <WarningOctagon className="w-4 h-4 text-rose-500" weight="fill" />
              诊断
            </div>
            <button
              type="button"
              onClick={onOpenLogs}
              className="text-[11.5px] text-ink-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              查看运行日志
            </button>
          </div>
          <ul className="divide-y divide-line-subtle">
            {problems.map((p) => (
              <li key={p.title} className="flex items-start gap-2.5 px-4 py-3">
                {p.tone === 'bad' ? (
                  <WarningOctagon className="w-4 h-4 text-rose-500 shrink-0 mt-px" weight="fill" />
                ) : (
                  <Warning className="w-4 h-4 text-amber-500 shrink-0 mt-px" weight="fill" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ink">{p.title}</div>
                  {p.body && <div className="mt-1 text-[11px] text-ink-muted font-mono break-words whitespace-pre-wrap line-clamp-4">{p.body}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="card-vessel p-1.5">
        <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
          <div className="flex items-center gap-2">
            <Stack className="w-4 h-4 text-ink-muted" />
            <span className="text-[13px] font-semibold text-ink">容器详情</span>
          </div>
          <span className="text-[11px] text-ink-faint inline-flex items-center gap-1.5">
            {loading && <CircleNotch className="w-3 h-3 animate-spin" />}
            {live ? `docker inspect · ${formatRelative(diag.checkedAt)}` : 'Compose 声明'}
          </span>
        </div>

        <DetailRow label="容器">
          <span className="font-mono">{container?.name || (compose ? `服务 ${compose.service}` : '—')}</span>
          {container && <span className="ml-2 font-mono text-ink-faint">{container.id}</span>}
        </DetailRow>
        <DetailRow label="引擎与镜像">
          {engine} · <span className="font-mono">{container?.image || compose?.image || '—'}</span>
        </DetailRow>
        {live && (
          <DetailRow label={container!.running ? '启动时间' : '停止时间'}>
            {formatTime(container!.running ? container!.startedAt : container!.finishedAt)}
          </DetailRow>
        )}
        <DetailRow label="数据卷">
          {live ? (
            container!.mounts.length ? (
              <div className="space-y-0.5">
                {container!.mounts.map((m) => (
                  <div key={m.destination} className="font-mono">
                    {m.name || m.source} → {m.destination}
                    {m.readOnly && <span className="ml-1 text-ink-faint">(只读)</span>}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">未挂载数据卷，删除容器会丢失数据</span>
            )
          ) : compose?.volumes.length ? (
            <div className="space-y-0.5 font-mono">
              {compose.volumes.map((v) => (
                <div key={v}>{v}</div>
              ))}
            </div>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">未声明数据卷</span>
          )}
        </DetailRow>
        <DetailRow label="网络">
          <span className="font-mono">{networks.length ? networks.join(', ') : '—'}</span>
        </DetailRow>
        <DetailRow label="最近部署">
          {app.lastDeployedAt ? `${formatTime(app.lastDeployedAt)} · ${formatRelative(app.lastDeployedAt)}` : '从未部署'}
        </DetailRow>
      </section>

      {!compose?.hasHealthcheck && (
        <p className="flex items-start gap-1.5 text-[11px] text-ink-faint leading-relaxed px-1">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          此数据库未定义 healthcheck，只能判断进程是否存活。新建的数据库会自动带上健康检查；现有应用可在 Compose 中为服务添加 healthcheck 后重新部署。
        </p>
      )}
    </div>
  );
};
