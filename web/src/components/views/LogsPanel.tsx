import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Pause,
  Play,
  Copy,
  DownloadSimple,
  Robot,
  MagnifyingGlass,
  CaretDown,
  ArrowsClockwise,
  Check,
  Warning,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { AppItem, ContainerInfo } from '../../types/index.js';

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
  const [isAiOpen, setIsAiOpen] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerList = app.containers || [];

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

    // Regex check for ISO timestamps (e.g. 2026-10-04T10:49:38.123456789Z or 2026-10-04T10:49:38+08:00)
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

  // Filtered log lines
  const parsedLogs = useMemo(() => {
    return logs.map(parseLogLine);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return parsedLogs.filter((item) => {
      // Filter by log type
      if (logType !== 'all') {
        if (logType === 'error' && item.level !== 'error') return false;
        if (logType === 'warn' && item.level !== 'warn') return false;
        if (logType === 'debug' && item.level !== 'debug') return false;
        if (logType === 'info' && item.level !== 'info') return false;
      }
      // Filter by search keyword
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!item.raw.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [parsedLogs, logType, search]);

  // Copy logs handler
  const handleCopy = () => {
    const text = filteredLogs.map((l) => l.raw).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download logs handler
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

  // AI Diagnostic Analysis
  const errorLines = useMemo(() => {
    return parsedLogs.filter((l) => l.level === 'error' || l.level === 'warn').slice(-15);
  }, [parsedLogs]);

  return (
    <div className="space-y-4">
      {/* ================= HEADER ================= */}
      <div className="bg-paper-2 border border-line rounded-lg p-5">
        <div>
          <h3 className="font-semibold text-lg text-ink tracking-tight font-sans">Logs</h3>
          <p className="text-xs text-ink-muted mt-0.5">Watch the logs of the application in real time</p>
        </div>

        {/* ================= CONTAINER SELECTOR ================= */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-ink-muted mb-1.5 select-none">
            Select a container to view logs
          </label>
          <div className="relative">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full appearance-none bg-paper border border-line rounded-md px-3.5 py-2.5 text-xs text-ink font-medium focus:border-accent focus:outline-none cursor-pointer pr-10 hover:border-paper-4 transition-colors"
            >
              <option value="all">
                全部容器日志 (All Stack Containers)
              </option>
              {containerList.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.id.slice(0, 12)}) [{c.state}] {c.status}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted">
              <CaretDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ================= CONTROLS TOOLBAR ================= */}
        <div className="mt-4 pt-3 border-t border-line/60 flex flex-wrap items-center justify-between gap-3">
          {/* Left Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {/* Limit to Pill */}
            <div className="flex items-center gap-1.5 bg-paper-3/60 px-2.5 py-1 rounded border border-line">
              <span className="text-ink-muted text-[11px]">Limit to</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-transparent text-ink font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value={50} className="bg-paper text-ink">50 lines</option>
                <option value={100} className="bg-paper text-ink">100 lines</option>
                <option value={200} className="bg-paper text-ink">200 lines</option>
                <option value={500} className="bg-paper text-ink">500 lines</option>
                <option value={1000} className="bg-paper text-ink">1000 lines</option>
              </select>
            </div>

            {/* Time range Pill */}
            <div className="flex items-center gap-1.5 bg-paper-3/60 px-2.5 py-1 rounded border border-line">
              <span className="text-ink-muted text-[11px]">Time range</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-transparent text-ink font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-paper text-ink">All time</option>
                <option value="15m" className="bg-paper text-ink">Last 15m</option>
                <option value="1h" className="bg-paper text-ink">Last 1h</option>
                <option value="24h" className="bg-paper text-ink">Last 24h</option>
              </select>
            </div>

            {/* Log type Pill */}
            <div className="flex items-center gap-1.5 bg-paper-3/60 px-2.5 py-1 rounded border border-line">
              <span className="text-ink-muted text-[11px]">Log type</span>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as any)}
                className="bg-transparent text-ink font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-paper text-ink">All</option>
                <option value="info" className="bg-paper text-ink">Info</option>
                <option value="debug" className="bg-paper text-ink">Debug</option>
                <option value="warn" className="bg-paper text-ink">Warning</option>
                <option value="error" className="bg-paper text-ink">Error</option>
              </select>
            </div>

            {loading && (
              <span className="text-[11px] text-accent animate-pulse font-mono flex items-center gap-1">
                <ArrowsClockwise className="w-3 h-3 animate-spin" />
                <span>实时同步中...</span>
              </span>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Pause / Resume */}
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                isPaused
                  ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                  : 'bg-paper-3 hover:bg-paper-4 border-line text-ink-muted hover:text-ink'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            {/* Copy */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-3 hover:bg-paper-4 border border-line text-ink-muted hover:text-ink text-xs font-medium rounded transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Download */}
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-3 hover:bg-paper-4 border border-line text-ink-muted hover:text-ink text-xs font-medium rounded transition-colors"
            >
              <DownloadSimple className="w-3.5 h-3.5" />
              <span>Download logs</span>
            </button>

            {/* AI Diagnose */}
            <button
              type="button"
              onClick={() => setIsAiOpen(!isAiOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                isAiOpen
                  ? 'bg-accent text-paper border-accent shadow-glow-accent'
                  : 'bg-sky-950/50 hover:bg-sky-900/60 border-sky-700/60 text-sky-300'
              }`}
            >
              <Robot className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>
          </div>
        </div>

        {/* ================= SEARCH INPUT ================= */}
        <div className="mt-3.5 relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
            <MagnifyingGlass className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full bg-paper border border-line rounded-md pl-9 pr-8 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none font-mono"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint hover:text-ink"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ================= AI DIAGNOSIS DRAWER (IF OPEN) ================= */}
      {isAiOpen && (
        <div className="bg-sky-950/40 border border-sky-800/80 rounded-lg p-4 space-y-3 animate-fade-in text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-sky-800/50">
            <div className="flex items-center gap-2">
              <Sparkle className="w-4 h-4 text-sky-400" />
              <span className="font-semibold text-sky-200">Antigravity AI 智能日志诊断分析</span>
            </div>
            <button
              onClick={() => setIsAiOpen(false)}
              className="text-sky-400 hover:text-sky-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {errorLines.length === 0 ? (
            <p className="text-emerald-300">
              ✓ 当前日志流运行状态良好，未检测到致命崩溃（Fatal/Panic）或异常错误堆栈。
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-amber-200 font-medium">
                检测到 {errorLines.length} 条警告或错误信号：
              </p>
              <div className="bg-black/60 rounded p-2.5 font-mono text-[11px] text-rose-300 space-y-1 max-h-36 overflow-y-auto">
                {errorLines.map((el, i) => (
                  <div key={i} className="truncate">
                    {el.raw}
                  </div>
                ))}
              </div>
              <div className="p-2.5 bg-sky-900/40 rounded border border-sky-700/50 text-sky-200 leading-relaxed text-[11px]">
                <span className="font-semibold text-white block mb-0.5">💡 AI 排错建议：</span>
                1. 检查环境变量配置（如数据库连接密码、端口冲突）是否与对应容器需求相匹配。
                <br />
                2. 若属于初始化首次启动报错，通常可在配置正确后自动恢复，或点击上方的「Rebuild」拉取更新重建。
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= REAL-TIME LOG VIEWER ================= */}
      <div className="bg-paper-2 border border-line rounded-lg overflow-hidden shadow-inner">
        <div className="bg-paper-3/40 px-4 py-2 border-b border-line flex items-center justify-between text-xs font-mono text-ink-faint select-none">
          <span>
            Showing {filteredLogs.length} of {parsedLogs.length} lines
            {isPaused && <span className="text-amber-400 ml-2">(Streaming Paused)</span>}
          </span>
          <span className="text-[11px]">
            {selectedService === 'all' ? 'All Services' : `Service: ${selectedService}`}
          </span>
        </div>

        <div className="p-3 font-mono text-xs overflow-x-auto min-h-[380px] max-h-[560px] overflow-y-auto space-y-1 bg-black/85 select-text">
          {filteredLogs.length === 0 ? (
            <div className="py-24 text-center text-ink-muted text-xs font-mono">
              {search
                ? `未找到包含 "${search}" 的日志条目`
                : '暂无容器输出日志。若容器刚启动，正在等待首批标准输出...'}
            </div>
          ) : (
            filteredLogs.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 hover:bg-paper-3/20 px-2 py-0.5 rounded transition-colors text-[11.5px] leading-relaxed group"
              >
                {/* Left Level Indicator Bar */}
                <div
                  className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    item.level === 'error'
                      ? 'bg-rose-500'
                      : item.level === 'warn'
                      ? 'bg-amber-400'
                      : item.level === 'debug'
                      ? 'bg-purple-400'
                      : item.level === 'info'
                      ? 'bg-sky-400'
                      : 'bg-neutral-600'
                  }`}
                />

                {/* Timestamp Column */}
                {item.timestamp && (
                  <span className="text-ink-faint flex-shrink-0 select-none tabular-nums text-[11px] whitespace-nowrap">
                    {item.timestamp}
                  </span>
                )}

                {/* Level Badge */}
                {item.level !== 'none' && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase flex-shrink-0 select-none ${
                      item.level === 'error'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : item.level === 'warn'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : item.level === 'debug'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-sky-950 text-sky-300 border border-sky-800'
                    }`}
                  >
                    {item.level}
                  </span>
                )}

                {/* Log Text Content */}
                <span
                  className={`flex-1 whitespace-pre-wrap break-all ${
                    item.level === 'error'
                      ? 'text-rose-200'
                      : item.level === 'warn'
                      ? 'text-amber-200'
                      : item.level === 'debug'
                      ? 'text-purple-200'
                      : 'text-neutral-300'
                  }`}
                >
                  {item.content}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
