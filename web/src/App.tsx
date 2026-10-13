import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import gsap from 'gsap';
import { AuthContext, useAuthProvider, useAuth } from './hooks/useAuth.js';
import { useData } from './hooks/useData.js';
import { Sidebar, NavTab } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';
const OverviewView = lazy(() => import('./components/views/OverviewView.js').then(module => ({ default: module.OverviewView })));
const AppsView = lazy(() => import('./components/views/AppsView.js').then(module => ({ default: module.AppsView })));
const DomainsView = lazy(() => import('./components/views/DomainsView.js').then(module => ({ default: module.DomainsView })));
const BackupsView = lazy(() => import('./components/views/BackupsView.js').then(module => ({ default: module.BackupsView })));
const RegistriesView = lazy(() => import('./components/views/RegistriesView.js').then(module => ({ default: module.RegistriesView })));
const MaintenanceView = lazy(() => import('./components/views/MaintenanceView.js').then(module => ({ default: module.MaintenanceView })));
import { LoginView } from './components/views/LoginView.js';
import { ChangePasswordModal } from './components/common/ChangePasswordModal.js';
import { GlobalTooltip } from './components/common/Tooltip.js';
import { ArrowClockwise } from '@phosphor-icons/react';
import { usePWA } from './hooks/usePWA.js';

interface RouteState {
  tab: NavTab;
  isLogin: boolean;
  appSubRoute: {
    mode: 'list' | 'create' | 'detail';
    appId?: string | null;
  } | null;
}

function parsePath(pathname: string, search: string = ''): RouteState {
  const params = new URLSearchParams(search);
  const tabParam = params.get('tab') as NavTab | null;

  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/login') {
    return { tab: 'overview', isLogin: true, appSubRoute: null };
  }
  if (tabParam && ['overview', 'apps', 'domains', 'backups', 'registries', 'maintenance'].includes(tabParam)) {
    return { tab: tabParam, isLogin: false, appSubRoute: tabParam === 'apps' ? { mode: 'list' } : null };
  }
  if (clean === '/apps/new' || clean === '/apps/create') {
    return { tab: 'apps', isLogin: false, appSubRoute: { mode: 'create' } };
  }
  if (clean.startsWith('/apps/')) {
    const appId = decodeURIComponent(clean.slice('/apps/'.length));
    return { tab: 'apps', isLogin: false, appSubRoute: { mode: 'detail', appId } };
  }
  if (clean === '/apps') {
    return { tab: 'apps', isLogin: false, appSubRoute: { mode: 'list' } };
  }
  if (clean === '/domains') {
    return { tab: 'domains', isLogin: false, appSubRoute: null };
  }
  if (clean === '/backups') {
    return { tab: 'backups', isLogin: false, appSubRoute: null };
  }
  if (clean === '/registries') {
    return { tab: 'registries', isLogin: false, appSubRoute: null };
  }
  if (clean === '/maintenance') {
    return { tab: 'maintenance', isLogin: false, appSubRoute: null };
  }
  return { tab: 'overview', isLogin: false, appSubRoute: null };
}

