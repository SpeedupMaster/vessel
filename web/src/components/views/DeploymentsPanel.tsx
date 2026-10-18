import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowCounterClockwise,
  ArrowsInSimple,
  ArrowsOutSimple,
  Check,
  CheckCircle,
  CircleNotch,
  ClockCounterClockwise,
  Copy,
  FileCode,
  Lightning,
  Play,
  Terminal,
  User,
  WebhooksLogo,
  XCircle,
} from '@phosphor-icons/react';
import { AppItem, DeploymentAction, DeploymentRecord, DeploymentTrigger } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';
import { useNotification } from '../../context/NotificationContext.js';
import { EmptyState } from '../common/EmptyState.js';
import { copyText } from '../../utils/clipboard.js';

interface DeploymentsPanelProps {
  app: AppItem;
  onDeploy: (id: string) => Promise<void>;
}

export const ACTION_LABELS: Record<DeploymentAction, string> = {
  deploy: '部署',
  rebuild: '拉取并重建',
  'fresh-volumes': '重置数据卷',
  rollback: '回滚',
};

const TRIGGERS: Record<DeploymentTrigger, { label: string; icon: React.ElementType }> = {
  manual: { label: '手动', icon: User },
  webhook: { label: 'Webhook', icon: WebhooksLogo },
  'auto-update': { label: '自动更新', icon: Lightning },
  'auto-rollback': { label: '自动回滚', icon: ArrowCounterClockwise },
};

// Tone keys map to .term-line[data-tone] styles in globals.css
export function getLogLineTone(line: string): 'error' | 'warn' | 'step' | 'ok' | undefined {
  const lower = line.toLowerCase();
  if (/error|fail|cannot find|fatal|panic|exception/.test(lower)) return 'error';
  if (lower.includes('warn')) return 'warn';
  if (line.startsWith('[vessel]') || line.startsWith('==>') || line.startsWith('STEP')) return 'step';
  if (/\b(done|started|created|healthy|pulled|success)\b/.test(lower)) return 'ok';
  return undefined;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined) return '—';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatRelative(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return new Date(iso).toLocaleDateString();
}

const formatTime = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

const StatusIcon: React.FC<{ status: DeploymentRecord['status']; className?: string }> = ({ status, className }) =>
  status === 'running' ? (
    <CircleNotch className={clsx('animate-spin text-signal', className)} weight="bold" />
  ) : status === 'success' ? (
    <CheckCircle className={clsx('text-emerald-500', className)} weight="fill" />
  ) : (
    <XCircle className={clsx('text-rose-500', className)} weight="fill" />
  );

