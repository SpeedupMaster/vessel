import React, { useState, lazy } from 'react';
import clsx from 'clsx';
import {
  Plus,
  Play,
  Stop,
  ArrowsClockwise,
  MagnifyingGlass,
  X,
  CaretDown,
  CaretRight,
  CircleNotch,
  Database,
  Stack,
} from '@phosphor-icons/react';
import { AppItem, DomainItem, BackupRecord } from '../../types/index.js';
import type { UploadProgress } from '../../hooks/useData.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { EmptyState } from '../common/EmptyState.js';
const ComposeAppView = lazy(() => import('./ComposeAppView.js').then(module => ({ default: module.ComposeAppView })));
import { CreateDatabaseModal } from '../common/CreateDatabaseModal.js';
import { formatRelative } from '../../utils/format.js';
import { isDatabaseApp } from '../../utils/appKind.js';

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
  onDeleteBackupSchedule?: (appId: string, scheduleId: string) => Promise<void>;
  onDownloadBackup?: (id: string, fileName: string) => void;
  onRestoreBackup?: (id: string, options?: { databaseName?: string }) => Promise<any>;
  onRestoreDatabaseFromFile?: (appId: string, file: File, databaseName?: string, onProgress?: (progress: UploadProgress) => void) => Promise<any>;
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
  onDeleteBackupSchedule,
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
  const [kindFilter, setKindFilter] = useState<'all' | 'compose' | 'db'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'error' | 'updates'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'status'>('recent');
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  const handleDeployApp = async (e: React.MouseEvent, appId: string) => {
    e.stopPropagation();
    try {
      setDeployingId(appId);
      await onDeploy(appId);
    } finally {
      setDeployingId(null);
    }
  };

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
        onDeleteBackupSchedule={onDeleteBackupSchedule}
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
        onDeleteBackupSchedule={onDeleteBackupSchedule}
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

  const isFiltering = search.trim() !== '' || kindFilter !== 'all' || statusFilter !== 'all';
  const dbCount = apps.filter((a) => isDatabaseApp(a)).length;
  const q = search.trim().toLowerCase();
  const imageOf = (a: AppItem) => a.currentImageTag || a.containers?.[0]?.image || '';
  const domainsOf = (a: AppItem) => domains.filter((d) => d.appId === a.id);
  const STATUS_RANK: Record<string, number> = { error: 0, deploying: 1, rebuilding: 1, running: 2, stopped: 3 };

  const visibleApps = apps
    .filter((a) => (kindFilter === 'all' ? true : kindFilter === 'db' ? isDatabaseApp(a) : !isDatabaseApp(a)))
    .filter((a) =>
      statusFilter === 'all' ? true : statusFilter === 'updates' ? !!a.updateAvailable : a.status === statusFilter
    )
    .filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        imageOf(a).toLowerCase().includes(q) ||
        domainsOf(a).some((d) => d.domain.toLowerCase().includes(q))
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      return (b.lastDeployedAt ?? b.updatedAt ?? '').localeCompare(a.lastDeployedAt ?? a.updatedAt ?? '');
    });

  const clearFilters = () => {
    setSearch('');
    setKindFilter('all');
    setStatusFilter('all');
  };

  const selectClass =
    'h-10 pl-3 pr-8 rounded-lg border border-line bg-paper-2 text-[13px] text-ink focus:outline-none focus:border-line-strong cursor-pointer appearance-none';

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Intro + create actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-muted">
          Compose 应用与受管数据库。每个应用对应服务器上一份原生的 docker-compose 编排文件。
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsDatabaseModalOpen(true)}
            className="btn-vessel-secondary min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
          >
            <Database className="w-4 h-4" />
            新建数据库
          </button>
          <button
            type="button"
            onClick={() => navigateTo('create')}
            className="btn-vessel-primary min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" weight="bold" />
            新建应用
          </button>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="card-vessel !cursor-default p-3 sm:p-4">
          <EmptyState
            className="min-h-[320px]"
            icon={<Stack className="w-5 h-5" weight="duotone" />}
            title="还没有应用"
            description="粘贴一份 docker-compose.yml 部署第一个应用，或一键创建 PostgreSQL、MySQL、Redis 等数据库。"
            action={
              <>
                <Button8State
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" weight="bold" />}
                  onClick={() => navigateTo('create')}
                >
                  新建应用
                </Button8State>
                <Button8State
                  variant="secondary"
                  size="sm"
                  icon={<Database className="w-4 h-4" />}
                  onClick={() => setIsDatabaseModalOpen(true)}
                >
                  新建数据库
                </Button8State>
              </>
            }
          />
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div role="tablist" aria-label="按类型筛选" className="flex items-center p-1 rounded-lg bg-paper-3 w-fit shrink-0">
              {(
                [
                  { key: 'all', label: '全部', n: apps.length },
                  { key: 'compose', label: 'Compose', n: apps.length - dbCount },
                  { key: 'db', label: '数据库', n: dbCount },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={kindFilter === s.key}
                  onClick={() => setKindFilter(s.key)}
                  className={clsx(
                    'h-8 px-3 rounded-md text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap',
                    kindFilter === s.key ? 'bg-paper-2 text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  {s.label} <span className="text-ink-faint tabular-nums">{s.n}</span>
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-0">
              <label htmlFor="apps-search" className="sr-only">
                搜索应用
              </label>
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                id="apps-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="按名称、域名或镜像搜索"
                className="w-full h-10 pl-9 pr-9 rounded-lg border border-line bg-paper-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="清除搜索"
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-ink-faint hover:text-ink cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="relative flex items-center gap-2 text-xs text-ink-muted">
                <span className="sr-only sm:not-sr-only">状态</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className={selectClass}
                >
                  <option value="all">全部</option>
                  <option value="running">运行中</option>
                  <option value="stopped">已停止</option>
                  <option value="error">异常</option>
                  <option value="updates">可更新</option>
                </select>
                <CaretDown className="pointer-events-none absolute right-2.5 w-3 h-3 text-ink-faint" />
              </label>
              <label className="relative flex items-center gap-2 text-xs text-ink-muted">
                <span className="sr-only sm:not-sr-only">排序</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={selectClass}>
                  <option value="recent">最近部署</option>
                  <option value="name">名称</option>
                  <option value="status">状态</option>
                </select>
                <CaretDown className="pointer-events-none absolute right-2.5 w-3 h-3 text-ink-faint" />
              </label>
            </div>
          </div>

          {/* List */}
          <section aria-label="应用列表" className="card-vessel !cursor-default overflow-hidden">
            <div
              aria-hidden="true"
              className="hidden md:grid grid-cols-[minmax(0,2fr)_96px_minmax(0,1.4fr)_minmax(0,1.5fr)_96px_92px] gap-4 px-5 h-10 items-center text-xs text-ink-faint border-b border-line-subtle"
            >
              <span>名称</span>
              <span>状态</span>
              <span>访问地址</span>
              <span>镜像</span>
              <span>最近部署</span>
              <span className="text-right">操作</span>
            </div>

            {visibleApps.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium text-ink">没有匹配的应用</p>
                <p className="text-xs text-ink-muted mt-1">换个关键字，或清除筛选条件。</p>
                {isFiltering && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn-vessel-secondary mt-4 min-h-[40px] px-4 text-[13px] rounded-xl cursor-pointer"
                  >
                    清除筛选
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {visibleApps.map((app) => {
                  const isDb = isDatabaseApp(app);
                  const appDomains = domainsOf(app);
                  const image = imageOf(app);
                  const busy = app.status === 'deploying' || app.status === 'rebuilding' || deployingId === app.id;
                  return (
                    <li
                      key={app.id}
                      onClick={() => navigateTo('detail', app.id)}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_96px_minmax(0,1.4fr)_minmax(0,1.5fr)_96px_92px] gap-x-4 gap-y-2 px-4 sm:px-5 py-3 items-center hover:bg-paper-3/50 transition-colors cursor-pointer"
                    >
                      {/* Name */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateTo('detail', app.id);
                        }}
                        className="flex items-center gap-3 min-w-0 min-h-[40px] text-left cursor-pointer"
                      >
                        <span
                          aria-hidden="true"
                          className="w-9 h-9 shrink-0 rounded-lg bg-paper-3 border border-line-subtle flex items-center justify-center text-[11px] font-semibold text-ink-muted uppercase font-mono"
                        >
                          {isDb ? (
                            <Database className="w-4 h-4" />
                          ) : (
                            app.name.replace(/[^a-z0-9]/gi, '').slice(0, 2) || app.name.slice(0, 1)
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink truncate group-hover:text-signal transition-colors">
                            {app.name}
                          </span>
                          <span className="block text-xs text-ink-faint truncate">
                            {isDb ? '数据库' : `Compose · ${app.containers?.length || 0} 容器`}
                          </span>
                        </span>
                      </button>

                      {/* Status (also shown inline on mobile) */}
                      <div className="justify-self-end md:justify-self-start">
                        <Badge variant={app.status}>{app.status}</Badge>
                      </div>

                      {/* Domain */}
                      <div className="hidden md:block min-w-0 text-xs font-mono text-ink-muted truncate">
                        {appDomains.length ? (
                          <>
                            {appDomains[0].domain}
                            {appDomains.length > 1 && <span className="text-ink-faint"> +{appDomains.length - 1}</span>}
                          </>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </div>

                      {/* Image */}
                      <div className="hidden md:flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono text-ink-muted truncate" title={image}>
                          {image || <span className="text-ink-faint">—</span>}
                        </span>
                        {app.updateAvailable && (
                          <span className="shrink-0 text-[10.5px] px-1.5 py-px rounded-full bg-signal-soft text-signal font-medium">
                            可更新
                          </span>
                        )}
                      </div>

                      {/* Deployed */}
                      <div className="hidden md:block text-xs text-ink-muted whitespace-nowrap">
                        {formatRelative(app.lastDeployedAt)}
                      </div>

                      {/* Actions */}
                      <div
                        className="col-span-2 md:col-span-1 flex items-center justify-end gap-1 -my-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {busy ? (
                          <span className="w-9 h-9 flex items-center justify-center text-ink-faint" aria-label="部署中">
                            <CircleNotch className="w-4 h-4 animate-spin" />
                          </span>
                        ) : app.status === 'running' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onRestart(app.id)}
                              aria-label={`重启 ${app.name}`}
                              data-tooltip="重启"
                              className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <ArrowsClockwise className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onStop(app.id)}
                              aria-label={`停止 ${app.name}`}
                              data-tooltip="停止"
                              className="w-9 h-9 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <Stop className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDeployApp(e, app.id)}
                            aria-label={`启动 ${app.name}`}
                            data-tooltip="启动"
                            className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Play className="w-4 h-4" weight="fill" />
                          </button>
                        )}
                        <CaretRight className="hidden md:block w-3.5 h-3.5 text-ink-faint ml-1" aria-hidden="true" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {isFiltering && visibleApps.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-5 h-11 border-t border-line-subtle text-xs text-ink-muted">
                <span>
                  显示 {visibleApps.length} / {apps.length} 个应用
                </span>
                <button type="button" onClick={clearFilters} className="min-h-[36px] px-2 -mr-2 rounded-md hover:text-ink cursor-pointer">
                  显示全部
                </button>
              </div>
            )}
          </section>
        </>
      )}

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
