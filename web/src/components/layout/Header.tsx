import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  List,
  Cpu,
  Memory,
  ArrowClockwise,
  CaretDown,
  Key,
  SignOut,
  Shield,
  Anchor,
} from '@phosphor-icons/react';
import { SystemMetrics, AuthUser } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { ThemeToggle } from '../common/ThemeToggle.js';

interface HeaderProps {
  title: string;
  metrics: SystemMetrics;
  user?: AuthUser | null;
  onRefresh: () => void;
  onOpenMenu?: () => void;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  metrics,
  user,
  onRefresh,
  onOpenMenu,
  onOpenChangePassword,
  onLogout,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const memUsedGb = metrics.memUsedBytes / (1024 * 1024 * 1024);
  const memTotalGb = metrics.memTotalBytes / (1024 * 1024 * 1024);
  const isDockerOnline = metrics.dockerStatus === 'running';

  // Close menu on click outside (check both desktop and mobile containers)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (desktopMenuRef.current && desktopMenuRef.current.contains(target)) ||
        (mobileMenuRef.current && mobileMenuRef.current.contains(target))
      ) {
        return;
      }
      setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <header className="bg-paper/80 backdrop-blur-md sticky top-0 z-20 transition-colors">
      {/* Mobile Top Navigation Bar (< md) */}
      <div className="md:hidden h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Hamburger Menu Button */}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="打开导航菜单"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink hover:bg-paper-3 transition-colors cursor-pointer"
          >
            <List className="w-5 h-5" weight="bold" />
          </button>

          {/* Logo & Brand */}
          <div className="flex items-center gap-1.5 select-none">
            <div className="w-7 h-7 rounded-lg bg-paper-3 flex items-center justify-center text-ink">
              <Anchor className="w-3.5 h-3.5" weight="bold" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-ink font-sans">VESSEL</span>
          </div>

          {/* Status Dot Pill */}
          <div className="flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-full bg-paper-2 text-[11px]">
            <span className="relative flex h-2 w-2">
              {isDockerOnline ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              ) : null}
              <span
                className={clsx(
                  'relative inline-flex rounded-full h-2 w-2',
                  isDockerOnline ? 'bg-emerald-500' : 'bg-rose-500'
                )}
              />
            </span>
            <span
              className={clsx(
                'font-medium text-[10px]',
                isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              )}
            >
              {isDockerOnline ? '在线' : '离线'}
            </span>
          </div>
        </div>

        {/* User Account Button (Mobile) */}
        {user && (
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-end p-1 rounded-xl text-ink transition-colors cursor-pointer select-none"
              aria-label="管理员账号菜单"
            >
              <div className="w-7 h-7 rounded-full bg-paper-3 text-ink flex items-center justify-center font-semibold text-xs">
                {user.username.charAt(0).toUpperCase()}
              </div>
            </button>

            {/* Mobile Dropdown */}
            {userMenuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-paper-2 shadow-2xl p-1.5 z-30 animate-fade-in font-sans origin-top-right"
              >
                <div className="px-3 py-2 bg-paper-3/40 rounded-xl mb-1">
                  <p className="text-xs font-semibold text-ink truncate">{user.username}</p>
                  <p className="text-[10px] text-ink-muted">超级管理员</p>
                </div>
                <div className="py-0.5 space-y-0.5">
                  {onOpenChangePassword && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenChangePassword();
                      }}
                      className="w-full min-h-[44px] px-3 text-left text-xs text-ink-muted hover:text-ink hover:bg-paper-3 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>修改密码</span>
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full min-h-[44px] px-3 text-left text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
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

      {/* Mobile Sub-Header (< md) */}
      <div className="md:hidden h-12 px-4 flex items-center justify-between">
        <h1 className="text-base font-semibold text-ink tracking-tight font-sans truncate pr-2">
          {title}
        </h1>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onRefresh}
            aria-label="刷新数据"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
          >
            <ArrowClockwise className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-center">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Desktop Header (>= md) - Clean borderless */}
      <div className="hidden md:flex h-16 px-6 lg:px-8 items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-ink tracking-tight font-sans">{title}</h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Real-time Telemetry Strip (Seamless soft pills) */}
          <div className="flex items-center gap-1.5 rounded-xl bg-paper-2 px-2 py-1 text-xs font-sans">
            {/* Docker Daemon Status */}
            <div className="flex items-center gap-2 px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                {isDockerOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={clsx(
                    'relative inline-flex rounded-full h-2 w-2',
                    isDockerOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  )}
                />
              </span>
              <span className="text-ink-muted">Docker</span>
              <span
                className={clsx(
                  'font-medium',
                  isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                )}
              >
                {isDockerOnline ? '运行中' : '离线'}
              </span>
            </div>

            {/* CPU */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-paper-3/40 rounded-lg">
              <Cpu className="w-3.5 h-3.5 text-ink-muted" weight="bold" />
              <span className="text-ink-muted">CPU</span>
              <span className="text-ink font-mono font-medium">
                <RollingCounter value={metrics.cpuUsage} suffix="%" />
              </span>
            </div>

            {/* Memory */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-paper-3/40 rounded-lg">
              <Memory className="w-3.5 h-3.5 text-ink-muted" weight="bold" />
              <span className="text-ink-muted">RAM</span>
              <span className="text-ink font-mono font-medium">
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
              className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-paper-2 transition-all cursor-pointer"
            >
              <ArrowClockwise className="w-4 h-4" />
            </button>

            {/* Theme Switcher */}
            <ThemeToggle />

            {/* Admin User Account Dropdown */}
            {user && (
              <div className="relative" ref={desktopMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-paper-2 hover:bg-paper-3 text-ink text-xs transition-colors cursor-pointer select-none"
                >
                  <div className="w-5 h-5 rounded-full bg-paper-3 text-ink flex items-center justify-center font-semibold text-[10px]">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium max-w-[80px] truncate">{user.username}</span>
                  <CaretDown className={`w-3 h-3 text-ink-muted transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-2 w-52 rounded-2xl bg-paper-2 shadow-2xl p-1.5 z-30 animate-fade-in font-sans origin-top-right"
                  >
                    {/* User Profile Overview */}
                    <div className="px-3 py-2 bg-paper-3/40 rounded-xl mb-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-paper-3 text-ink">
                          <Shield className="w-3.5 h-3.5" weight="bold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">{user.username}</p>
                          <p className="text-[10px] text-ink-muted">超级管理员</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="py-0.5 space-y-0.5">
                      {onOpenChangePassword && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onOpenChangePassword();
                          }}
                          className="group w-full px-3 py-2 text-left text-xs text-ink-muted hover:text-ink hover:bg-paper-3 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5 text-ink-muted group-hover:text-ink transition-colors" />
                          <span>修改密码</span>
                        </button>
                      )}

                      {onLogout && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onLogout();
                          }}
                          className="group w-full px-3 py-2 text-left text-xs text-ink-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <SignOut className="w-3.5 h-3.5 text-ink-muted group-hover:text-rose-500 transition-colors" />
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
      </div>
    </header>
  );
};
