import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  CaretRight,
  CircleNotch,
  Database,
  Stack,
} from '@phosphor-icons/react';
import { AppItem, DomainItem, BackupRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { ComposeAppView } from './ComposeAppView.js';
import { CreateDatabaseModal } from '../common/CreateDatabaseModal.js';

interface AppsViewProps {
  apps: AppItem[];
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
  onBackup: (id: string, options?: { databaseName?: string; schedule?: any; runNow?: boolean }) => Promise<any>;
  onDownloadBackup?: (id: string, fileName: string) => void;
  onRestoreBackup?: (id: string, options?: { databaseName?: string }) => Promise<any>;
  onRestoreDatabaseFromFile?: (appId: string, file: File, databaseName?: string) => Promise<any>;
  onDeleteBackup?: (id: string) => Promise<any>;
  onSubscribeLogs: (id: string) => void;
  onCreateDomain?: (domain: Partial<DomainItem>) => Promise<any>;
  onUpdateDomain?: (id: string, domainData: Partial<DomainItem>) => Promise<any>;
  onDeleteDomain?: (id: string) => Promise<any>;
  onRenewDomain?: (id: string) => Promise<any>;
}

export const AppsView: React.FC<AppsViewProps> = ({
  apps,
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
  onRestoreDatabaseFromFile,
  onDeleteBackup,
  onSubscribeLogs,
  onCreateDomain,
  onUpdateDomain,
  onDeleteDomain,
  onRenewDomain,
}) => {
  const [internalMode, setInternalMode] = useState<'list' | 'create' | 'detail'>('list');
  const [internalAppId, setInternalAppId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const actionSheetRef = useRef<HTMLDivElement>(null);

  const handleDeployApp = async (e: React.MouseEvent, appId: string) => {
    e.stopPropagation();
    try {
      setDeployingId(appId);
      await onDeploy(appId);
    } finally {
      setDeployingId(null);
    }
  };

  // Close create menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // Do not close if clicking inside desktop dropdown menu or mobile action sheet
      if (createMenuRef.current?.contains(target)) {
        return;
      }
      if (actionSheetRef.current?.contains(target)) {
        return;
      }
      setIsCreateMenuOpen(false);
    };
    if (isCreateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
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
        onRestoreDatabaseFromFile={onRestoreDatabaseFromFile}
        onDeleteBackup={onDeleteBackup}
        onSubscribeLogs={onSubscribeLogs}
        onCreateDomain={onCreateDomain}
        onUpdateDomain={onUpdateDomain}
        onDeleteDomain={onDeleteDomain}
        onRenewDomain={onRenewDomain}
      />
    );
  }

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Top Action Bar - Sticky on scroll with blur background */}
      <div className="sticky -top-4 sm:-top-6 md:-top-8 lg:-top-10 z-20 -mx-4 sm:-mx-6 md:-mx-8 lg:-mx-10 px-4 sm:px-6 md:px-8 lg:px-10 py-3 bg-paper/80 backdrop-blur-md transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
              <MagnifyingGlass className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索受管应用 (名称 / ID)..."
              className="w-full min-h-[44px] bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 rounded-xl pl-10 pr-8 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 font-sans transition-colors shadow-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="清除搜索"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint hover:text-ink cursor-pointer min-w-[44px] justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Create App Dropdown / Action Sheet Trigger */}
          <div className="relative shrink-0" ref={createMenuRef}>
            <button
              type="button"
              onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-px shadow-sm"
            >
              <Plus className="w-4 h-4" weight="bold" />
              <span>新建应用</span>
              <CaretDown className={`hidden md:inline-block w-3 h-3 transition-transform duration-200 ${isCreateMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Desktop Dropdown Popover */}
            {isCreateMenuOpen && (
              <div className="hidden md:block absolute right-0 mt-2 w-64 rounded-2xl bg-paper-2 shadow-2xl p-1.5 z-30 animate-fade-in font-sans">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateMenuOpen(false);
                    navigateTo('create');
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-ink hover:bg-paper-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-paper-3 text-ink flex items-center justify-center shrink-0">
                    <Stack className="w-4 h-4" weight="bold" />
                  </div>
                  <div>
                    <div className="font-semibold text-ink group-hover:text-ink-muted transition-colors">Compose 应用</div>
                    <div className="text-[11px] text-ink-muted">Docker Compose 自定义编排</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCreateMenuOpen(false);
                    setIsDatabaseModalOpen(true);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-xs text-ink hover:bg-paper-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" weight="bold" />
                  </div>
                  <div>
                    <div className="font-semibold text-ink group-hover:text-ink-muted transition-colors">Database 数据库</div>
                    <div className="text-[11px] text-ink-muted">PostgreSQL, MySQL, Redis 等</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Action Sheet */}
      {typeof document !== 'undefined' &&
        isCreateMenuOpen &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end"
            onClick={() => setIsCreateMenuOpen(false)}
          >
            <div
              ref={actionSheetRef}
              className="w-full bg-paper-2 rounded-t-3xl shadow-2xl p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-3 font-sans animate-bottom-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle Indicator */}
              <div className="w-10 h-1 bg-ink-muted/30 rounded-full mx-auto mb-1 shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">新建受管应用</h3>
                  <p className="text-[11px] text-ink-muted">选择要创建的服务类型</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(false)}
                  aria-label="关闭面板"
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X className="w-4 h-4" weight="bold" />
                </button>
              </div>

              {/* Action Sheet Options */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreateMenuOpen(false);
                    navigateTo('create');
                  }}
                  className="w-full min-h-[56px] p-3.5 rounded-2xl bg-paper-3/50 hover:bg-paper-3 flex items-center gap-3.5 transition-all text-left cursor-pointer active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-xl bg-paper-3 text-ink flex items-center justify-center shrink-0">
                    <Stack className="w-5 h-5" weight="bold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">Compose 应用</div>
                    <div className="text-xs text-ink-muted truncate">Docker Compose 多容器或单服务自定义编排</div>
                  </div>
                  <CaretRight className="w-4 h-4 text-ink-faint shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreateMenuOpen(false);
                    setIsDatabaseModalOpen(true);
                  }}
                  className="w-full min-h-[56px] p-3.5 rounded-2xl bg-paper-3/50 hover:bg-paper-3 flex items-center gap-3.5 transition-all text-left cursor-pointer active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5" weight="bold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">Database 数据库</div>
                    <div className="text-xs text-ink-muted truncate">快速拉起 PostgreSQL, MySQL, Redis 等数据库</div>
                  </div>
                  <CaretRight className="w-4 h-4 text-ink-faint shrink-0" />
                </button>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setIsCreateMenuOpen(false)}
                className="w-full min-h-[48px] rounded-2xl bg-paper-3 hover:bg-paper-4 text-ink text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer mt-1"
              >
                取消
              </button>
            </div>
          </div>,
          document.body
        )}

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
              onClick={() => navigateTo('detail', app.id)}
              className="card-vessel p-5 sm:p-6 lg:p-7 flex flex-col justify-between hover:bg-paper-3 transition-colors group cursor-pointer active:scale-[0.995]"
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      className="font-semibold text-base text-ink tracking-tight transition-colors"
                    >
                      {app.name}
                    </h3>
                    <p className="text-[11px] text-ink-faint font-mono mt-0.5">{app.id}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Badge variant={app.status}>{app.status === 'running' ? '运行中' : app.status === 'stopped' ? '已停止' : app.status}</Badge>
                  </div>
                </div>

                {/* Content Group */}
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
                      <span className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full font-medium flex-shrink-0">
                        <Sparkle className="w-3 h-3 text-amber-500" weight="bold" />
                        可升级
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="mt-5 pt-3 flex items-center justify-between gap-2">
                <div
                  className="text-xs font-medium text-ink-muted group-hover:text-ink flex items-center gap-1.5 py-1 transition-colors select-none"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>配置与终端</span>
                  <CaretRight className="w-3 h-3 text-ink-faint group-hover:text-ink group-hover:translate-x-0.5 transition-transform" />
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {app.status === 'running' ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRestart(app.id);
                        }}
                        data-tooltip="重启应用"
                        aria-label="重启应用"
                        className="min-w-[36px] min-h-[36px] p-2 rounded-xl text-ink-muted hover:text-ink bg-paper-3/40 hover:bg-paper-4 transition-colors cursor-pointer flex items-center justify-center"
                      >
                        <ArrowsClockwise className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStop(app.id);
                        }}
                        data-tooltip="停止容器"
                        aria-label="停止容器"
                        className="min-w-[36px] min-h-[36px] p-2 rounded-xl text-ink-muted hover:text-rose-500 bg-paper-3/40 hover:bg-rose-500/15 transition-all cursor-pointer flex items-center justify-center"
                      >
                        <Stop className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={deployingId === app.id}
                      onClick={(e) => handleDeployApp(e, app.id)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 disabled:bg-neutral-200 disabled:text-neutral-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-400 transition-all cursor-pointer active:translate-y-px disabled:cursor-not-allowed"
                    >
                      {deployingId === app.id ? (
                        <>
                          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                          <span>启动中...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" weight="fill" />
                          <span>启动</span>
                        </>
                      )}
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
            try {
              await onDeploy(created.id);
            } catch (err) {
              console.warn('[Database] Auto-deploy deferred:', err);
            }
            navigateTo('detail', created.id);
          }
          return created;
        }}
      />
    </div>
  );
};
