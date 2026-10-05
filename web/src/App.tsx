import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useData } from './hooks/useData.js';
import { Sidebar, NavTab } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';
import { OverviewView } from './components/views/OverviewView.js';
import { AppsView } from './components/views/AppsView.js';
import { DomainsView } from './components/views/DomainsView.js';
import { BackupsView } from './components/views/BackupsView.js';
import { RegistriesView } from './components/views/RegistriesView.js';
import { MaintenanceView } from './components/views/MaintenanceView.js';
import { GlobalTooltip } from './components/common/Tooltip.js';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const mainContentRef = useRef<HTMLDivElement>(null);

  const {
    metrics,
    apps,
    domains,
    r2Config,
    backups,
    registries,
    maintenance,
    templates,
    loading,
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
    saveRegistry,
    testRegistry,
    saveMaintenance,
    triggerPrune,
    triggerCheckUpdates,
    refreshAll,
  } = useData();

  // GSAP tab switch transition
  useEffect(() => {
    if (mainContentRef.current) {
      gsap.fromTo(
        mainContentRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
      );
    }
  }, [currentTab]);

  const getTabTitle = () => {
    switch (currentTab) {
      case 'overview':
        return '平台控制台概览';
      case 'apps':
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

  if (loading) {
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
      {/* Side-Rail Navigation */}
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} metrics={metrics} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Real-time Telemetry Header */}
        <Header
          title={getTabTitle()}
          metrics={metrics}
          onRefresh={refreshAll}
          onQuickBackup={triggerSystemBackup}
        />

        {/* Dynamic View Container - Spacious & Relaxed */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12">
          <div ref={mainContentRef} className="max-w-7xl mx-auto pb-16">
            {currentTab === 'overview' && (
              <OverviewView
                metrics={metrics}
                apps={apps}
                domains={domains}
                r2Config={r2Config}
                backups={backups}
                onNavigate={setCurrentTab}
                onDeploy={deployApp}
                onTriggerBackup={triggerSystemBackup}
                onTriggerPrune={triggerPrune}
              />
            )}

            {currentTab === 'apps' && (
              <AppsView
                apps={apps}
                templates={templates}
                logsMap={logsMap}
                domains={domains}
                backups={backups}
                onCreateApp={createApp}
                onUpdateApp={updateApp}
                onDeleteApp={deleteApp}
                onDeploy={deployApp}
                onStop={stopApp}
                onRestart={restartApp}
                onRebuild={rebuildApp}
                onFreshVolumes={freshVolumesApp}
                onBackup={backupApp}
                onSubscribeLogs={subscribeLogs}
                onCreateDomain={createDomain}
                onDeleteDomain={deleteDomain}
                onRenewDomain={renewDomain}
              />
            )}

            {currentTab === 'domains' && (
              <DomainsView
                domains={domains}
                apps={apps}
                onCreateDomain={createDomain}
                onDeleteDomain={deleteDomain}
                onRenewDomain={renewDomain}
              />
            )}

            {currentTab === 'backups' && (
              <BackupsView
                r2Config={r2Config}
                backups={backups}
                onSaveConfig={saveR2Config}
                onTestConnection={testR2Connection}
                onTriggerBackupNow={triggerSystemBackup}
              />
            )}

            {currentTab === 'registries' && (
              <RegistriesView
                registries={registries}
                onSaveRegistry={saveRegistry}
                onTestRegistry={testRegistry}
              />
            )}

            {currentTab === 'maintenance' && (
              <MaintenanceView
                maintenance={maintenance}
                apps={apps}
                onSaveMaintenance={saveMaintenance}
                onTriggerPrune={triggerPrune}
                onTriggerCheckUpdates={triggerCheckUpdates}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modern Custom Tooltip Engine across the whole website */}
      <GlobalTooltip />
    </div>
  );
}

export default App;
