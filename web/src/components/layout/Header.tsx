import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  Cpu,
  Memory,
  ArrowClockwise,
  UserCircle,
  CaretDown,
  Key,
  SignOut,
  Shield,
} from '@phosphor-icons/react';
import { SystemMetrics, AuthUser } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { ThemeToggle } from '../common/ThemeToggle.js';

interface HeaderProps {
  title: string;
  metrics: SystemMetrics;
  user?: AuthUser | null;
  onRefresh: () => void;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  metrics,
  user,
  onRefresh,
  onOpenChangePassword,
  onLogout,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const memUsedGb = metrics.memUsedBytes / (1024 * 1024 * 1024);
  const memTotalGb = metrics.memTotalBytes / (1024 * 1024 * 1024);
  const isDockerOnline = metrics.dockerStatus === 'running';

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <header className="h-16 bg-paper/80 backdrop-blur-md border-b border-line px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 transition-colors">
      <div>
        <h1 className="text-base font-semibold text-ink tracking-tight font-sans">{title}</h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real-time Telemetry Strip */}
        <div className="hidden lg:flex items-center divide-x divide-line rounded-lg border border-line bg-paper-2 px-1 py-1 text-xs font-sans">
          {/* Docker Daemon Status */}
          <div className="flex items-center gap-2 px-3 py-0.5">
            <span className="relative flex h-2 w-2">
              {isDockerOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={clsx(
                  'relative inline-flex rounded-full h-2 w-2',
                  isDockerOnline
                    ? 'bg-emerald-500'
                    : 'bg-[#ff6b6b] shadow-[0_0_6px_rgba(255,107,107,0.6)]'
                )}
              />
            </span>
            <span className="text-ink-muted">Docker</span>
            <span
              className={clsx(
                'font-medium',
                isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-[#ff6b6b]'
              )}
            >
              {isDockerOnline ? '运行中' : '离线'}
            </span>
          </div>

          {/* CPU */}
          <div className="flex items-center gap-2 px-3 py-0.5">
            <Cpu className="w-3.5 h-3.5 text-accent" weight="bold" />
            <span className="text-ink-muted">CPU</span>
            <span className="text-ink font-medium">
              <RollingCounter value={metrics.cpuUsage} suffix="%" />
            </span>
          </div>

          {/* Memory */}
          <div className="flex items-center gap-2 px-3 py-0.5">
            <Memory className="w-3.5 h-3.5 text-accent" weight="bold" />
            <span className="text-ink-muted">RAM</span>
            <span className="text-ink font-medium">
              <RollingCounter value={memUsedGb} precision={1} />
              <span className="text-ink-faint">/{memTotalGb.toFixed(0)}G</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            data-tooltip="刷新数据"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-all cursor-pointer"
          >
            <ArrowClockwise className="w-4 h-4" />
          </button>

          {/* Theme Switcher */}
          <ThemeToggle />

          {/* Admin User Account Dropdown */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-paper-2 hover:bg-paper-3 text-ink text-xs transition-colors cursor-pointer select-none"
              >
                <div className="w-5 h-5 rounded-full bg-accent/15 text-accent flex items-center justify-center font-semibold text-[10px]">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium max-w-[80px] truncate">{user.username}</span>
                <CaretDown className={`w-3 h-3 text-ink-muted transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl bg-paper-2 border border-line shadow-xl py-1 z-30 animate-fade-in font-sans">
                  {/* User Profile Overview */}
                  <div className="px-3.5 py-2.5 border-b border-line">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-accent/10 text-accent">
                        <Shield className="w-3.5 h-3.5" weight="bold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-ink truncate">{user.username}</p>
                        <p className="text-[10px] text-ink-muted">超级管理员</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="py-1">
                    {onOpenChangePassword && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenChangePassword();
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 text-accent" />
                        <span>修改密码</span>
                      </button>
                    )}

                    {onLogout && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full px-3.5 py-2 text-left text-xs text-red-500 dark:text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <SignOut className="w-3.5 h-3.5" />
                        <span>退出登录</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
