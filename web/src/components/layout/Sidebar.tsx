import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  SquaresFour,
  HardDrives,
  Globe,
  CloudArrowUp,
  Package,
  Wrench,
  BellRinging,
  X,
  Cpu,
  Memory,
  MagnifyingGlass,
  Icon,
} from '@phosphor-icons/react';
import { SystemMetrics } from '../../types/index.js';
import { RollingCounter } from '../common/RollingCounter.js';
import { VesselMark } from '../common/ViewReveal.js';
import { UpdateModal } from '../common/UpdateModal.js';
import { useSystemUpdate } from '../../hooks/useSystemUpdate.js';
import { useNotification } from '../../context/NotificationContext.js';

export type NavTab = 'overview' | 'apps' | 'domains' | 'backups' | 'registries' | 'maintenance' | 'notifications';

export interface NavCounts {
  apps?: number;
  domains?: number;
  /** Apps with a newer image available; surfaced on the maintenance item */
  updates?: number;
}

export interface NavItem {
  id: NavTab;
  label: string;
  icon: Icon;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: '工作区',
    items: [
      { id: 'overview', label: '概览', icon: SquaresFour },
      { id: 'apps', label: '应用', icon: HardDrives },
      { id: 'domains', label: '域名与证书', icon: Globe },
    ],
  },
  {
    label: '运维',
    items: [
      { id: 'backups', label: '备份', icon: CloudArrowUp },
      { id: 'maintenance', label: '维护', icon: Wrench },
    ],
  },
  {
    label: '设置',
    items: [
      { id: 'registries', label: '镜像仓库', icon: Package },
      { id: 'notifications', label: '通知渠道', icon: BellRinging },
    ],
  },
];

export const NAV_LABELS: Record<NavTab, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.label]))
) as Record<NavTab, string>;

export const NAV_SECTION: Record<NavTab, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.id, g.label]))
) as Record<NavTab, string>;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenSearch: () => void;
  metrics: SystemMetrics;
  counts: NavCounts;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSearch,
  metrics,
  counts,
  isOpen = false,
  onClose,
}) => {
  const memUsedGb = metrics.memUsedBytes / (1024 * 1024 * 1024);
  const memTotalGb = metrics.memTotalBytes / (1024 * 1024 * 1024);
  const memPct = metrics.memTotalBytes > 0 ? (metrics.memUsedBytes / metrics.memTotalBytes) * 100 : 0;

  const update = useSystemUpdate(true);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const { toast } = useNotification();
  useEffect(() => {
    if (update.justUpdatedTo) toast.success(`Vessel 已更新至 v${update.justUpdatedTo}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNavClick = (tabId: NavTab) => {
    onSelectTab(tabId);
    onClose?.();
  };

  const countFor = (id: NavTab): { value: number; attention: boolean } | null => {
    if (id === 'apps' && counts.apps) return { value: counts.apps, attention: false };
    if (id === 'domains' && counts.domains) return { value: counts.domains, attention: false };
    if (id === 'maintenance' && counts.updates) return { value: counts.updates, attention: true };
    return null;
  };

  const latestTag = update.status?.updateAvailable ? update.status.latest?.tag : null;

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
        aria-label="导航菜单"
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-paper-2 flex flex-col h-screen select-none transition-transform duration-[420ms] ease-out-expo',
          'md:static md:translate-x-0 md:w-60 md:flex-shrink-0 md:z-auto md:border-r md:border-line md:bg-paper-2/60 md:backdrop-blur-xl',
          isOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent shadow-[var(--shadow-button)]">
              <VesselMark className="w-4 h-4" />
            </div>
            <span className="font-semibold text-[15px] text-ink">Vessel</span>
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

        {/* Search / jump */}
        <div className="px-3 pb-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              onOpenSearch();
            }}
            className="w-full h-10 px-3 flex items-center gap-2 rounded-lg border border-line bg-paper-2 text-[13px] text-ink-faint hover:text-ink-muted hover:border-line-strong transition-colors cursor-pointer"
          >
            <MagnifyingGlass className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">搜索或跳转…</span>
            <kbd className="hidden md:inline text-[10.5px] px-1.5 py-px rounded border border-line text-ink-faint font-mono">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="主导航" className="flex-1 pt-3 pb-3 px-3 overflow-y-auto no-scrollbar">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={clsx(gi > 0 && 'mt-5')}>
              <div className="px-3 pb-1.5 text-[11.5px] font-medium text-ink-faint">{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = currentTab === item.id;
                  const ItemIcon = item.icon;
                  const count = countFor(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'w-full min-h-[40px] flex items-center gap-2.5 px-3 rounded-lg text-[13.5px] font-medium cursor-pointer transition-colors duration-150',
                        active
                          ? 'bg-paper-2 text-signal shadow-subtle ring-1 ring-line'
                          : 'text-ink-muted hover:text-ink hover:bg-paper-3/70'
                      )}
                    >
                      <ItemIcon className="w-[18px] h-[18px] shrink-0" weight={active ? 'fill' : 'regular'} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {count && (
                        <span
                          className={clsx(
                            'text-[11.5px] tabular-nums',
                            count.attention
                              ? 'min-w-[20px] px-1.5 rounded-full bg-signal-soft text-signal font-semibold text-center'
                              : 'text-ink-faint font-normal'
                          )}
                        >
                          {count.value}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* CPU / RAM on mobile — the desktop header carries these */}
        <div className="md:hidden mx-3 mb-3 grid grid-cols-2 gap-2 text-xs flex-shrink-0">
          <div className="bg-paper-3/60 rounded-xl p-2.5 border border-line-subtle">
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
          <div className="bg-paper-3/60 rounded-xl p-2.5 border border-line-subtle">
            <div className="flex items-center gap-1.5 text-ink-muted text-[11px]">
              <Memory className="w-3.5 h-3.5" />
              <span>内存</span>
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

        {/* Version / panel update */}
        <div className="mx-3 mb-3 pb-[env(safe-area-inset-bottom,0px)] flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsUpdateOpen(true)}
            className="w-full min-h-[44px] px-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-paper-2 text-xs hover:bg-paper-3 transition-colors cursor-pointer"
          >
            <span className="text-ink-muted font-mono">v{__APP_VERSION__}</span>
            {latestTag ? (
              <span className="flex items-center gap-1.5 text-signal font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                有新版本 {latestTag}
              </span>
            ) : (
              <span className="text-ink-faint">检查更新</span>
            )}
          </button>
        </div>
      </aside>

      <UpdateModal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
        status={update.status}
        checking={update.checking}
        apply={update.apply}
        onCheck={update.check}
        onStart={update.start}
        onReset={update.reset}
      />
    </>
  );
};
