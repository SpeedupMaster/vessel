import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Pause,
  Play,
  Copy,
  DownloadSimple,
  MagnifyingGlass,
  ArrowsClockwise,
  Check,
  X,
} from '@phosphor-icons/react';
import { AppItem } from '../../types/index.js';
import { CustomSelect } from '../common/CustomSelect.js';

interface LogsPanelProps {
  app: AppItem;
}

interface ParsedLogLine {
  raw: string;
  timestamp?: string;
  level: 'info' | 'debug' | 'warn' | 'error' | 'none';
  content: string;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ app }) => {
  const [selectedService, setSelectedService] = useState<string>('all');
  const [limit, setLimit] = useState<number>(100);
  const [timeRange, setTimeRange] = useState<'all' | '15m' | '1h' | '24h'>('all');
  const [logType, setLogType] = useState<'all' | 'info' | 'debug' | 'warn' | 'error'>('all');
  const [search, setSearch] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerList = app.containers || [];
  const isRunning = app.status === 'running';

  // Fetch runtime logs from backend
  const fetchLogs = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const serviceParam = selectedService === 'all' ? '' : `&service=${encodeURIComponent(selectedService)}`;
      const res = await fetch(`/api/apps/${app.id}/logs?tail=${limit}${serviceParam}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (e) {
      console.error('Failed to fetch runtime logs:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial and param change fetch
  useEffect(() => {
    fetchLogs(false);
  }, [app.id, selectedService, limit]);

  // Periodic polling when not paused
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [app.id, selectedService, limit, isPaused]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isPaused && !search) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, isPaused, search]);

  // Parse log line structure
  const parseLogLine = (line: string): ParsedLogLine => {
    let clean = line;
    let timestamp: string | undefined;
    let level: 'info' | 'debug' | 'warn' | 'error' | 'none' = 'none';

    const isoMatch = clean.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)\s+(.*)$/);
    if (isoMatch) {
      try {
        const d = new Date(isoMatch[1]);
        if (!isNaN(d.getTime())) {
          const yy = String(d.getFullYear()).slice(-2);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          const ss = String(d.getSeconds()).padStart(2, '0');
          timestamp = `${yy}/${mm}/${dd} ${hh}:${min}:${ss}`;
          clean = isoMatch[2];
        }
      } catch {}
    }

    const lower = clean.toLowerCase();
    if (lower.includes('err') || lower.includes('fatal') || lower.includes('panic') || lower.includes('exception')) {
      level = 'error';
    } else if (lower.includes('warn')) {
      level = 'warn';
    } else if (lower.includes('debug') || lower.includes('trace')) {
      level = 'debug';
    } else if (lower.includes('info') || lower.includes('request') || lower.includes('http') || lower.includes('listening')) {
      level = 'info';
    }

    return {
      raw: line,
      timestamp,
      level,
      content: clean,
    };
  };

  const parsedLogs = useMemo(() => {
    return logs.map(parseLogLine);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return parsedLogs.filter((item) => {
      if (logType !== 'all') {
        if (logType === 'error' && item.level !== 'error') return false;
        if (logType === 'warn' && item.level !== 'warn') return false;
        if (logType === 'debug' && item.level !== 'debug') return false;
        if (logType === 'info' && item.level !== 'info') return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!item.raw.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [parsedLogs, logType, search]);

  const handleCopy = () => {
    const text = filteredLogs.map((l) => l.raw).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = filteredLogs.map((l) => l.raw).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.name}-logs-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* HEADER SECTION (FLAT CANVAS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm text-ink tracking-tight font-sans">容器运行时日志</h3>
          <p className="text-xs text-ink-muted mt-0.5">实时流式观察该应用栈下所有容器的标准输出与错误日志</p>
        </div>
        {loading && (
          <span className="text-[11px] text-accent flex items-center gap-1.5 self-start sm:self-auto">
            <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
            <span>实时同步中...</span>
          </span>
        )}
      </div>

      {/* CONSOLIDATED HIGH-DENSITY TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Search + Compact Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search Box (Compact 220px) */}
          <div className="relative w-44 sm:w-56 min-w-[150px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
              <MagnifyingGlass className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索日志关键词..."
              className="w-full bg-paper border border-line rounded-lg pl-8 pr-7 py-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors shadow-subtle"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-ink-faint hover:text-ink cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Container Selector Pill (Compact, auto-width) */}
          <CustomSelect
            variant="pill"
            labelPrefix="容器"
            value={selectedService}
            onChange={(val) => setSelectedService(val)}
            options={[
              { value: 'all', label: '全部容器', badge: `${containerList.length}` },
              ...containerList.map((c) => ({
                value: c.name,
                label: c.name,
                badge: c.state,
                description: `${c.id.slice(0, 12)} · ${c.status}`,
              })),
            ]}
          />

          {/* Limit Pill */}
          <CustomSelect
            variant="pill"
            labelPrefix="行数"
            value={limit}
            onChange={(val) => setLimit(Number(val))}
            options={[
              { value: 50, label: '50 行' },
              { value: 100, label: '100 行' },
              { value: 200, label: '200 行' },
              { value: 500, label: '500 行' },
              { value: 1000, label: '1000 行' },
            ]}
          />

          {/* Time range Pill */}
          <CustomSelect
            variant="pill"
            labelPrefix="时间"
            value={timeRange}
            onChange={(val) => setTimeRange(val as any)}
            options={[
              { value: 'all', label: '全部时间' },
              { value: '15m', label: '15 分钟' },
              { value: '1h', label: '1 小时' },
              { value: '24h', label: '24 小时' },
            ]}
          />

          {/* Log level Pill */}
          <CustomSelect
            variant="pill"
            labelPrefix="等级"
            value={logType}
            onChange={(val) => setLogType(val as any)}
            options={[
              { value: 'all', label: '全部' },
              { value: 'info', label: '正常 (Info)' },
              { value: 'debug', label: '调试 (Debug)' },
              { value: 'warn', label: '警告 (Warn)' },
              { value: 'error', label: '异常 (Error)' },
            ]}
          />
        </div>

        {/* Right: Actions (State-aware pause, Copy, Download, AI Diagnosis) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Pause Button - State Aware */}
          <button
            type="button"
            onClick={() => isRunning && setIsPaused(!isPaused)}
            disabled={!isRunning}
            data-tooltip={!isRunning ? '应用未运行，暂无实时日志流' : isPaused ? '点击恢复自动滚屏' : '点击暂停滚屏'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              !isRunning
                ? 'bg-paper-2 text-ink-muted/40 border-line/40 cursor-not-allowed opacity-50'
                : isPaused
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400 cursor-pointer shadow-subtle'
                : 'bg-paper-2 hover:bg-paper-3 border-line text-ink cursor-pointer shadow-subtle'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? '继续' : '暂停'}</span>
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle cursor-pointer"
          >
            <DownloadSimple className="w-3.5 h-3.5" />
            <span>下载</span>
          </button>
        </div>
      </div>

      {/* REAL-TIME LOG VIEWER - HIGH CONTRAST TERMINAL VIEWPORT */}
      <div className="rounded-xl border border-line/80 bg-[#09090b] dark:bg-black overflow-hidden shadow-subtle flex flex-col">
        {/* Terminal Screen Body */}
        <div className="p-3.5 sm:p-4 font-mono text-xs overflow-x-auto min-h-[460px] max-h-[calc(100vh-340px)] overflow-y-auto space-y-1 text-ink dark:text-zinc-200 select-text flex-1">
          {filteredLogs.length === 0 ? (
            <div className="py-28 text-center text-ink-faint dark:text-zinc-600 text-xs">
              {search
                ? `未找到包含 "${search}" 的日志条目`
                : !isRunning
                ? `[vessel] ${new Date().toISOString()} No runtime logs yet or containers are currently stopped.`
                : '暂无容器输出日志，正在等待首批标准输出...'}
            </div>
          ) : (
            filteredLogs.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 hover:bg-white/[0.04] px-2 py-0.5 rounded transition-colors text-[11.5px] leading-relaxed group"
              >
                {/* Left Level Indicator Bar */}
                <div
                  className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    item.level === 'error'
                      ? 'bg-rose-500'
                      : item.level === 'warn'
                      ? 'bg-amber-500 dark:bg-amber-400'
                      : item.level === 'debug'
                      ? 'bg-purple-500 dark:bg-purple-400'
                      : item.level === 'info'
                      ? 'bg-blue-500 dark:bg-blue-400'
                      : 'bg-white/10 dark:bg-zinc-800'
                  }`}
                />

                {/* Timestamp Column */}
                {item.timestamp && (
                  <span className="text-zinc-500 flex-shrink-0 select-none tabular-nums text-[11px] whitespace-nowrap">
                    {item.timestamp}
                  </span>
                )}

                {/* Level Badge */}
                {item.level !== 'none' && (
                  <span
                    className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-medium flex-shrink-0 select-none ${
                      item.level === 'error'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : item.level === 'warn'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : item.level === 'debug'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}
                  >
                    {item.level === 'error' ? '错误' : item.level === 'warn' ? '警告' : item.level === 'debug' ? '调试' : '正常'}
                  </span>
                )}

                {/* Log Text Content */}
                <span
                  className={`flex-1 whitespace-pre-wrap break-all ${
                    item.level === 'error'
                      ? 'text-rose-400'
                      : item.level === 'warn'
                      ? 'text-amber-300'
                      : item.level === 'debug'
                      ? 'text-purple-300'
                      : 'text-zinc-300'
                  }`}
                >
                  {item.content}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* BOTTOM WEAK STATUS BAR (Replaces Top Thick Header) */}
        <div className="px-4 py-2 bg-paper-3/30 dark:bg-white/[0.02] border-t border-line/30 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-ink-muted dark:text-zinc-500 font-mono select-none">
          <div className="flex items-center gap-2">
            <span>
              显示 {filteredLogs.length} / {parsedLogs.length} 行
            </span>
            {isPaused && <span className="text-amber-500 dark:text-amber-400 font-sans font-medium">(滚屏已暂停)</span>}
            {!isPaused && isRunning && (
              <span className="text-emerald-500 dark:text-emerald-400 font-sans font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                实时流监听中
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>{selectedService === 'all' ? '所有服务聚合' : `服务: ${selectedService}`}</span>
            <span className="text-zinc-600 dark:text-zinc-700 hidden sm:inline">runtime-stdout-pipe</span>
          </div>
        </div>
      </div>
    </div>
  );
};
