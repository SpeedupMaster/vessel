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
  Sparkle,
  X,
} from '@phosphor-icons/react';
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

  const errorLines = useMemo(() => {
    return parsedLogs.filter((l) => l.level === 'error' || l.level === 'warn').slice(-15);
  }, [parsedLogs]);

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="card-vessel p-6 sm:p-7 shadow-subtle">
        <div>
          <h3 className="font-semibold text-base text-ink tracking-tight font-sans">容器运行时日志</h3>
          <p className="text-xs text-ink-muted mt-0.5">实时流式观察该应用栈下所有容器的标准输出与错误日志</p>
        </div>

        {/* CONTAINER SELECTOR */}
        <div className="mt-5">
          <label className="block text-xs font-semibold text-ink-muted mb-1.5 select-none">
            选择日志目标容器
          </label>
          <div className="relative">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full appearance-none bg-paper border border-line rounded-lg px-3.5 py-2.5 text-xs text-ink font-medium focus:border-accent focus:outline-none cursor-pointer pr-10 hover:border-paper-4 transition-colors"
            >
              <option value="all">
                全部容器聚合日志
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

        {/* CONTROLS TOOLBAR */}
        <div className="mt-5 pt-4 border-t border-line/60 flex flex-wrap items-center justify-between gap-3">
          {/* Left Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {/* Limit to Pill */}
            <div className="flex items-center gap-1.5 bg-paper-3/70 px-3 py-1.5 rounded-lg border border-line">
              <span className="text-ink-muted text-[11px]">行数限制</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-transparent text-ink font-medium focus:outline-none cursor-pointer text-xs"
              >
                <option value={50} className="bg-paper text-ink">50 行</option>
                <option value={100} className="bg-paper text-ink">100 行</option>
                <option value={200} className="bg-paper text-ink">200 行</option>
                <option value={500} className="bg-paper text-ink">500 行</option>
                <option value={1000} className="bg-paper text-ink">1000 行</option>
              </select>
            </div>

            {/* Time range Pill */}
            <div className="flex items-center gap-1.5 bg-paper-3/70 px-3 py-1.5 rounded-lg border border-line">
              <span className="text-ink-muted text-[11px]">时间范围</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-transparent text-ink font-medium focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-paper text-ink">全部时间</option>
                <option value="15m" className="bg-paper text-ink">最近 15 分钟</option>
                <option value="1h" className="bg-paper text-ink">最近 1 小时</option>
                <option value="24h" className="bg-paper text-ink">最近 24 小时</option>
              </select>
            </div>

            {/* Log type Pill */}
            <div className="flex items-center gap-1.5 bg-paper-3/70 px-3 py-1.5 rounded-lg border border-line">
              <span className="text-ink-muted text-[11px]">日志等级</span>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as any)}
                className="bg-transparent text-ink font-medium focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-paper text-ink">全部</option>
                <option value="info" className="bg-paper text-ink">正常 (Info)</option>
                <option value="debug" className="bg-paper text-ink">调试 (Debug)</option>
                <option value="warn" className="bg-paper text-ink">警告 (Warning)</option>
                <option value="error" className="bg-paper text-ink">异常 (Error)</option>
              </select>
            </div>

            {loading && (
              <span className="text-[11px] text-accent flex items-center gap-1.5 ml-1">
                <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
                <span>实时同步中...</span>
              </span>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isPaused
                  ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                  : 'bg-paper-2 hover:bg-paper-3 border-line text-ink'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? '继续滚屏' : '暂停'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制日志'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle"
            >
              <DownloadSimple className="w-3.5 h-3.5" />
              <span>下载日志</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAiOpen(!isAiOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isAiOpen
                  ? 'bg-accent text-white border-accent shadow-subtle'
                  : 'bg-paper-2 hover:bg-paper-3 border-line text-ink'
              }`}
            >
              <Robot className="w-3.5 h-3.5 text-accent" />
              <span>AI 诊断</span>
            </button>
          </div>
        </div>

        {/* SEARCH INPUT */}
        <div className="mt-4 relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
            <MagnifyingGlass className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="在日志中搜索关键词..."
            className="w-full bg-paper border border-line rounded-lg pl-9 pr-8 py-2 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none transition-colors"
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

      {/* AI DIAGNOSIS DRAWER */}
      {isAiOpen && (
        <div className="bg-blue-50/90 border border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-200 rounded-xl p-5 space-y-3 text-xs shadow-subtle">
          <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-800/40">
            <div className="flex items-center gap-2">
              <Sparkle className="w-4 h-4 text-accent" weight="bold" />
              <span className="font-semibold text-ink">Antigravity AI 智能日志诊断分析</span>
            </div>
            <button
              onClick={() => setIsAiOpen(false)}
              className="text-ink-muted hover:text-ink p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorLines.length === 0 ? (
            <p className="text-emerald-700 dark:text-emerald-300 font-medium">
              ✓ 当前日志流运行状态良好，未检测到致命崩溃（Fatal/Panic）或异常错误堆栈。
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-amber-800 dark:text-amber-300 font-medium">
                检测到 {errorLines.length} 条警告或错误信号：
              </p>
              <div className="bg-paper rounded-lg border border-line p-3 font-mono text-[11px] text-rose-600 dark:text-rose-300 space-y-1 max-h-36 overflow-y-auto">
                {errorLines.map((el, i) => (
                  <div key={i} className="truncate">
                    {el.raw}
                  </div>
                ))}
              </div>
              <div className="p-3 bg-paper rounded-lg border border-line text-ink leading-relaxed text-[11.5px]">
                <span className="font-semibold text-accent block mb-1">💡 AI 排错建议：</span>
                1. 检查环境变量配置（如数据库连接密码、端口冲突）是否与对应容器需求相匹配。
                <br />
                2. 若属于初始化首次启动报错，通常可在配置正确后自动恢复，或点击上方的「重建服务」拉取更新重建。
              </div>
            </div>
          )}
        </div>
      )}

      {/* REAL-TIME LOG VIEWER - HIGH CONTRAST TERMINAL VIEWPORT */}
      <div className="bg-paper border border-line rounded-xl overflow-hidden shadow-subtle dark:bg-zinc-950">
        <div className="bg-paper-2/80 px-4 py-2.5 border-b border-line flex items-center justify-between text-xs text-ink-muted select-none dark:bg-zinc-900/80 dark:border-zinc-800 dark:text-zinc-400">
          <span>
            显示 {filteredLogs.length} / {parsedLogs.length} 行
            {isPaused && <span className="text-amber-600 dark:text-amber-400 ml-2">(滚屏已暂停)</span>}
          </span>
          <span className="text-[11px]">
            {selectedService === 'all' ? '所有服务' : `服务: ${selectedService}`}
          </span>
        </div>

        <div className="p-3.5 font-mono text-xs overflow-x-auto min-h-[380px] max-h-[560px] overflow-y-auto space-y-1 bg-paper text-ink dark:bg-zinc-950 dark:text-zinc-200 select-text">
          {filteredLogs.length === 0 ? (
            <div className="py-24 text-center text-ink-faint dark:text-zinc-500 text-xs">
              {search
                ? `未找到包含 "${search}" 的日志条目`
                : '暂无容器输出日志。若容器刚启动，正在等待首批标准输出...'}
            </div>
          ) : (
            filteredLogs.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 hover:bg-paper-2/70 dark:hover:bg-zinc-900/60 px-2 py-0.5 rounded transition-colors text-[11.5px] leading-relaxed group"
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
                      : 'bg-paper-4 dark:bg-zinc-700'
                  }`}
                />

                {/* Timestamp Column */}
                {item.timestamp && (
                  <span className="text-ink-faint dark:text-zinc-500 flex-shrink-0 select-none tabular-nums text-[11px] whitespace-nowrap">
                    {item.timestamp}
                  </span>
                )}

                {/* Level Badge */}
                {item.level !== 'none' && (
                  <span
                    className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-medium flex-shrink-0 select-none ${
                      item.level === 'error'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                        : item.level === 'warn'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        : item.level === 'debug'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                        : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                    }`}
                  >
                    {item.level === 'error' ? '错误' : item.level === 'warn' ? '警告' : item.level === 'debug' ? '调试' : '正常'}
                  </span>
                )}

                {/* Log Text Content */}
                <span
                  className={`flex-1 whitespace-pre-wrap break-all ${
                    item.level === 'error'
                      ? 'text-rose-600 dark:text-rose-300'
                      : item.level === 'warn'
                      ? 'text-amber-700 dark:text-amber-300'
                      : item.level === 'debug'
                      ? 'text-purple-700 dark:text-purple-300'
                      : 'text-ink-secondary dark:text-zinc-300'
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