export const DeploymentsPanel: React.FC<DeploymentsPanelProps> = ({ app, onDeploy }) => {
  const { toast, confirm } = useNotification();
  const [records, setRecords] = useState<DeploymentRecord[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'log' | 'config'>('log');
  const [logText, setLogText] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const busy = app.status === 'deploying' || app.status === 'rebuilding';

  const loadRecords = useCallback(async () => {
    try {
      const list: DeploymentRecord[] = await (await apiFetch(`/api/apps/${app.id}/deployments`)).json();
      setRecords(list);
    } catch (err: any) {
      setRecords((prev) => prev ?? []);
      toast.error(`加载部署记录失败: ${err.message}`);
    }
  }, [app.id, toast]);

  // Refresh on status transitions (start / finish of an operation)
  useEffect(() => {
    void loadRecords();
  }, [loadRecords, app.status, app.lastDeployedAt]);

  const hasRunning = !!records?.some((r) => r.status === 'running');
  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => void loadRecords(), 3000);
    return () => window.clearInterval(id);
  }, [hasRunning, loadRecords]);

  // Follow the newest record unless the user picked one
  const selected = useMemo(() => {
    if (!records?.length) return null;
    return records.find((r) => r.id === selectedId) ?? records[0];
  }, [records, selectedId]);

  const latestSuccessId = useMemo(() => records?.find((r) => r.status === 'success')?.id, [records]);

  // Log of the selected record; re-read while it is still running
  useEffect(() => {
    if (!selected) {
      setLogText('');
      return;
    }
    let cancelled = false;
    const read = async () => {
      try {
        const { log } = await (await apiFetch(`/api/apps/${app.id}/deployments/${selected.id}/log`)).json();
        if (!cancelled) setLogText(log || '');
      } catch {
        /* keep the last good text */
      }
    };
    void read();
    if (selected.status !== 'running') return () => { cancelled = true; };
    const id = window.setInterval(read, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [app.id, selected?.id, selected?.status]);

  const lines = useMemo(() => {
    const source = view === 'config' ? selected?.composeYaml || '' : logText;
    const out = source.split('\n');
    if (out.length && out[out.length - 1] === '') out.pop();
    return out;
  }, [view, selected?.composeYaml, logText]);

  useEffect(() => {
    if (isAutoScroll && view === 'log' && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, isAutoScroll, view]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsFullscreen(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  const handleCopy = () => {
    if (!lines.length) {
      toast.info('暂无内容可复制');
      return;
    }
    void copyText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRollback = async (record: DeploymentRecord) => {
    const ok = await confirm({
      title: `回滚到部署 #${record.seq}`,
      message: `将恢复部署 #${record.seq} 时的 Compose 与环境变量配置并重新部署。当前未保存的编辑会被覆盖。`,
      details: [
        '镜像按 Compose 中的标签重新解析；若标签已指向新版本，请在 Compose 中固定版本号或摘要。',
        '数据卷不会被修改。',
      ],
      confirmText: '确认回滚',
      variant: 'primary',
    });
    if (!ok) return;
    setRollingBack(true);
    try {
      const res = await (await apiFetch(`/api/apps/${app.id}/deployments/${record.id}/rollback`, { method: 'POST' })).json();
      toast.success(`已开始回滚（部署 #${res.seq}）`);
      setSelectedId(null);
      setView('log');
      await loadRecords();
    } catch (err: any) {
      toast.error(`回滚失败: ${err.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  const handleDeploy = async () => {
    setSelectedId(null);
    setView('log');
    await onDeploy(app.id);
    await loadRecords();
  };

  if (records === null) {
    return (
      <div className="grid xl:grid-cols-[260px_minmax(0,1fr)] gap-4">
        <div className="skeleton h-[320px] rounded-2xl" />
        <div className="skeleton h-[440px] rounded-2xl" />
      </div>
    );
  }

  if (!records.length) {
    return (
      <EmptyState
        icon={<ClockCounterClockwise className="w-6 h-6" />}
        title="还没有部署记录"
        description="每次部署、重建、Webhook 触发与回滚都会在这里留下记录，包括完整日志与当时的配置快照。"
        action={
          <button type="button" onClick={handleDeploy} disabled={busy} className="btn-vessel-primary h-9 px-4 rounded-xl text-xs gap-1.5">
            <Play className="w-3.5 h-3.5" weight="fill" />
            立即部署
          </button>
        }
      />
    );
  }

  return (
    <div className="grid xl:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
      {/* Record list */}
      <div className="card-vessel p-1.5 xl:sticky xl:top-4">
        <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
          <span className="eyebrow">部署记录</span>
          <span className="text-[11px] text-ink-faint font-mono">{records.length}</span>
        </div>
        <ul className="space-y-0.5 max-h-[200px] xl:max-h-[520px] overflow-y-auto no-scrollbar">
          {records.map((record) => {
            const active = record.id === selected?.id;
            const trigger = TRIGGERS[record.trigger];
            const TriggerIcon = trigger.icon;
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  aria-current={active ? 'true' : undefined}
                  className={clsx(
                    'w-full text-left px-2.5 py-2 rounded-xl flex items-start gap-2.5 transition-colors cursor-pointer',
                    active ? 'bg-paper-3 shadow-subtle' : 'hover:bg-paper-3/50'
                  )}
                >
                  <StatusIcon status={record.status} className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12.5px]">
                      <span className="font-mono text-ink-faint">#{record.seq}</span>
                      <span className={clsx('truncate', active ? 'text-ink font-semibold' : 'text-ink font-medium')}>
                        {ACTION_LABELS[record.action]}
                      </span>
                      {record.id === latestSuccessId && (
                        <span className="ml-auto text-[10px] px-1.5 py-px rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400 font-medium shrink-0">
                          当前
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                      <TriggerIcon className="w-3 h-3 shrink-0" />
                      <span>{trigger.label}</span>
                      <span className="opacity-50">·</span>
                      <span title={formatTime(record.startedAt)}>{formatRelative(record.startedAt)}</span>
                      {record.status !== 'running' && (
                        <>
                          <span className="opacity-50">·</span>
                          <span className="font-mono">{formatDuration(record.durationMs)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Viewer */}
      {selected && (
        <div className="term min-w-0" data-fullscreen={isFullscreen}>
          <div className="term-bar flex-wrap gap-y-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 basis-[180px]">
              <div className="w-7 h-7 rounded-lg bg-paper-3 border border-line-subtle flex items-center justify-center shrink-0">
                <StatusIcon status={selected.status} className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] font-semibold text-ink truncate">
                  部署 #{selected.seq} · {ACTION_LABELS[selected.action]}
                </div>
                <div className="hidden sm:block text-[11px] text-ink-faint truncate mt-0.5">
                  {formatTime(selected.startedAt)}
                  {selected.rollbackOf && (
                    <> · 回滚自 #{records.find((r) => r.id === selected.rollbackOf)?.seq ?? '已清理记录'}</>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <div className="term-tools">
                <button type="button" onClick={() => setView('log')} data-active={view === 'log'} className="term-btn">
                  <Terminal className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">日志</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('config')}
                  data-active={view === 'config'}
                  data-tooltip="该次部署使用的 Compose 配置快照"
                  className="term-btn"
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">配置</span>
                </button>
              </div>
              <div className="term-tools">
                <button
                  type="button"
                  onClick={() => setIsAutoScroll(!isAutoScroll)}
                  data-active={isAutoScroll}
                  data-tooltip={isAutoScroll ? '自动滚屏已开启，点击暂停' : '自动滚屏已暂停，点击恢复'}
                  className="term-btn hidden sm:inline-flex"
                >
                  <span
                    className={clsx('status-dot !w-1.5 !h-1.5 shrink-0', isAutoScroll ? 'text-emerald-500' : 'text-ink-faint')}
                    data-live={isAutoScroll && selected.status === 'running'}
                  />
                  <span>{isAutoScroll ? '滚屏' : '暂停'}</span>
                </button>
                <button type="button" onClick={handleCopy} data-tooltip="复制当前内容" aria-label="复制" className="term-btn">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" weight="bold" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  data-active={isFullscreen}
                  data-tooltip={isFullscreen ? '退出全屏 (Esc)' : '全屏查看'}
                  aria-label={isFullscreen ? '退出全屏' : '全屏'}
                  className="term-btn"
                >
                  {isFullscreen ? (
                    <ArrowsInSimple className="w-3.5 h-3.5 shrink-0" weight="bold" />
                  ) : (
                    <ArrowsOutSimple className="w-3.5 h-3.5 shrink-0" weight="bold" />
                  )}
                </button>
              </div>

              {selected.status === 'success' && selected.id !== latestSuccessId ? (
                <button
                  type="button"
                  onClick={() => handleRollback(selected)}
                  disabled={busy || rollingBack}
                  className="btn-vessel-secondary h-[30px] px-3 rounded-[10px] text-[11.5px] gap-1.5"
                >
                  <ArrowCounterClockwise className="w-3.5 h-3.5" weight="bold" />
                  <span className="hidden sm:inline">回滚到此版本</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeploy}
                  disabled={busy}
                  className="btn-vessel-primary h-[30px] px-3 rounded-[10px] text-[11.5px] gap-1.5"
                >
                  {busy ? <CircleNotch className="w-3 h-3 animate-spin" weight="bold" /> : <Play className="w-3 h-3" weight="fill" />}
                  <span className="hidden sm:inline">{busy ? '部署中' : '重新部署'}</span>
                </button>
              )}
            </div>
          </div>

          {selected.status === 'failed' && selected.error && view === 'log' && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] text-[12px] text-rose-700 dark:text-rose-300 flex gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-px" weight="fill" />
              <span className="min-w-0 break-words line-clamp-3">{selected.error}</span>
            </div>
          )}

          <div ref={bodyRef} className={clsx('term-body', isFullscreen ? 'h-auto' : 'h-[380px] sm:h-[460px] flex-none')}>
            {lines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6 select-none font-sans">
                <div className="w-10 h-10 rounded-xl bg-paper-2 border border-line shadow-subtle flex items-center justify-center text-ink-faint mb-1">
                  <Terminal className="w-5 h-5" />
                </div>
                <p className="text-xs text-ink-muted">
                  {selected.status === 'running' ? '等待构建输出…' : '这次部署没有留下日志输出。'}
                </p>
              </div>
            ) : (
              lines.map((line, idx) => (
                <div key={idx} className="term-line" data-tone={view === 'log' ? getLogLineTone(line) : undefined}>
                  <span className="term-gutter">{idx + 1}</span>
                  <span className="flex-1 min-w-0">{line || ' '}</span>
                </div>
              ))
            )}
          </div>

          <div className="term-foot">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span>{TRIGGERS[selected.trigger].label}触发</span>
              <span className="opacity-50">·</span>
              <span>
                耗时 <span className="text-ink-muted font-mono">{selected.status === 'running' ? '进行中' : formatDuration(selected.durationMs)}</span>
              </span>
              {selected.imageDigest && (
                <span className="hidden md:inline truncate">
                  <span className="opacity-50">· </span>镜像指纹 <span className="font-mono text-ink-muted">{selected.imageDigest.slice(0, 12)}</span>
                </span>
              )}
            </div>
            <span className="shrink-0">
              {view === 'config' ? 'docker-compose.yml 快照' : `${lines.length} 行`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