function MainConsole() {
  const { user, token, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { updateAvailable, updateApp } = usePWA();
  const [route, setRoute] = useState<RouteState>(() => parsePath(window.location.pathname, window.location.search));
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const {
    metrics,
    apps,
    domains,
    r2Config,
    backups,
    registries,
    maintenance,
    loading: dataLoading,
    logsMap,
    subscribeLogs,
    createApp,
    updateApp: updateAppData,
    deleteApp,
    deployApp,
    stopApp,
    restartApp,
    rebuildApp,
    freshVolumesApp,
    backupApp,
    createDomain,
    updateDomain,
    deleteDomain,
    renewDomain,
    saveR2Config,
    testR2Connection,
    triggerSystemBackup,
    deleteBackup,
    downloadBackup,
    restoreBackup,
    restoreDatabaseFromFile,
    saveRegistry,
    testRegistry,
    saveMaintenance,
    triggerPrune,
    triggerCheckUpdates,
    refreshAll,
  } = useData(token, isAuthenticated && !user?.isDefaultPassword);

  // Navigation dispatcher that updates URL path and state
  const navigate = useCallback((newPath: string, replace = false) => {
    if (replace) {
      window.history.replaceState(null, '', newPath);
    } else {
      window.history.pushState(null, '', newPath);
    }
    setRoute(parsePath(newPath));
  }, []);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePath(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Normalize root URL to /overview or query tab
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      const search = window.location.search;
      const params = new URLSearchParams(search);
      const tab = params.get('tab');
      if (tab) {
        window.history.replaceState(null, '', `/${tab}`);
      } else {
        window.history.replaceState(null, '', '/overview');
      }
    }
  }, []);

  // If already authenticated and currently on /login, redirect to /overview
  useEffect(() => {
    if (!authLoading && isAuthenticated && route.isLogin) {
      navigate('/overview', true);
    }
  }, [authLoading, isAuthenticated, route.isLogin, navigate]);

  // Tab change animation
  useEffect(() => {
    if (mainContentRef.current) {
      gsap.fromTo(
        mainContentRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
      );
    }
  }, [route.tab, route.appSubRoute?.mode]);

  const handleSelectTab = (tab: NavTab) => {
    navigate(`/${tab}`);
  };

  const handleNavigateSubRoute = (mode: 'list' | 'create' | 'detail', appId?: string | null) => {
    if (mode === 'create') {
      navigate('/apps/new');
    } else if (mode === 'detail' && appId) {
      navigate(`/apps/${encodeURIComponent(appId)}`);
    } else {
      navigate('/apps');
    }
  };

  const getTabTitle = () => {
    switch (route.tab) {
      case 'overview':
        return '平台控制台概览';
      case 'apps':
        if (route.appSubRoute?.mode === 'create') return '新建 Docker Compose 应用';
        if (route.appSubRoute?.mode === 'detail') return 'Compose 应用编排详情';
        return 'Docker Compose 应用编排';
      case 'domains':
        return 'Caddy 域名绑定与证书';
      case 'backups':
        return 'Cloudflare R2 定时备份';
      case 'registries':
        return '私有镜像凭证管理';
      case 'maintenance':
        return '镜像更新巡检与安全瘦身';
    }
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-xs">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span className="tracking-wider text-ink-muted">验证管理员会话中...</span>
        </div>
      </div>
    );
  }

  // If not logged in, render sleek Login View
  if (!isAuthenticated || route.isLogin) {
    return (
      <LoginView
        onLoginSuccess={() => {
          navigate('/overview', true);
        }}
      />
    );
  }

  if (user?.isDefaultPassword) {
    return <div className="min-h-screen bg-paper"><ChangePasswordModal isOpen required onClose={() => {}} /></div>;
  }

  // Data initializing state
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-sans text-xs">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span className="tracking-wider text-ink-muted">VESSEL 控制中心正在初始化...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex overflow-hidden font-sans">
      {/* Side-Rail Navigation & Mobile Drawer */}
      <Sidebar
        currentTab={route.tab}
        onSelectTab={handleSelectTab}
        metrics={metrics}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Real-time Telemetry Header & Mobile Nav Bar */}
        <Header
          title={getTabTitle()}
          metrics={metrics}
          user={user}
          onRefresh={refreshAll}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          onLogout={async () => {
            await logout();
            navigate('/login');
          }}
        />

        {/* Dynamic View Container (Mobile px-4, Desktop md:p-8 lg:p-10) */}
        <main className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 sm:px-6 sm:py-6 md:p-8 lg:p-10">
          <div ref={mainContentRef} className="max-w-7xl mx-auto pb-16">
            {/* PWA Update Banner */}
            {updateAvailable && (
              <div className="mb-6 rounded-2xl bg-paper-2 border border-line shadow-sm p-4 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans animate-fade-in">
                <div className="flex items-center gap-2.5 text-ink min-w-0">
                  <ArrowClockwise className="w-4 h-4 shrink-0 text-accent animate-spin" />
                  <span>
                    <strong>版本更新：</strong> Vessel 控制中心已加载新版本，点击以完成离线缓存与应用更新。
                  </span>
                </div>
                <div className="flex items-center justify-end shrink-0">
                  <button
                    type="button"
                    onClick={updateApp}
                    className="btn-vessel-primary py-1.5 px-3.5 text-xs font-medium rounded-xl cursor-pointer"
                  >
                    立即更新
                  </button>
                </div>
              </div>
            )}

            {route.tab === 'overview' && (
              <OverviewView
                metrics={metrics}
                apps={apps}
                domains={domains}
                r2Config={r2Config}
                backups={backups}
                onNavigate={handleSelectTab}
                onDeploy={deployApp}
                onTriggerBackup={triggerSystemBackup}
                onTriggerPrune={triggerPrune}
              />
            )}

            {route.tab === 'apps' && (
              <AppsView
                apps={apps}
                logsMap={logsMap}
                domains={domains}
                backups={backups}
                subRoute={route.appSubRoute || { mode: 'list' }}
                onNavigateSubRoute={handleNavigateSubRoute}
                onCreateApp={createApp}
                onUpdateApp={updateAppData}
                onDeleteApp={deleteApp}
                onDeploy={deployApp}
                onStop={stopApp}
                onRestart={restartApp}
                onRebuild={rebuildApp}
                onFreshVolumes={freshVolumesApp}
                onBackup={backupApp}
                onDownloadBackup={downloadBackup}
                onRestoreBackup={restoreBackup}
                onRestoreDatabaseFromFile={restoreDatabaseFromFile}
                onDeleteBackup={deleteBackup}
                onSubscribeLogs={subscribeLogs}
                onCreateDomain={createDomain}
                onUpdateDomain={updateDomain}
                onDeleteDomain={deleteDomain}
                onRenewDomain={renewDomain}
              />
            )}

            {route.tab === 'domains' && (
              <DomainsView
                domains={domains}
                apps={apps}
                onCreateDomain={createDomain}
                onUpdateDomain={updateDomain}
                onDeleteDomain={deleteDomain}
                onRenewDomain={renewDomain}
              />
            )}

            {route.tab === 'backups' && (
              <BackupsView
                r2Config={r2Config}
                backups={backups}
                onSaveConfig={saveR2Config}
                onTestConnection={testR2Connection}
                onTriggerBackupNow={triggerSystemBackup}
                onDeleteBackup={deleteBackup}
                onDownloadBackup={downloadBackup}
                onRestoreBackup={restoreBackup}
              />
            )}

            {route.tab === 'registries' && (
              <RegistriesView
                registries={registries}
                onSaveRegistry={saveRegistry}
                onTestRegistry={testRegistry}
              />
            )}

            {route.tab === 'maintenance' && (
              <MaintenanceView
                maintenance={maintenance}
                apps={apps}
                onSaveMaintenance={saveMaintenance}
                onTriggerPrune={triggerPrune}
                onTriggerCheckUpdates={triggerCheckUpdates}
                onRebuildApp={rebuildApp}
                onUpdateApp={updateAppData}
              />
            )}
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Modern Custom Tooltip Engine across the whole website */}
      <GlobalTooltip />
    </div>
  );
}

export function App() {
  const auth = useAuthProvider();

  return (
    <AuthContext.Provider value={auth}>
      <Suspense fallback={<div className="min-h-screen bg-paper p-8 text-ink" role="status">加载页面中…</div>}><MainConsole /></Suspense>
    </AuthContext.Provider>
  );
}

export default App;
