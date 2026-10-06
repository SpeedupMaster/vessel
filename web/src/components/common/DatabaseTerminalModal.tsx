import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import {
  X,
  Copy,
  Check,
  Terminal,
  CircleNotch,
  ArrowsClockwise,
  Trash,
  Play,
  Database,
  ArrowRight,
} from '@phosphor-icons/react';
import { AppItem } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';
import { DATABASE_OPTIONS } from './CreateDatabaseModal.js';

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

  const [mounted, setMounted] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [mode, setMode] = useState<'db' | 'shell'>('db');
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<CommandRecord[]>([]);
  const [cmdHistoryList, setCmdHistoryList] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number | null>(null);

  // Identify database engine
  const dbInfo = useMemo(() => {
    const yaml = (app.composeYaml || '').toLowerCase();
    const env = (app.envContent || '').toLowerCase();
    const name = (app.name || '').toLowerCase();

    for (const opt of DATABASE_OPTIONS) {
      if (opt.type === 'postgres' && (yaml.includes('postgres') || name.includes('postgres'))) {
        return { type: 'postgresql', name: 'PostgreSQL', icon: opt.icon, defaultCli: 'psql', prompt: 'postgres=# ' };
      }
      if (opt.type === 'mysql' && (yaml.includes('mysql') || name.includes('mysql')) && !yaml.includes('mariadb')) {
        return { type: 'mysql', name: 'MySQL', icon: opt.icon, defaultCli: 'mysql', prompt: 'mysql> ' };
      }
      if (opt.type === 'mariadb' && (yaml.includes('mariadb') || name.includes('mariadb'))) {
        return { type: 'mariadb', name: 'MariaDB', icon: opt.icon, defaultCli: 'mariadb', prompt: 'mariadb> ' };
      }
      if (opt.type === 'redis' && (yaml.includes('redis') || name.includes('redis'))) {
        return { type: 'redis', name: 'Redis', icon: opt.icon, defaultCli: 'redis-cli', prompt: 'redis:6379> ' };
      }
      if (opt.type === 'mongodb' && (yaml.includes('mongo') || name.includes('mongo'))) {
        return { type: 'mongodb', name: 'MongoDB', icon: opt.icon, defaultCli: 'mongosh', prompt: 'mongosh> ' };
      }
      if (opt.type === 'libsql' && (yaml.includes('sqld') || yaml.includes('libsql') || name.includes('libsql'))) {
        return { type: 'libsql', name: 'libSQL', icon: opt.icon, defaultCli: 'sqld', prompt: 'sqld> ' };
      }
    }
    return { type: 'generic', name: '容器服务', icon: null, defaultCli: 'sh', prompt: 'db> ' };
  }, [app]);

  // Current prompt string
  const currentPrompt = mode === 'db' ? dbInfo.prompt : 'root@database:/# ';

  // Quick preset shortcuts based on engine and mode
  const quickCommands = useMemo(() => {
    if (mode === 'shell') {
      return [
        { label: '文件清单', cmd: 'ls -la' },
        { label: '磁盘空间', cmd: 'df -h' },
        { label: '环境变量', cmd: 'env' },
        { label: '运行进程', cmd: 'ps aux' },
        { label: '系统内核', cmd: 'uname -a' },
      ];
    }

    switch (dbInfo.type) {
      case 'postgresql':
        return [
          { label: '列出数据库 (\\l)', cmd: '\\l' },
          { label: '列出数据表 (\\dt)', cmd: '\\dt' },
          { label: '数据库版本', cmd: 'SELECT version();' },
          { label: '当前用户与库', cmd: 'SELECT current_user, current_database();' },
          { label: '当前连接数', cmd: 'SELECT count(*) FROM pg_stat_activity;' },
          { label: '当前服务器时间', cmd: 'SELECT now();' },
        ];
      case 'mysql':
      case 'mariadb':
        return [
          { label: '查看所有数据库', cmd: 'SHOW DATABASES;' },
          { label: '查看数据表', cmd: 'SHOW TABLES;' },
          { label: '数据库版本', cmd: 'SELECT VERSION();' },
          { label: '系统状态', cmd: 'STATUS;' },
          { label: '当前连接进程', cmd: 'SHOW PROCESSLIST;' },
        ];
      case 'redis':
        return [
          { label: '存活心跳 (PING)', cmd: 'PING' },
          { label: '服务器信息 (INFO)', cmd: 'INFO' },
          { label: '键数量 (DBSIZE)', cmd: 'DBSIZE' },
          { label: '所有键 (KEYS *)', cmd: 'KEYS *' },
          { label: '客户端连接', cmd: 'CLIENT LIST' },
        ];
      case 'mongodb':
        return [
          { label: '查看数据库列表', cmd: 'show dbs' },
          { label: '查看集合 (Collections)', cmd: 'show collections' },
          { label: '数据库状态统计', cmd: 'db.stats()' },
          { label: '引擎版本', cmd: 'db.version()' },
        ];
      default:
        return [
          { label: '列出文件', cmd: 'ls -la' },
          { label: '环境变量', cmd: 'env' },
          { label: '磁盘用量', cmd: 'df -h' },
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
          { opacity: 0, scale: 0.96, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power3.out' }
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

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll to bottom when history changes
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isExecuting]);

  // Execute command
  const handleExecute = async (overrideCmd?: string) => {
    const cmd = (overrideCmd !== undefined ? overrideCmd : commandInput).trim();
    if (!cmd || isExecuting) return;

    setCommandInput('');
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
        '── 数据库终端帮助指南 ──',
        '• 模式切换: 可在上方切换「数据库 CLI」或「容器 Shell」模式',
        '• 快捷键: [↑ / ↓] 浏览历史命令 | [Ctrl + L] 清空屏幕 | [Esc] 关闭窗口',
        `• 快捷操作: 点击上方快捷指令可直接运行预置命令`,
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
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !mounted) return null;

  const isRunning = app.status === 'running';

  const modalElement = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-md transition-opacity"
      />

      {/* Terminal Window Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-5xl h-[680px] max-h-[92vh] bg-[#0c0d12] border border-zinc-800/90 rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden text-zinc-200 font-sans"
      >
        {/* Terminal Header */}
        <div className="px-4 py-3 bg-[#13141b] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          {/* Left: Window Title & Meta */}
          <div className="flex items-center gap-3">
            {/* macOS Style Traffic Dots */}
            <div className="flex items-center gap-1.5 mr-1">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors cursor-pointer"
                title="关闭"
              />
              <button
                onClick={() => setHistory([])}
                className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors cursor-pointer"
                title="清空"
              />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>

            {/* Title & Icon */}
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-zinc-800/80 text-emerald-400">
                <Terminal className="w-4 h-4" />
              </div>
              <span className="font-semibold text-xs sm:text-sm text-zinc-100 font-mono tracking-tight">
                {app.name}
              </span>
              <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
                数据库命令终端
              </span>
            </div>

            {/* Status & Engine Badge */}
            <div className="hidden md:flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                  isRunning
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                  }`}
                />
                {isRunning ? '已连接 (运行中)' : '离线 (未启动)'}
              </span>

              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-zinc-800/70 text-zinc-300 border border-zinc-700/60">
                {dbInfo.name}
              </span>
            </div>
          </div>

          {/* Right: Controls & Mode Switch */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-medium font-mono">
              <button
                type="button"
                onClick={() => {
                  setMode('db');
                  inputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  mode === 'db'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>数据库 CLI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('shell');
                  inputRef.current?.focus();
                }}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  mode === 'shell'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Terminal className="w-3 h-3" />
                <span>容器 Shell</span>
              </button>
            </div>

            {/* Clear Screen */}
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                inputRef.current?.focus();
              }}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 rounded-lg transition-colors cursor-pointer"
              title="清空屏幕 (Ctrl+L)"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>

            {/* Copy Output */}
            <button
              type="button"
              onClick={handleCopyOutput}
              disabled={history.length === 0}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              title="复制终端输出"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 rounded-lg transition-colors cursor-pointer"
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Command Toolbar */}
        <div className="px-4 py-2 bg-[#0f1016] border-b border-zinc-800/70 flex items-center gap-2 overflow-x-auto flex-shrink-0 scrollbar-none text-xs">
          <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap mr-1 flex items-center gap-1">
            <span>快捷指令:</span>
          </span>
          {quickCommands.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleExecute(item.cmd)}
              disabled={isExecuting}
              className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-800/90 text-[11px] font-mono transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>{item.label}</span>
              <span className="text-zinc-500 text-[10px]">({item.cmd})</span>
            </button>
          ))}
        </div>

        {/* Terminal Screen Body */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex-1 bg-[#090a0f] p-4 sm:p-5 font-mono text-xs sm:text-[13px] leading-relaxed overflow-y-auto space-y-3 select-text cursor-text"
        >
          {/* Welcome Banner */}
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/70 text-zinc-400 space-y-1">
            <div className="text-emerald-400 font-semibold flex items-center gap-2">
              <span>●</span>
              <span>Vessel 数据库容器终端 [Database Interactive Console]</span>
            </div>
            <div className="text-zinc-400 text-[11px] leading-normal">
              目标服务: <span className="text-zinc-200">database</span> | 数据库引擎:{' '}
              <span className="text-zinc-200">{dbInfo.name}</span> | 当前模式:{' '}
              <span className="text-emerald-300">
                {mode === 'db' ? `数据库 CLI (${dbInfo.defaultCli})` : '容器 Shell (/bin/sh)'}
              </span>
            </div>
            <div className="text-zinc-500 text-[11px]">
              输入 <span className="text-zinc-300">help</span> 查看快捷键，输入{' '}
              <span className="text-zinc-300">clear</span> 清屏，直接输入命令并按{' '}
              <span className="text-zinc-300">Enter</span> 执行。
            </div>
          </div>

          {!isRunning && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>容器当前未在运行中。执行命令前请先在主界面点击「部署」或「重载」启动该容器。</span>
            </div>
          )}

          {/* History of executed commands */}
          {history.map((item) => (
            <div key={item.id} className="space-y-1 group">
              {/* Command line */}
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="text-zinc-600 text-[10px] select-none font-mono">[{item.time}]</span>
                <span className={item.prompt.includes('#') ? 'text-emerald-400 font-bold' : 'text-cyan-400 font-bold'}>
                  {item.prompt}
                </span>
                <span className="text-zinc-100 font-semibold">{item.command}</span>
              </div>

              {/* Command output */}
              <div
                className={`pl-4 whitespace-pre-wrap rounded-md py-1 px-2 ${
                  item.isError
                    ? 'text-rose-400 bg-rose-950/20 border-l-2 border-rose-500 font-mono'
                    : 'text-zinc-300 font-mono leading-relaxed'
                }`}
              >
                {item.output}
              </div>
            </div>
          ))}

          {/* Currently executing indicator */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-zinc-400 pl-4 py-1">
              <CircleNotch className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span className="text-xs text-zinc-400 font-mono">命令执行中...</span>
            </div>
          )}

          {/* Bottom Anchor for auto-scroll */}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Input Bar */}
        <div className="p-3 bg-[#111218] border-t border-zinc-800 flex items-center gap-2.5 flex-shrink-0">
          <span
            className={`font-mono text-xs font-bold select-none pl-1 ${
              mode === 'db' ? 'text-emerald-400' : 'text-cyan-400'
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
                ? `输入 ${dbInfo.name} 语句 (例如: ${quickCommands[0]?.cmd || 'SELECT 1;'})`
                : '输入 Linux 容器命令 (例如: ls -la, df -h)'
            }
            className="flex-1 bg-transparent border-none text-zinc-100 font-mono text-xs sm:text-sm focus:outline-none placeholder:text-zinc-600 disabled:opacity-50"
            autoFocus
          />

          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={!commandInput.trim() || isExecuting}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium font-mono flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:hover:bg-emerald-600 cursor-pointer shadow-sm active:scale-95"
          >
            {isExecuting ? (
              <CircleNotch className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3 h-3" weight="fill" />
            )}
            <span>执行</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
};
