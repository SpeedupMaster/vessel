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
  Plus,
  ArrowSquareOut,
  ShieldCheck,
  Link as LinkIcon,
  LockKey,
  Info,
  Lightning,
  CheckCircle,
} from '@phosphor-icons/react';
import { AppItem, ComposeTemplate, DomainItem, BackupRecord } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { CodeEditorWithLines } from '../common/CodeEditorWithLines.js';
import { Modal } from '../common/Modal.js';
import { CustomSelect } from '../common/CustomSelect.js';
import { LogsPanel } from './LogsPanel.js';
import { useNotification } from '../../context/NotificationContext.js';

interface ComposeAppViewProps {
  mode: 'create' | 'edit';
  app?: AppItem | null;
  templates: ComposeTemplate[];
  logsMap: Record<string, string[]>;
  domains?: DomainItem[];
  backups?: BackupRecord[];
  onBack: () => void;
  onCreateApp: (app: Partial<AppItem> & { domainBinding?: any }) => Promise<AppItem>;
  onUpdateApp: (id: string, updates: Partial<AppItem>) => Promise<AppItem>;
  onDeleteApp: (id: string) => Promise<void>;
  onDeploy: (id: string) => Promise<void>;
  onStop: (id: string) => Promise<void>;
  onRestart: (id: string) => Promise<void>;
  onRebuild: (id: string) => Promise<void>;
  onFreshVolumes?: (id: string) => Promise<any>;
  onBackup: (id: string) => Promise<any>;
  onSubscribeLogs: (id: string) => void;
  onCreateDomain?: (domain: Partial<DomainItem>) => Promise<any>;
  onDeleteDomain?: (id: string) => Promise<any>;
  onRenewDomain?: (id: string) => Promise<any>;
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
  onCreateDomain,
  onDeleteDomain,
  onRenewDomain,
}) => {
  const { toast, confirm } = useNotification();

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
  const [composeYaml, setComposeYaml] = useState(app?.composeYaml || '');
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

  // Domain binding in deployment (create mode)
  const [bindDomainOnDeploy, setBindDomainOnDeploy] = useState(false);
  const [deployDomain, setDeployDomain] = useState('');
  const [deployServiceName, setDeployServiceName] = useState('');
  const [deployTargetPort, setDeployTargetPort] = useState('');
  const [deployTargetType, setDeployTargetType] = useState<'internal' | 'host'>('internal');

  // Domain binding modal (edit mode or quick action)
  const [isAddDomainModalOpen, setIsAddDomainModalOpen] = useState(false);
  const [modalDomain, setModalDomain] = useState('');
  const [modalServiceName, setModalServiceName] = useState('');
  const [modalTargetPort, setModalTargetPort] = useState('');
  const [modalTargetType, setModalTargetType] = useState<'internal' | 'host'>('internal');
  const [isBindingDomain, setIsBindingDomain] = useState(false);

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

  // Detected services and ports from compose YAML
  const detectedServices = useMemo(() => {
    if (!yamlValidation.valid || !yamlValidation.parsed?.services) return [];
    const servicesObj = yamlValidation.parsed.services;
    const list: { name: string; ports: number[] }[] = [];
    for (const [srvName, config] of Object.entries<any>(servicesObj)) {
      const portSet = new Set<number>();
      if (Array.isArray(config?.ports)) {
        for (const p of config.ports) {
          const str = String(p);
          const parts = str.split(':');
          const internalPort = parseInt(parts[parts.length - 1]?.split('/')[0], 10);
          if (!isNaN(internalPort)) portSet.add(internalPort);
          if (parts.length > 1) {
            const hostPort = parseInt(parts[parts.length - 2]?.split('/')[0], 10);
            if (!isNaN(hostPort)) portSet.add(hostPort);
          }
        }
      }
      list.push({
        name: srvName,
        ports: Array.from(portSet),
      });
    }
    return list;
  }, [yamlValidation]);

  // Auto-fill defaults for create mode
  useEffect(() => {
    if (detectedServices.length > 0) {
      if (!deployServiceName || !detectedServices.some((s) => s.name === deployServiceName)) {
        setDeployServiceName(detectedServices[0].name);
      }
      if (!deployTargetPort && detectedServices[0].ports.length > 0) {
        setDeployTargetPort(String(detectedServices[0].ports[0]));
      }
    }
  }, [detectedServices, deployServiceName, deployTargetPort]);

  // Open Add Domain Modal handler with intelligent defaults
  const openAddDomainModal = () => {
    const defaultSrv = detectedServices[0]?.name || 'web';
    const defaultPort = detectedServices[0]?.ports[0] ? String(detectedServices[0].ports[0]) : '80';
    setModalServiceName(defaultSrv);
    setModalTargetPort(defaultPort);
    setModalTargetType('internal');
    setModalDomain('');
    setIsAddDomainModalOpen(true);
  };

  // Submit Add Domain Modal
  const handleModalBindDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || !onCreateDomain) return;
    const cleanDomain = modalDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!cleanDomain) {
      toast.error('请输入有效域名');
      return;
    }
    if (!modalTargetPort || isNaN(Number(modalTargetPort))) {
      toast.error('请输入有效目标端口');
      return;
    }

    setIsBindingDomain(true);
    try {
      await onCreateDomain({
        domain: cleanDomain,
        appId: app.id,
        serviceName: modalServiceName.trim() || 'web',
        targetPort: Number(modalTargetPort),
        targetType: modalTargetType,
      });
      toast.success(`域名 ${cleanDomain} 绑定成功！Caddy 正在自动化签发 SSL 证书`);
      setIsAddDomainModalOpen(false);
      setModalDomain('');
    } catch (err: any) {
      toast.error(`绑定域名失败: ${err.message}`);
    } finally {
      setIsBindingDomain(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = (tmpl: ComposeTemplate) => {
    setName(tmpl.name);
    setTempName(tmpl.name);
    setDescription(tmpl.description);
    setComposeYaml(tmpl.composeYaml);
    setEnvContent(tmpl.envContent || '');

    // Check if envContent has DOMAIN=...
    const match = (tmpl.envContent || '').match(/(?:^|\n)\s*DOMAIN\s*=\s*([^\s#\r\n]+)/i);
    if (match && match[1]) {
      setDeployDomain(match[1]);
      setBindDomainOnDeploy(true);
    }
    setActiveTab('general');
  };

  // Delete App confirmation handler
  const handleDeleteAppClick = async () => {
    if (!app) return;
    const ok = await confirm({
      title: '⚠️ 危险操作：彻底删除应用',
      subtitle: `受管服务: ${app.name} (${app.id})`,
      dangerTitle: '删除操作不可撤回！',
      message: `确定要彻底删除应用 "${app.name}" 吗？此操作将立即停止容器并清理本地编排配置文件与关联网络。`,
      details: [
        '容器服务将立即执行停止并销毁 Compose 实例',
        '本地存储的 docker-compose.yml 编排文件将被彻底删除',
        '关联的域名反向代理路由规则需要按需手动解绑',
      ],
      confirmText: '确认彻底删除',
      cancelText: '取消并返回',
      variant: 'danger',
    });
    if (ok) {
      toast.info(`正在删除应用 ${app.name}...`);
      try {
        await onDeleteApp(app.id);
        toast.success(`应用 ${app.name} 已成功删除`);
        onBack();
      } catch (err: any) {
        toast.error(`删除应用失败: ${err.message}`);
      }
    }
  };

  // Create App
  const handleCreate = async (shouldDeploy: boolean = false) => {
    if (!name.trim()) {
      toast.error('请填写应用名称');
      return;
    }
    if (!composeYaml.trim()) {
      toast.error('请填写 Docker Compose 编排文件内容');
      return;
    }
    if (!yamlValidation.valid) {
      toast.error(`Docker Compose 语法错误: ${yamlValidation.error}`);
      return;
    }

    if (bindDomainOnDeploy) {
      if (!deployDomain.trim()) {
        toast.error('已启用部署时绑定域名，请填写域名 (如 app.example.com)');
        return;
      }
      if (!deployTargetPort || isNaN(Number(deployTargetPort))) {
        toast.error('请填写有效的目标反向代理端口');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const domainBinding =
        bindDomainOnDeploy && deployDomain.trim()
          ? {
              domain: deployDomain.trim().toLowerCase(),
              serviceName: deployServiceName.trim() || 'web',
              targetPort: Number(deployTargetPort) || 80,
              targetType: deployTargetType,
            }
          : undefined;

      const created = await onCreateApp({
        name: name.trim(),
        description: description.trim(),
        composeYaml,
        envContent,
        autoUpdate,
        ...(domainBinding ? { domainBinding } : {}),
      } as any);

      toast.success(
        domainBinding
          ? `应用创建成功！已自动绑定域名 ${domainBinding.domain} 并配置 Caddy`
          : '应用创建成功！'
      );
      if (shouldDeploy && created?.id) {
        await onDeploy(created.id);
      }
      onBack();
    } catch (err: any) {
      toast.error(`创建应用失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save / Update App in Edit Mode
  const handleSaveApp = async () => {
    if (!app) return;
    if (!composeYaml.trim()) {
      toast.error('请填写 Docker Compose 编排文件内容');
      return;
    }
    if (!yamlValidation.valid) {
      toast.error(`Docker Compose 语法错误: ${yamlValidation.error}`);
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
      toast.success('配置已成功保存！');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      toast.error(`保存更新失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(composeYaml);
    setCopiedYaml(true);
    toast.success('Compose 配置已复制到剪贴板');
    setTimeout(() => setCopiedYaml(false), 1800);
  };

  const handleSaveNameRename = async () => {
    if (!app || !tempName.trim()) return;
    try {
      await onUpdateApp(app.id, { name: tempName.trim() });
      setName(tempName.trim());
      setIsRenaming(false);
      toast.success('应用名称已修改');
    } catch (err: any) {
      toast.error(err.message);
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
      toast.error(`Fresh Volumes 执行失败: ${err.message}`);
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
            className="flex items-center gap-2 px-2.5 py-1 -ml-2 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回受管应用列表</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-line">
              Docker Compose 模式
            </span>
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              Vessel 控制中枢
            </span>
          </div>
        </div>

        {/* Header App Details Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Status Dot */}
            <div className="relative flex items-center justify-center">
              {mode === 'create' ? (
                <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
              ) : (
                <div
                  className={`w-3 h-3 rounded-full ${
                    app?.status === 'running'
                      ? 'bg-emerald-500 animate-pulse'
                      : app?.status === 'deploying' || app?.status === 'rebuilding'
                      ? 'bg-blue-500 animate-ping'
                      : 'bg-rose-500'
                  }`}
                />
              )}
            </div>

            {/* Title & Slug */}
            <div>
              {mode === 'create' ? (
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-ink tracking-tight">
                    {name ? name : '新建 Docker Compose 应用'}
                  </h2>
                  <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    新建应用
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
                        className="bg-paper border border-line rounded-lg px-3 py-1 text-sm text-ink font-semibold focus:border-accent focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveNameRename}
                        className="text-xs px-3 py-1 bg-accent text-white font-medium rounded-lg shadow-subtle"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setIsRenaming(false)}
                        className="text-xs px-3 py-1 bg-paper-2 border border-line text-ink-muted hover:text-ink rounded-lg"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-ink tracking-tight">{app?.name}</h2>
                      <button
                        onClick={() => setIsRenaming(true)}
                        data-tooltip="修改应用显示名称"
                        className="p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>
                      <Badge variant={app?.status || 'stopped'}>{app?.status || 'stopped'}</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Subtitle / ID */}
              <p className="text-xs text-ink-muted mt-0.5">
                {mode === 'create'
                  ? name
                    ? `应用标识: ${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
                    : '配置独立的 Docker Compose 容器编排服务'
                  : `应用 ID: ${app?.id} · 镜像: ${app?.currentImageTag || '由 Compose 编排托管'}`}
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {mode === 'edit' && app && (
              <button
                onClick={handleDeleteAppClick}
                data-tooltip="删除此应用"
                className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-line transition-colors cursor-pointer"
              >
                <Trash className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================= DOKPLOY HORIZONTAL TABS ================= */}
        <div className="mt-6 pt-4 border-t border-line/60 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {/* General Tab */}
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-accent" />
            <span>基础编排</span>
          </button>

          {/* Environment Tab */}
          <button
            onClick={() => setActiveTab('environment')}
            className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'environment'
                ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-accent" />
            <span>环境变量 (.env)</span>
          </button>

          {/* Mode specific tabs */}
          {mode === 'create' ? (
            <>
              {/* Domains Tab in Create Mode */}
              <button
                onClick={() => setActiveTab('domains')}
                className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'domains'
                    ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                    : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  域名绑定{' '}
                  {bindDomainOnDeploy && deployDomain ? (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded-full border border-emerald-500/20 font-mono">
                      1
                    </span>
                  ) : (
                    '(0)'
                  )}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('templates')}
                className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'templates'
                    ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                    : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
                }`}
              >
                <Sparkle className="w-3.5 h-3.5 text-amber-500" />
                <span>预置模板</span>
              </button>
            </>
          ) : (
            <>
              {/* Deployments / Terminal Tab */}
              <button
                onClick={() => setActiveTab('deployments')}
                className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'deployments'
                    ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                    : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span>部署日志</span>
              </button>

              {/* Containers Tab */}
              <button
                onClick={() => setActiveTab('containers')}
                className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'containers'
                    ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                    : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
                }`}
              >
                <Stack className="w-3.5 h-3.5 text-accent" />
                <span>容器实例 ({app?.containers?.length || 0})</span>
              </button>

              {/* Domains Tab */}
              <button
                onClick={() => setActiveTab('domains')}
                className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'domains'
                    ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                    : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>域名绑定 ({appDomains.length})</span>
              </button>

              {/* Backups Tab */}
              <button
                onClick={() => setActiveTab('backups')}
                className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'backups'
                    ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                    : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
                }`}
              >
                <CloudArrowUp className="w-3.5 h-3.5 text-accent" />
                <span>备份存档 ({appBackups.length})</span>
              </button>

              {/* Logs Tab */}
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'logs'
                    ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                    : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span>运行日志</span>
              </button>
            </>
          )}

          {/* Advanced Tab */}
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-3.5 py-2 text-xs rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'advanced'
                ? 'bg-paper dark:bg-paper-3 border border-line text-ink font-medium shadow-subtle'
                : 'border border-transparent text-ink-muted hover:text-ink hover:bg-paper-3/60 font-normal'
            }`}
          >
            <span>高级设置</span>
          </button>
        </div>
      </div>

      {/* ================= TAB CONTENT 1: GENERAL ================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* CARD 1: DEPLOY SETTINGS (Dokploy Style) */}
          <div className="card-vessel p-6 sm:p-7 shadow-subtle">
            <div className="flex items-center justify-between pb-3 border-b border-line/60">
              <div>
                <h3 className="font-semibold text-base text-ink tracking-tight">部署设置</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  配置 Docker Compose 服务的部署行为与自动化更新策略
                </p>
              </div>
              <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted font-medium border border-line">
                编排服务
              </span>
            </div>

            {/* In Create Mode: Name & Description Fields */}
            {mode === 'create' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    应用名称 *
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
                    className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-sm text-ink font-medium focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    应用描述
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="例如: 企业级工作流自动化编排与应用管理"
                    className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* In Create Mode: Domain Binding Section */}
            {mode === 'create' && (
              <div className="mt-4 pt-4 border-t border-line/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="text-xs font-semibold text-ink">部署时直接绑定公网域名</span>
                      <span className="text-[11px] text-ink-muted ml-1.5 hidden sm:inline">
                        (Caddy 自动申请 Let's Encrypt / ZeroSSL 证书并反向代理)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bindDomainOnDeploy}
                    onClick={() => setBindDomainOnDeploy(!bindDomainOnDeploy)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      bindDomainOnDeploy ? 'bg-accent' : 'bg-paper-4'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        bindDomainOnDeploy ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {bindDomainOnDeploy && (
                  <div className="mt-3.5 p-4 bg-paper-2 rounded-xl border border-line space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-ink flex items-center gap-1">
                          <span>公网域名 (FQDN)</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-ink-faint">部署时自动注册 Caddyfile</span>
                      </div>

                      <div className="flex items-stretch rounded-xl border border-line bg-paper shadow-subtle focus-within:border-accent transition-colors overflow-hidden group">
                        <div className="bg-paper-2 border-r border-line px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none group-focus-within:text-accent transition-colors">
                          <LockKey className="w-3.5 h-3.5" weight="bold" />
                          <span>https://</span>
                        </div>
                        <input
                          type="text"
                          value={deployDomain}
                          onChange={(e) => {
                            let val = e.target.value.trim();
                            val = val.replace(/^https?:\/\//i, '');
                            setDeployDomain(val);
                          }}
                          placeholder="n8n.yourdomain.com"
                          className="flex-1 min-w-0 bg-transparent px-3.5 py-2 text-xs text-ink font-mono placeholder:text-ink-faint focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          反代目标服务
                        </label>
                        {detectedServices.length > 0 ? (
                          <CustomSelect
                            value={deployServiceName}
                            onChange={(val) => {
                              setDeployServiceName(val);
                              const s = detectedServices.find((ds) => ds.name === val);
                              if (s && s.ports.length > 0) {
                                setDeployTargetPort(String(s.ports[0]));
                              }
                            }}
                            options={detectedServices.map((s) => ({
                              value: s.name,
                              label: s.name,
                              badge: 'Compose 服务',
                              description: s.ports.length > 0 ? `检测端口: ${s.ports.join(', ')}` : undefined,
                            }))}
                            placeholder="选择目标服务..."
                          />
                        ) : (
                          <input
                            type="text"
                            value={deployServiceName}
                            onChange={(e) => setDeployServiceName(e.target.value)}
                            placeholder="web"
                            className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink focus:border-accent focus:outline-none shadow-subtle transition-colors"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          目标端口 (上游端口)
                        </label>
                        <input
                          type="number"
                          value={deployTargetPort}
                          onChange={(e) => setDeployTargetPort(e.target.value)}
                          placeholder="5678"
                          className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono font-medium focus:border-accent focus:outline-none shadow-subtle transition-colors"
                        />
                      </div>
                    </div>

                    {detectedServices.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[11px] text-ink-faint flex items-center gap-1 mr-1">
                          <Lightning className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                          检测端口:
                        </span>
                        {detectedServices.flatMap((s) =>
                          s.ports.map((p) => {
                            const isSelected = deployServiceName === s.name && deployTargetPort === String(p);
                            return (
                              <button
                                key={`${s.name}-${p}`}
                                type="button"
                                onClick={() => {
                                  setDeployServiceName(s.name);
                                  setDeployTargetPort(String(p));
                                }}
                                className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? 'bg-accent text-white border-accent shadow-subtle font-semibold'
                                    : 'bg-paper hover:bg-paper-3 text-ink-muted hover:text-ink border-line'
                                }`}
                              >
                                <span>{s.name}:{p}</span>
                                {isSelected && <CheckCircle className="w-3 h-3 text-white" weight="bold" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons Row */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {mode === 'create' ? (
                  <>
                    <button
                      onClick={() => handleCreate(true)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px"
                    >
                      <Play className="w-3.5 h-3.5 text-white" weight="fill" />
                      <span>{isSubmitting ? '正在创建并部署...' : '创建并立即部署'}</span>
                    </button>

                    <button
                      onClick={() => handleCreate(false)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>保存草稿</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Dokploy Action Buttons */}
                    <button
                      onClick={() => app && onDeploy(app.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px"
                    >
                      <Play className="w-3.5 h-3.5 text-white" weight="fill" />
                      <span>部署应用</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFreshVolumesModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle"
                    >
                      <Database className="w-3.5 h-3.5 text-accent" />
                      <span>清空卷重部署</span>
                    </button>

                    <button
                      onClick={() => app && onRebuild(app.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle"
                    >
                      <ArrowsClockwise className="w-3.5 h-3.5 text-ink-muted" />
                      <span>重建服务</span>
                    </button>

                    <button
                      onClick={() => app && onStop(app.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 dark:hover:bg-rose-900/50 text-xs font-medium rounded-lg transition-colors shadow-subtle"
                    >
                      <Stop className="w-3.5 h-3.5" />
                      <span>停止运行</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('deployments')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg transition-colors shadow-subtle"
                    >
                      <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                      <span>查看日志</span>
                    </button>
                  </>
                )}
              </div>

              {/* Autodeploy Switch Toggle */}
              <div className="flex items-center gap-3 bg-paper-3/60 px-3 py-1.5 rounded-lg border border-line">
                <label
                  htmlFor="autodeployToggle"
                  className="text-xs font-medium text-ink flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <span>自动部署</span>
                  <span className="text-[10px] text-ink-faint">(镜像自动巡检更新)</span>
                </label>
                <button
                  type="button"
                  id="autodeployToggle"
                  role="switch"
                  aria-checked={autoUpdate}
                  onClick={() => setAutoUpdate(!autoUpdate)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoUpdate ? 'bg-accent' : 'bg-paper-4'
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

            {/* In Edit Mode: External Access Status Bar */}
            {mode === 'edit' && app && (
              <div className="mt-4 pt-3.5 border-t border-line/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  <span className="text-ink-muted">外部公网路由:</span>
                  {appDomains.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://${appDomains[0].domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-accent hover:underline flex items-center gap-1"
                      >
                        <span>https://{appDomains[0].domain}</span>
                        <ArrowSquareOut className="w-3 h-3" />
                      </a>
                      {appDomains.length > 1 && (
                        <span className="text-ink-faint">等 {appDomains.length} 个域名</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-ink-faint">暂未绑定公网域名</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openAddDomainModal}
                    className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-accent/10 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" weight="bold" />
                    <span>绑定新域名</span>
                  </button>
                  {appDomains.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('domains')}
                      className="text-xs text-ink-muted hover:text-ink px-2.5 py-1 rounded-md hover:bg-paper-3 transition-colors cursor-pointer"
                    >
                      管理域名 ({appDomains.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: COMPOSE FILE (Dokploy Code Editor with Line Numbers) */}
          <div className="card-vessel p-6 sm:p-7 shadow-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/60">
              <div>
                <h3 className="font-semibold text-base text-ink tracking-tight">Compose 编排文件 (YAML)</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  声明式管理容器镜像、网络、环境变量与持久化数据卷挂载
                </p>
              </div>

              {/* Status & Copy controls */}
              <div className="flex items-center gap-2.5">
                {/* YAML Validation Indicator */}
                {!composeYaml.trim() ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-paper-3 text-ink-muted border border-line rounded-full font-medium">
                    待填写编排配置
                  </span>
                ) : yamlValidation.valid ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-full font-medium">
                    <Check className="w-3 h-3 text-emerald-500" />
                    YAML 语法有效
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 rounded-full truncate max-w-xs font-medium cursor-help"
                    data-tooltip={yamlValidation.error || ''}
                  >
                    <Warning className="w-3 h-3 text-rose-500" />
                    语法错误: {yamlValidation.error}
                  </span>
                )}

                {/* Preview Compose Button */}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs text-ink-muted hover:text-ink bg-paper-2 hover:bg-paper-3 border border-line rounded-lg transition-colors shadow-subtle"
                >
                  <GitBranch className="w-3.5 h-3.5 text-accent" />
                  <span>预览配置</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyYaml}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-ink-muted hover:text-ink bg-paper-2 hover:bg-paper-3 border border-line rounded-lg transition-colors shadow-subtle"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedYaml ? '已复制' : '复制配置'}</span>
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

            {/* Card Footer: Save Button */}
            <div className="mt-4 pt-4 flex items-center justify-between border-t border-line/60">
              <span className="text-xs text-ink-faint">
                Tab 键自动补全 2 格缩进 · 支持 docker compose v2 标准语法
              </span>

              <div className="flex items-center gap-2">
                {mode === 'create' ? (
                  <>
                    <button
                      onClick={onBack}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleCreate(false)}
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-paper-2 hover:bg-paper-3 text-ink font-medium text-xs rounded-lg border border-line transition-all shadow-subtle active:translate-y-px"
                    >
                      {isSubmitting ? '保存中...' : '保存应用'}
                    </button>
                    <button
                      onClick={() => handleCreate(true)}
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px"
                    >
                      {isSubmitting ? '部署中...' : '创建并部署'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleSaveApp}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-6 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>已保存！</span>
                      </>
                    ) : (
                      <span>{isSubmitting ? '正在保存...' : '保存配置'}</span>
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
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">环境变量 (.env)</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                为此 Docker Compose 服务配置专用的环境变量参数
              </p>
            </div>
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted font-medium border border-line">
              .env 格式
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

          <div className="pt-4 border-t border-line/60 flex justify-end">
            {mode === 'edit' ? (
              <button
                onClick={handleSaveApp}
                disabled={isSubmitting}
                className="px-6 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px"
              >
                {saveSuccess ? '已保存！' : '保存环境变量'}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('general')}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle"
              >
                返回基础编排
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 3: TEMPLATES (CREATE MODE) ================= */}
      {activeTab === 'templates' && (
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-4">
          <div className="pb-3 border-b border-line/60">
            <h3 className="font-semibold text-base text-ink tracking-tight">官方预置模板库</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              点击任意模板，即刻导入经过安全生产验证的标准 Docker Compose 编排规则及配置。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((tmpl) => (
              <div
                key={tmpl.name}
                className="p-5 rounded-xl border border-line bg-paper hover:border-accent/40 hover:bg-paper-2 transition-all flex flex-col justify-between shadow-subtle hover:shadow-card"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-ink">{tmpl.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-line">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-2.5 line-clamp-3 leading-relaxed">{tmpl.description}</p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-line/60 flex items-center justify-end">
                  <button
                    onClick={() => {
                      handleSelectTemplate(tmpl);
                      setActiveTab('general');
                    }}
                    className="px-3 py-1.5 bg-accent text-white font-medium text-xs rounded-lg hover:bg-accent-hover transition-colors shadow-subtle"
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
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">部署构建与实时日志</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                WebSocket 实时管道对接 Docker Compose 部署构建与容器标准输出
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onDeploy(app.id)}
                className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg flex items-center gap-1.5 shadow-subtle"
              >
                <Play className="w-3.5 h-3.5" weight="fill" />
                <span>立即部署</span>
              </button>
              <button
                onClick={() => onRebuild(app.id)}
                className="px-3.5 py-1.5 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line flex items-center gap-1.5 shadow-subtle"
              >
                <ArrowsClockwise className="w-3.5 h-3.5" />
                <span>重建</span>
              </button>
            </div>
          </div>

          {/* Terminal Screen */}
          <div className="bg-paper dark:bg-zinc-950 border border-line rounded-xl p-4 sm:p-5 font-mono text-xs text-ink dark:text-emerald-400 h-96 overflow-y-auto space-y-1 select-text shadow-subtle">
            <div className="text-ink-faint dark:text-zinc-500 pb-2.5 border-b border-line dark:border-zinc-800 flex items-center justify-between">
              <span>── Vessel 部署实时日志流 [{app.id}] ──</span>
              <span className="text-[10px] text-ink-faint dark:text-zinc-500">自动滚屏</span>
            </div>

            {appLogs.length === 0 ? (
              <div className="text-ink-faint dark:text-zinc-500 py-16 text-center">
                暂无部署输出。点击上方「立即部署」或「重建」查看实时日志流。
              </div>
            ) : (
              appLogs.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed text-emerald-700 dark:text-emerald-400">
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
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-4">
          <div className="pb-3 border-b border-line/60">
            <h3 className="font-semibold text-base text-ink tracking-tight">活跃容器实例</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              此 Compose 应用栈下所挂载的 Docker 容器实例状态与端口映射
            </p>
          </div>

          {(app.containers || []).length === 0 ? (
            <div className="py-12 text-center text-ink-muted text-xs">
              暂未检测到运行中的容器实例。请点击上方「部署应用」启动应用编排。
            </div>
          ) : (
            <div className="divide-y divide-line">
              {app.containers.map((c) => (
                <div key={c.id} className="py-3.5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-medium text-sm text-ink">{c.name}</span>
                      <Badge variant={c.state === 'running' ? 'running' : 'stopped'}>
                        {c.state}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-muted">
                      镜像: {c.image} · 容器 ID: {c.id.slice(0, 12)}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-ink-muted">
                      {c.ports?.length ? c.ports.join(', ') : '无直接对外映射端口'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB CONTENT 6: DOMAINS (CREATE & EDIT MODES) ================= */}
      {activeTab === 'domains' && mode === 'create' && (
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">部署时域名绑定</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                在创建并部署此应用的同时，自动为 Caddy 注册反向代理路由并申请免费自动续订 SSL 证书
              </p>
            </div>
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-line">
              Caddy 自动化 HTTPS
            </span>
          </div>

          <div className="p-4 bg-paper-2 rounded-xl border border-line space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-emerald-500" />
                <div>
                  <h4 className="text-xs font-semibold text-ink">部署时自动绑定公网域名</h4>
                  <p className="text-[11px] text-ink-muted">
                    勾选后在部署启动时一键下发 Caddyfile 路由规则，无需部署后再次手动配置
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={bindDomainOnDeploy}
                onClick={() => setBindDomainOnDeploy(!bindDomainOnDeploy)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  bindDomainOnDeploy ? 'bg-accent' : 'bg-paper-4'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    bindDomainOnDeploy ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {bindDomainOnDeploy && (
              <div className="pt-3 border-t border-line/60 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-ink flex items-center gap-1">
                      <span>绑定公网域名 (FQDN)</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-ink-faint">部署时自动下发至 Caddyfile</span>
                  </div>

                  <div className="flex items-stretch rounded-xl border border-line bg-paper shadow-subtle focus-within:border-accent transition-colors overflow-hidden group">
                    <div className="bg-paper-2 border-r border-line px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none group-focus-within:text-accent transition-colors">
                      <LockKey className="w-3.5 h-3.5" weight="bold" />
                      <span>https://</span>
                    </div>
                    <input
                      type="text"
                      value={deployDomain}
                      onChange={(e) => {
                        let val = e.target.value.trim();
                        val = val.replace(/^https?:\/\//i, '');
                        setDeployDomain(val);
                      }}
                      placeholder="n8n.yourdomain.com"
                      className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-ink font-mono placeholder:text-ink-faint focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" weight="fill" />
                  <div>
                    提示：请确保已在域名解析商处添加该域名的 <strong className="text-ink font-semibold">A / AAAA 记录</strong> 并指向本机公网 IP。
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      反向代理目标服务 <span className="text-rose-500">*</span>
                    </label>
                    {detectedServices.length > 0 ? (
                      <CustomSelect
                        value={deployServiceName}
                        onChange={(val) => {
                          setDeployServiceName(val);
                          const s = detectedServices.find((ds) => ds.name === val);
                          if (s && s.ports.length > 0) {
                            setDeployTargetPort(String(s.ports[0]));
                          }
                        }}
                        options={detectedServices.map((s) => ({
                          value: s.name,
                          label: s.name,
                          badge: 'Compose 服务',
                          description: s.ports.length > 0 ? `检测端口: ${s.ports.join(', ')}` : undefined,
                        }))}
                        placeholder="选择目标服务..."
                      />
                    ) : (
                      <input
                        type="text"
                        value={deployServiceName}
                        onChange={(e) => setDeployServiceName(e.target.value)}
                        placeholder="web"
                        className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink focus:border-accent focus:outline-none shadow-subtle transition-colors"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      目标端口 (上游端口) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={deployTargetPort}
                      onChange={(e) => setDeployTargetPort(e.target.value)}
                      placeholder="5678"
                      className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono font-medium focus:border-accent focus:outline-none shadow-subtle transition-colors"
                    />
                  </div>
                </div>

                {detectedServices.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-ink-faint flex items-center gap-1 mr-1">
                      <Lightning className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                      检测端口快捷填入:
                    </span>
                    {detectedServices.flatMap((s) =>
                      s.ports.map((p) => {
                        const isSelected = deployServiceName === s.name && deployTargetPort === String(p);
                        return (
                          <button
                            key={`${s.name}-${p}`}
                            type="button"
                            onClick={() => {
                              setDeployServiceName(s.name);
                              setDeployTargetPort(String(p));
                            }}
                            className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-accent text-white border-accent shadow-subtle font-semibold'
                                : 'bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink border-line'
                            }`}
                          >
                            <span>{s.name}:{p}</span>
                            {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" weight="bold" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-ink mb-2">
                    反向代理目标网络
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDeployTargetType('internal')}
                      className={`p-3.5 text-left rounded-xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                        deployTargetType === 'internal'
                          ? 'border-accent bg-accent/5 shadow-subtle'
                          : 'border-line bg-paper hover:bg-paper-2'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className={`w-4 h-4 ${deployTargetType === 'internal' ? 'text-accent' : 'text-emerald-500'}`} weight="bold" />
                            <span className="text-xs font-semibold text-ink">容器内部网络</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">推荐</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${deployTargetType === 'internal' ? 'border-accent bg-accent' : 'border-line bg-paper'}`}>
                            {deployTargetType === 'internal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed">
                          基于 Docker 内部服务网络互通，容器端口无需向宿主机暴露更安全
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeployTargetType('host')}
                      className={`p-3.5 text-left rounded-xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                        deployTargetType === 'host'
                          ? 'border-accent bg-accent/5 shadow-subtle'
                          : 'border-line bg-paper hover:bg-paper-2'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <HardDrives className={`w-4 h-4 ${deployTargetType === 'host' ? 'text-accent' : 'text-ink-muted'}`} weight="bold" />
                            <span className="text-xs font-semibold text-ink">宿主机端口</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${deployTargetType === 'host' ? 'border-accent bg-accent' : 'border-line bg-paper'}`}>
                            {deployTargetType === 'host' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-ink-muted leading-relaxed">
                          代理至主机映射的 localhost 端口，适合本机网络直通场景
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-line/60 flex items-center justify-between">
            <button
              onClick={() => setActiveTab('general')}
              className="text-xs text-ink-muted hover:text-ink"
            >
              返回基础编排
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCreate(false)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 border border-line text-ink text-xs font-medium rounded-lg shadow-subtle"
              >
                保存草稿
              </button>
              <button
                onClick={() => handleCreate(true)}
                disabled={isSubmitting}
                className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg shadow-subtle flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 text-white" weight="fill" />
                <span>{isSubmitting ? '正在创建并部署...' : '创建并立即部署'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 6: DOMAINS (EDIT MODE) ================= */}
      {activeTab === 'domains' && mode === 'edit' && app && (
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">Caddy 域名路由绑定</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                为此应用栈配置的反向代理公网域名及 Let's Encrypt / ZeroSSL 自动化证书
              </p>
            </div>

            <Button8State
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" weight="bold" />}
              onClick={openAddDomainModal}
            >
              绑定新域名
            </Button8State>
          </div>

          {appDomains.length === 0 ? (
            <div className="py-14 px-6 text-center border border-dashed border-line/80 rounded-xl bg-paper/50 flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shadow-subtle">
                <Globe className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md">
                <h4 className="text-sm font-semibold text-ink">该应用尚未绑定自定义公网域名</h4>
                <p className="text-xs text-ink-muted leading-relaxed">
                  可直接在此为本应用添加公网域名。Vessel 内置 Caddy 将自动向证书机构签发 SSL/TLS 证书，并在到期前 30 天静默自动续期。
                </p>
              </div>
              <button
                type="button"
                onClick={openAddDomainModal}
                className="mt-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 shadow-subtle transition-all active:translate-y-px"
              >
                <Plus className="w-3.5 h-3.5" weight="bold" />
                <span>立即为此应用绑定域名</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appDomains.map((dom) => (
                <div
                  key={dom.id}
                  className="p-4 sm:p-5 rounded-xl border border-line bg-paper hover:border-line-focus hover:shadow-subtle transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <LockKey className="w-4 h-4" weight="bold" />
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://${dom.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-base text-ink hover:text-accent flex items-center gap-1.5 transition-colors group"
                        >
                          <span>https://{dom.domain}</span>
                          <ArrowSquareOut className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent transition-colors" />
                        </a>
                        <Badge variant={dom.sslStatus}>
                          {dom.sslStatus === 'active' ? 'HTTPS 活跃' : dom.sslStatus}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted pl-11">
                      <span className="flex items-center gap-1.5">
                        <span>上游目标:</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60 shadow-subtle">
                          {dom.targetType === 'internal'
                            ? `${dom.serviceName}:${dom.targetPort} (容器内部)`
                            : `127.0.0.1:${dom.targetPort} (宿主机)`}
                        </span>
                      </span>
                      <span>证书颁发机构: <strong className="text-ink font-medium">{dom.sslIssuer}</strong></span>
                      {dom.sslExpiresAt && <span>证书到期: <span className="font-mono">{dom.sslExpiresAt}</span></span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center self-end pl-11 sm:pl-0">
                    {onRenewDomain && (
                      <button
                        onClick={async () => {
                          toast.info(`正在检测并续订域名 ${dom.domain} 证书...`);
                          try {
                            await onRenewDomain(dom.id);
                            toast.success(`域名 ${dom.domain} 证书检测完成`);
                          } catch (e: any) {
                            toast.error(`检测续订失败: ${e.message}`);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-2 border border-line text-xs font-medium flex items-center gap-1.5 transition-colors shadow-subtle cursor-pointer"
                        data-tooltip="检测/续订证书"
                      >
                        <ArrowsClockwise className="w-3.5 h-3.5" />
                        <span>检测续订</span>
                      </button>
                    )}

                    {onDeleteDomain && (
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: '⚠️ 确认解除域名绑定',
                            subtitle: `域名: ${dom.domain}`,
                            dangerTitle: '解除绑定将立即移除反代路由',
                            message: `确定要从当前应用解绑域名 "${dom.domain}" 吗？解绑后 Caddy 反向代理将不再路由该域名的流量。`,
                            confirmText: '确认解除绑定',
                            cancelText: '取消',
                            variant: 'danger',
                          });
                          if (ok) {
                            try {
                              await onDeleteDomain(dom.id);
                              toast.success(`域名 ${dom.domain} 已成功解绑`);
                            } catch (e: any) {
                              toast.error(`解绑失败: ${e.message}`);
                            }
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-line transition-colors cursor-pointer"
                        data-tooltip="解除绑定"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB CONTENT 7: BACKUPS (EDIT MODE) ================= */}
      {activeTab === 'backups' && mode === 'edit' && app && (
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line/60">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">Cloudflare R2 灾备记录</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                此应用对应的数据卷与 Compose 编排快照备份存档
              </p>
            </div>

            <button
              onClick={() => onBackup(app.id)}
              className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-subtle"
            >
              <CloudArrowUp className="w-4 h-4 text-white" />
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
                <div key={b.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-ink">{b.fileName}</span>
                    <p className="text-xs text-ink-muted mt-0.5">
                      大小: {(b.fileSizeBytes / 1024 / 1024).toFixed(2)} MB · 时间: {b.createdAt}
                    </p>
                  </div>
                  <Badge variant="connected">{b.status}</Badge>
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
        <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-6">
          <div className="pb-3 border-b border-line/60">
            <h3 className="font-semibold text-base text-ink tracking-tight">高级设置</h3>
            <p className="text-xs text-ink-muted mt-0.5">系统底层元数据与生命周期安全管理</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-paper-3/50 border border-line">
              <span className="text-ink-muted">应用唯一标识 (UUID):</span>
              <span className="text-ink font-medium">{app?.id || '未生成 (创建后确定)'}</span>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-paper-3/50 border border-line">
              <span className="text-ink-muted">创建时间:</span>
              <span className="text-ink font-medium">{app?.createdAt || new Date().toISOString()}</span>
            </div>
          </div>

          {mode === 'edit' && app && (
            <div className="mt-6 p-5 rounded-xl border border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20">
              <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">危险操作区域</h4>
              <p className="text-xs text-rose-600/90 dark:text-rose-300/80 mt-1">
                彻底删除此 Docker Compose 应用栈。这将停止相关容器、清理本地配置文件，不可恢复。
              </p>
              <div className="mt-3.5">
                <button
                  onClick={handleDeleteAppClick}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border dark:border-rose-800 text-xs font-medium rounded-lg flex items-center gap-1.5 shadow-subtle transition-colors"
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
            <div className="p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 text-xs">
              <span className="font-bold">无法解析 YAML 内容:</span>
              <p className="mt-1 font-mono">{yamlValidation.error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-ink-muted flex items-center justify-between">
                <span>解析服务数量: {Object.keys(yamlValidation.parsed?.services || {}).length} 个</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">YAML 校验有效</span>
              </div>

              <div className="space-y-2.5">
                {Object.entries(yamlValidation.parsed?.services || {}).map(
                  ([sName, sCfg]: [string, any]) => (
                    <div
                      key={sName}
                      className="p-4 rounded-xl bg-paper-2 border border-line text-xs space-y-1.5 shadow-subtle"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent">{sName}</span>
                        <span className="text-[11px] text-ink-faint">
                          重启策略: {sCfg.restart || 'no'}
                        </span>
                      </div>
                      <div className="text-ink-muted">
                        镜像: <span className="text-ink">{sCfg.image || 'build/custom'}</span>
                      </div>
                      {sCfg.ports && (
                        <div className="text-ink-muted">
                          端口映射: <span className="text-accent">{JSON.stringify(sCfg.ports)}</span>
                        </div>
                      )}
                      {sCfg.volumes && (
                        <div className="text-ink-muted">
                          数据卷: <span className="text-ink-faint">{JSON.stringify(sCfg.volumes)}</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-line flex justify-end">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle transition-colors"
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
          <div className="p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-300">
              <Warning className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" weight="fill" />
              <span>数据卷内所有数据将彻底清空且无法撤回！</span>
            </div>
            <p className="leading-relaxed">
              此操作将执行 <code className="font-mono bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded text-rose-900 dark:text-white font-semibold">docker compose down -v</code>。
              所有挂载在该应用下的<strong>持久化数据卷（Volumes）将被彻底销毁</strong>，包括数据库中所有数据表记录、用户上传的本地持久文件等，随后以<strong>全新空白初始状态</strong>重新创建容器。
            </p>
          </div>

          <div className="p-4 rounded-xl bg-paper-2 border border-line text-xs space-y-2 shadow-subtle">
            <div className="font-semibold text-ink">影响范围确认：</div>
            <ul className="space-y-1.5 text-ink-muted list-disc list-inside">
              <li>
                <span className="text-rose-600 dark:text-rose-400 font-medium">永久抹除</span>：数据库表数据、本地挂载持久卷所有文件
              </li>
              <li>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">保留不变</span>：当前 compose 编排文件、.env 环境变量、Caddy 域名绑定
              </li>
              <li>
                <span className="text-accent font-medium">执行流程</span>：重置数据卷后自动执行全新的镜像拉取与启动构建
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsFreshVolumesModalOpen(false)}
              className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle transition-colors"
            >
              取消并返回
            </button>
            <button
              type="button"
              onClick={handleConfirmFreshVolumes}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-200 dark:border dark:border-rose-800 font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px flex items-center gap-2"
            >
              <Database className="w-4 h-4 text-white" />
              <span>确认彻底清空并重新部署</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* ================= BIND DOMAIN MODAL ================= */}
      <Modal
        isOpen={isAddDomainModalOpen}
        onClose={() => setIsAddDomainModalOpen(false)}
        title="绑定公网域名与 SSL 路由"
        subtitle={`受管服务: ${app?.name || name || '当前应用'}`}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleModalBindDomain} className="space-y-5">
          {/* Domain Input with Addon */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink flex items-center gap-1">
                <span>公网域名 (FQDN)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-ink-faint">支持一级主域名或子域名</span>
            </div>

            <div className="flex items-stretch rounded-xl border border-line bg-paper shadow-subtle focus-within:border-accent transition-colors overflow-hidden group">
              <div className="bg-paper-2 border-r border-line px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none group-focus-within:text-accent transition-colors">
                <LockKey className="w-3.5 h-3.5" weight="bold" />
                <span>https://</span>
              </div>
              <input
                type="text"
                required
                value={modalDomain}
                onChange={(e) => {
                  let val = e.target.value.trim();
                  val = val.replace(/^https?:\/\//i, '');
                  setModalDomain(val);
                }}
                placeholder="n8n.yourdomain.com"
                className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-ink font-mono placeholder:text-ink-faint focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* DNS Guidance Banner */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" weight="fill" />
            <div>
              请确保已将该域名的 DNS <strong className="text-ink font-semibold">A / AAAA 记录</strong> 解析至当前服务器公网 IP。绑定后 Caddy 将在后台全自动通过 ACME 协议向 Let's Encrypt / ZeroSSL 申请并续订 TLS 证书。
            </div>
          </div>

          {/* Service & Port Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                目标服务名 <span className="text-rose-500">*</span>
              </label>
              {detectedServices.length > 0 ? (
                <CustomSelect
                  value={modalServiceName}
                  onChange={(val) => {
                    setModalServiceName(val);
                    const s = detectedServices.find((ds) => ds.name === val);
                    if (s && s.ports.length > 0) {
                      setModalTargetPort(String(s.ports[0]));
                    }
                  }}
                  options={detectedServices.map((s) => ({
                    value: s.name,
                    label: s.name,
                    badge: 'Compose 服务',
                    description: s.ports.length > 0 ? `检测端口: ${s.ports.join(', ')}` : undefined,
                  }))}
                  placeholder="选择目标服务..."
                />
              ) : (
                <input
                  type="text"
                  required
                  value={modalServiceName}
                  onChange={(e) => setModalServiceName(e.target.value)}
                  placeholder="web"
                  className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink focus:border-accent focus:outline-none shadow-subtle transition-colors"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                目标端口 (上游端口) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                value={modalTargetPort}
                onChange={(e) => setModalTargetPort(e.target.value)}
                placeholder="5678"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono font-medium focus:border-accent focus:outline-none shadow-subtle transition-colors"
              />
            </div>
          </div>

          {/* Quick Select Pill Buttons */}
          {detectedServices.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-ink-faint flex items-center gap-1 mr-1">
                <Lightning className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                快速填入检测端口:
              </span>
              {detectedServices.flatMap((s) =>
                s.ports.map((p) => {
                  const isSelected = modalServiceName === s.name && modalTargetPort === String(p);
                  return (
                    <button
                      key={`${s.name}-${p}`}
                      type="button"
                      onClick={() => {
                        setModalServiceName(s.name);
                        setModalTargetPort(String(p));
                      }}
                      className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-accent text-white border-accent shadow-subtle font-semibold'
                          : 'bg-paper-2 hover:bg-paper-3 text-ink-muted hover:text-ink border-line'
                      }`}
                    >
                      <span>{s.name}:{p}</span>
                      {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" weight="bold" />}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Target Network Mode Radio Cards */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-2">
              反向代理目标网络
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModalTargetType('internal')}
                className={`p-3.5 text-left rounded-xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                  modalTargetType === 'internal'
                    ? 'border-accent bg-accent/5 shadow-subtle'
                    : 'border-line bg-paper hover:bg-paper-2'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className={`w-4 h-4 ${modalTargetType === 'internal' ? 'text-accent' : 'text-emerald-500'}`} weight="bold" />
                      <span className="text-xs font-semibold text-ink">容器内部网络</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">推荐</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${modalTargetType === 'internal' ? 'border-accent bg-accent' : 'border-line bg-paper'}`}>
                      {modalTargetType === 'internal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    直通容器服务内网通信，无需向宿主机暴露端口，网络暴露面最小更安全
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModalTargetType('host')}
                className={`p-3.5 text-left rounded-xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                  modalTargetType === 'host'
                    ? 'border-accent bg-accent/5 shadow-subtle'
                    : 'border-line bg-paper hover:bg-paper-2'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <HardDrives className={`w-4 h-4 ${modalTargetType === 'host' ? 'text-accent' : 'text-ink-muted'}`} weight="bold" />
                      <span className="text-xs font-semibold text-ink">宿主机端口</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${modalTargetType === 'host' ? 'border-accent bg-accent' : 'border-line bg-paper'}`}>
                      {modalTargetType === 'host' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    反向代理至主机 127.0.0.1 映射端口，适合需要本地端口调试的场景
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddDomainModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink bg-paper-2 hover:bg-paper-3 border border-line rounded-lg transition-colors shadow-subtle"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isBindingDomain}
              className="px-5 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-lg shadow-subtle transition-all flex items-center gap-2 active:translate-y-px"
            >
              <ShieldCheck className="w-4 h-4" weight="bold" />
              <span>{isBindingDomain ? '正在配置 Caddy...' : '确认绑定并自动签发证书'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
