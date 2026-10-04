import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import {
  Plus,
  Play,
  Stop,
  ArrowsClockwise,
  Code,
  Sparkle,
} from '@phosphor-icons/react';
import { AppItem, ComposeTemplate, DomainItem, BackupRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { ComposeAppView } from './ComposeAppView.js';

interface AppsViewProps {
  apps: AppItem[];
  templates: ComposeTemplate[];
  logsMap: Record<string, string[]>;
  domains?: DomainItem[];
  backups?: BackupRecord[];
  onCreateApp: (app: Partial<AppItem>) => Promise<any>;
  onUpdateApp: (id: string, updates: Partial<AppItem>) => Promise<any>;
  onDeleteApp: (id: string) => Promise<any>;
  onDeploy: (id: string) => Promise<any>;
  onStop: (id: string) => Promise<any>;
  onRestart: (id: string) => Promise<any>;
  onRebuild: (id: string) => Promise<any>;
  onFreshVolumes?: (id: string) => Promise<any>;
  onBackup: (id: string) => Promise<any>;
  onSubscribeLogs: (id: string) => void;
}

export const AppsView: React.FC<AppsViewProps> = ({
  apps,
  templates,
  logsMap,
  domains = [],
  backups = [],
  onCreateApp,
  onUpdateApp,
  onDeleteApp,
  onDeploy,
  onStop,
  onRestart,
  onRebuild,
  onFreshVolumes,
  onBackup,
  onSubscribeLogs,
}) => {
  // Navigation mode within Apps: 'list' | 'create' | 'detail'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Selected App Object
  const selectedApp = apps.find((a) => a.id === selectedAppId) || null;

  // GSAP animation container
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

  // If in CREATE mode -> Render Dokploy Compose Create Page
  if (viewMode === 'create') {
    return (
      <ComposeAppView
        mode="create"
        templates={templates}
        logsMap={logsMap}
        domains={domains}
        backups={backups}
        onBack={() => setViewMode('list')}
        onCreateApp={onCreateApp}
        onUpdateApp={onUpdateApp}
        onDeleteApp={onDeleteApp}
        onDeploy={onDeploy}
        onStop={onStop}
        onRestart={onRestart}
        onRebuild={onRebuild}
        onBackup={onBackup}
        onSubscribeLogs={onSubscribeLogs}
      />
    );
  }

  // If in DETAIL mode -> Render Dokploy Compose Manage Page
  if (viewMode === 'detail' && selectedApp) {
    return (
      <ComposeAppView
        mode="edit"
        app={selectedApp}
        templates={templates}
        logsMap={logsMap}
        domains={domains}
        backups={backups}
        onBack={() => {
          setViewMode('list');
          setSelectedAppId(null);
        }}
        onCreateApp={onCreateApp}
        onUpdateApp={onUpdateApp}
        onDeleteApp={async (id) => {
          await onDeleteApp(id);
          setViewMode('list');
          setSelectedAppId(null);
        }}
        onDeploy={onDeploy}
        onStop={onStop}
        onRestart={onRestart}
        onRebuild={onRebuild}
        onFreshVolumes={onFreshVolumes}
        onBackup={onBackup}
        onSubscribeLogs={onSubscribeLogs}
      />
    );
  }

  // DEFAULT: Application List Mode
  return (
    <div ref={containerRef} className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索受管应用 (名称 / ID)..."
            className="w-full bg-paper-2 border border-line rounded px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent font-sans"
          />
        </div>

        {/* Create App Button: Switches to Dokploy Full Create Page */}
        <Button8State
          variant="primary"
          icon={<Plus className="w-4 h-4" weight="bold" />}
          onClick={() => setViewMode('create')}
        >
          新建应用
        </Button8State>
      </div>

      {/* Applications Grid */}
      {filteredApps.length === 0 ? (
        <div className="card-vessel p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-paper-3 flex items-center justify-center mx-auto text-ink-muted">
            <Code className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-ink">未找到任何应用</h4>
            <p className="text-xs text-ink-muted mt-1">
              {search ? '请尝试更换搜索关键字' : '当前暂无托管应用，点击下方按钮创建第一个 Docker Compose 应用'}
            </p>
          </div>
          {!search && (
            <Button8State
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" weight="bold" />}
              onClick={() => setViewMode('create')}
            >
              新建应用 (Dokploy 模式)
            </Button8State>
          )}
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="card-vessel p-5 flex flex-col justify-between hover:border-paper-4 transition-all"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3
                      onClick={() => {
                        setSelectedAppId(app.id);
                        setViewMode('detail');
                      }}
                      className="font-semibold text-base text-ink tracking-tight hover:text-accent cursor-pointer transition-colors"
                    >
                      {app.name}
                    </h3>
                    <p className="text-xs font-mono text-ink-muted mt-0.5">{app.id}</p>
                  </div>
                  <Badge variant={app.status}>{app.status}</Badge>
                </div>

                {/* Description */}
                {app.description && (
                  <p className="text-xs text-ink-muted mt-2 line-clamp-2">{app.description}</p>
                )}

                {/* Image & Update Badge */}
                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-faint truncate max-w-[180px]">
                    {app.currentImageTag || 'compose managed'}
                  </span>
                  {app.updateAvailable && (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-800 rounded">
                      <Sparkle className="w-3 h-3 text-amber-400" />
                      可升级
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="mt-5 pt-3 border-t border-line flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setSelectedAppId(app.id);
                    setViewMode('detail');
                  }}
                  className="text-xs font-medium text-accent hover:text-accent-hover flex items-center gap-1.5 py-1"
                >
                  <Code className="w-4 h-4" />
                  <span>配置与终端</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {app.status === 'running' ? (
                    <>
                      <button
                        onClick={() => onRestart(app.id)}
                        title="重启应用"
                        className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors"
                      >
                        <ArrowsClockwise className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onStop(app.id)}
                        title="停止容器"
                        className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                      >
                        <Stop className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <Button8State
                      size="sm"
                      variant="primary"
                      icon={<Play className="w-3.5 h-3.5" weight="fill" />}
                      onClick={() => onDeploy(app.id)}
                    >
                      启动
                    </Button8State>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
