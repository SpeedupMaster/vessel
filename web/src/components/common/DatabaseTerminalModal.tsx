import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import {
  X,
  Copy,
  Check,
  Terminal,
  CircleNotch,
  Trash,
  Database,
  CaretDown,
  Play,
} from '@phosphor-icons/react';
import { AppItem } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';
import { DATABASE_OPTIONS } from './CreateDatabaseModal.js';
import { copyText } from '../../utils/clipboard.js';

interface DatabaseTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppItem;
}

interface CommandRecord {
  id: string;
  time: string;
  prompt: string;
  command: string;
  output: string;
  isError?: boolean;
}

export const DatabaseTerminalModal: React.FC<DatabaseTerminalModalProps> = ({
  isOpen,
  onClose,
  app,
}) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [mode, setMode] = useState<'db' | 'shell'>('db');
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [history, setHistory] = useState<CommandRecord[]>([]);
  const [cmdHistoryList, setCmdHistoryList] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number | null>(null);

  // Identify database engine
  const dbInfo = useMemo(() => {
    const yaml = (app.composeYaml || '').toLowerCase();
    const name = (app.name || '').toLowerCase();

    for (const opt of DATABASE_OPTIONS) {
      if (opt.type === 'postgres' && (yaml.includes('postgres') || name.includes('postgres'))) {
        return { type: 'postgresql', name: 'PostgreSQL', defaultCli: 'psql', prompt: 'postgres=# ' };
      }
      if (opt.type === 'mysql' && (yaml.includes('mysql') || name.includes('mysql')) && !yaml.includes('mariadb')) {
        return { type: 'mysql', name: 'MySQL', defaultCli: 'mysql', prompt: 'mysql> ' };
      }
      if (opt.type === 'mariadb' && (yaml.includes('mariadb') || name.includes('mariadb'))) {
        return { type: 'mariadb', name: 'MariaDB', defaultCli: 'mariadb', prompt: 'mariadb> ' };
      }
      if (opt.type === 'redis' && (yaml.includes('redis') || name.includes('redis'))) {
        return { type: 'redis', name: 'Redis', defaultCli: 'redis-cli', prompt: '127.0.0.1:6379> ' };
      }
      if (opt.type === 'mongodb' && (yaml.includes('mongo') || name.includes('mongo'))) {
        return { type: 'mongodb', name: 'MongoDB', defaultCli: 'mongosh', prompt: 'mongosh> ' };
      }
      if (opt.type === 'libsql' && (yaml.includes('sqld') || yaml.includes('libsql') || name.includes('libsql'))) {
        return { type: 'libsql', name: 'libSQL', defaultCli: 'sqld', prompt: 'sqld> ' };
      }
    }
    return { type: 'generic', name: '容器服务', defaultCli: 'sh', prompt: 'db> ' };
  }, [app]);

  // Current prompt string
  const currentPrompt = mode === 'db' ? dbInfo.prompt : 'root@database:/# ';

  // Quick preset shortcuts based on engine and mode
  const quickCommands = useMemo(() => {
    if (mode === 'shell') {
      return [
        { label: '列出文件与权限', cmd: 'ls -la' },
        { label: '查看磁盘空间', cmd: 'df -h' },
        { label: '查看环境变量', cmd: 'env' },
        { label: '查看当前运行进程', cmd: 'ps aux' },
        { label: '查看系统内核信息', cmd: 'uname -a' },
      ];
    }

    switch (dbInfo.type) {
      case 'postgresql':
        return [
          { label: '列出所有数据库', cmd: '\\l' },
          { label: '列出当前库所有数据表', cmd: '\\dt' },
          { label: '查询数据库引擎版本', cmd: 'SELECT version();' },
          { label: '查询当前用户与数据库', cmd: 'SELECT current_user, current_database();' },
          { label: '查询当前活动连接数', cmd: 'SELECT count(*) FROM pg_stat_activity;' },
          { label: '查询数据库服务器时间', cmd: 'SELECT now();' },
        ];
      case 'mysql':
      case 'mariadb':
        return [
          { label: '查看所有数据库', cmd: 'SHOW DATABASES;' },
          { label: '查看当前库数据表', cmd: 'SHOW TABLES;' },
          { label: '查询数据库引擎版本', cmd: 'SELECT VERSION();' },
          { label: '查看服务器综合状态', cmd: 'STATUS;' },
          { label: '查看当前活动连接进程', cmd: 'SHOW PROCESSLIST;' },
        ];
      case 'redis':
        return [
          { label: '存活心跳检测', cmd: 'PING' },
          { label: '服务器运行信息 (INFO)', cmd: 'INFO' },
          { label: '查询当前数据库键数量', cmd: 'DBSIZE' },
          { label: '查看所有键列表', cmd: 'KEYS *' },
          { label: '列出所有已连接客户端', cmd: 'CLIENT LIST' },
        ];
      case 'mongodb':
        return [
          { label: '查看所有数据库列表', cmd: 'show dbs' },
          { label: '查看当前集合 (Collections)', cmd: 'show collections' },
          { label: '数据库运行统计信息', cmd: 'db.stats()' },
          { label: '查看引擎版本', cmd: 'db.version()' },
        ];
      default:
        return [
          { label: '列出文件目录', cmd: 'ls -la' },
          { label: '查看环境变量', cmd: 'env' },
          { label: '查看磁盘用量', cmd: 'df -h' },
        ];
    }
  }, [dbInfo.type, mode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // GSAP animation
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (backdropRef.current && panelRef.current) {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.2, ease: 'power2.out' }
        );
        gsap.fromTo(
          panelRef.current,
          { opacity: 0, scale: 0.97, y: 10 },
          { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power3.out' }
        );
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Click outside to close quick menu dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowQuickMenu(false);
      }
    };
    if (showQuickMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showQuickMenu]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showQuickMenu) {
          setShowQuickMenu(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showQuickMenu, onClose]);

  // Auto scroll
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isExecuting]);

  // Execute command
  const handleExecute = async (overrideCmd?: string) => {
    const cmd = (overrideCmd !== undefined ? overrideCmd : commandInput).trim();
    if (!cmd || isExecuting) return;

    setCommandInput('');
    setShowQuickMenu(false);
    setHistoryPointer(null);
    setCmdHistoryList((prev) => [cmd, ...prev.filter((c) => c !== cmd)]);

    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    // Client-side built-in commands
    if (cmd === 'clear' || cmd === 'cls') {
      setHistory([]);
      return;
    }

    if (cmd === 'help') {
      const helpText = [
        '── 终端操作指南 ──',
        '• 模式切换: 右上方可切换「数据库 CLI」或「容器 Shell」模式',
        '• 快捷指令: 点击右上角「快捷指令 ▾」菜单可一键运行预设命令',
        '• 快捷键: [↑ / ↓] 浏览历史命令 | [Ctrl + L] 清屏 | [Esc] 关闭终端',
        '• 退出终端: 输入 exit 或 \\q 可直接关闭本窗口',
      ].join('\n');

      setHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          time: timeStr,
          prompt: currentPrompt,
          command: cmd,
          output: helpText,
          isError: false,
        },
      ]);
      return;
    }

    if (cmd === 'exit' || cmd === '\\q') {
      onClose();
      return;
    }

    setIsExecuting(true);

    try {
      const res = await apiFetch(`/api/apps/${app.id}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: cmd,
          mode,
          service: 'database',
        }),
      });

      const data = await res.json();
      const outputText = data.output || (data.success ? '（命令执行完成，无返回输出）' : (data.error || '执行失败'));

      setHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          time: timeStr,
          prompt: currentPrompt,
          command: cmd,
          output: outputText,
          isError: !data.success,
        },
      ]);
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          time: timeStr,
          prompt: currentPrompt,
          command: cmd,
          output: `[网络错误] 请求发送失败: ${err.message}`,
          isError: true,
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Keyboard navigation for command history
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistoryList.length === 0) return;
      const nextIndex = historyPointer === null ? 0 : Math.min(cmdHistoryList.length - 1, historyPointer + 1);
      setHistoryPointer(nextIndex);
      setCommandInput(cmdHistoryList[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer === null) return;
      const nextIndex = historyPointer - 1;
      if (nextIndex < 0) {
        setHistoryPointer(null);
        setCommandInput('');
      } else {
        setHistoryPointer(nextIndex);
        setCommandInput(cmdHistoryList[nextIndex]);
      }
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setHistory([]);
    }
  };

  // Copy full terminal output
  const handleCopyOutput = () => {
    const text = history
      .map((h) => `${h.prompt}${h.command}\n${h.output}`)
      .join('\n\n');
    void copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !mounted) return null;

  const isRunning = app.status === 'running';

  const modalElement = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Terminal Window Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-5xl h-[680px] max-h-[92vh] bg-paper-2 dark:bg-[#0c0d12] rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden text-ink dark:text-zinc-200 font-sans border border-line/40 dark:border-transparent transition-colors"
      >
        {/* Terminal Header */}
        <div className="px-5 py-3.5 bg-paper-3 dark:bg-[#12131a] flex items-center justify-between gap-3 flex-shrink-0 transition-colors">
          {/* Left: Window Title & Meta */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-paper-4 dark:bg-zinc-800 flex items-center justify-center text-ink dark:text-zinc-300 font-mono text-xs font-bold">
              &gt;_
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-ink dark:text-zinc-100 font-mono tracking-tight">
                {app.name}
              </span>
              <span className="text-[11px] text-ink-muted dark:text-zinc-400 font-mono hidden sm:inline">
                数据库终端
              </span>
            </div>

            <div className="flex items-center gap-1.5 ml-1">
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-paper-4 dark:bg-zinc-800 text-ink dark:text-zinc-300">
                {dbInfo.name}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono font-medium ${
                  isRunning
                    ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : 'bg-paper-4 dark:bg-zinc-800 text-ink-muted dark:text-zinc-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-ink-muted/50 dark:bg-zinc-500'
                  }`}
                />
                {isRunning ? '运行中' : '已停止'}
              </span>
            </div>
          </div>

          {/* Right: Controls & Mode Switch */}
          <div className="flex items-center gap-2">
            {/* Mode Segmented Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-paper-4 dark:bg-zinc-900 text-[11px] font-medium font-mono">
              <button
                type="button"
                onClick={() => {
                  setMode('db');
                  inputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  mode === 'db'
                    ? 'bg-paper-2 dark:bg-zinc-800 text-ink dark:text-zinc-100 shadow-sm'
                    : 'text-ink-muted hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Database className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span>数据库 CLI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('shell');
                  inputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  mode === 'shell'
                    ? 'bg-paper-2 dark:bg-zinc-800 text-ink dark:text-zinc-100 shadow-sm'
                    : 'text-ink-muted hover:text-ink dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Terminal className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                <span>容器 Shell</span>
              </button>
            </div>

            {/* Quick Commands Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowQuickMenu(!showQuickMenu)}
                className="px-3 py-1.5 text-xs font-mono font-medium text-ink dark:text-zinc-300 hover:text-ink dark:hover:text-white bg-paper-4 hover:bg-paper-3 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="选择并执行快捷预设指令"
              >
                <span>快捷指令</span>
                <CaretDown className={`w-3 h-3 text-ink-muted dark:text-zinc-400 transition-transform ${showQuickMenu ? 'rotate-180' : ''}`} />
              </button>

              {showQuickMenu && (
                <div className="absolute right-0 mt-1.5 w-72 bg-paper-2 dark:bg-[#161720] border border-line/60 dark:border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-30 font-mono text-xs">
                  <div className="px-3 py-1.5 text-[10px] text-ink-muted dark:text-zinc-500 uppercase tracking-wider mb-1">
                    {mode === 'db' ? `${dbInfo.name} 预设指令` : '容器系统指令'}
                  </div>
                  {quickCommands.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleExecute(item.cmd)}
                      className="w-full text-left px-3 py-2 hover:bg-paper-3 dark:hover:bg-zinc-800/80 rounded-lg flex flex-col gap-0.5 transition-colors cursor-pointer group"
                    >
                      <div className="text-ink dark:text-zinc-200 group-hover:text-ink dark:group-hover:text-white font-medium text-xs">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                        {item.cmd}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear Screen */}
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                inputRef.current?.focus();
              }}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-4 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/70 rounded-lg transition-colors cursor-pointer"
              title="清空屏幕 (Ctrl+L)"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>

            {/* Copy Output */}
            <button
              type="button"
              onClick={handleCopyOutput}
              disabled={history.length === 0}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-4 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/70 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
              title="复制终端输出"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-4 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/80 rounded-lg transition-colors cursor-pointer ml-0.5"
              aria-label="关闭终端"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Screen Body */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex-1 bg-paper-1/40 dark:bg-[#090a0f] p-4 sm:p-5 font-mono text-xs sm:text-[13px] leading-relaxed overflow-y-auto space-y-2 select-text cursor-text no-scrollbar transition-colors"
        >
          {/* CLI Welcome Banner */}
          <div className="text-ink-muted dark:text-zinc-500 text-xs leading-relaxed space-y-0.5 pb-2">
            <div className="text-ink dark:text-zinc-400 font-semibold">
              Vessel Terminal 1.0 — {dbInfo.name} ({mode === 'db' ? `Interactive ${dbInfo.defaultCli}` : '/bin/sh'})
            </div>
            <div>
              Target service container: <span className="text-ink dark:text-zinc-300 font-medium">database</span> | Status:{' '}
              <span className={isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted dark:text-zinc-400'}>
                {isRunning ? 'running' : 'stopped'}
              </span>
            </div>
            <div className="text-ink-faint dark:text-zinc-600">
              Type &quot;help&quot; for instructions, &quot;\q&quot; or &quot;exit&quot; to leave, or select from &quot;快捷指令&quot; above.
            </div>
            {!isRunning && (
              <div className="text-amber-600 dark:text-amber-500/90 pt-1">
                [vessel] 注意: 容器当前未运行，请先在控制台点击「部署」或「启动」容器后再执行命令。
              </div>
            )}
          </div>

          {/* History of executed commands */}
          {history.map((item) => (
            <div key={item.id} className="space-y-1">
              {/* Command line */}
              <div className="flex items-center gap-2 text-ink-muted dark:text-zinc-400 pt-1">
                <span className="text-ink-faint dark:text-zinc-600 text-[10px] select-none font-mono">[{item.time}]</span>
                <span className={item.prompt.includes('#') ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-cyan-600 dark:text-cyan-400 font-bold'}>
                  {item.prompt}
                </span>
                <span className="text-ink dark:text-zinc-100 font-semibold">{item.command}</span>
              </div>

              {/* Command output */}
              <div
                className={`pl-4 whitespace-pre-wrap ${
                  item.isError
                    ? 'text-rose-600 dark:text-rose-400/90 border-l border-rose-500/50 pl-3 my-0.5'
                    : 'text-ink dark:text-zinc-300 leading-relaxed'
                }`}
              >
                {item.output}
              </div>
            </div>
          ))}

          {/* Currently executing indicator */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-ink-muted dark:text-zinc-400 pl-4 py-1">
              <CircleNotch className="w-3.5 h-3.5 animate-spin text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs text-ink-muted dark:text-zinc-500 font-mono">执行中...</span>
            </div>
          )}

          {/* Bottom Anchor for auto-scroll */}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Input Bar */}
        <div className="px-5 py-3.5 bg-paper-3 dark:bg-[#101117] flex items-center gap-2 flex-shrink-0 transition-colors">
          <span
            className={`font-mono text-xs font-bold select-none ${
              mode === 'db' ? 'text-emerald-600 dark:text-emerald-400' : 'text-cyan-600 dark:text-cyan-400'
            }`}
          >
            {currentPrompt}
          </span>

          <input
            ref={inputRef}
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={isExecuting}
            placeholder={
              mode === 'db'
                ? `输入 ${dbInfo.name} 语句 (例: ${quickCommands[0]?.cmd || 'SELECT 1;'})`
                : '输入 Linux 命令 (例: ls -la, df -h, env)'
            }
            className="flex-1 bg-transparent border-none text-ink dark:text-zinc-100 font-mono text-xs sm:text-[13px] focus:outline-none placeholder:text-ink-faint dark:placeholder:text-zinc-600 disabled:opacity-50"
            autoFocus
          />

          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={!commandInput.trim() || isExecuting}
            className="px-2.5 py-1 rounded-md bg-paper-4 hover:bg-paper-2 text-ink dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:hover:bg-paper-4 dark:disabled:hover:bg-zinc-800 cursor-pointer"
            title="执行命令 (Enter)"
          >
            {isExecuting ? (
              <CircleNotch className="w-3 h-3 animate-spin text-ink-muted dark:text-zinc-400" />
            ) : (
              <Play className="w-3 h-3 text-ink dark:text-zinc-300" weight="fill" />
            )}
            <span className="text-[11px]">执行</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
