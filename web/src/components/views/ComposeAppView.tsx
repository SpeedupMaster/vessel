import React, { useState, useRef, useEffect, useMemo } from 'react';
import YAML from 'yaml';
import {
  ArrowLeft,
  Play,
  Stop,
  ArrowsClockwise,
  Trash,
  Code,
  Terminal,
  FileText,
  Package,
  HardDrives,
  CloudArrowUp,
  Sparkle,
  Copy,
  Check,
  Warning,
  Eye,
  GitBranch,
  PencilSimple,
  Globe,
  Database,
  Stack,
  FolderSimple,
} from '@phosphor-icons/react';
import { AppItem, ComposeTemplate, DomainItem, BackupRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { CodeEditorWithLines } from '../common/CodeEditorWithLines.js';
import { Modal } from '../common/Modal.js';
import { LogsPanel } from './LogsPanel.js';

interface ComposeAppViewProps {
  mode: 'create' | 'edit';
  app?: AppItem | null;
  templates: ComposeTemplate[];
  logsMap: Record<string, string[]>;
  domains?: DomainItem[];
  backups?: BackupRecord[];
  onBack: () => void;
  onCreateApp: (app: Partial<AppItem>) => Promise<AppItem>;
  onUpdateApp: (id: string, updates: Partial<AppItem>) => Promise<AppItem>;
  onDeleteApp: (id: string) => Promise<void>;
  onDeploy: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onRestart: (id: string) => Promise<void>;
  onRebuild: (id: string) => Promise<void>;
  onFreshVolumes?: (id: string) => Promise<any>;
  onBackup: (id: string) => Promise<any>;
  onSubscribeLogs: (id: string) => void;
}

export const ComposeAppView: React.FC<ComposeAppViewProps> = ({
  mode,
  app,
  templates,
  logsMap,
  domains = [],
  backups = [],
  onBack,
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
  // Tabs: Dokploy tabs layout
  type TabKey =
    | 'general'
    | 'environment'
    | 'domains'
    | 'deployments'
    | 'containers'
    | 'backups'
    | 'logs'
    | 'templates'
    | 'advanced';

  const [activeTab, setActiveTab] = useState<TabKey>('general');

  // Form State
  const [name, setName] = useState(app?.name || '');
  const [description, setDescription] = useState(app?.description || '');
  const [composeYaml, setComposeYaml] = useState(
    app?.composeYaml ||
      `services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    restart: unless-stopped
`
  );
  const [envContent, setEnvContent] = useState(app?.envContent || '');
  const [autoUpdate, setAutoUpdate] = useState(app ? app.autoUpdate : true);

  // Status & Loaders
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFreshVolumesModalOpen, setIsFreshVolumesModalOpen] = useState(false);
  const [copiedYaml, setCopiedYaml] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState(app?.name || '');

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Sync when editing different app
  useEffect(() => {
    if (app && mode === 'edit') {
      setName(app.name);
      setTempName(app.name);
      setDescription(app.description || '');
      setComposeYaml(app.composeYaml || '');
      setEnvContent(app.envContent || '');
      setAutoUpdate(app.autoUpdate);
      onSubscribeLogs(app.id);
    }
  }, [app, mode]);

  // Terminal scroll to bottom
  useEffect(() => {
    if (activeTab === 'deployments') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsMap, activeTab, app?.id]);

  // YAML Parsing & Validation
  const yamlValidation = useMemo(() => {
    if (!composeYaml.trim()) {
      return { valid: false, error: 'Compose 内容不能为空' };
    }
    try {
      const parsed = YAML.parse(composeYaml);
      if (typeof parsed !== 'object' || parsed === null) {
        return { valid: false, error: 'YAML 内容格式不正确' };
      }
      return { valid: true, error: null, parsed };
    } catch (e: any) {
      return { valid: false, error: e.message || 'YAML 语法解析错误' };
    }
  }, [composeYaml]);

  // Handle template selection
  const handleSelectTemplate = (tmpl: ComposeTemplate) => {
    setName(tmpl.name);
    setTempName(tmpl.name);
    setDescription(tmpl.description);
    setComposeYaml(tmpl.composeYaml);
    setEnvContent(tmpl.envContent || '');
    setActiveTab('general');
  };

  // Create App
  const handleCreate = async (shouldDeploy: boolean = false) => {
    if (!name.trim()) {
      alert('请填写应用名称');
      return;
    }
    if (!yamlValidation.valid) {
      alert(`Docker Compose 语法错误: ${yamlValidation.error}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await onCreateApp({
        name: name.trim(),
        description: description.trim(),
        composeYaml,
        envContent,
        autoUpdate,
      });

      if (shouldDeploy && created?.id) {
        await onDeploy(created.id);
      }
      onBack();
    } catch (err: any) {
      alert(`创建应用失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save / Update App in Edit Mode
  const handleSaveApp = async () => {
    if (!app) return;
    if (!yamlValidation.valid) {
      alert(`Docker Compose 语法错误: ${yamlValidation.error}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateApp(app.id, {
        name: name.trim() || app.name,
        description: description.trim(),
        composeYaml,
        envContent,
        autoUpdate,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`保存更新失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(composeYaml);
    setCopiedYaml(true);
    setTimeout(() => setCopiedYaml(false), 1800);
  };

  const handleSaveNameRename = async () => {
    if (!app || !tempName.trim()) return;
    try {
      await onUpdateApp(app.id, { name: tempName.trim() });
      setName(tempName.trim());
      setIsRenaming(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmFreshVolumes = async () => {
    if (!app) return;
    setIsFreshVolumesModalOpen(false);
    setActiveTab('deployments');
    try {
      if (onFreshVolumes) {
        await onFreshVolumes(app.id);
      } else {
        await onRebuild(app.id);
      }
    } catch (err: any) {
      alert(`Fresh Volumes 执行失败: ${err.message}`);
    }
  };

  // Associated domains for this app
  const appDomains = useMemo(() => {
    if (!app) return [];
    return domains.filter((d) => d.appId === app.id);
  }, [domains, app]);

  // Associated backups for this app
  const appBackups = useMemo(() => {
    if (!app) return [];
    return backups.filter((b) => b.targetId === app.id);
  }, [backups, app]);

  const appLogs = (app ? logsMap[app.id] : []) || [];

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ================= DOKPLOY HEADER ================= */}
      <div className="bg-paper-2 border border-line rounded-lg p-5">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-line/60">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-mono text-ink-muted hover:text-accent transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回受管应用列表</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-muted border border-line">
              Dokploy Compose Mode
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800">
              Vessel Hub
            </span>
          </div>
        </div>

        {/* Header App Details Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Status Dot */}
            <div className="relative flex items-center justify-center">
              {mode === 'create' ? (
                <div className="w-3.5 h-3.5 rounded-full bg-sky-400 animate-pulse shadow-glow-accent" />
              ) : (
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    app?.status === 'running'
                      ? 'bg-emerald-400 animate-pulse shadow-glow-emerald'
                      : app?.status === 'deploying' || app?.status === 'rebuilding'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-500'
                  }`}
                />
              )}
            </div>

            {/* Title & Slug */}
            <div>
              {mode === 'create' ? (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-ink tracking-tight">
                    {name ? name : '新建 Docker Compose 应用'}
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                    CREATE NEW
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isRenaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="bg-paper-3 border border-line rounded px-2.5 py-1 text-sm text-ink font-semibold focus:border-accent focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveNameRename}
                        className="text-xs px-2 py-1 bg-accent text-paper font-semibold rounded"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setIsRenaming(false)}
                        className="text-xs px-2 py-1 bg-paper-3 text-ink-muted rounded"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-ink tracking-tight">{app?.name}</h2>
                      <button
                        onClick={() => setIsRenaming(true)}
                        title="修改应用显示名称"
                        className="p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>
                      <Badge variant={app?.status || 'stopped'}>{app?.status || 'stopped'}</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Subtitle / ID */}
              <p className="text-xs font-mono text-ink-muted mt-0.5">
                {mode === 'create'
                  ? name
                    ? `slug: ${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
                    : '配置独立的 Docker Compose 容器编排服务'
                  : `ID: ${app?.id} · 镜像: ${app?.currentImageTag || 'compose managed'}`}
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {mode === 'edit' && app && (
              <button
                onClick={() => {
                  if (confirm(`确定要彻底删除应用 ${app.name} 吗？`)) {
                    onDeleteApp(app.id);
                    onBack();
                  }
                }}
                title="删除此应用"
                className="p-2 rounded text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 border border-rose-900/60 transition-colors"
              >
                <Trash className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================= DOKPLOY HORIZONTAL TABS ================= */}
        <div className="mt-6 pt-4 border-t border-line/60 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* General Tab */}
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'general'
                ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>General (编排)</span>
          </button>

          {/* Environment Tab */}
          <button
            onClick={() => setActiveTab('environment')}
            className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'environment'
                ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Environment (.env)</span>
          </button>

          {/* Mode specific tabs */}
          {mode === 'create' ? (
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                  : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
              }`}
            >
              <Sparkle className="w-3.5 h-3.5 text-amber-400" />
              <span>Templates (预置模板)</span>
            </button>
          ) : (
            <>
              {/* Deployments / Terminal Tab */}
              <button
                onClick={() => setActiveTab('deployments')}
                className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'deployments'
                    ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                    : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Deployments (终端日志)</span>
              </button>

              {/* Containers Tab */}
              <button
                onClick={() => setActiveTab('containers')}
                className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'containers'
                    ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                    : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
                }`}
              >
                <Stack className="w-3.5 h-3.5" />
                <span>Containers ({app?.containers?.length || 0})</span>
              </button>

              {/* Domains Tab */}
              <button
                onClick={() => setActiveTab('domains')}
                className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'domains'
                    ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                    : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Domains ({appDomains.length})</span>
              </button>

              {/* Backups Tab */}
              <button
                onClick={() => setActiveTab('backups')}
                className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'backups'
                    ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                    : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
                }`}
              >
                <CloudArrowUp className="w-3.5 h-3.5" />
                <span>Backups ({appBackups.length})</span>
              </button>

              {/* Logs Tab */}
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'logs'
                    ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                    : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Logs</span>
              </button>
            </>
          )}

          {/* Advanced Tab */}
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-3.5 py-1.5 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'advanced'
                ? 'border border-rose-500/80 text-rose-300 bg-rose-950/30 font-semibold shadow-sm'
                : 'border border-line/60 text-ink-muted hover:text-ink hover:border-line bg-paper-3/40'
            }`}
          >
            <span>Advanced (高级)</span>
          </button>
        </div>
      </div>

      {/* ================= TAB CONTENT 1: GENERAL ================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* CARD 1: DEPLOY SETTINGS (Dokploy Style) */}
          <div className="bg-paper-2 border border-line rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-line/60">
              <div>
                <h3 className="font-semibold text-base text-ink tracking-tight">Deploy Settings</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Create a compose file to deploy your compose
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-black text-ink font-semibold border border-line">
                Compose
              </span>
            </div>

            {/* In Create Mode: Name & Description Fields */}
            {mode === 'create' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-1">
                <div>
                  <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                    应用名称 (Application Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setTempName(e.target.value);
                    }}
                    placeholder="例如: n8n-automation"
                    className="w-full bg-paper-3 border border-line rounded px-3 py-2 text-sm text-ink font-medium focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-ink-muted mb-1.5">
                    应用简介 (Description)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="例如: 企业级工作流自动化编排与应用管理"
                    className="w-full bg-paper-3 border border-line rounded px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons Row */}
            <div className="mt-5 pt-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {mode === 'create' ? (
                  <>
                    <button
                      onClick={() => handleCreate(true)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-black hover:bg-neutral-900 border border-neutral-700 text-white font-semibold text-xs rounded transition-all shadow-sm active:translate-y-px"
                    >
                      <Play className="w-3.5 h-3.5 text-accent" weight="fill" />
                      <span>{isSubmitting ? '正在创建并部署...' : 'Deploy (创建并立即部署)'}</span>
                    </button>

                    <button
                      onClick={() => handleCreate(false)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-paper-3 hover:bg-paper-4 border border-line text-ink text-xs font-medium rounded transition-colors"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>仅保存配置 (Save Draft)</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Dokploy Action Buttons */}
                    <button
                      onClick={() => app && onDeploy(app.id)}
                      className="inline-flex items-center gap-2 px-4 py-1.5 bg-black hover:bg-neutral-900 border border-neutral-700 text-white font-semibold text-xs rounded transition-all active:translate-y-px"
                    >
                      <Play className="w-3.5 h-3.5 text-accent" weight="fill" />
                      <span>Deploy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFreshVolumesModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-3 hover:bg-paper-4 border border-line text-ink text-xs font-medium rounded transition-colors"
                    >
                      <Database className="w-3.5 h-3.5 text-sky-400" />
                      <span>Fresh Volumes</span>
                    </button>

                    <button
                      onClick={() => app && onRebuild(app.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-3 hover:bg-paper-4 border border-line text-ink text-xs font-medium rounded transition-colors"
                    >
                      <ArrowsClockwise className="w-3.5 h-3.5 text-ink-muted" />
                      <span>Rebuild</span>
                    </button>

                    <button
                      onClick={() => app && onStop(app.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/60 text-rose-300 text-xs font-medium rounded transition-colors"
                    >
                      <Stop className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('deployments')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper-3 hover:bg-paper-4 border border-line text-ink text-xs font-medium rounded transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Open Terminal</span>
                    </button>
                  </>
                )}
              </div>

              {/* Autodeploy Switch Toggle */}
              <div className="flex items-center gap-3 bg-paper-3/60 px-3 py-1.5 rounded border border-line/60">
                <label
                  htmlFor="autodeployToggle"
                  className="text-xs font-medium text-ink flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <span>Autodeploy</span>
                  <span className="text-[10px] text-ink-faint font-mono">(镜像自动巡检更新)</span>
                </label>
                <button
                  type="button"
                  id="autodeployToggle"
                  role="switch"
                  aria-checked={autoUpdate}
                  onClick={() => setAutoUpdate(!autoUpdate)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoUpdate ? 'bg-sky-500' : 'bg-paper-4'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoUpdate ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* CARD 2: COMPOSE FILE (Dokploy Code Editor with Line Numbers) */}
          <div className="bg-paper-2 border border-line rounded-lg p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/60">
              <div>
                <h3 className="font-semibold text-base text-ink tracking-tight">Compose File</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Configure your Docker Compose file for this service.
                </p>
              </div>

              {/* Status & Copy controls */}
              <div className="flex items-center gap-2.5">
                {/* YAML Validation Indicator */}
                {yamlValidation.valid ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800 rounded">
                    <Check className="w-3 h-3 text-emerald-400" />
                    YAML 语法有效
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 bg-rose-950/80 text-rose-300 border border-rose-800 rounded truncate max-w-xs"
                    title={yamlValidation.error || ''}
                  >
                    <Warning className="w-3 h-3 text-rose-400" />
                    语法错误: {yamlValidation.error}
                  </span>
                )}

                {/* Preview Compose Button */}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-ink-muted hover:text-ink bg-paper-3 hover:bg-paper-4 border border-line rounded transition-colors"
                >
                  <GitBranch className="w-3.5 h-3.5 text-accent" />
                  <span>Preview Compose</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyYaml}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-ink-muted hover:text-ink bg-paper-3 hover:bg-paper-4 border border-line rounded transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedYaml ? '已复制' : '复制'}</span>
                </button>
              </div>
            </div>

            {/* Code Editor Area with Line Numbers */}
            <div className="mt-4">
              <CodeEditorWithLines
                value={composeYaml}
                onChange={setComposeYaml}
                placeholder="services:&#10;  app:&#10;    image: ...&#10;    ports:&#10;      - '8080:80'"
                minHeight="440px"
              />
            </div>

            {/* Card Footer: Save Button (Dokploy Style at Bottom Right) */}
            <div className="mt-4 pt-3 flex items-center justify-between border-t border-line/40">
              <span className="text-xs text-ink-faint font-mono">
                Tab 键自动补全 2 格缩进 · 支持 docker compose v2 标准语法
              </span>

              <div className="flex items-center gap-2">
                {mode === 'create' ? (
                  <>
                    <button
                      onClick={onBack}
                      className="px-4 py-2 rounded text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleCreate(false)}
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-neutral-900 hover:bg-black text-white font-semibold text-xs rounded border border-neutral-700 transition-all active:translate-y-px"
                    >
                      {isSubmitting ? '保存中...' : '保存应用 (Save)'}
                    </button>
                    <button
                      onClick={() => handleCreate(true)}
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-accent hover:bg-accent-hover text-paper font-semibold text-xs rounded transition-all shadow-glow-accent active:translate-y-px"
                    >
                      {isSubmitting ? '部署中...' : '创建并部署 (Deploy)'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleSaveApp}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-6 py-2 bg-black hover:bg-neutral-900 border border-neutral-700 text-white font-semibold text-xs rounded transition-all shadow-sm active:translate-y-px"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>已保存！</span>
                      </>
                    ) : (
                      <span>{isSubmitting ? '正在保存...' : 'Save'}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 2: ENVIRONMENT ================= */}
      {activeTab === 'environment' && (
        <div className="bg-paper-2 border border-line rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">Environment Variables</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Configure your environment variables (.env) for this service.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-3 text-ink-faint border border-line">
              .env Format
            </span>
          </div>

          <p className="text-xs text-ink-muted">
            在此处定义的键值对将作为 <code className="font-mono text-accent">.env</code>{' '}
            注入至同一编排目录，可在 Compose 文件中通过{' '}
            <code className="font-mono text-accent">${'{KEY}'}</code> 变量直接插值引用。
          </p>

          <CodeEditorWithLines
            value={envContent}
            onChange={setEnvContent}
            placeholder={'NODE_ENV=production\nDATABASE_URL=postgres://...\nPORT=8080'}
            minHeight="340px"
          />

          <div className="pt-3 border-t border-line/40 flex justify-end">
            {mode === 'edit' ? (
              <button
                onClick={handleSaveApp}
                disabled={isSubmitting}
                className="px-6 py-2 bg-black hover:bg-neutral-900 border border-neutral-700 text-white font-semibold text-xs rounded transition-all active:translate-y-px"
              >
                {saveSuccess ? '已保存！' : 'Save Environment'}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('general')}
                className="px-4 py-2 bg-paper-3 hover:bg-paper-4 text-ink text-xs font-medium rounded border border-line"
              >
                返回常规编排
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 3: TEMPLATES (CREATE MODE) ================= */}
      {activeTab === 'templates' && (
        <div className="bg-paper-2 border border-line rounded-lg p-5 space-y-4">
          <div className="pb-3 border-b border-line/60">
            <h3 className="font-semibold text-base text-ink tracking-tight">官方预置模板库</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              点击任意模板，即刻导入经过安全生产验证的标准 Docker Compose 编排规则及配置。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.name}
                className="p-4 rounded border border-line bg-paper-3/40 hover:border-accent hover:bg-paper-3 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-ink">{tmpl.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-paper-4 text-ink-muted">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-2 line-clamp-3">{tmpl.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-end">
                  <button
                    onClick={() => {
                      handleSelectTemplate(tmpl);
                      setActiveTab('general');
                    }}
                    className="px-3 py-1.5 bg-accent text-paper font-semibold text-xs rounded hover:bg-accent-hover transition-colors"
                  >
                    使用此模板
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 4: DEPLOYMENTS & TERMINAL (EDIT MODE) ================= */}
      {activeTab === 'deployments' && mode === 'edit' && app && (
        <div className="bg-paper-2 border border-line rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">Deployment & Realtime Logs</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                WebSocket 实时管道对接 Docker Compose 部署构建与容器标准输出
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onDeploy(app.id)}
                className="px-3 py-1 bg-accent text-paper font-semibold text-xs rounded flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" weight="fill" />
                <span>立即部署</span>
              </button>
              <button
                onClick={() => onRebuild(app.id)}
                className="px-3 py-1 bg-paper-3 hover:bg-paper-4 text-ink text-xs font-medium rounded border border-line flex items-center gap-1.5"
              >
                <ArrowsClockwise className="w-3.5 h-3.5" />
                <span>重建</span>
              </button>
            </div>
          </div>

          {/* Terminal Screen */}
          <div className="bg-black border border-line rounded p-4 font-mono text-xs text-emerald-400 h-96 overflow-y-auto space-y-1 select-text shadow-inner">
            <div className="text-ink-faint pb-2 border-b border-line/40 flex items-center justify-between">
              <span>── Vessel WebSocket Deployment Log Stream [{app.id}] ──</span>
              <span className="text-[10px] text-ink-faint">Auto-scrolling</span>
            </div>

            {appLogs.length === 0 ? (
              <div className="text-ink-muted py-16 text-center">
                暂无部署输出。点击上方「立即部署」或「重建」查看实时日志流。
              </div>
            ) : (
              appLogs.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {line}
                </div>
              ))
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 5: CONTAINERS (EDIT MODE) ================= */}
      {activeTab === 'containers' && mode === 'edit' && app && (
        <div className="bg-paper-2 border border-line rounded-lg p-5 space-y-4">
          <div className="pb-3 border-b border-line/60">
            <h3 className="font-semibold text-base text-ink tracking-tight">Active Containers</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              此 Compose 应用栈下所挂载的 Docker 容器实例状态与端口映射
            </p>
          </div>

          {(app.containers || []).length === 0 ? (
            <div className="py-12 text-center text-ink-muted text-xs font-mono">
              暂未检测到运行中的容器实例。请点击上方「Deploy」启动应用编排。
            </div>
          ) : (
            <div className="divide-y divide-line">
              {app.containers.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink">{c.name}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          c.state === 'running'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {c.state}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted font-mono">
                      Image: {c.image} · ID: {c.id.slice(0, 12)}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono text-ink-muted">
                      {c.ports?.length ? c.ports.join(', ') : '无直接对外映射端口'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB CONTENT 6: DOMAINS (EDIT MODE) ================= */}
      {activeTab === 'domains' && mode === 'edit' && app && (
        <div className="bg-paper-2 border border-line rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">Caddy 域名路由绑定</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                为此应用栈配置的反向代理域名及 Let's Encrypt / ZeroSSL 证书
              </p>
            </div>
          </div>

          {appDomains.length === 0 ? (
            <div className="py-12 text-center text-ink-muted text-xs">
              <p>该应用尚未绑定自定义外部域名。</p>
              <p className="mt-1 text-ink-faint">
                可前往「域名与证书」模块，为本应用的内网端口一键颁发自动续期 SSL 证书。
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {appDomains.map((dom) => (
                <div key={dom.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-ink">{dom.domain}</span>
                    <p className="text-xs text-ink-muted font-mono mt-0.5">
                      反代目标端口: {dom.targetPort} · 证书颁发商: {dom.sslIssuer}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded">
                    HTTPS 活跃
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB CONTENT 7: BACKUPS (EDIT MODE) ================= */}
      {activeTab === 'backups' && mode === 'edit' && app && (
        <div className="bg-paper-2 border border-line rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">Cloudflare R2 灾备记录</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                此应用对应的数据卷与 Compose 编排快照备份存档
              </p>
            </div>

            <button
              onClick={() => onBackup(app.id)}
              className="px-3.5 py-1.5 bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-200 text-xs font-medium rounded flex items-center gap-1.5"
            >
              <CloudArrowUp className="w-4 h-4 text-sky-400" />
              <span>立即备份此应用</span>
            </button>
          </div>

          {appBackups.length === 0 ? (
            <div className="py-12 text-center text-ink-muted text-xs">
              暂无此应用的独立备份归档。点击右上角即可立即将编排与数据卷上传至 R2。
            </div>
          ) : (
            <div className="divide-y divide-line">
              {appBackups.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-ink">{b.fileName}</span>
                    <p className="text-xs text-ink-muted font-mono mt-0.5">
                      大小: {(b.fileSizeBytes / 1024 / 1024).toFixed(2)} MB · 时间: {b.createdAt}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB CONTENT: LOGS (DOKPLOY RUNTIME CONTAINER LOGS) ================= */}
      {activeTab === 'logs' && mode === 'edit' && app && (
        <LogsPanel app={app} />
      )}

      {/* ================= TAB CONTENT 8: ADVANCED ================= */}
      {activeTab === 'advanced' && (
        <div className="bg-paper-2 border border-line rounded-lg p-5 space-y-6">
          <div className="pb-3 border-b border-line/60">
            <h3 className="font-semibold text-base text-ink tracking-tight">Advanced Settings</h3>
            <p className="text-xs text-ink-muted mt-0.5">系统底层元数据与生命周期安全管理</p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-3 rounded bg-paper-3/40 border border-line">
              <span className="text-ink-muted">Application UUID:</span>
              <span className="text-ink">{app?.id || '未生成 (创建后确定)'}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-paper-3/40 border border-line">
              <span className="text-ink-muted">Created Timestamp:</span>
              <span className="text-ink">{app?.createdAt || new Date().toISOString()}</span>
            </div>
          </div>

          {mode === 'edit' && app && (
            <div className="mt-6 pt-5 border-t border-rose-900/50">
              <h4 className="text-sm font-bold text-rose-400">危险操作区域 (Danger Zone)</h4>
              <p className="text-xs text-ink-muted mt-1">
                彻底删除此 Docker Compose 应用栈。这将停止相关容器、清理本地配置文件，不可恢复。
              </p>
              <div className="mt-3">
                <button
                  onClick={() => {
                    if (confirm(`警告：确定彻底删除应用 ${app.name} 吗？`)) {
                      onDeleteApp(app.id);
                      onBack();
                    }
                  }}
                  className="px-4 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-semibold rounded flex items-center gap-1.5"
                >
                  <Trash className="w-4 h-4" />
                  <span>彻底删除此应用</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= PREVIEW COMPOSE MODAL ================= */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Docker Compose 配置结构解析预览"
        subtitle="实时解析自当前 YAML 文本"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {!yamlValidation.valid ? (
            <div className="p-4 rounded bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
              <span className="font-bold">无法解析 YAML 内容:</span>
              <p className="mt-1 font-mono">{yamlValidation.error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-ink-muted flex items-center justify-between">
                <span>解析服务数量: {Object.keys(yamlValidation.parsed?.services || {}).length} 个</span>
                <span className="text-emerald-400 font-mono">YAML PARSED VALID</span>
              </div>

              <div className="space-y-2">
                {Object.entries(yamlValidation.parsed?.services || {}).map(
                  ([sName, sCfg]: [string, any]) => (
                    <div
                      key={sName}
                      className="p-3.5 rounded bg-paper-3/60 border border-line font-mono text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent">{sName}</span>
                        <span className="text-[11px] text-ink-faint">
                          restart: {sCfg.restart || 'no'}
                        </span>
                      </div>
                      <div className="text-ink-muted">
                        image: <span className="text-ink">{sCfg.image || 'build/custom'}</span>
                      </div>
                      {sCfg.ports && (
                        <div className="text-ink-muted">
                          ports: <span className="text-sky-300">{JSON.stringify(sCfg.ports)}</span>
                        </div>
                      )}
                      {sCfg.volumes && (
                        <div className="text-ink-muted">
                          volumes: <span className="text-ink-faint">{JSON.stringify(sCfg.volumes)}</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line flex justify-end">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="px-4 py-1.5 bg-paper-3 hover:bg-paper-4 text-ink text-xs font-medium rounded border border-line"
            >
              关闭
            </button>
          </div>
        </div>
      </Modal>

      {/* ================= FRESH VOLUMES CONFIRMATION MODAL ================= */}
      <Modal
        isOpen={isFreshVolumesModalOpen}
        onClose={() => setIsFreshVolumesModalOpen(false)}
        title="⚠️ 危险操作：清空数据卷并重新部署"
        subtitle={`受管服务: ${app?.name || ''} (${app?.id || ''})`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-300">
              <Warning className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>数据卷内所有数据将彻底清空且无法撤回！</span>
            </div>
            <p className="leading-relaxed text-rose-200/90">
              此操作将执行 <code className="font-mono bg-rose-900/60 px-1.5 py-0.5 rounded text-white">docker compose down -v</code>。
              所有挂载在该应用下的<strong>持久化数据卷（Volumes）将被彻底销毁</strong>，包括数据库中所有数据表记录、用户上传的本地持久文件等，随后以<strong>全新空白初始状态</strong>重新创建容器。
            </p>
          </div>

          <div className="p-3.5 rounded bg-paper-3/40 border border-line text-xs space-y-2">
            <div className="font-semibold text-ink">影响范围确认：</div>
            <ul className="space-y-1 text-ink-muted list-disc list-inside">
              <li>
                <span className="text-rose-400 font-medium">永久抹除</span>：数据库表数据、本地挂载持久卷所有文件
              </li>
              <li>
                <span className="text-emerald-400 font-medium">保留不变</span>：当前 compose 编排文件、.env 环境变量、Caddy 域名绑定
              </li>
              <li>
                <span className="text-sky-400 font-medium">执行流程</span>：重置数据卷后自动执行全新的镜像拉取与启动构建
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-line/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsFreshVolumesModalOpen(false)}
              className="px-4 py-2 bg-paper-3 hover:bg-paper-4 text-ink text-xs font-medium rounded border border-line transition-colors"
            >
              取消并返回
            </button>
            <button
              type="button"
              onClick={handleConfirmFreshVolumes}
              className="px-5 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-100 font-semibold text-xs rounded transition-all shadow-sm active:translate-y-px flex items-center gap-2"
            >
              <Database className="w-4 h-4 text-rose-400" />
              <span>确认彻底清空并重新部署</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
