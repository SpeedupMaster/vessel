import React from 'react';
import clsx from 'clsx';
import {
  SquaresFour,
  HardDrives,
  Globe,
  CloudArrowUp,
  Package,
  Broom,
  Anchor,
  Circle,
} from '@phosphor-icons/react';
import { SystemMetrics } from '../../types/index.js';

export type NavTab = 'overview' | 'apps' | 'domains' | 'backups' | 'registries' | 'maintenance';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  metrics: SystemMetrics;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, metrics }) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '控制台概览', icon: <SquaresFour className="w-4 h-4" /> },
    { id: 'apps', label: '应用与编排', icon: <HardDrives className="w-4 h-4" /> },
    { id: 'domains', label: '域名与证书', icon: <Globe className="w-4 h-4" /> },
    { id: 'registries', label: '私有镜像凭证', icon: <Package className="w-4 h-4" /> },
    { id: 'maintenance', label: '巡检与安全瘦身', icon: <Broom className="w-4 h-4" /> },
    { id: 'backups', label: 'Cloudflare R2 备份', icon: <CloudArrowUp className="w-4 h-4" /> },
  ];

  const isDockerOnline = metrics.dockerStatus === 'running';

  return (
    <aside className="w-64 flex-shrink-0 bg-paper-2 border-r border-line flex flex-col h-screen select-none transition-colors">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-line">
        <div className="w-8 h-8 rounded-lg bg-paper-3 border border-line flex items-center justify-center text-accent shadow-subtle">
          <Anchor className="w-4 h-4" weight="bold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-ink font-sans">VESSEL</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-paper-3 text-ink-muted border border-line rounded">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-ink-faint">Docker Compose Hub</p>
        </div>
      </div>

      {/* Navigation List - Spacious & Relaxed */}
      <nav className="flex-1 py-6 px-3.5 space-y-1.5">
        {navItems.map((item) => {
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={clsx(
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm border font-sans select-none cursor-pointer',
                active
                  ? 'bg-paper dark:bg-paper-3 text-ink font-medium border-line shadow-subtle'
                  : 'border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
              )}
            >
              <div className="flex items-center gap-3">
                <span className={clsx(active ? 'text-accent' : 'text-ink-muted')}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Daemon Status Footer */}
      <div className="p-5 border-t border-line bg-paper/40">
        <div className="flex items-center justify-between text-xs">
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
                    : 'bg-[#ff6b6b] shadow-[0_0_8px_rgba(255,107,107,0.6)]'
                )}
              />
            </span>
            <span
              className={clsx(
                'text-[11px] font-semibold tracking-wide',
                isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-[#ff6b6b]'
              )}
            >
              {isDockerOnline ? '已连接' : '离线'}
            </span>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-ink-faint flex justify-between items-center">
          <span>运行中容器:</span>
          <span className="text-ink font-mono font-medium">{metrics.runningContainers}</span>
        </div>
      </div>
    </aside>
  );
};
