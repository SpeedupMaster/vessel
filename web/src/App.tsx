import React, { useState, useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { AuthContext, useAuthProvider, useAuth } from './hooks/useAuth.js';
import { useData } from './hooks/useData.js';
import { Sidebar, NavTab } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';
import { OverviewView } from './components/views/OverviewView.js';
import { AppsView } from './components/views/AppsView.js';
import { DomainsView } from './components/views/DomainsView.js';
import { BackupsView } from './components/views/BackupsView.js';
import { RegistriesView } from './components/views/RegistriesView.js';
import { MaintenanceView } from './components/views/MaintenanceView.js';
import { LoginView } from './components/views/LoginView.js';
import { ChangePasswordModal } from './components/common/ChangePasswordModal.js';
import { GlobalTooltip } from './components/common/Tooltip.js';
import { ShieldWarning, X } from '@phosphor-icons/react';

interface RouteState {
  tab: NavTab;
  isLogin: boolean;
  appSubRoute: {
    mode: 'list' | 'create' | 'detail';
    appId?: string | null;
  } | null;
}

function parsePath(pathname: string): RouteState {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/login') {
    return { tab: 'overview', isLogin: true, appSubRoute: null };
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
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [route, setRoute] = useState<RouteState>(() => parsePath(window.location.pathname));
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isPasswordWarningDismissed, setIsPasswordWarningDismissed] = useState<boolean>(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('vessel_dismiss_password_warning') === '1';
  });
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
    updateApp,
    deleteApp,
    deployApp,
    stopApp,
    restartApp,
    rebuildApp,
    freshVolumesApp,
    backupApp,
    createDomain,
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
  } = useData();

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
      setRoute(parsePath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Normalize root URL to /overview
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState(null, '', '/overview');
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
          refreshAll();
        }}
      />
    );
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
            {/* Inset Dismissible Security Banner */}
            {user?.isDefaultPassword && !isPasswordWarningDismissed && (
              <div className="mb-6 rounded-2xl bg-amber-500/10 p-4 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans animate-fade-in">
                <div className="flex items-start sm:items-center gap-2.5 text-amber-800 dark:text-amber-200 min-w-0">
                  <ShieldWarning className="w-4 h-4 shrink-0 text-amber-500 mt-0.5 sm:mt-0" weight="fill" />
                  <span className="leading-relaxed break-words">
                    <strong>安全提醒：</strong> 当前系统正在使用初始默认密码 (<code className="px-1.5 py-0.5 rounded-md bg-amber-500/15 font-mono text-amber-900 dark:text-amber-100">vessel2026</code>)。为防止公网未授权访问，建议尽快修改。
                  </span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0">
                  <button
                    onClick={() => setIsChangePasswordOpen(true)}
                    className="min-h-[40px] sm:min-h-0 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <span>立即修改密码</span>
                    <span>&rarr;</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsPasswordWarningDismissed(true);
                      sessionStorage.setItem('vessel_dismiss_password_warning', '1');
                    }}
                    title="忽略本次提醒"
                    className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-amber-700/70 hover:text-amber-900 dark:text-amber-400/70 dark:hover:text-amber-200 hover:bg-amber-500/15 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" weight="bold" />
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
                onUpdateApp={updateApp}
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
                onDeleteDomain={deleteDomain}
                onRenewDomain={renewDomain}
              />
            )}

            {route.tab === 'domains' && (
              <DomainsView
                domains={domains}
                apps={apps}
                onCreateDomain={createDomain}
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
                onUpdateApp={updateApp}
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
      <MainConsole />
    </AuthContext.Provider>
  );
}

export default App;
