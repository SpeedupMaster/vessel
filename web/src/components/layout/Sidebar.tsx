import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  SquaresFour,
  HardDrives,
  Globe,
  CloudArrowUp,
  Package,
  Broom,
  X,
  Cpu,
  Memory,
  Icon,
} from '@phosphor-icons/react';
import { SystemMetrics } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { VesselMark } from '../common/ViewReveal.js';

export type NavTab = 'overview' | 'apps' | 'domains' | 'backups' | 'registries' | 'maintenance';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  metrics: SystemMetrics;
  isOpen?: boolean;
  onClose?: () => void;
}

const NAV_GROUPS: { label: string; items: { id: NavTab; label: string; icon: Icon }[] }[] = [
  {
    label: '工作区',
    items: [
      { id: 'overview', label: '控制台概览', icon: SquaresFour },
      { id: 'apps', label: '应用与编排', icon: HardDrives },
      { id: 'domains', label: '域名与证书', icon: Globe },
    ],
  },
  {
    label: '运维',
    items: [
      { id: 'registries', label: '私有镜像凭证', icon: Package },
      { id: 'maintenance', label: '巡检与安全瘦身', icon: Broom },
      { id: 'backups', label: 'Cloudflare R2 备份', icon: CloudArrowUp },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  metrics,
  isOpen = false,
  onClose,
}) => {
  const isDockerOnline = metrics.dockerStatus === 'running';
  const memUsedGb = metrics.memUsedBytes / (1024 * 1024 * 1024);
  const memTotalGb = metrics.memTotalBytes / (1024 * 1024 * 1024);
  const memPct = metrics.memTotalBytes > 0 ? (metrics.memUsedBytes / metrics.memTotalBytes) * 100 : 0;

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Partial<Record<NavTab, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ top: number; height: number; ready: boolean; animate: boolean }>({
    top: 0,
    height: 0,
    ready: false,
    animate: false,
  });

  // Slide the active pill to the selected item. The first placement is instant; later ones spring.
  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[currentTab];
      if (!el) return;
      setIndicator((prev) => ({ top: el.offsetTop, height: el.offsetHeight, ready: true, animate: prev.ready }));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [currentTab]);

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
    onClose?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ease-out-expo md:hidden',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-paper-2 flex flex-col h-screen select-none transition-transform duration-[420ms] ease-out-expo',
          'md:static md:translate-x-0 md:w-64 md:flex-shrink-0 md:z-auto md:border-r md:border-line md:bg-paper-2/60 md:backdrop-blur-xl',
          isOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center text-accent-contrast bg-accent shadow-[var(--shadow-button)] overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-transparent dark:to-black/10" />
              <VesselMark className="relative w-[18px] h-[18px]" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[13px] tracking-[0.04em] text-ink">VESSEL</span>
                <span className="text-[9.5px] px-1.5 py-px rounded-md border border-line text-ink-faint font-medium font-mono">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-ink-faint mt-0.5">Docker Compose Hub</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导航菜单"
            className="md:hidden min-w-[44px] min-h-[44px] p-2 -mr-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer flex items-center justify-center"
          >
            <X className="w-5 h-5" weight="bold" />
          </button>
        </div>

        {/* Navigation */}
        <nav ref={navRef} className="relative flex-1 pt-2 pb-3 px-3 overflow-y-auto no-scrollbar">
          {/* Sliding active indicator */}
          <div
            aria-hidden="true"
            className={clsx(
              'absolute left-3 right-3 rounded-xl bg-paper-3 border border-line shadow-subtle pointer-events-none',
              indicator.animate && 'transition-[transform,height] duration-[460ms] ease-spring',
              !indicator.ready && 'opacity-0'
            )}
            style={{ transform: `translateY(${indicator.top}px)`, height: indicator.height, top: 0 }}
          >
            <span className="absolute left-0 top-1/2 -translate-y-1/2 -ml-px w-[3px] h-4 rounded-full bg-signal shadow-[0_0_10px_var(--color-signal-ring)]" />
          </div>

          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={clsx(gi > 0 && 'mt-5')}>
              <div className="eyebrow px-3.5 pb-2">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = currentTab === item.id;
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        itemRefs.current[item.id] = el;
                      }}
                      onClick={() => handleNavClick(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'group relative w-full min-h-[40px] flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13px] select-none cursor-pointer transition-colors duration-200',
                        active ? 'text-ink font-semibold' : 'text-ink-muted hover:text-ink hover:bg-paper-3/50'
                      )}
                    >
                      <ItemIcon
                        className={clsx(
                          'w-[17px] h-[17px] shrink-0 transition-transform duration-300 ease-spring',
                          active ? 'text-ink' : 'text-ink-faint group-hover:text-ink group-hover:scale-110'
                        )}
                        weight={active ? 'fill' : 'regular'}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Engine status */}
        <div className="m-3 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] md:pb-3.5 rounded-2xl bg-paper-3/50 border border-line-subtle flex-shrink-0 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted text-[11px]">Docker 引擎</span>
            <span
              className={clsx(
                'flex items-center gap-2 text-[11px] font-semibold',
                isDockerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
              )}
            >
              <span className="status-dot" data-live={isDockerOnline} />
              {isDockerOnline ? '已连接' : '离线'}
            </span>
          </div>

          <div className="text-[11px] text-ink-faint flex justify-between items-center">
            <span>运行中容器</span>
            <span className="text-ink font-mono font-medium">{metrics.runningContainers ?? '—'}</span>
          </div>

          {/* CPU / RAM — the desktop header already carries these */}
          <div className="md:hidden pt-1 grid grid-cols-2 gap-2">
            <div className="bg-paper-2 rounded-xl p-2.5 border border-line-subtle">
              <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
                <Cpu className="w-3.5 h-3.5" />
                <span>CPU</span>
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-ink">
                <RollingCounter value={metrics.cpuUsage} suffix="%" />
              </div>
              <div className="meter mt-2 text-ink">
                <span style={{ width: `${Math.min(100, metrics.cpuUsage)}%` }} />
              </div>
            </div>
            <div className="bg-paper-2 rounded-xl p-2.5 border border-line-subtle">
              <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
                <Memory className="w-3.5 h-3.5" />
                <span>RAM</span>
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-ink flex items-baseline gap-0.5">
                <RollingCounter value={memUsedGb} precision={1} />
                <span className="text-ink-faint text-[10px]">/{memTotalGb.toFixed(0)}G</span>
              </div>
              <div className="meter mt-2 text-ink">
                <span style={{ width: `${Math.min(100, memPct)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
