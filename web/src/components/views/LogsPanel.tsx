import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Pause,
  Play,
  Copy,
  DownloadSimple,
  MagnifyingGlass,
  ArrowsClockwise,
  Check,
  X,
  ArrowsOutSimple,
  ArrowsInSimple,
  CaretDown,
  CheckCircle,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { AppItem } from '../../types/index.js';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<'service' | 'limit' | 'time' | 'level' | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
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

  // Handle escape key to exit fullscreen or active sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSheet) {
          setActiveSheet(null);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, activeSheet]);

  // Lock body scroll when in fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

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
    const now = Date.now();
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
      if (timeRange !== 'all') {
        const isoMatch = item.raw.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/);
        if (isoMatch) {
          const logTime = new Date(isoMatch[1]).getTime();
          if (!isNaN(logTime)) {
            const diffMs = now - logTime;
            if (timeRange === '15m' && diffMs > 15 * 60 * 1000) return false;
            if (timeRange === '1h' && diffMs > 60 * 60 * 1000) return false;
            if (timeRange === '24h' && diffMs > 24 * 60 * 60 * 1000) return false;
          }
        }
      }
      return true;
    });
  }, [parsedLogs, logType, search, timeRange]);

  const handleCopy = () => {
    const text = filteredLogs.map((l) => l.raw).join('\n');
    navigator.clipboard.writeText(text);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
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

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  };

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {}
    }
  };

  const isFilterActive =
    selectedService !== 'all' || limit !== 100 || timeRange !== 'all' || logType !== 'all' || search.trim() !== '';

  return (
    <div className="space-y-3 font-sans">
      {/* 1. HEADER SECTION (Hidden in Fullscreen) */}
      {!isFullscreen && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-0.5">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight font-sans">容器运行时日志</h3>
            <p className="text-xs text-ink-muted mt-0.5">实时流式观察该应用栈下所有容器的标准输出与错误日志</p>
          </div>
          {loading && (
            <span className="text-[11px] text-accent flex items-center gap-1.5 self-start sm:self-auto font-mono">
              <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
              <span>实时同步中...</span>
            </span>
          )}
        </div>
      )}

      {/* 2. COMPACT SEARCH & HORIZONTAL SCROLLABLE CHIPS (Hidden in Fullscreen) */}
      {!isFullscreen && (
        <div className="space-y-2">
          {/* Row 1: Full-width Search Bar */}
          <div className="relative w-full flex items-center rounded-2xl bg-paper-2 focus-within:bg-paper-3 transition-colors">
            <div className="pl-3.5 pr-2 flex items-center text-ink-muted/70 pointer-events-none shrink-0">
              <MagnifyingGlass className="w-4 h-4" weight="bold" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索日志关键词..."
              className="flex-1 min-w-0 bg-transparent py-2.5 pr-3 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:outline-none min-h-[40px] font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="清空搜索"
                className="pr-3 pl-1 text-ink-faint hover:text-ink transition-colors cursor-pointer flex items-center shrink-0 min-h-[40px]"
              >
                <div className="w-5 h-5 rounded-full bg-paper-3 hover:bg-paper-4 flex items-center justify-center transition-colors">
                  <X className="w-3 h-3 text-ink-muted" weight="bold" />
                </div>
              </button>
            )}
          </div>

          {/* Row 2: Horizontal Scrollable Filter Chips (1-Row, Native Ergonomic) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5 scroll-smooth">
            {/* Service Chip */}
            <button
              type="button"
              aria-haspopup="listbox"
              onClick={() => {
                triggerHaptic();
                setActiveSheet('service');
              }}
              className={clsx(
                "min-h-[32px] px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 select-none active:scale-95",
                selectedService !== 'all'
                  ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                  : "bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink"
              )}
            >
              <span>
                容器:{' '}
                {selectedService === 'all'
                  ? `全部 (${containerList.length})`
                  : selectedService}
              </span>
              <CaretDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Limit Chip */}
            <button
              type="button"
              aria-haspopup="listbox"
              onClick={() => {
                triggerHaptic();
                setActiveSheet('limit');
              }}
              className={clsx(
                "min-h-[32px] px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 select-none active:scale-95",
                limit !== 100
                  ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                  : "bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink"
              )}
            >
              <span>行数: {limit} 行</span>
              <CaretDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Time Chip */}
            <button
              type="button"
              aria-haspopup="listbox"
              onClick={() => {
                triggerHaptic();
                setActiveSheet('time');
              }}
              className={clsx(
                "min-h-[32px] px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 select-none active:scale-95",
                timeRange !== 'all'
                  ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                  : "bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink"
              )}
            >
              <span>
                时间:{' '}
                {timeRange === 'all'
                  ? '全部时间'
                  : timeRange === '15m'
                  ? '近 15 分钟'
                  : timeRange === '1h'
                  ? '近 1 小时'
                  : '近 24 小时'}
              </span>
              <CaretDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Level Chip */}
            <button
              type="button"
              aria-haspopup="listbox"
              onClick={() => {
                triggerHaptic();
                setActiveSheet('level');
              }}
              className={clsx(
                "min-h-[32px] px-3 py-1 rounded-full text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 select-none active:scale-95",
                logType !== 'all'
                  ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                  : "bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink"
              )}
            >
              <span>
                等级:{' '}
                {logType === 'all'
                  ? '全部'
                  : logType === 'error'
                  ? '异常 (Error)'
                  : logType === 'warn'
                  ? '警告 (Warn)'
                  : logType === 'info'
                  ? '正常 (Info)'
                  : '调试 (Debug)'}
              </span>
              <CaretDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Reset Filters Pill */}
            {isFilterActive && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setSelectedService('all');
                  setLimit(100);
                  setTimeRange('all');
                  setLogType('all');
                  setSearch('');
                }}
                className="min-h-[32px] px-2.5 py-1 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium transition-colors cursor-pointer shrink-0 select-none flex items-center gap-1 active:scale-95"
              >
                <X className="w-3 h-3" />
                <span>重置条件</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. TERMINAL VIEWPORT (STANDALONE CARD OR 100% FULLSCREEN CONTAINER) */}
      <div
        className={clsx(
          "bg-[#09090b] dark:bg-black overflow-hidden flex flex-col transition-all",
          isFullscreen
            ? "fixed inset-0 z-50 rounded-none border-0 w-screen h-[100dvh]"
            : "rounded-2xl shadow-lg min-h-[460px] max-h-[calc(100vh-320px)] sm:max-h-[calc(100vh-280px)] flex-1"
        )}
      >
        {/* Terminal Dark Integrated Toolbar (Mac / Hacker Style) */}
        <div className="bg-[#161b22] dark:bg-[#121214] px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shrink-0 select-none">
          {/* Left: Terminal status indicators & meta */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Status dot */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={clsx(
                  "w-2.5 h-2.5 rounded-full transition-colors",
                  !isRunning
                    ? "bg-zinc-600"
                    : isPaused
                    ? "bg-amber-500 ring-2 ring-amber-500/30"
                    : "bg-emerald-500 ring-2 ring-emerald-500/30 animate-pulse"
                )}
              />
            </div>

            <div className="flex items-center gap-2 min-w-0 text-xs font-mono">
              <span className="font-semibold text-zinc-200">
                {isFullscreen ? '终端全屏控制台' : '终端控制台'}
              </span>
              <span className="text-[11px] text-zinc-400 font-mono hidden xs:inline truncate">
                {filteredLogs.length} / {parsedLogs.length} 行
              </span>
              {isPaused ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-sans shrink-0 font-medium">
                  滚屏已暂停
                </span>
              ) : isRunning ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-sans shrink-0 font-medium hidden sm:inline-flex items-center gap-1">
                  实时流
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Integrated Terminal Actions (Pause, Copy, Download, Fullscreen) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pause / Resume */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                if (isRunning) setIsPaused(!isPaused);
              }}
              disabled={!isRunning}
              data-tooltip={!isRunning ? '应用未运行，暂无实时日志流' : isPaused ? '点击恢复自动滚屏' : '点击暂停滚屏'}
              className={clsx(
                "min-h-[30px] px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95",
                !isRunning
                  ? "bg-zinc-800/50 text-zinc-500 cursor-not-allowed opacity-50"
                  : isPaused
                  ? "bg-amber-500/20 text-amber-300 shadow-sm font-semibold"
                  : "bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300"
              )}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-amber-300" weight="fill" /> : <Pause className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isPaused ? '继续' : '暂停'}</span>
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={handleCopy}
              data-tooltip="复制当前日志"
              className={clsx(
                "min-h-[30px] px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95",
                copied
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                  : "bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300"
              )}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" weight="bold" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? '已复制' : '复制'}</span>
            </button>

            {/* Download */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                handleDownload();
              }}
              data-tooltip="下载日志文本"
              className="min-h-[30px] px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer select-none active:scale-95"
            >
              <DownloadSimple className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">下载</span>
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              data-tooltip={isFullscreen ? '退出全屏 (Esc)' : '全屏日志模式'}
              className={clsx(
                "min-h-[30px] px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95",
                isFullscreen
                  ? "bg-accent text-accent-contrast shadow-sm font-semibold"
                  : "bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300"
              )}
            >
              {isFullscreen ? (
                <>
                  <ArrowsInSimple className="w-3.5 h-3.5" weight="bold" />
                  <span>退出全屏</span>
                </>
              ) : (
                <>
                  <ArrowsOutSimple className="w-3.5 h-3.5" weight="bold" />
                  <span>全屏</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Terminal Screen Body (Pure Black, Monospace, Auto-wrapping, Smooth Scrolling) */}
        <div
          ref={terminalScrollRef}
          className="p-3 sm:p-4 font-mono text-xs overflow-y-auto space-y-1 text-zinc-200 select-text flex-1 leading-relaxed"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-24 sm:py-28 text-center text-zinc-500 text-xs font-mono">
              {search
                ? `未找到包含 "${search}" 的日志条目`
                : !isRunning
                ? `[vessel] ${new Date().toISOString()} No runtime logs yet or containers are currently stopped.`
                : '暂无容器输出日志，正在等待首批标准输出管道流...'}
            </div>
          ) : (
            filteredLogs.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 hover:bg-white/[0.04] px-1.5 py-0.5 rounded transition-colors text-[11.5px] leading-relaxed group"
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

                {/* Log Text Content with Automatic Mobile Word-wrapping */}
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

        {/* Terminal Bottom Weak Status Bar */}
        <div className="px-4 py-2 bg-black/50 flex items-center justify-between text-[11px] text-zinc-500 font-mono select-none shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center gap-2 truncate pr-2">
            <span className="truncate">
              服务: {selectedService === 'all' ? '所有服务聚合' : selectedService}
            </span>
            {isPaused && <span className="text-amber-400 font-sans font-medium shrink-0">(滚屏已暂停)</span>}
          </div>
          <div className="flex items-center gap-3 text-zinc-500 shrink-0">
            <span className="hidden sm:inline">tail -n {limit}</span>
            <span>{search ? `匹配: "${search}"` : '实时管道'}</span>
          </div>
        </div>
      </div>

      {/* 4. ACTION SHEET / BOTTOM SHEET FOR MOBILE CHIP FILTER SELECTION */}
      {activeSheet && createPortal(
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-black/60 sm:bg-black/40 backdrop-blur-sm animate-fade-in font-sans"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveSheet(null);
          }}
        >
          <div
            className="w-full sm:max-w-md bg-paper-2 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Grab Handle */}
            <div className="w-10 h-1 bg-ink/20 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

            {/* Header */}
            <div className="px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
              <div>
                <h4 className="text-sm font-semibold text-ink">
                  {activeSheet === 'service' && '选择过滤容器'}
                  {activeSheet === 'limit' && '选择日志行数'}
                  {activeSheet === 'time' && '选择时间范围'}
                  {activeSheet === 'level' && '选择日志等级'}
                </h4>
                <p className="text-[11px] text-ink-muted">
                  {activeSheet === 'service' && '单独观察特定容器服务或聚合全部输出'}
                  {activeSheet === 'limit' && '控制向服务端拉取的最大日志行数'}
                  {activeSheet === 'time' && '快速收敛至特定时间窗口排查'}
                  {activeSheet === 'level' && '过滤指定严重程度的日志条目'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                aria-label="关闭面板"
                className="min-w-[40px] min-h-[40px] -mr-2 p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" weight="bold" />
              </button>
            </div>

            {/* Options List */}
            <div className="p-3 sm:p-4 space-y-2 overflow-y-auto no-scrollbar flex-1 pb-6 sm:pb-4">
              {activeSheet === 'service' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setSelectedService('all');
                      setActiveSheet(null);
                    }}
                    className={clsx(
                      "w-full min-h-[48px] p-3 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer select-none",
                      selectedService === 'all'
                        ? "bg-paper-4/80 shadow-sm"
                        : "bg-paper-3 hover:bg-paper-4/40"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink">全部容器服务</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-paper-4 text-ink-muted font-mono">
                          {containerList.length} 个实例
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-muted mt-0.5">聚合该编排栈下的所有容器输出日志</p>
                    </div>
                    {selectedService === 'all' && <CheckCircle className="w-4 h-4 text-accent shrink-0" weight="fill" />}
                  </button>

                  {containerList.map((c) => {
                    const isSelected = selectedService === c.name;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setSelectedService(c.name);
                          setActiveSheet(null);
                        }}
                        className={clsx(
                          "w-full min-h-[48px] p-3 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer select-none",
                          isSelected
                            ? "bg-paper-4/80 shadow-sm"
                            : "bg-paper-3 hover:bg-paper-4/40"
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-ink font-mono truncate">{c.name}</span>
                            <span
                              className={clsx(
                                "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                                c.state === 'running'
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-paper-4 text-ink-muted"
                              )}
                            >
                              {c.state}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted font-mono mt-0.5 truncate">
                            {c.id.slice(0, 12)} · {c.status}
                          </p>
                        </div>
                        {isSelected && <CheckCircle className="w-4 h-4 text-accent shrink-0" weight="fill" />}
                      </button>
                    );
                  })}
                </>
              )}

              {activeSheet === 'limit' && (
                [50, 100, 200, 500, 1000].map((num) => {
                  const isSelected = limit === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setLimit(num);
                        setActiveSheet(null);
                      }}
                      className={clsx(
                        "w-full min-h-[48px] p-3 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer select-none",
                        isSelected
                          ? "bg-paper-4/80 shadow-sm"
                          : "bg-paper-3 hover:bg-paper-4/40"
                      )}
                    >
                      <div>
                        <span className="text-xs font-semibold text-ink font-mono">{num} 行</span>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {num === 100
                            ? '推荐默认配置，快速响应'
                            : num <= 100
                            ? '极速响应，占用带宽最小'
                            : '拉取更长历史上下文，适合深入排查'}
                        </p>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-accent shrink-0" weight="fill" />}
                    </button>
                  );
                })
              )}

              {activeSheet === 'time' && (
                ([
                  { val: 'all', label: '全部时间', desc: '不限制产生时间，按指定行数全量拉取' },
                  { val: '15m', label: '最近 15 分钟', desc: '紧急排查最近产生的服务异常' },
                  { val: '1h', label: '最近 1 小时', desc: '查看近一小时内的波动与请求' },
                  { val: '24h', label: '最近 24 小时', desc: '当日全天运行概况与周期任务' },
                ] as const).map((t) => {
                  const isSelected = timeRange === t.val;
                  return (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setTimeRange(t.val);
                        setActiveSheet(null);
                      }}
                      className={clsx(
                        "w-full min-h-[48px] p-3 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer select-none",
                        isSelected
                          ? "bg-paper-4/80 shadow-sm"
                          : "bg-paper-3 hover:bg-paper-4/40"
                      )}
                    >
                      <div>
                        <span className="text-xs font-semibold text-ink">{t.label}</span>
                        <p className="text-[11px] text-ink-muted mt-0.5">{t.desc}</p>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-accent shrink-0" weight="fill" />}
                    </button>
                  );
                })
              )}

              {activeSheet === 'level' && (
                ([
                  { val: 'all', label: '全部等级', badge: undefined, desc: '显示所有标准输出与错误信息' },
                  {
                    val: 'error',
                    label: '异常与错误 (Error)',
                    badge: 'Error',
                    desc: '高亮致命错误、Fatal、Panic 与 Exception 堆栈',
                  },
                  { val: 'warn', label: '警告信息 (Warn)', badge: 'Warn', desc: '业务告警与潜在隐患' },
                  { val: 'info', label: '标准信息 (Info)', badge: 'Info', desc: '常规服务监听与 HTTP 请求' },
                  { val: 'debug', label: '调试信息 (Debug)', badge: 'Debug', desc: '底层 Trace 与详细上下文' },
                ] as const).map((lvl) => {
                  const isSelected = logType === lvl.val;
                  return (
                    <button
                      key={lvl.val}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setLogType(lvl.val);
                        setActiveSheet(null);
                      }}
                      className={clsx(
                        "w-full min-h-[48px] p-3 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer select-none",
                        isSelected
                          ? "bg-paper-4/80 shadow-sm"
                          : "bg-paper-3 hover:bg-paper-4/40"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-ink">{lvl.label}</span>
                          {lvl.badge && (
                            <span
                              className={clsx(
                                "text-[10px] px-1.5 py-0.2 rounded font-sans font-medium",
                                lvl.val === 'error'
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : lvl.val === 'warn'
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : lvl.val === 'info'
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              )}
                            >
                              {lvl.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-muted mt-0.5">{lvl.desc}</p>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-accent shrink-0" weight="fill" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Close Button for Mobile */}
            <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:hidden bg-paper-2">
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="w-full min-h-[44px] bg-paper-3 hover:bg-paper-4 text-ink text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
