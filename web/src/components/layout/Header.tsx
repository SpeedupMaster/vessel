import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  List,
  Cpu,
  Memory,
  ArrowClockwise,
  CaretDown,
  CaretRight,
  Key,
  SignOut,
  Shield,
} from '@phosphor-icons/react';
import { SystemMetrics, AuthUser } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { ThemeToggle } from '../common/ThemeToggle.js';
import { VesselMark } from '../common/ViewReveal.js';

interface HeaderProps {
  title: string;
  section?: string;
  metrics: SystemMetrics;
  user?: AuthUser | null;
  onRefresh: () => void;
  onOpenMenu?: () => void;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
}

/** Refresh button whose icon completes one full turn per click. */
const RefreshButton: React.FC<{ onRefresh: () => void; className?: string }> = ({ onRefresh, className }) => {
  const [turns, setTurns] = useState(0);
  return (
    <button
      onClick={() => {
        setTurns((t) => t + 1);
        onRefresh();
      }}
      aria-label="刷新数据"
      data-tooltip="刷新数据"
      className={clsx(
        'rounded-xl text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer flex items-center justify-center active:scale-95',
        className
      )}
    >
      <ArrowClockwise
        className="w-4 h-4 transition-transform duration-700 ease-out-expo"
        style={{ transform: `rotate(${turns * 360}deg)` }}
      />
    </button>
  );
};

