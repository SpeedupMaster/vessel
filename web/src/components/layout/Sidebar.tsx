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
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'overview', label: '控制台概览', icon: <SquaresFour className="w-5 h-5" /> },
    { id: 'apps', label: '应用与编排', icon: <HardDrives className="w-5 h-5" />, count: metrics.totalApps },
    { id: 'domains', label: '域名与证书', icon: <Globe className="w-5 h-5" />, count: metrics.activeDomains },
    { id: 'backups', label: 'Cloudflare R2 备份', icon: <CloudArrowUp className="w-5 h-5" />, count: metrics.totalBackups },
    { id: 'registries', label: '私有镜像仓 (GHCR)', icon: <Package className="w-5 h-5" /> },
    { id: 'maintenance', label: '巡检与安全瘦身', icon: <Broom className="w-5 h-5" /> },
  ];

  const isDockerOnline = metrics.dockerStatus === 'running';

  return (
    <aside className="w-64 flex-shrink-0 bg-paper-2 border-r border-line flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-line">
        <div className="w-9 h-9 rounded bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-accent shadow-glow-accent">
          <Anchor className="w-5 h-5" weight="bold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-ink font-sans">VESSEL</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-paper-3 text-ink-muted border border-line rounded">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-ink-faint font-mono">Docker Compose Hub</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={clsx(
                'w-full flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-sky-950/70 text-sky-300 border border-sky-700/60 shadow-glow-accent'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-3/70'
              )}
            >
              <div className="flex items-center gap-3">
                <span className={clsx(active ? 'text-accent' : 'text-ink-muted')}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={clsx(
                    'text-[11px] font-mono px-1.5 py-0.5 rounded',
                    active ? 'bg-sky-900/80 text-sky-200' : 'bg-paper-3 text-ink-muted'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Daemon Status Footer */}
      <div className="p-4 border-t border-line bg-paper/40">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-muted font-mono">DOCKER ENGINE</span>
          <div className="flex items-center gap-1.5">
            <Circle
              weight="fill"
              className={clsx('w-2 h-2', isDockerOnline ? 'text-emerald-400 animate-pulse' : 'text-rose-500')}
            />
            <span className={clsx('font-mono font-medium', isDockerOnline ? 'text-emerald-400' : 'text-rose-400')}>
              {isDockerOnline ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
        </div>
        <div className="mt-2 text-[11px] font-mono text-ink-faint flex justify-between">
          <span>Active Containers:</span>
          <span className="text-ink font-semibold">{metrics.runningContainers}</span>
        </div>
      </div>
    </aside>
  );
};
