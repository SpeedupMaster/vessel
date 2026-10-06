import React, { useEffect } from 'react';
import clsx from 'clsx';
import {
  SquaresFour,
  HardDrives,
  Globe,
  CloudArrowUp,
  Package,
  Broom,
  Anchor,
  X,
  Cpu,
  Memory,
} from '@phosphor-icons/react';
import { SystemMetrics } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';

export type NavTab = 'overview' | 'apps' | 'domains' | 'backups' | 'registries' | 'maintenance';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  metrics: SystemMetrics;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  metrics,
  isOpen = false,
  onClose,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '控制台概览', icon: <SquaresFour className="w-4 h-4" /> },
    { id: 'apps', label: '应用与编排', icon: <HardDrives className="w-4 h-4" /> },
    { id: 'domains', label: '域名与证书', icon: <Globe className="w-4 h-4" /> },
    { id: 'registries', label: '私有镜像凭证', icon: <Package className="w-4 h-4" /> },
    { id: 'maintenance', label: '巡检与安全瘦身', icon: <Broom className="w-4 h-4" /> },
    { id: 'backups', label: 'Cloudflare R2 备份', icon: <CloudArrowUp className="w-4 h-4" /> },
  ];

  const isDockerOnline = metrics.dockerStatus === 'running';
  const memUsedGb = metrics.memUsedBytes / (1024 * 1024 * 1024);
  const memTotalGb = metrics.memTotalBytes / (1024 * 1024 * 1024);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNavClick = (tabId: NavTab) => {
    onSelectTab(tabId);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay (250ms ease-out) */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 md:hidden',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Drawer Container */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-paper-2 flex flex-col h-screen select-none transition-transform duration-250 ease-out',
          'md:static md:translate-x-0 md:w-64 md:flex-shrink-0 md:z-auto',
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Brand Header - Seamless borderless */}
        <div className="h-16 flex items-center justify-between px-5 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-paper-3 flex items-center justify-center text-ink">
              <Anchor className="w-4 h-4" weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-ink font-sans">VESSEL</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-paper-3 text-ink-muted rounded-md font-medium">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-ink-faint">Docker Compose Hub</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导航菜单"
            className="md:hidden min-w-[44px] min-h-[44px] p-2 -mr-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer flex items-center justify-center"
          >
            <X className="w-5 h-5" weight="bold" />
          </button>
        </div>

        {/* Navigation List - Airy spacing without hard borders */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={clsx(
                  'w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-sans select-none cursor-pointer transition-all duration-150',
                  active
                    ? 'bg-paper-3 text-ink font-semibold'
                    : 'text-ink-muted hover:text-ink hover:bg-paper-3/50 font-normal'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={clsx(active ? 'text-ink' : 'text-ink-muted')}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Daemon & Telemetry Status Footer - Hidden on desktop since desktop header already displays real-time telemetry */}
        <div className="md:hidden m-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-paper-3/40 rounded-2xl flex-shrink-0 space-y-3 font-sans text-xs">
          {/* Docker Status */}
          <div className="flex items-center justify-between">
            <span className="text-ink-muted text-[11px]">Docker 引擎</span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isDockerOnline ? (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                ) : (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-40 animate-pulse" />
                )}
                <span
                  className={clsx(
                    'relative inline-flex rounded-full h-2 w-2',
                    isDockerOnline
                      ? 'bg-emerald-500'
                      : 'bg-rose-500'
                  )}
                />
              </span>
              <span
                className={clsx(
                  'text-[11px] font-semibold tracking-wide',
                  isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                )}
              >
                {isDockerOnline ? '已连接' : '离线'}
              </span>
            </div>
          </div>

          {/* Running Containers */}
          <div className="text-[11px] text-ink-faint flex justify-between items-center">
            <span>运行中容器:</span>
            <span className="text-ink font-mono font-medium">{metrics.runningContainers}</span>
          </div>

          {/* Telemetry (Subtle Surface micro-cards without borders) */}
          <div className="pt-1 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-paper-2 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-ink-muted" />
                <span>CPU 负载</span>
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-ink">
                <RollingCounter value={metrics.cpuUsage} suffix="%" />
              </div>
            </div>
            <div className="bg-paper-2 rounded-xl p-2.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
                <Memory className="w-3.5 h-3.5 text-ink-muted" />
                <span>RAM 内存</span>
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-ink flex items-baseline gap-0.5">
                <RollingCounter value={memUsedGb} precision={1} />
                <span className="text-ink-faint text-[10px]">/{memTotalGb.toFixed(0)}G</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
