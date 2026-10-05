import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import {
  Plus,
  Play,
  Stop,
  ArrowsClockwise,
  Code,
  Sparkle,
  MagnifyingGlass,
  Package,
  X,
  CaretDown,
  Database,
  Stack,
} from '@phosphor-icons/react';
import { AppItem, ComposeTemplate, DomainItem, BackupRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { ComposeAppView } from './ComposeAppView.js';
import { CreateDatabaseModal } from '../common/CreateDatabaseModal.js';

interface AppsViewProps {
  apps: AppItem[];
  templates: ComposeTemplate[];
  logsMap: Record<string, string[]>;
  domains?: DomainItem[];
  backups?: BackupRecord[];
  subRoute?: {
    mode: 'list' | 'create' | 'detail';
    appId?: string | null;
  };
  onNavigateSubRoute?: (mode: 'list' | 'create' | 'detail', appId?: string | null) => void;
  onCreateApp: (app: Partial<AppItem>) => Promise<any>;
  onUpdateApp: (id: string, updates: Partial<AppItem>) => Promise<any>;
  onDeleteApp: (id: string) => Promise<any>;
  onDeploy: (id: string) => Promise<any>;
  onStop: (id: string) => Promise<any>;
  onRestart: (id: string) => Promise<any>;
  onRebuild: (id: string) => Promise<any>;
  onFreshVolumes?: (id: string) => Promise<any>;
  onBackup: (id: string) => Promise<any>;
  onDownloadBackup?: (id: string, fileName: string) => void;
  onRestoreBackup?: (id: string) => Promise<any>;
  onDeleteBackup?: (id: string) => Promise<any>;
  onSubscribeLogs: (id: string) => void;
  onCreateDomain?: (domain: Partial<DomainItem>) => Promise<any>;
  onDeleteDomain?: (id: string) => Promise<any>;
  onRenewDomain?: (id: string) => Promise<any>;
}

export const AppsView: React.FC<AppsViewProps> = ({
  apps,
  templates,
  logsMap,
  domains = [],
  backups = [],
  subRoute,
  onNavigateSubRoute,
  onCreateApp,
  onUpdateApp,
  onDeleteApp,
  onDeploy,
  onStop,
  onRestart,
  onRebuild,
  onFreshVolumes,
  onBackup,
  onDownloadBackup,
  onRestoreBackup,
  onDeleteBackup,
  onSubscribeLogs,
  onCreateDomain,
  onDeleteDomain,
  onRenewDomain,
}) => {
  const [internalMode, setInternalMode] = useState<'list' | 'create' | 'detail'>('list');
  const [internalAppId, setInternalAppId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Close create menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    if (isCreateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCreateMenuOpen]);

  const viewMode = subRoute ? subRoute.mode : internalMode;
  const selectedAppId = subRoute ? subRoute.appId : internalAppId;

  const navigateTo = (mode: 'list' | 'create' | 'detail', appId: string | null = null) => {
    if (onNavigateSubRoute) {
      onNavigateSubRoute(mode, appId);
    } else {
      setInternalMode(mode);
      setInternalAppId(appId);
    }
  };

  const selectedApp = apps.find((a) => a.id === selectedAppId) || null;

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode === 'list' && gridRef.current) {
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }, [viewMode, apps.length]);

  const filteredApps = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase())
  );

  if (viewMode === 'create') {
    return (
      <ComposeAppView
        mode="create"
        templates={templates}
        logsMap={logsMap}
        domains={domains}
        backups={backups}
        onBack={() => navigateTo('list')}
        onCreateApp={async (appData) => {
          const created = await onCreateApp(appData);
          if (created?.id) {
            navigateTo('detail', created.id);
          } else {
            navigateTo('list');
          }
          return created;
        }}
        onUpdateApp={onUpdateApp}
        onDeleteApp={onDeleteApp}
        onDeploy={onDeploy}
        onStop={onStop}
        onRestart={onRestart}
        onRebuild={onRebuild}
        onBackup={onBackup}
        onDownloadBackup={onDownloadBackup}
        onRestoreBackup={onRestoreBackup}
        onDeleteBackup={onDeleteBackup}
        onSubscribeLogs={onSubscribeLogs}
        onCreateDomain={onCreateDomain}
        onDeleteDomain={onDeleteDomain}
        onRenewDomain={onRenewDomain}
      />
    );
  }

  if (viewMode === 'detail' && selectedApp) {
    return (
      <ComposeAppView
        mode="edit"
        app={selectedApp}
        templates={templates}
        logsMap={logsMap}
        domains={domains}
        backups={backups}
        onBack={() => navigateTo('list')}
        onCreateApp={onCreateApp}
        onUpdateApp={onUpdateApp}
        onDeleteApp={async (id) => {
          await onDeleteApp(id);
          navigateTo('list');
        }}
        onDeploy={onDeploy}
        onStop={onStop}
        onRestart={onRestart}
        onRebuild={onRebuild}
        onFreshVolumes={onFreshVolumes}
        onBackup={onBackup}
        onDownloadBackup={onDownloadBackup}
        onRestoreBackup={onRestoreBackup}
        onDeleteBackup={onDeleteBackup}
        onSubscribeLogs={onSubscribeLogs}
        onCreateDomain={onCreateDomain}
        onDeleteDomain={onDeleteDomain}
        onRenewDomain={onRenewDomain}
      />
    );
  }

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
            <MagnifyingGlass className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索受管应用 (名称 / ID)..."
            className="w-full bg-paper border border-line rounded-lg pl-9 pr-8 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent font-sans transition-colors shadow-subtle"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-ink-faint hover:text-ink cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Create App Dropdown Menu (Dokploy style: Compose & Database) */}
        <div className="relative" ref={createMenuRef}>
          <button
            type="button"
            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-subtle cursor-pointer transition-all active:translate-y-px"
          >
            <Plus className="w-4 h-4" weight="bold" />
            <span>新建应用</span>
            <CaretDown className={`w-3 h-3 transition-transform duration-200 ${isCreateMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isCreateMenuOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl bg-paper border border-line shadow-xl py-1.5 z-30 animate-fade-in font-sans">
              <button
                type="button"
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  navigateTo('create');
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs text-ink hover:bg-paper-2 flex items-center gap-3 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Stack className="w-4 h-4" weight="bold" />
                </div>
                <div>
                  <div className="font-semibold text-ink group-hover:text-accent transition-colors">Compose 应用</div>
                  <div className="text-[11px] text-ink-muted">Docker Compose 自定义编排</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  setIsDatabaseModalOpen(true);
                }}
                className="w-full px-3.5 py-2.5 text-left text-xs text-ink hover:bg-paper-2 flex items-center gap-3 transition-colors cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" weight="bold" />
                </div>
                <div>
                  <div className="font-semibold text-ink group-hover:text-accent transition-colors">Database 数据库</div>
                  <div className="text-[11px] text-ink-muted">PostgreSQL, MySQL, Redis 等</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Applications Grid */}
      {filteredApps.length === 0 ? (
        <div className="card-vessel p-16 text-center space-y-4 shadow-subtle">
          <div className="w-12 h-12 rounded-xl bg-paper-3 flex items-center justify-center mx-auto text-ink-muted">
            <Code className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-ink">未找到任何应用</h4>
            <p className="text-xs text-ink-muted mt-1.5">
              {search ? '请尝试更换搜索关键字' : '当前暂无托管应用，点击下方按钮创建第一个应用或数据库服务'}
            </p>
          </div>
          {!search && (
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button8State
                variant="primary"
                size="sm"
                icon={<Stack className="w-4 h-4" weight="bold" />}
                onClick={() => navigateTo('create')}
              >
                Compose 应用
              </Button8State>
              <Button8State
                variant="secondary"
                size="sm"
                icon={<Database className="w-4 h-4 text-emerald-500" weight="bold" />}
                onClick={() => setIsDatabaseModalOpen(true)}
              >
                Database 数据库
              </Button8State>
            </div>
          )}
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="card-vessel p-6 sm:p-7 flex flex-col justify-between hover:border-ink-muted/30 dark:hover:border-white/20 transition-all shadow-subtle hover:shadow-card group"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      onClick={() => navigateTo('detail', app.id)}
                      className="font-semibold text-base text-ink tracking-tight hover:text-accent cursor-pointer transition-colors"
                    >
                      {app.name}
                    </h3>
                    <p className="text-[11px] text-ink-faint font-mono mt-0.5">{app.id}</p>
                  </div>
                  <Badge variant={app.status}>{app.status === 'running' ? '运行中' : app.status === 'stopped' ? '已停止' : app.status}</Badge>
                </div>

                {/* Content Group (Description + Image Metadata, NO harsh divider) */}
                <div className="space-y-2.5">
                  {app.description && (
                    <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  )}

                  {/* Image & Update Badge */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="flex items-center gap-1.5 text-ink-faint font-mono text-[11px] min-w-0">
                      <Package className="w-3.5 h-3.5 flex-shrink-0 text-ink-muted/70" />
                      <span className="truncate max-w-[200px]" title={app.currentImageTag || 'Compose 编排托管'}>
                        {app.currentImageTag || 'Compose 编排托管'}
                      </span>
                    </div>
                    {app.updateAvailable && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 rounded-full font-medium flex-shrink-0">
                        <Sparkle className="w-3 h-3 text-amber-500" weight="bold" />
                        可升级
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions Footer - 4% Ghost Divider */}
              <div className="mt-5 pt-3.5 border-t border-line/20 dark:border-white/[0.04] flex items-center justify-between gap-2">
                <button
                  onClick={() => navigateTo('detail', app.id)}
                  className="text-xs font-medium text-ink-muted hover:text-accent flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-paper-3 transition-colors cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>配置与终端</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {app.status === 'running' ? (
                    <>
                      <button
                        onClick={() => onRestart(app.id)}
                        data-tooltip="重启应用"
                        className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 border border-line/60 transition-colors cursor-pointer shadow-subtle"
                      >
                        <ArrowsClockwise className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onStop(app.id)}
                        data-tooltip="停止容器"
                        className="p-1.5 rounded-lg text-ink-muted hover:text-white hover:bg-rose-600 hover:border-rose-600 border border-line/60 transition-all cursor-pointer shadow-subtle"
                      >
                        <Stop className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDeploy(app.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-paper-2 hover:bg-accent text-ink hover:text-white border border-line hover:border-accent transition-all shadow-subtle cursor-pointer active:translate-y-px group/btn"
                    >
                      <Play className="w-3 h-3 text-ink-muted group-hover/btn:text-white transition-colors" weight="fill" />
                      <span>启动</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Database Creation Modal (Dokploy Style) */}
      <CreateDatabaseModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
        onCreateDatabase={async (appData) => {
          const created = await onCreateApp(appData);
          if (created?.id) {
            navigateTo('detail', created.id);
          }
          return created;
        }}
      />
    </div>
  );
};
