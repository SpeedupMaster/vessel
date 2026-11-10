import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowsClockwise, Broom, CircleNotch, Info } from '@phosphor-icons/react';
import { apiFetch } from '../../hooks/useData.js';
import { formatBytes } from '../../utils/format.js';

interface DiskUsageRow {
  type: string;
  totalCount: number;
  active: number;
  size: string;
  reclaimable: string;
}

interface ContainerLogUsage {
  id: string;
  name: string;
  sizeBytes: number;
}

interface DiskReport {
  breakdown: DiskUsageRow[];
  logs: ContainerLogUsage[];
  logsError: string | null;
}

const TYPES: { key: string; label: string; hint: string; bar: string }[] = [
  { key: 'Images', label: '镜像', hint: '未被引用的镜像满冷却期后清理', bar: 'bg-ink' },
  { key: 'Local Volumes', label: '数据卷', hint: '存放数据，从不清理', bar: 'bg-signal' },
  { key: 'Build Cache', label: '构建缓存', hint: '超过冷却期未使用的会被清理', bar: 'bg-ink-faint' },
  { key: 'Containers', label: '容器', hint: '可写层，停止的容器可按天数清理', bar: 'bg-line-strong' },
];

const UNIT: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 };

/** Parses the docker system df strings ("1.23GB", "512MB (40%)") into bytes. */
export function parseDockerSize(s: string | undefined): number {
  const m = /([\d.]+)\s*([kKMGT]?B)/.exec(s || '');
  if (!m) return 0;
  return parseFloat(m[1]) * (UNIT[m[2].toUpperCase()] ?? 1);
}

/** Same decimal units docker system df uses, so totals line up with the rows. */
const formatSI = (n: number) => {
  if (n <= 0) return '0 B';
  const u = ['B', 'kB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log10(n) / 3));
  return `${(n / 1000 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

const LOG_WARN_BYTES = 100 * 1024 * 1024;

interface DiskUsagePanelProps {
  /** Runs the safe prune; the panel reloads afterwards. */
  onPrune?: () => Promise<void>;
  isPruning?: boolean;
}

export const DiskUsagePanel: React.FC<DiskUsagePanelProps> = ({ onPrune, isPruning = false }) => {
  const [report, setReport] = useState<DiskReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/maintenance/disk-usage');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReport(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = TYPES.map((t) => {
    const row = report?.breakdown.find((r) => r.type === t.key);
    return {
      ...t,
      row,
      bytes: parseDockerSize(row?.size),
      // Volumes are never removed by the safe prune, so they never count as reclaimable here.
      reclaim: t.key === 'Local Volumes' ? 0 : parseDockerSize(row?.reclaimable),
    };
  });
  const total = rows.reduce((n, r) => n + r.bytes, 0);
  const reclaimable = rows.reduce((n, r) => n + r.reclaim, 0);

  const handlePrune = async () => {
    if (!onPrune) return;
    await onPrune();
    void load();
  };

  return (
    <section aria-labelledby="disk-usage-title" className="card-vessel !cursor-default overflow-hidden">
      <div className="min-h-14 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-subtle">
        <div className="min-w-0">
          <h2 id="disk-usage-title" className="text-sm font-semibold text-ink">Docker 磁盘占用</h2>
          {report && (
            <p className="text-xs text-ink-muted">
              共 <span className="font-mono text-ink">{formatSI(total)}</span>
              <span className="mx-1.5 text-ink-faint">·</span>
              可回收 <span className="font-mono text-ink">{formatSI(reclaimable)}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="刷新磁盘占用"
            data-tooltip="刷新"
            className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <ArrowsClockwise className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
          {onPrune && (
            <button
              type="button"
              onClick={handlePrune}
              disabled={isPruning}
              className="btn-vessel-secondary min-h-[36px] !px-3 text-[13px] inline-flex items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
            >
              {isPruning ? <CircleNotch className="w-4 h-4 animate-spin" /> : <Broom className="w-4 h-4" />}
              {isPruning ? '清理中…' : reclaimable > 0 ? `清理 ${formatSI(reclaimable)}` : '立即清理'}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {error && !report && (
          <p className="p-3.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs">无法读取磁盘占用：{error}</p>
        )}
        {!report && !error && (
          <div className="h-24 flex items-center justify-center text-xs text-ink-muted gap-2">
            <CircleNotch className="w-4 h-4 animate-spin" />
            正在读取…
          </div>
        )}

        {report && (
          <>
            {/* Stacked bar */}
            <div>
              <div className="flex h-2.5 rounded-full overflow-hidden bg-paper-3" role="img" aria-label="各类资源占用比例">
                {total > 0 &&
                  rows.map((r) =>
                    r.bytes > 0 ? (
                      <span key={r.key} className={clsx('h-full', r.bar)} style={{ width: `${(r.bytes / total) * 100}%` }} />
                    ) : null
                  )}
              </div>
              <ul className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                {rows.map((r) => (
                  <li key={r.key} className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <span className={clsx('w-2 h-2 rounded-sm shrink-0', r.bar)} />
                      {r.label}
                      {r.row && (
                        <span className="text-ink-faint font-mono">
                          {r.row.active}/{r.row.totalCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-sm text-ink">{r.row?.size ?? '—'}</p>
                    <p className="text-[11px] text-ink-faint truncate" title={r.hint}>
                      {r.key === 'Local Volumes' ? r.hint : r.reclaim > 0 ? `可回收 ${formatSI(r.reclaim)}` : r.hint}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Largest container logs */}
            <div className="pt-4 border-t border-line-subtle">
              <h3 className="text-xs font-medium text-ink mb-2">最大的容器日志</h3>
              {report.logsError ? (
                <p className="text-xs text-ink-muted">{report.logsError}</p>
              ) : report.logs.length === 0 ? (
                <p className="text-xs text-ink-muted">没有找到容器日志文件</p>
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {report.logs.map((log) => {
                    const big = log.sizeBytes >= LOG_WARN_BYTES;
                    return (
                      <li key={log.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                        <span className="min-w-0 truncate text-ink">
                          {log.name}
                          <span className="ml-1.5 font-mono text-[11px] text-ink-faint">{log.id}</span>
                        </span>
                        <span
                          className={clsx(
                            'font-mono shrink-0',
                            big ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-ink-muted'
                          )}
                        >
                          {formatBytes(log.sizeBytes)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-muted leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>
                  超过 100 MB 的会标出。容器日志不在自动清理范围内，可在宿主机{' '}
                  <code className="font-mono">/etc/docker/daemon.json</code> 中设置
                  <code className="font-mono"> "log-opts": {'{'}"max-size": "10m", "max-file": "3"{'}'}</code>
                  ，重启 Docker 后对新建容器生效。
                </span>
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
