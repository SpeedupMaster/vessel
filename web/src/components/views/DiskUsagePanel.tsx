import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwise, ChartPieSlice, FileText, Info } from '@phosphor-icons/react';
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

const TYPE_LABELS: Record<string, string> = {
  Images: '镜像',
  Containers: '容器',
  'Local Volumes': '数据卷',
  'Build Cache': '构建缓存',
};

// Reclaimable volumes are only unattached, never deleted by the safe prune
const TYPE_HINTS: Record<string, string> = {
  Images: '未被容器引用的镜像满冷却期后清理',
  Containers: '可写层；停止的容器可按天数清理',
  'Local Volumes': '存放数据，安全瘦身从不删除',
  'Build Cache': '超过冷却期未使用的缓存会被清理',
};

const LOG_WARN_BYTES = 100 * 1024 * 1024;

export const DiskUsagePanel: React.FC = () => {
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

  return (
    <div className="card-vessel p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <ChartPieSlice className="w-4 h-4" weight="bold" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-ink tracking-tight">磁盘占用分布</h4>
            <span className="text-[11px] text-ink-muted block mt-0.5">Docker 各类资源占用与最大的容器日志</span>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors disabled:opacity-50 cursor-pointer"
        >
          <ArrowsClockwise className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {error && !report && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">无法读取磁盘占用: {error}</div>
      )}

      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Resource breakdown */}
          <div className="rounded-xl border border-line overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-paper-3/50 text-ink-muted">
                <tr>
                  <th className="text-left font-medium px-3.5 py-2">类型</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">使用/总数</th>
                  <th className="text-right font-medium px-3 py-2">占用</th>
                  <th className="text-right font-medium px-3.5 py-2">可回收</th>
                </tr>
              </thead>
              <tbody>
                {report.breakdown.map((row) => (
                  <tr key={row.type} className="border-t border-line">
                    <td className="px-3.5 py-2.5">
                      <span className="font-semibold text-ink block">{TYPE_LABELS[row.type] || row.type}</span>
                      <span className="text-[11px] text-ink-faint">{TYPE_HINTS[row.type]}</span>
                    </td>
                    <td className="text-right px-3 py-2.5 font-mono text-ink-muted">
                      {row.active}/{row.totalCount}
                    </td>
                    <td className="text-right px-3 py-2.5 font-mono text-ink">{row.size}</td>
                    <td className="text-right px-3.5 py-2.5 font-mono text-ink-muted">{row.reclaimable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Largest container logs */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <FileText className="w-3.5 h-3.5 text-ink-muted" />
              <span>最大的容器日志</span>
            </div>
            {report.logsError ? (
              <p className="text-[11px] text-ink-muted">{report.logsError}</p>
            ) : report.logs.length === 0 ? (
              <p className="text-[11px] text-ink-muted">没有找到容器日志文件</p>
            ) : (
              <ul className="space-y-1.5">
                {report.logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-paper-3/40 dark:bg-paper-3/50 border border-line text-xs"
                  >
                    <span className="truncate text-ink">
                      {log.name}
                      <span className="ml-1.5 font-mono text-[11px] text-ink-faint">{log.id}</span>
                    </span>
                    <span className={`font-mono shrink-0 ${log.sizeBytes >= LOG_WARN_BYTES ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-ink-muted'}`}>
                      {formatBytes(log.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-start gap-1.5 text-[11px] text-ink-muted leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>
                容器日志不在安全瘦身范围内。Docker 默认不限制日志大小，可在宿主机 <code className="font-mono">/etc/docker/daemon.json</code> 中配置
                <code className="font-mono"> "log-opts": {'{'}"max-size": "10m", "max-file": "3"{'}'}</code>，重启 Docker 后对新建容器生效。
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