const UserMenu: React.FC<{
  user: AuthUser;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
  onDone: () => void;
  className?: string;
}> = ({ user, onOpenChangePassword, onLogout, onDone, className }) => (
  <div
    onMouseDown={(e) => e.stopPropagation()}
    className={clsx('absolute right-0 top-full mt-2 w-56 rounded-2xl surface-pop p-1.5 z-30 animate-dropdown origin-top-right', className)}
  >
    <div className="px-3 py-2.5 mb-1 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-paper-3 to-paper-4 border border-line flex items-center justify-center text-ink font-semibold text-xs">
        {user.username.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-ink truncate">{user.username}</p>
        <p className="text-[10.5px] text-ink-muted flex items-center gap-1">
          <Shield className="w-3 h-3" weight="fill" />
          超级管理员
        </p>
      </div>
    </div>
    <div className="hairline mx-2 mb-1" />
    <div className="space-y-0.5">
      {onOpenChangePassword && (
        <button
          type="button"
          onClick={() => {
            onDone();
            onOpenChangePassword();
          }}
          className="group w-full min-h-[40px] md:min-h-0 px-3 py-2 text-left text-xs text-ink-muted hover:text-ink hover:bg-paper-3 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
        >
          <Key className="w-3.5 h-3.5 transition-transform duration-300 ease-spring group-hover:-rotate-12" />
          <span>修改密码</span>
        </button>
      )}
      {onLogout && (
        <button
          type="button"
          onClick={() => {
            onDone();
            onLogout();
          }}
          className="group w-full min-h-[40px] md:min-h-0 px-3 py-2 text-left text-xs text-ink-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
        >
          <SignOut className="w-3.5 h-3.5 transition-transform duration-300 ease-spring group-hover:translate-x-0.5" />
          <span>退出登录</span>
        </button>
      )}
    </div>
  </div>
);

export const Header: React.FC<HeaderProps> = ({
  title,
  section,
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
  const memPct = metrics.memTotalBytes > 0 ? (metrics.memUsedBytes / metrics.memTotalBytes) * 100 : 0;
  const isDockerOnline = metrics.dockerStatus === 'running';

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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userMenuOpen]);

  return (
    <header className="bg-paper/70 backdrop-blur-xl backdrop-saturate-150 sticky top-0 z-20 border-b border-line">
      {/* Mobile top bar (< md) */}
      <div className="md:hidden h-14 px-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="打开导航菜单"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-ink hover:bg-paper-3 transition-colors cursor-pointer active:scale-95"
          >
            <List className="w-5 h-5" weight="bold" />
          </button>

          <div className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 rounded-lg bg-accent text-accent-contrast flex items-center justify-center shadow-[var(--shadow-button)]">
              <VesselMark className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-[13px] tracking-[0.04em] text-ink">VESSEL</span>
          </div>

          <div
            className={clsx(
              'flex items-center gap-1.5 ml-1.5 px-2 py-0.5 rounded-full border border-line text-[10px] font-medium',
              isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
            )}
          >
            <span className="status-dot !w-1.5 !h-1.5" data-live={isDockerOnline} />
            {isDockerOnline ? '在线' : '离线'}
          </div>
        </div>

        {user && (
          <div className="relative" ref={mobileMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-end p-1 rounded-xl text-ink cursor-pointer select-none"
              aria-label="管理员账号菜单"
              aria-expanded={userMenuOpen}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-paper-3 to-paper-4 border border-line text-ink flex items-center justify-center font-semibold text-xs">
                {user.username.charAt(0).toUpperCase()}
              </div>
            </button>
            {userMenuOpen && (
              <UserMenu
                user={user}
                onOpenChangePassword={onOpenChangePassword}
                onLogout={onLogout}
                onDone={() => setUserMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile sub-header (< md) */}
      <div className="md:hidden h-12 px-4 flex items-center justify-between border-t border-line-subtle">
        <h1 key={title} className="text-[15px] font-semibold text-ink tracking-tight truncate pr-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {title}
        </h1>
        <div className="flex items-center gap-1 shrink-0">
          <RefreshButton onRefresh={onRefresh} className="min-w-[44px] min-h-[44px]" />
          <ThemeToggle />
        </div>
      </div>

      {/* Desktop header (>= md) */}
      <div className="hidden md:flex h-16 px-6 lg:px-8 items-center justify-between gap-4">
        <div className="min-w-0">
          {section && (
            <div className="flex items-center gap-1 text-[11px] text-ink-faint leading-none mb-1.5">
              <span>Vessel</span>
              <CaretRight className="w-2.5 h-2.5" />
              <span>{section}</span>
            </div>
          )}
          <h1
            key={title}
            className="text-[15px] font-semibold text-ink tracking-tight leading-none truncate animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Telemetry strip */}
          <div className="hidden lg:flex items-stretch rounded-xl border border-line bg-paper-2/70 shadow-subtle text-xs divide-x divide-line">
            <div
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 font-medium',
                isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              )}
            >
              <span className="status-dot" data-live={isDockerOnline} />
              <span className="text-ink-muted font-normal">Docker</span>
              <span>{isDockerOnline ? '运行中' : '离线'}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5" data-tooltip={`CPU 负载 ${metrics.cpuUsage.toFixed(0)}%`}>
              <Cpu className="w-3.5 h-3.5 text-ink-faint" />
              <span className="text-ink font-mono font-medium w-[34px] text-right">
                <RollingCounter value={metrics.cpuUsage} suffix="%" />
              </span>
              <div className="meter w-10 text-ink">
                <span style={{ width: `${Math.min(100, metrics.cpuUsage)}%` }} />
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5" data-tooltip={`内存 ${memUsedGb.toFixed(1)} / ${memTotalGb.toFixed(0)} GB`}>
              <Memory className="w-3.5 h-3.5 text-ink-faint" />
              <span className="text-ink font-mono font-medium">
                <RollingCounter value={memUsedGb} precision={1} />
                <span className="text-ink-faint">/{memTotalGb.toFixed(0)}G</span>
              </span>
              <div className="meter w-10 text-ink">
                <span style={{ width: `${Math.min(100, memPct)}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <RefreshButton onRefresh={onRefresh} className="w-9 h-9" />
            <ThemeToggle />

            {user && (
              <div className="relative ml-1" ref={desktopMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-expanded={userMenuOpen}
                  className="btn-vessel-secondary px-2 py-1 rounded-xl gap-2 text-xs select-none"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-paper-3 to-paper-4 border border-line text-ink flex items-center justify-center font-semibold text-[10px]">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium max-w-[80px] truncate">{user.username}</span>
                  <CaretDown
                    className={clsx('w-3 h-3 text-ink-muted transition-transform duration-300 ease-spring', userMenuOpen && 'rotate-180')}
                  />
                </button>
                {userMenuOpen && (
                  <UserMenu
                    user={user}
                    onOpenChangePassword={onOpenChangePassword}
                    onLogout={onLogout}
                    onDone={() => setUserMenuOpen(false)}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
