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
  CaretDown,
  CircleNotch,
  DownloadSimple,
  ArrowCounterClockwise,
  EyeSlash,
  Key,
} from '@phosphor-icons/react';
import { AppItem, ComposeTemplate, DomainItem, BackupRecord } from '../../types/index.js';
import { DATABASE_OPTIONS } from '../common/CreateDatabaseModal.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { CodeEditorWithLines } from '../common/CodeEditorWithLines.js';
import { Modal } from '../common/Modal.js';
import { DatabaseTerminalModal } from '../common/DatabaseTerminalModal.js';
import { CreateDatabaseBackupModal } from '../common/CreateDatabaseBackupModal.js';
import { CustomSelect } from '../common/CustomSelect.js';
import { LogsPanel } from './LogsPanel.js';
import { useNotification } from '../../context/NotificationContext.js';
import { formatBytes } from '../../utils/format.js';

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
  onBackup: (id: string, options?: { databaseName?: string }) => Promise<any>;
  onDownloadBackup?: (id: string, fileName: string) => void;
  onRestoreBackup?: (id: string) => Promise<any>;
  onDeleteBackup?: (id: string) => Promise<any>;
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
  onDownloadBackup,
  onRestoreBackup,
  onDeleteBackup,
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
    | 'advanced'
    | 'monitoring';

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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedUUID, setCopiedUUID] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Delete App Modal state (Strict 2-step confirmation)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Backup Tab states & handlers
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<BackupRecord | null>(null);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [deletingBackup, setDeletingBackup] = useState<BackupRecord | null>(null);
  const [isDeletingBackup, setIsDeletingBackup] = useState(false);

  // Database credentials parsed from envContent for managed database apps
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showDbRootPassword, setShowDbRootPassword] = useState(false);
  const [showDbInternalUrl, setShowDbInternalUrl] = useState(false);
  const [showDbExternalUrl, setShowDbExternalUrl] = useState(false);
  const [showDbInternalRootUrl, setShowDbInternalRootUrl] = useState(false);
  const [showDbExternalRootUrl, setShowDbExternalRootUrl] = useState(false);
  const [externalPortInput, setExternalPortInput] = useState('');
  const [isSavingExternalPort, setIsSavingExternalPort] = useState(false);
  const [copiedDbField, setCopiedDbField] = useState<string | null>(null);
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [showDbBackupModal, setShowDbBackupModal] = useState(false);

  const handleCopyDbField = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedDbField(fieldKey);
    setTimeout(() => setCopiedDbField(null), 2000);
  };

  const isDb = useMemo(() => {
    if (!app && mode === 'edit') return false;
    const desc = app?.description || '';
    const yaml = app?.composeYaml || composeYaml || '';
    const n = (app?.name || name || '').toLowerCase();
    return (
      desc.includes('Database') ||
      yaml.includes('services:\n  database:') ||
      yaml.includes('services:\r\n  database:') ||
      n.endsWith('-db') ||
      n.startsWith('postgres') ||
      n.startsWith('mysql') ||
      n.startsWith('mariadb') ||
      n.startsWith('mongo') ||
      n.startsWith('redis') ||
      n.startsWith('libsql')
    );
  }, [app, mode, composeYaml, name]);

  const dbInfo = useMemo(() => {
    if (!isDb) return null;

    const envMap: Record<string, string> = {};
    (envContent || app?.envContent || '').split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          envMap[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
        }
      }
    });

    let engine: 'PostgreSQL' | 'MongoDB' | 'MariaDB' | 'MySQL' | 'Redis' | 'libSQL' | 'Database' = 'Database';
    const desc = app?.description || '';
    const yaml = app?.composeYaml || composeYaml || '';
    const n = (app?.name || name || '').toLowerCase();

    if (desc.includes('PostgreSQL') || /postgres/i.test(yaml) || n.includes('postgres') || envMap.POSTGRES_DB || envMap.POSTGRES_PASSWORD) {
      engine = 'PostgreSQL';
    } else if (desc.includes('MongoDB') || /mongo/i.test(yaml) || n.includes('mongo') || envMap.MONGO_INITDB_ROOT_PASSWORD || envMap.MONGO_INITDB_DATABASE) {
      engine = 'MongoDB';
    } else if (desc.includes('MariaDB') || /mariadb/i.test(yaml) || n.includes('mariadb') || envMap.MARIADB_ROOT_PASSWORD || envMap.MARIADB_DATABASE) {
      engine = 'MariaDB';
    } else if (desc.includes('MySQL') || /mysql/i.test(yaml) || n.includes('mysql') || envMap.MYSQL_ROOT_PASSWORD || envMap.MYSQL_DATABASE) {
      engine = 'MySQL';
    } else if (desc.includes('Redis') || /redis/i.test(yaml) || n.includes('redis') || envMap.REDIS_PASSWORD) {
      engine = 'Redis';
    } else if (desc.includes('libSQL') || /libsql|sqld/i.test(yaml) || n.includes('libsql') || envMap.SQLD_AUTH_TOKEN) {
      engine = 'libSQL';
    }

    const dbName = envMap.POSTGRES_DB || envMap.MYSQL_DATABASE || envMap.MARIADB_DATABASE || envMap.MONGO_INITDB_DATABASE || '';
    const user = envMap.POSTGRES_USER || envMap.MYSQL_USER || envMap.MARIADB_USER || envMap.MONGO_INITDB_ROOT_USERNAME || '';
    const password = envMap.POSTGRES_PASSWORD || envMap.MYSQL_PASSWORD || envMap.MARIADB_PASSWORD || envMap.MONGO_INITDB_ROOT_PASSWORD || envMap.REDIS_PASSWORD || envMap.SQLD_AUTH_TOKEN || '';
    const rootPassword = envMap.MYSQL_ROOT_PASSWORD || envMap.MARIADB_ROOT_PASSWORD || '';
    const port = envMap.POSTGRES_PORT || envMap.MYSQL_PORT || envMap.MARIADB_PORT || envMap.MONGO_PORT || envMap.REDIS_PORT || envMap.LIBSQL_PORT || (
      engine === 'PostgreSQL' ? '5432' :
      engine === 'MySQL' || engine === 'MariaDB' ? '3306' :
      engine === 'MongoDB' ? '27017' :
      engine === 'Redis' ? '6379' :
      engine === 'libSQL' ? '8080' : '5432'
    );

    // Detect external mapped port from composeYaml
    let detectedExternalPort = '';
    try {
      const parsed = YAML.parse(yaml);
      const srv = parsed?.services?.database || (parsed?.services && Object.values(parsed.services)[0]) as any;
      if (srv?.ports && Array.isArray(srv.ports) && srv.ports.length > 0) {
        const rawPort = String(srv.ports[0]);
        if (rawPort.includes(':')) {
          const parts = rawPort.split(':');
          let hostPart = parts[parts.length - 2]?.trim();
          if (hostPart.startsWith('${') && hostPart.endsWith('}')) {
            const varName = hostPart.slice(2, -1);
            detectedExternalPort = envMap[varName] || '';
          } else {
            detectedExternalPort = hostPart || '';
          }
        } else {
          detectedExternalPort = rawPort;
        }
      }
    } catch {
      const portMatch = yaml.match(/ports:\s*\n\s*-\s*["']?(\d+|\$\{[^}]+\}):(\d+)/);
      if (portMatch) {
        const hostPart = portMatch[1];
        if (hostPart.startsWith('${') && hostPart.endsWith('}')) {
          detectedExternalPort = envMap[hostPart.slice(2, -1)] || '';
        } else {
          detectedExternalPort = hostPart;
        }
      }
    }

    const internalHost = 'database';

    let internalUrl = envMap.INTERNAL_DATABASE_URL || envMap.INTERNAL_MONGO_URL || envMap.INTERNAL_REDIS_URL || envMap.INTERNAL_LIBSQL_URL || '';
    if (!internalUrl) {
      if (engine === 'PostgreSQL') internalUrl = `postgresql://${user || 'postgres'}:${password}@${internalHost}:${port}/${dbName || 'postgres'}`;
      else if (engine === 'MySQL' || engine === 'MariaDB') internalUrl = `mysql://${user || 'root'}:${password}@${internalHost}:${port}/${dbName || 'app_db'}`;
      else if (engine === 'MongoDB') internalUrl = `mongodb://${user || 'mongo'}:${password}@${internalHost}:${port}/${dbName || 'app_db'}?authSource=admin`;
      else if (engine === 'Redis') internalUrl = `redis://default:${password}@${internalHost}:${port}`;
      else if (engine === 'libSQL') internalUrl = `http://${internalHost}:${port}`;
    }

    const internalRootUrl = envMap.INTERNAL_DATABASE_ROOT_URL || (rootPassword ? `mysql://root:${rootPassword}@${internalHost}:${port}/${dbName || 'app_db'}` : '');

    let externalUrl = '';
    let rootUrl = '';
    if (detectedExternalPort) {
      externalUrl = envMap.DATABASE_URL || envMap.MONGO_URL || envMap.REDIS_URL || envMap.LIBSQL_URL || '';
      if (!externalUrl) {
        if (engine === 'PostgreSQL') externalUrl = `postgresql://${user || 'postgres'}:${password}@localhost:${detectedExternalPort}/${dbName || 'postgres'}`;
        else if (engine === 'MySQL' || engine === 'MariaDB') externalUrl = `mysql://${user || 'root'}:${password}@localhost:${detectedExternalPort}/${dbName || 'app_db'}`;
        else if (engine === 'MongoDB') externalUrl = `mongodb://${user || 'mongo'}:${password}@localhost:${detectedExternalPort}/${dbName || 'app_db'}?authSource=admin`;
        else if (engine === 'Redis') externalUrl = `redis://default:${password}@localhost:${detectedExternalPort}`;
        else if (engine === 'libSQL') externalUrl = `http://localhost:${detectedExternalPort}`;
      }
      rootUrl = envMap.DATABASE_ROOT_URL || (rootPassword ? `mysql://root:${rootPassword}@localhost:${detectedExternalPort}/${dbName || 'app_db'}` : '');
    }

    return {
      engine,
      dbName,
      user,
      password,
      rootPassword,
      port,
      internalHost,
      detectedExternalPort,
      externalUrl,
      internalUrl,
      rootUrl,
      internalRootUrl,
    };
  }, [isDb, app, envContent, composeYaml, name]);

  useEffect(() => {
    if (dbInfo) {
      setExternalPortInput(dbInfo.detectedExternalPort || '');
    }
  }, [dbInfo?.detectedExternalPort]);

  const handleSaveExternalPort = async () => {
    if (!app) return;
    const trimmedPort = externalPortInput.trim();
    if (trimmedPort && !/^\d+$/.test(trimmedPort)) {
      toast.error('外部端口必须为有效数字端口 (1-65535)');
      return;
    }
    const portNum = trimmedPort ? parseInt(trimmedPort, 10) : 0;
    if (trimmedPort && (portNum < 1 || portNum > 65535)) {
      toast.error('外部端口必须在 1 到 65535 范围内');
      return;
    }

    setIsSavingExternalPort(true);
    try {
      const containerPort = dbInfo?.port || '5432';
      let newYaml = composeYaml || app.composeYaml || '';
      let newEnv = envContent || app.envContent || '';

      try {
        const doc = YAML.parseDocument(newYaml);
        const services = doc.get('services') as any;
        if (services) {
          const dbService = services.get('database') || (services.items && services.items[0]?.value);
          if (dbService) {
            if (trimmedPort) {
              dbService.set('ports', [`${trimmedPort}:${containerPort}`]);
            } else {
              dbService.delete('ports');
            }
            newYaml = doc.toString();
          }
        }
      } catch {
        if (trimmedPort) {
          if (/ports:\s*\n(\s*-\s*["']?[^\n]+["']?\s*\n?)+/m.test(newYaml)) {
            newYaml = newYaml.replace(/ports:\s*\n(\s*-\s*["']?[^\n]+["']?\s*\n?)+/m, `ports:\n      - "${trimmedPort}:${containerPort}"\n`);
          } else {
            newYaml = newYaml.replace(/(services:\s*\n\s*database:\s*\n)/, `$1    ports:\n      - "${trimmedPort}:${containerPort}"\n`);
          }
        } else {
          newYaml = newYaml.replace(/\n\s*ports:\s*\n(\s*-\s*["']?[^\n]+["']?\s*\n?)+/g, '\n');
        }
      }

      if (trimmedPort) {
        const portKey = dbInfo?.engine === 'PostgreSQL' ? 'POSTGRES_PORT'
          : dbInfo?.engine === 'MySQL' ? 'MYSQL_PORT'
          : dbInfo?.engine === 'MariaDB' ? 'MARIADB_PORT'
          : dbInfo?.engine === 'MongoDB' ? 'MONGO_PORT'
          : dbInfo?.engine === 'Redis' ? 'REDIS_PORT'
          : dbInfo?.engine === 'libSQL' ? 'LIBSQL_PORT' : 'DB_PORT';

        if (new RegExp(`^${portKey}=`, 'm').test(newEnv)) {
          newEnv = newEnv.replace(new RegExp(`^${portKey}=.*$`, 'm'), `${portKey}=${trimmedPort}`);
        } else {
          newEnv += `\n${portKey}=${trimmedPort}`;
        }
      }

      setComposeYaml(newYaml);
      setEnvContent(newEnv);

      await onUpdateApp(app.id, {
        composeYaml: newYaml,
        envContent: newEnv,
      });

      toast.success(trimmedPort ? `外部端口已设置为 ${trimmedPort}，正在重新部署...` : '外部网络连接已关闭，正在重新部署...');
      await onDeploy(app.id);
    } catch (err: any) {
      toast.error(`保存外部端口失败: ${err.message || '未知错误'}`);
    } finally {
      setIsSavingExternalPort(false);
    }
  };

  const dbOption = useMemo(() => {
    if (!isDb) return null;
    return DATABASE_OPTIONS.find(
      (opt) =>
        opt.label.toLowerCase() === dbInfo?.engine.toLowerCase() ||
        opt.type.toLowerCase() === dbInfo?.engine.toLowerCase() ||
        (app?.name || name || '').toLowerCase().includes(opt.type) ||
        (app?.description || '').toLowerCase().includes(opt.type)
    );
  }, [isDb, dbInfo, app, name]);

  const handleAppBackup = async () => {
    if (!app || isBackingUp) return;
    if (isDb) {
      setShowDbBackupModal(true);
      return;
    }
    setIsBackingUp(true);
    try {
      await onBackup(app.id);
      toast.success(`应用 ${app.name} 的数据卷与编排快照已备份成功！`);
    } catch (err: any) {
      toast.error(`备份失败: ${err.message || '未知错误'}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleConfirmDbBackup = async (targetDbName: string) => {
    if (!app) return;
    try {
      await onBackup(app.id, { databaseName: targetDbName });
      toast.success(`数据库 ${app.name} (${targetDbName === 'all' ? '全部数据库' : targetDbName}) 快照备份已成功生成！`);
    } catch (err: any) {
      toast.error(`备份失败: ${err.message || '未知错误'}`);
      throw err;
    }
  };

  const handleDownloadBackup = (b: BackupRecord) => {
    if (onDownloadBackup) {
      onDownloadBackup(b.id, b.fileName);
    } else {
      const token = localStorage.getItem('vessel_token') || '';
      const url = `/api/r2/backups/${b.id}/download?token=${encodeURIComponent(token)}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = b.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleConfirmRestoreBackup = async () => {
    if (!restoringBackup || !onRestoreBackup || isRestoringBackup) return;
    setIsRestoringBackup(true);
    try {
      await onRestoreBackup(restoringBackup.id);
      toast.success(`应用 ${app?.name || ''} 快照恢复成功！`);
      setRestoringBackup(null);
    } catch (err: any) {
      toast.error(`恢复快照失败: ${err.message || '未知错误'}`);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleConfirmDeleteBackup = async () => {
    if (!deletingBackup || !onDeleteBackup || isDeletingBackup) return;
    setIsDeletingBackup(true);
    try {
      await onDeleteBackup(deletingBackup.id);
      toast.success('备份归档已成功删除');
      setDeletingBackup(null);
    } catch (err: any) {
      toast.error(`删除备份失败: ${err.message || '未知错误'}`);
    } finally {
      setIsDeletingBackup(false);
    }
  };

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Dirty detection for composeYaml, envContent, autoUpdate
  const isDirty = useMemo(() => {
    if (mode !== 'edit' || !app) return false;
    return (
      composeYaml !== (app.composeYaml || '') ||
      envContent !== (app.envContent || '') ||
      autoUpdate !== app.autoUpdate
    );
  }, [mode, app, composeYaml, envContent, autoUpdate]);

  // Click outside and ESC key listener for more menu dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreMenuOpen]);

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

  // Open strict delete confirmation modal
  const openDeleteModal = () => {
    setDeleteConfirmInput('');
    setIsDeleteModalOpen(true);
  };

  // Copy UUID handler
  const handleCopyUUID = (uuid: string) => {
    if (!uuid) return;
    navigator.clipboard.writeText(uuid);
    setCopiedUUID(true);
    toast.success('应用 UUID 已复制到剪贴板');
    setTimeout(() => setCopiedUUID(false), 2000);
  };

  // Target identifier to confirm (prioritize app.id for low-friction typing)
  const targetAppId = (app?.id || app?.name || '').trim();
  const isDeleteConfirmed =
    deleteConfirmInput.trim().length > 0 &&
    (deleteConfirmInput.trim().toLowerCase() === targetAppId.toLowerCase() ||
      (app?.name && deleteConfirmInput.trim().toLowerCase() === app.name.trim().toLowerCase()));

  // Confirm delete application execution
  const handleConfirmDeleteApp = async () => {
    if (!app || !isDeleteConfirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      toast.info(`正在删除应用 ${app.name}...`);
      await onDeleteApp(app.id);
      toast.success(`应用 ${app.name} 已成功删除`);
      setIsDeleteModalOpen(false);
      onBack();
    } catch (err: any) {
      toast.error(`删除应用失败: ${err.message}`);
    } finally {
      setIsDeleting(false);
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

  // Unified action flow: Save configuration and trigger deployment together
  const handleSaveAndDeploy = async () => {
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
      toast.success('配置已成功保存！正在启动重新部署...');
      await onDeploy(app.id);
    } catch (err: any) {
      toast.error(`保存并部署失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Discard uncommitted edits and revert back to app defaults
  const handleDiscardChanges = () => {
    if (!app) return;
    setComposeYaml(app.composeYaml || '');
    setEnvContent(app.envContent || '');
    setAutoUpdate(app.autoUpdate);
    setName(app.name);
    setTempName(app.name);
    setDescription(app.description || '');
    toast.info('已恢复至上次保存的配置');
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success('公网路由地址已复制到剪贴板');
    setTimeout(() => setCopiedUrl(false), 2000);
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
    setActiveTab(isDb ? 'logs' : 'deployments');
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
      {/* ================= VESSEL GLOBAL APP HEADER ================= */}
      {isDb ? (
        <div className="pb-3 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Database Engine Official Icon with Live Status Dot */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-paper-2 dark:bg-[#16161b] border border-line/40 flex items-center justify-center p-1.5 shadow-sm">
                {dbOption?.icon || <Database className="w-6 h-6 text-emerald-500" />}
              </div>
              <span
                className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-paper dark:ring-[#0f0f12] ${
                  app?.status === 'running'
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : app?.status === 'deploying' || app?.status === 'rebuilding'
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
            </div>

            {/* Title & Subtitle / ID */}
            <div>
              <h2 className="text-xl font-bold text-ink leading-tight tracking-tight">
                {app?.name || name}
              </h2>
              <p className="text-xs font-mono text-ink-muted leading-tight mt-0.5">
                {app?.id || '新建数据库'}
              </p>
            </div>
          </div>

          <button
            onClick={onBack}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-paper-2 border border-line/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回列表</span>
          </button>
        </div>
      ) : (
        <div className="pb-4 border-b border-line">
        {/* Top Navigation & Status Badges & Danger Action */}
        <div className="flex items-center justify-between mb-3.5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-2.5 py-1 -ml-2 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-paper-2 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回受管应用列表</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Visual de-noised quiet badges */}
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3/60 dark:bg-white/[0.06] text-ink-muted select-none pointer-events-none">
              Docker Compose 模式
            </span>
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3/60 dark:bg-white/[0.06] text-ink-muted select-none pointer-events-none">
              Vessel 控制中枢
            </span>

            {/* Global Danger Action: Delete App */}
            {mode === 'edit' && app && (
              <button
                onClick={openDeleteModal}
                data-tooltip="彻底删除此应用"
                className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer ml-1"
              >
                <Trash className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main App Title & Details Bar */}
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
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse'
                      : app?.status === 'deploying' || app?.status === 'rebuilding'
                      ? 'bg-blue-500 shadow-sm shadow-blue-500/50 animate-ping'
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
                  <span className="text-xs font-sans px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
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
                        className="text-xs px-3 py-1 bg-accent text-white font-medium rounded-lg shadow-subtle cursor-pointer"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setIsRenaming(false)}
                        className="text-xs px-3 py-1 bg-paper-2 border border-line text-ink-muted hover:text-ink rounded-lg cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-ink tracking-tight">{app?.name}</h2>
                      <button
                        onClick={() => setIsRenaming(true)}
                        data-tooltip="修改应用显示名称"
                        className="p-1 rounded text-ink-muted hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>
                      <Badge variant={app?.status || 'stopped'}>{app?.status || 'stopped'}</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Elevated URL & Metadata Info Row */}
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-muted mt-1">
                {mode === 'create' ? (
                  <span>
                    {name
                      ? `应用标识: ${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
                      : '配置独立的 Docker Compose 容器编排服务'}
                  </span>
                ) : (
                  <>
                    <span className="font-mono">应用 ID: {app?.id}</span>
                    <span className="text-line">·</span>
                    <span className="truncate max-w-xs" title={app?.currentImageTag || '由 Compose 编排托管'}>
                      镜像: {app?.currentImageTag || '由 Compose 编排托管'}
                    </span>
                    <span className="text-line">·</span>

                    {/* Elevated Public Route URL with one-click copy and open */}
                    {appDomains.length > 0 ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        <span>公网路由:</span>
                        <a
                          href={`https://${appDomains[0].domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-accent hover:underline inline-flex items-center gap-1 font-mono"
                        >
                          <span>https://{appDomains[0].domain}</span>
                          <ArrowSquareOut className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(`https://${appDomains[0].domain}`)}
                          data-tooltip="复制公网链接"
                          className="p-0.5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        >
                          {copiedUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                        {appDomains.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('domains')}
                            className="text-[11px] text-ink-muted hover:text-accent font-medium ml-0.5"
                          >
                            (+{appDomains.length - 1} 个)
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={openAddDomainModal}
                        className="inline-flex items-center gap-1 text-ink-muted hover:text-accent transition-colors cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5 text-ink-faint" />
                        <span>+ 绑定公网路由</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ================= GLOBAL HORIZONTAL TAB NAVIGATION ================= */}
      {isDb ? (
        <div className="flex items-center gap-1 p-1 bg-stone-100/90 dark:bg-white/[0.04] rounded-xl border border-line/40 w-fit overflow-x-auto scrollbar-none -mt-2">
          {(['general', 'environment', 'logs', 'monitoring', 'backups', 'advanced'] as TabKey[]).map((tabKey) => {
            const labels: Record<string, string> = {
              general: '常规',
              environment: '环境变量',
              logs: '日志',
              monitoring: '监控',
              backups: '备份',
              advanced: '高级设置',
            };
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-[#1f1f24] text-ink shadow-sm font-semibold'
                    : 'text-ink-muted hover:text-ink hover:bg-white/40 dark:hover:bg-white/[0.04]'
                }`}
              >
                {labels[tabKey]}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="border-b border-line/20 dark:border-white/[0.04] flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none -mt-2">
          {/* General Tab */}
        <button
          onClick={() => setActiveTab('general')}
          className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'general'
              ? 'text-accent font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
          }`}
        >
          <Code className={`w-3.5 h-3.5 ${activeTab === 'general' ? 'text-accent' : 'text-ink-muted'}`} />
          <span>基础编排</span>
          {activeTab === 'general' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>

        {/* Environment Tab */}
        <button
          onClick={() => setActiveTab('environment')}
          className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'environment'
              ? 'text-accent font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
          }`}
        >
          <FileText className={`w-3.5 h-3.5 ${activeTab === 'environment' ? 'text-accent' : 'text-ink-muted'}`} />
          <span>环境变量 (.env)</span>
          {activeTab === 'environment' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>

        {/* Mode specific tabs */}
        {mode === 'create' ? (
          <>
            {/* Domains Tab in Create Mode */}
            <button
              onClick={() => setActiveTab('domains')}
              className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'domains'
                  ? 'text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
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
              {activeTab === 'domains' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'templates'
                  ? 'text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
              }`}
            >
              <Sparkle className="w-3.5 h-3.5 text-amber-500" />
              <span>预置模板</span>
              {activeTab === 'templates' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          </>
        ) : (
          <>
            {/* Deployments / Terminal Tab */}
            <button
              onClick={() => setActiveTab('deployments')}
              className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'deployments'
                  ? 'text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
              }`}
            >
              <Terminal className={`w-3.5 h-3.5 ${activeTab === 'deployments' ? 'text-accent' : 'text-ink-muted'}`} />
              <span>部署日志</span>
              {activeTab === 'deployments' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>

            {/* Containers Tab */}
            <button
              onClick={() => setActiveTab('containers')}
              className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'containers'
                  ? 'text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
              }`}
            >
              <Stack className={`w-3.5 h-3.5 ${activeTab === 'containers' ? 'text-accent' : 'text-ink-muted'}`} />
              <span>容器实例 ({app?.containers?.length || 0})</span>
              {activeTab === 'containers' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>

            {/* Domains Tab */}
            <button
              onClick={() => setActiveTab('domains')}
              className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'domains'
                  ? 'text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>域名绑定 ({appDomains.length})</span>
              {activeTab === 'domains' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>

            {/* Backups Tab */}
            <button
              onClick={() => setActiveTab('backups')}
              className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'backups'
                  ? 'text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
              }`}
            >
              <CloudArrowUp className={`w-3.5 h-3.5 ${activeTab === 'backups' ? 'text-accent' : 'text-ink-muted'}`} />
              <span>备份存档 ({appBackups.length})</span>
              {activeTab === 'backups' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>

            {/* Logs Tab */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'logs'
                  ? 'text-accent font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${activeTab === 'logs' ? 'text-accent' : 'text-ink-muted'}`} />
              <span>运行日志</span>
              {activeTab === 'logs' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          </>
        )}

        {/* Advanced Tab */}
        <button
          onClick={() => setActiveTab('advanced')}
          className={`px-3.5 py-2.5 text-xs font-medium transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'advanced'
              ? 'text-accent font-semibold'
              : 'text-ink-muted hover:text-ink hover:bg-paper-2/60 rounded-t-lg'
          }`}
        >
          <span>高级设置</span>
          {activeTab === 'advanced' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
          )}
        </button>
      </div>
      )}

      {/* ================= ACTION & CONTROL BAR (EDIT MODE - GENERAL, ENVIRONMENT, LOGS & DOMAINS TABS) ================= */}
      {!isDb && mode === 'edit' && (activeTab === 'general' || activeTab === 'environment' || activeTab === 'logs' || activeTab === 'domains') && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 pb-1">
          {/* Left: Core State-Driven Actions (Heuristic Principle 2 & Interaction Flow) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status: STOPPED */}
            {app?.status !== 'running' && app?.status !== 'deploying' && app?.status !== 'rebuilding' && (
              <>
                <button
                  onClick={() => !isDirty && app && onDeploy(app.id)}
                  disabled={isDirty}
                  data-tooltip={isDirty ? '配置已修改，请使用底部悬浮栏「保存并部署」或放弃更改' : undefined}
                  className={`inline-flex items-center gap-2 px-4 py-2 font-medium text-xs rounded-lg transition-all shadow-subtle ${
                    isDirty
                      ? 'bg-paper-3 text-ink-muted border border-line cursor-not-allowed opacity-60'
                      : 'bg-accent hover:bg-accent-hover text-white active:translate-y-px cursor-pointer'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isDirty ? 'text-ink-muted' : 'text-white'}`} weight="fill" />
                  <span>启动应用</span>
                </button>

                <button
                  onClick={() => setActiveTab('deployments')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line rounded-lg transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span>查看日志</span>
                </button>

                {/* Dropdown for Secondary Actions */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line rounded-lg transition-colors cursor-pointer"
                  >
                    <span>更多操作</span>
                    <CaretDown className="w-3 h-3 text-ink-muted" />
                  </button>
                  {isMoreMenuOpen && (
                    <div className="absolute left-0 mt-1.5 w-48 bg-paper border border-line rounded-xl shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        disabled={isDirty}
                        onClick={() => {
                          if (isDirty) return;
                          setIsMoreMenuOpen(false);
                          app && onRebuild(app.id);
                        }}
                        data-tooltip={isDirty ? '配置已修改，请先保存或放弃更改' : undefined}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                          isDirty
                            ? 'text-ink-faint cursor-not-allowed opacity-50'
                            : 'text-ink hover:bg-paper-2 cursor-pointer'
                        }`}
                      >
                        <ArrowsClockwise className="w-3.5 h-3.5 text-ink-muted" />
                        <span>重建容器服务</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDirty}
                        onClick={() => {
                          if (isDirty) return;
                          setIsMoreMenuOpen(false);
                          setIsFreshVolumesModalOpen(true);
                        }}
                        data-tooltip={isDirty ? '配置已修改，请先保存或放弃更改' : undefined}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                          isDirty
                            ? 'text-rose-400/50 cursor-not-allowed opacity-50'
                            : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>清空卷重部署</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Status: RUNNING */}
            {app?.status === 'running' && (
              <>
                <button
                  onClick={() => !isDirty && app && onDeploy(app.id)}
                  disabled={isDirty}
                  data-tooltip={isDirty ? '配置已修改，请使用底部悬浮栏「保存并部署」或放弃更改' : undefined}
                  className={`inline-flex items-center gap-2 px-4 py-2 font-medium text-xs rounded-lg transition-all shadow-subtle ${
                    isDirty
                      ? 'bg-paper-3 text-ink-muted border border-line cursor-not-allowed opacity-60'
                      : 'bg-accent hover:bg-accent-hover text-white active:translate-y-px cursor-pointer'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isDirty ? 'text-ink-muted' : 'text-white'}`} weight="fill" />
                  <span>重新部署</span>
                </button>

                <button
                  onClick={() => setActiveTab('deployments')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line rounded-lg transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span>查看日志</span>
                </button>

                <button
                  onClick={() => app && onStop(app.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60 dark:hover:bg-rose-900/50 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Stop className="w-3.5 h-3.5" />
                  <span>停止运行</span>
                </button>

                {/* Dropdown for Secondary Actions */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line rounded-lg transition-colors cursor-pointer"
                  >
                    <span>更多操作</span>
                    <CaretDown className="w-3 h-3 text-ink-muted" />
                  </button>
                  {isMoreMenuOpen && (
                    <div className="absolute left-0 mt-1.5 w-48 bg-paper border border-line rounded-xl shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        disabled={isDirty}
                        onClick={() => {
                          if (isDirty) return;
                          setIsMoreMenuOpen(false);
                          app && onRestart(app.id);
                        }}
                        data-tooltip={isDirty ? '配置已修改，请先保存或放弃更改' : undefined}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                          isDirty
                            ? 'text-ink-faint cursor-not-allowed opacity-50'
                            : 'text-ink hover:bg-paper-2 cursor-pointer'
                        }`}
                      >
                        <ArrowsClockwise className="w-3.5 h-3.5 text-ink-muted" />
                        <span>重启服务实例</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDirty}
                        onClick={() => {
                          if (isDirty) return;
                          setIsMoreMenuOpen(false);
                          app && onRebuild(app.id);
                        }}
                        data-tooltip={isDirty ? '配置已修改，请先保存或放弃更改' : undefined}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                          isDirty
                            ? 'text-ink-faint cursor-not-allowed opacity-50'
                            : 'text-ink hover:bg-paper-2 cursor-pointer'
                        }`}
                      >
                        <ArrowsClockwise className="w-3.5 h-3.5 text-ink-muted" />
                        <span>重建容器服务</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDirty}
                        onClick={() => {
                          if (isDirty) return;
                          setIsMoreMenuOpen(false);
                          setIsFreshVolumesModalOpen(true);
                        }}
                        data-tooltip={isDirty ? '配置已修改，请先保存或放弃更改' : undefined}
                        className={`w-full px-3.5 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                          isDirty
                            ? 'text-rose-400/50 cursor-not-allowed opacity-50'
                            : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer'
                        }`}
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>清空卷重部署</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Status: DEPLOYING / REBUILDING */}
            {(app?.status === 'deploying' || app?.status === 'rebuilding') && (
              <>
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent/70 text-white font-medium text-xs rounded-lg cursor-wait"
                >
                  <CircleNotch className="w-3.5 h-3.5 text-white animate-spin" />
                  <span>部署执行中...</span>
                </button>

                <button
                  onClick={() => setActiveTab('deployments')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10 border border-accent/20 rounded-lg transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>查看实时部署日志</span>
                </button>
              </>
            )}
          </div>

          {/* Right: Autodeploy Switch Toggle (Borderless & Minimalist) */}
          <div className="flex items-center gap-2.5">
            <label
              htmlFor="autodeployToggle"
              className="text-xs font-medium text-ink-muted hover:text-ink flex items-center gap-1.5 cursor-pointer select-none transition-colors"
            >
              <span>自动部署</span>
              <span className="text-[10px] text-ink-faint hidden sm:inline">(镜像自动巡检更新)</span>
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
      )}

      {/* ================= TAB CONTENT 1: GENERAL (UNIFIED COMPOSE WORKSPACE) ================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {mode === 'create' ? (
            /* ================= CREATE MODE WORKSPACE ================= */
            <div className="card-vessel p-6 sm:p-7 shadow-subtle space-y-6">
              <div className="pb-3 border-b border-line/60">
                <h3 className="font-semibold text-base text-ink tracking-tight">应用基础配置</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  填写服务基础属性并指定初始编排文件与自动化部署策略
                </p>
              </div>

              {/* Name & Description Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Domain Binding Section */}
              <div className="pt-4 border-t border-line/60">
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
                  </div>
                )}
              </div>

              {/* Compose YAML Section */}
              <div className="pt-4 border-t border-line/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                  <div>
                    <h4 className="font-semibold text-sm text-ink tracking-tight">Compose 编排定义 (YAML)</h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      声明式管理服务容器镜像、网络与卷挂载
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {yamlValidation.valid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 rounded-full font-medium">
                        <Check className="w-3 h-3 text-emerald-500" />
                        YAML 语法有效
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 rounded-full font-medium">
                        <Warning className="w-3 h-3 text-rose-500" />
                        语法错误
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs text-ink-muted hover:text-ink bg-paper-2 hover:bg-paper-3 border border-line rounded-lg transition-colors shadow-subtle cursor-pointer"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-accent" />
                      <span>预览配置</span>
                    </button>
                  </div>
                </div>

                <CodeEditorWithLines
                  language="yaml"
                  value={composeYaml}
                  onChange={setComposeYaml}
                  placeholder="services:&#10;  app:&#10;    image: ...&#10;    ports:&#10;      - '8080:80'"
                  minHeight="420px"
                />
              </div>

              {/* Create Mode Actions Footer */}
              <div className="pt-4 border-t border-line/60 flex items-center justify-between">
                <button
                  onClick={onBack}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 border border-line transition-colors cursor-pointer"
                >
                  取消
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleCreate(false)}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-paper-2 hover:bg-paper-3 text-ink font-medium text-xs rounded-lg border border-line transition-all shadow-subtle active:translate-y-px cursor-pointer"
                  >
                    {isSubmitting ? '保存中...' : '保存应用 (草稿)'}
                  </button>
                  <button
                    onClick={() => handleCreate(true)}
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-accent hover:bg-accent-hover text-white font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px cursor-pointer flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-white" weight="fill" />
                    <span>{isSubmitting ? '部署中...' : '创建并立即部署'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE: UNIFIED WORKSPACE ================= */
            <div className="space-y-6">
              {/* 部署设置 (Dokploy 1:1 Figure 3) */}
              {isDb && (
                <div className="rounded-2xl border border-line/60 bg-paper dark:bg-[#121216] p-6 shadow-subtle space-y-4">
                  <h3 className="text-base font-semibold text-ink tracking-tight">部署设置</h3>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Deploy Button */}
                    <button
                      type="button"
                      onClick={() => app && onDeploy(app.id)}
                      disabled={app?.status === 'deploying' || app?.status === 'rebuilding'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-black text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {app?.status === 'deploying' || app?.status === 'rebuilding' ? (
                        <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                          <path d="M12 9v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                        </svg>
                      )}
                      <span>{app?.status === 'deploying' || app?.status === 'rebuilding' ? '部署中...' : '部署'}</span>
                    </button>

                    {/* Reload Button */}
                    <button
                      type="button"
                      onClick={() => app && onRestart(app.id)}
                      disabled={app?.status !== 'running'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-ink border border-line/40 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowsClockwise className="w-3.5 h-3.5" />
                      <span>重载</span>
                    </button>

                    {/* Stop Button */}
                    <button
                      type="button"
                      onClick={() => app && onStop(app.id)}
                      disabled={app?.status !== 'running'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="m4.93 4.93 14.14 14.14"/>
                      </svg>
                      <span>停止</span>
                    </button>

                    {/* Open Terminal Button */}
                    <button
                      type="button"
                      onClick={() => setShowTerminalModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-ink border border-line/40 transition-colors cursor-pointer"
                    >
                      <span className="font-mono font-bold text-xs">&gt;_</span>
                      <span>打开终端</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 内部凭据 (Dokploy 1:1 Figure 3) */}
              {dbInfo && (
                <div className="rounded-2xl border border-line/60 bg-paper dark:bg-[#121216] p-6 shadow-subtle space-y-5">
                  <h3 className="text-base font-semibold text-ink tracking-tight">内部凭据</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* User */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          用户名
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                          <span className="truncate">{dbInfo.user || '-'}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyDbField(dbInfo.user, 'user')}
                            className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer ml-2 flex-shrink-0"
                            title="复制用户名"
                          >
                            {copiedDbField === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          密码
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                          <span className="truncate">
                            {showDbPassword ? dbInfo.password : '••••••••••••••••'}
                          </span>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowDbPassword(!showDbPassword)}
                              className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                              title={showDbPassword ? '隐藏' : '显示'}
                            >
                              {showDbPassword ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyDbField(dbInfo.password, 'password')}
                              className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                              title="复制密码"
                            >
                              {copiedDbField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Internal Host */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          内部主机
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                          <span className="truncate">{dbInfo.internalHost}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyDbField(dbInfo.internalHost, 'internalHost')}
                            className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer ml-2 flex-shrink-0"
                            title="复制内部主机"
                          >
                            {copiedDbField === 'internalHost' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Root Password (if applicable) */}
                      {dbInfo.rootPassword ? (
                        <div>
                          <label className="block text-xs font-semibold text-ink mb-1.5">
                            Root 密码
                          </label>
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                            <span className="truncate">
                              {showDbRootPassword ? dbInfo.rootPassword : '••••••••••••••••'}
                            </span>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowDbRootPassword(!showDbRootPassword)}
                                className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                title={showDbRootPassword ? '隐藏' : '显示'}
                              >
                                {showDbRootPassword ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyDbField(dbInfo.rootPassword, 'rootPassword')}
                                className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                title="复制 Root 密码"
                              >
                                {copiedDbField === 'rootPassword' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Database Name */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          数据库名称
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                          <span className="truncate">{dbInfo.dbName || '-'}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyDbField(dbInfo.dbName, 'dbName')}
                            className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer ml-2 flex-shrink-0"
                            title="复制数据库名称"
                          >
                            {copiedDbField === 'dbName' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Internal Port (Container) */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          内部端口 (容器)
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                          <span className="truncate">{dbInfo.port}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyDbField(dbInfo.port, 'port')}
                            className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer ml-2 flex-shrink-0"
                            title="复制端口"
                          >
                            {copiedDbField === 'port' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Internal Connection URL */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          内部连接字符串
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                          <span className="truncate select-all">
                            {showDbInternalUrl ? dbInfo.internalUrl : '••••••••••••••••••••••••••••••••••••••••••••'}
                          </span>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowDbInternalUrl(!showDbInternalUrl)}
                              className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                              title={showDbInternalUrl ? '隐藏' : '显示'}
                            >
                              {showDbInternalUrl ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyDbField(dbInfo.internalUrl, 'internalUrl')}
                              className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                              title="复制内部连接字符串"
                            >
                              {copiedDbField === 'internalUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Internal Root Connection URL (if applicable) */}
                      {dbInfo.rootPassword && dbInfo.internalRootUrl ? (
                        <div>
                          <label className="block text-xs font-semibold text-ink mb-1.5">
                            内部 Root 连接字符串
                          </label>
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                            <span className="truncate select-all">
                              {showDbInternalRootUrl ? dbInfo.internalRootUrl : '••••••••••••••••••••••••••••••••••••••••••••'}
                            </span>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowDbInternalRootUrl(!showDbInternalRootUrl)}
                                className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                title={showDbInternalRootUrl ? '隐藏' : '显示'}
                              >
                                {showDbInternalRootUrl ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyDbField(dbInfo.internalRootUrl, 'internalRootUrl')}
                                className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                title="复制内部 Root 连接字符串"
                              >
                                {copiedDbField === 'internalRootUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {/* 外部凭据 (Dokploy 1:1 Figure 3) */}
              {dbInfo && (
                <div className="rounded-2xl border border-line/60 bg-paper dark:bg-[#121216] p-6 shadow-subtle space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-ink tracking-tight">外部凭据</h3>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      为了使数据库可以通过互联网或宿主机外部网络访问，您必须设置一个端口，并确保该端口未被其他应用或数据库占用。默认关闭外部连接以保证数据安全。
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1.5">
                        外部端口 (互联网)
                      </label>
                      <input
                        type="text"
                        value={externalPortInput}
                        onChange={(e) => setExternalPortInput(e.target.value)}
                        placeholder=""
                        className="w-full bg-stone-50/50 dark:bg-white/[0.03] border border-line/60 rounded-xl px-4 py-2.5 text-xs text-ink font-mono focus:border-accent focus:bg-paper focus:outline-none transition-colors"
                      />
                    </div>

                    {dbInfo.detectedExternalPort ? (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-ink mb-1.5">
                            外部连接字符串
                          </label>
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                            <span className="truncate select-all">
                              {showDbExternalUrl ? dbInfo.externalUrl : '••••••••••••••••••••••••••••••••••••••••••••'}
                            </span>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowDbExternalUrl(!showDbExternalUrl)}
                                className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                title={showDbExternalUrl ? '隐藏' : '显示'}
                              >
                                {showDbExternalUrl ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyDbField(dbInfo.externalUrl, 'externalUrl')}
                                className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                title="复制外部连接字符串"
                              >
                                {copiedDbField === 'externalUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {dbInfo.rootPassword && dbInfo.rootUrl ? (
                          <div>
                            <label className="block text-xs font-semibold text-ink mb-1.5">
                              外部 Root 连接字符串
                            </label>
                            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-line/60 bg-stone-50/70 dark:bg-white/[0.03] text-xs font-mono text-ink">
                              <span className="truncate select-all">
                                {showDbExternalRootUrl ? dbInfo.rootUrl : '••••••••••••••••••••••••••••••••••••••••••••'}
                              </span>
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setShowDbExternalRootUrl(!showDbExternalRootUrl)}
                                  className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                  title={showDbExternalRootUrl ? '隐藏' : '显示'}
                                >
                                  {showDbExternalRootUrl ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyDbField(dbInfo.rootUrl, 'externalRootUrl')}
                                  className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                                  title="复制外部 Root 连接字符串"
                                >
                                  {copiedDbField === 'externalRootUrl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveExternalPort}
                        disabled={isSavingExternalPort}
                        className="px-5 py-2 rounded-lg text-xs font-medium bg-black text-white hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200 transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                      >
                        {isSavingExternalPort && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                        <span>{isSavingExternalPort ? '保存中...' : '保存'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPOSE YAML EDITOR WORKSPACE - INDEPENDENT IDE CARD (FOR COMPOSE APPS) */}
              {!isDb && (
                <div className="rounded-xl border border-line/80 bg-paper-2/60 dark:bg-[#111115] overflow-hidden shadow-subtle">
                  {/* Card Window Header */}
                  <div className="px-4 py-2.5 bg-paper-3/40 dark:bg-white/[0.02] border-b border-line/30 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-xs sm:text-sm text-ink tracking-tight">Compose 编排文件 (YAML)</h3>
                      {/* YAML Validation Indicator */}
                      {!composeYaml.trim() ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-paper-3 text-ink-muted border border-line rounded-full font-medium">
                          待填写编排配置
                        </span>
                      ) : yamlValidation.valid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80 rounded-full font-medium">
                          <Check className="w-3 h-3 text-emerald-500" />
                          YAML 语法有效
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/80 rounded-full truncate max-w-xs font-medium cursor-help"
                          data-tooltip={yamlValidation.error || ''}
                        >
                          <Warning className="w-3 h-3 text-rose-500" />
                          语法错误: {yamlValidation.error}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-auto">
                      {/* Preview Button (Ghost style) */}
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-paper-3/80 rounded-md transition-colors cursor-pointer"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-accent" />
                        <span>预览配置</span>
                      </button>

                      {/* Copy Button (Ghost style) */}
                      <button
                        type="button"
                        onClick={handleCopyYaml}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-paper-3/80 rounded-md transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedYaml ? '已复制' : '复制配置'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Enhanced Code Editor with Syntax Highlighting and Borderless */}
                  <CodeEditorWithLines
                    borderless
                    language="yaml"
                    value={composeYaml}
                    onChange={setComposeYaml}
                    placeholder="services:&#10;  app:&#10;    image: ...&#10;    ports:&#10;      - '8080:80'"
                    minHeight="480px"
                  />

                  {/* Card Window Footer */}
                  <div className="px-4 py-2 bg-paper-3/20 dark:bg-white/[0.01] border-t border-line/30 dark:border-white/[0.06] flex items-center justify-between text-xs text-ink-muted">
                    <span>Tab 键自动补全 2 格缩进 · 支持 docker compose v2 标准语法</span>
                    <span className="text-ink-faint font-mono text-[11px] hidden sm:inline">compose-spec v2</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB CONTENT 2: ENVIRONMENT ================= */}
      {activeTab === 'environment' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">环境变量 (.env)</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              配置 Docker Compose 服务的专属环境变量。在此处定义的键值对将作为 <code className="font-mono text-accent">.env</code> 注入至同一编排目录，可在 Compose 文件中通过 <code className="font-mono text-accent">${'{KEY}'}</code> 变量直接插值引用。
            </p>
          </div>

          {/* COMPOSE ENV EDITOR WORKSPACE - INDEPENDENT IDE CARD */}
          <div className="rounded-xl border border-line/80 bg-paper-2/60 dark:bg-[#111115] overflow-hidden shadow-subtle">
            {/* Card Window Header */}
            <div className="px-4 py-2.5 bg-paper-3/40 dark:bg-white/[0.02] border-b border-line/30 dark:border-white/[0.06] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span className="font-semibold text-xs sm:text-sm text-ink tracking-tight">环境变量定义 (.env)</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-paper-3 dark:bg-white/[0.06] text-ink-muted border border-line/60 dark:border-white/10 font-medium">
                .env 格式
              </span>
            </div>

            {/* Enhanced Code Editor with Syntax Highlighting and Borderless */}
            <CodeEditorWithLines
              borderless
              language="bash"
              value={envContent}
              onChange={setEnvContent}
              placeholder={'NODE_ENV=production\nDATABASE_URL=postgres://...\nPORT=8080'}
              minHeight="480px"
            />

            {/* Card Window Footer */}
            <div className="px-4 py-2 bg-paper-3/20 dark:bg-white/[0.01] border-t border-line/30 dark:border-white/[0.06] flex items-center justify-between text-xs text-ink-muted">
              <span>每行一条 KEY=VALUE · 支持以 # 开头的注释行</span>
              <span className="text-ink-faint font-mono text-[11px] hidden sm:inline">dotenv v1</span>
            </div>
          </div>

          {/* Outside Status Helper Note */}
          <div className="flex items-center justify-between text-xs text-ink-muted pt-0.5">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-ink-faint flex-shrink-0" />
              <span>环境变量在容器启动或重新部署时注入生效</span>
            </div>
            {mode === 'create' && (
              <button
                onClick={() => setActiveTab('general')}
                className="px-3 py-1 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle cursor-pointer"
              >
                返回基础编排
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 3: TEMPLATES (CREATE MODE) ================= */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">官方预置模板库</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              点击任意模板，即刻导入经过安全生产验证的标准 Docker Compose 编排规则及配置。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.name}
                className="p-5 rounded-xl border border-line/80 bg-paper-2/60 dark:bg-[#111115] hover:border-accent/40 hover:bg-paper-2/90 transition-all flex flex-col justify-between shadow-subtle hover:shadow-card"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-ink">{tmpl.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-paper-3 dark:bg-white/[0.06] text-ink-muted border border-line/60 dark:border-white/10 font-medium">
                      {tmpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-2.5 line-clamp-3 leading-relaxed">{tmpl.description}</p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-line/30 dark:border-white/[0.06] flex items-center justify-end">
                  <button
                    onClick={() => {
                      handleSelectTemplate(tmpl);
                      setActiveTab('general');
                    }}
                    className="px-3 py-1.5 bg-accent text-white font-medium text-xs rounded-lg hover:bg-accent-hover transition-colors shadow-subtle cursor-pointer"
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
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">部署构建与实时日志</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              WebSocket 实时管道对接 Docker Compose 部署构建与容器标准输出
            </p>
          </div>

          {/* Terminal Screen Window Card */}
          <div className="rounded-xl border border-line/80 bg-paper-2/60 dark:bg-[#111115] overflow-hidden shadow-subtle">
            {/* Terminal Card Window Header */}
            <div className="px-4 py-2.5 bg-paper-3/40 dark:bg-white/[0.02] border-b border-line/30 dark:border-white/[0.06] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                <span className="font-mono text-xs text-ink font-medium">── 实时部署输出 [{app.id}] ──</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-faint font-mono hidden sm:inline">自动滚屏</span>
                <button
                  type="button"
                  onClick={() => onDeploy(app.id)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-paper-3/80 rounded-md transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 text-accent" weight="fill" />
                  <span>立即部署</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRebuild(app.id)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:bg-paper-3/80 rounded-md transition-colors cursor-pointer"
                >
                  <ArrowsClockwise className="w-3 h-3 text-accent" />
                  <span>重建</span>
                </button>
              </div>
            </div>

            {/* Terminal Screen Body */}
            <div className="bg-paper dark:bg-zinc-950/90 p-4 sm:p-5 font-mono text-xs text-ink dark:text-emerald-400 h-96 overflow-y-auto space-y-1 select-text">
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

            {/* Terminal Window Footer */}
            <div className="px-4 py-2 bg-paper-3/20 dark:bg-white/[0.01] border-t border-line/30 dark:border-white/[0.06] flex items-center justify-between text-xs text-ink-muted font-mono text-[11px]">
              <span>共输出 {appLogs.length} 行构建日志</span>
              <span className="text-ink-faint">docker-compose-deploy-pipe</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 5: CONTAINERS (EDIT MODE) ================= */}
      {activeTab === 'containers' && mode === 'edit' && app && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">活跃容器实例</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              此 Compose 应用栈下所挂载的 Docker 容器实例状态与端口映射
            </p>
          </div>

          <div className="rounded-xl border border-line/80 bg-paper-2/60 dark:bg-[#111115] overflow-hidden shadow-subtle">
            {(app.containers || []).length === 0 ? (
              <div className="py-14 text-center text-ink-muted text-xs">
                暂未检测到运行中的容器实例。请点击上方「启动应用」启动应用编排。
              </div>
            ) : (
              <div className="divide-y divide-line/40 px-5">
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
                      <span className="text-xs text-ink-muted font-mono">
                        {c.ports?.length ? c.ports.join(', ') : '无直接对外映射端口'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm text-ink tracking-tight">Caddy 域名路由绑定</h3>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                为此应用栈配置的反向代理公网域名及 Let's Encrypt / ZeroSSL 自动化证书
              </p>
            </div>

            {appDomains.length > 0 && (
              <Button8State
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" weight="bold" />}
                onClick={openAddDomainModal}
              >
                绑定新域名
              </Button8State>
            )}
          </div>

          {appDomains.length === 0 ? (
            <div className="py-16 px-6 text-center border border-line/60 dark:border-white/[0.06] rounded-xl bg-paper-2/30 dark:bg-white/[0.02] flex flex-col items-center justify-center space-y-3 shadow-subtle">
              <div className="w-12 h-12 rounded-2xl bg-paper-3/80 dark:bg-white/[0.05] text-ink-muted dark:text-zinc-400 border border-line/40 dark:border-white/[0.06] flex items-center justify-center shadow-subtle">
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
                className="mt-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 shadow-subtle transition-all active:translate-y-px cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" weight="bold" />
                <span>添加公网域名</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appDomains.map((dom) => (
                <div
                  key={dom.id}
                  className="p-4 sm:p-5 rounded-xl border border-line/80 dark:border-white/10 bg-paper-2/60 dark:bg-[#111115] hover:border-ink-muted/30 dark:hover:border-white/20 hover:bg-paper-2 dark:hover:bg-[#16161b] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle group"
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
                          className="font-semibold text-sm sm:text-base text-ink hover:text-accent flex items-center gap-1.5 transition-colors group/link"
                        >
                          <span>https://{dom.domain}</span>
                          <ArrowSquareOut className="w-3.5 h-3.5 text-ink-muted group-hover/link:text-accent transition-colors" />
                        </a>
                        <Badge variant={dom.sslStatus}>
                          {dom.sslStatus === 'active' ? 'HTTPS 活跃' : dom.sslStatus}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs pl-11">
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-muted">上游目标:</span>
                        <code className="font-mono text-[11.5px] text-ink dark:text-zinc-100 font-medium bg-paper-3/50 dark:bg-white/[0.05] px-1.5 py-0.5 rounded border border-line/40 dark:border-white/[0.08]">
                          {dom.targetType === 'internal'
                            ? `${dom.serviceName}:${dom.targetPort} (容器内部)`
                            : `127.0.0.1:${dom.targetPort} (宿主机)`}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-muted">颁发机构:</span>
                        <span className="text-ink dark:text-zinc-100 font-medium">
                          {dom.sslIssuer || "Let's Encrypt (Auto-Renew)"}
                        </span>
                      </div>
                      {dom.sslExpiresAt && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink-muted">到期时间:</span>
                          <span className="font-mono text-ink dark:text-zinc-100">{dom.sslExpiresAt}</span>
                        </div>
                      )}
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
                        className="px-3 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 border border-line text-xs font-medium flex items-center gap-1.5 transition-colors shadow-subtle cursor-pointer"
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
                        className="p-1.5 rounded-lg text-ink-muted hover:text-white hover:bg-rose-600 hover:border-rose-600 dark:hover:bg-rose-600 dark:hover:border-rose-600 border border-line transition-all cursor-pointer shadow-subtle"
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

      {/* ================= TAB CONTENT: MONITORING (DATABASE CONTAINER METRICS & HEALTH) ================= */}
      {activeTab === 'monitoring' && mode === 'edit' && app && (
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">运行监控与遥测</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              实时监控此数据库容器实例的运行状态、健康检查、端口网络与数据卷持久化
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Card */}
            <div className="p-4 rounded-xl border border-line/60 bg-paper dark:bg-[#121216] shadow-subtle space-y-2">
              <div className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
                容器运行状态
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    app?.status === 'running'
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-base font-semibold text-ink capitalize">
                  {app?.status === 'running' ? '运行中' : app?.status || '未知'}
                </span>
              </div>
              <p className="text-[11px] text-ink-muted">
                {app?.containers?.[0]?.status || (app?.status === 'running' ? '正常运行且响应' : '容器未在运行')}
              </p>
            </div>

            {/* Port Card */}
            <div className="p-4 rounded-xl border border-line/60 bg-paper dark:bg-[#121216] shadow-subtle space-y-2">
              <div className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
                外部暴露端口
              </div>
              <div className="text-base font-semibold font-mono text-ink">
                {dbInfo?.detectedExternalPort || '未映射'}
              </div>
              <p className="text-[11px] text-ink-muted">
                {dbInfo?.detectedExternalPort
                  ? `0.0.0.0:${dbInfo.detectedExternalPort} (宿主机映射)`
                  : '外部网络连接已关闭 (仅限容器内网)'}
              </p>
            </div>

            {/* Engine Image Card */}
            <div className="p-4 rounded-xl border border-line/60 bg-paper dark:bg-[#121216] shadow-subtle space-y-2">
              <div className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
                数据库引擎与镜像
              </div>
              <div className="text-base font-semibold text-ink truncate">
                {dbInfo?.engine || '数据库'}
              </div>
              <p className="text-[11px] font-mono text-ink-muted truncate">
                {app?.containers?.[0]?.image || '官方 Docker 镜像'}
              </p>
            </div>

            {/* Restart Policy Card */}
            <div className="p-4 rounded-xl border border-line/60 bg-paper dark:bg-[#121216] shadow-subtle space-y-2">
              <div className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">
                重启策略
              </div>
              <div className="text-base font-semibold text-ink">
                unless-stopped
              </div>
              <p className="text-[11px] text-ink-muted">
                故障或系统重启时自动恢复
              </p>
            </div>
          </div>

          {/* Container Details & Storage Table */}
          <div className="rounded-xl border border-line/80 bg-paper dark:bg-[#111115] overflow-hidden shadow-subtle">
            <div className="px-5 py-3.5 bg-paper-3/40 dark:bg-white/[0.02] border-b border-line/30 dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stack className="w-4 h-4 text-accent" />
                <h4 className="font-semibold text-xs sm:text-sm text-ink tracking-tight">
                  容器运行详情
                </h4>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-paper-3 dark:bg-white/[0.06] text-ink-muted border border-line/60">
                Docker Engine
              </span>
            </div>

            <div className="divide-y divide-line/30 dark:divide-white/[0.06] text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-5 hover:bg-paper-2/40 transition-colors">
                <span className="text-ink-muted">容器名称</span>
                <span className="font-mono text-ink font-semibold">{app?.containers?.[0]?.name || app?.name || 'database'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-5 hover:bg-paper-2/40 transition-colors">
                <span className="text-ink-muted">容器 ID</span>
                <span className="font-mono text-ink">{app?.containers?.[0]?.id ? app.containers[0].id.slice(0, 12) : '未生成'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-5 hover:bg-paper-2/40 transition-colors">
                <span className="text-ink-muted">持久化数据卷挂载</span>
                <span className="font-mono text-ink">./data &rarr; 持久化数据存储</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-5 hover:bg-paper-2/40 transition-colors">
                <span className="text-ink-muted">内部虚拟网络</span>
                <span className="font-mono text-ink">vessel-network (Bridge 桥接)</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-5 hover:bg-paper-2/40 transition-colors">
                <span className="text-ink-muted">最近部署时间</span>
                <span className="font-mono text-ink-muted">{app?.lastDeployedAt || app?.updatedAt || '从未部署'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 7: BACKUPS (EDIT MODE) ================= */}
      {activeTab === 'backups' && mode === 'edit' && app && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm text-ink tracking-tight">
                {isDb ? '数据库转储与灾备快照' : 'Cloudflare R2 灾备记录'}
              </h3>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                {isDb
                  ? '支持选择指定数据库进行原生 SQL 快照转储导出，可按需恢复并同步至 Cloudflare R2'
                  : '此应用对应的数据卷与 Compose 编排快照备份存档'}
              </p>
            </div>

            <Button8State
              size="sm"
              variant="primary"
              state={isBackingUp ? 'loading' : 'default'}
              icon={isDb ? <Database className="w-4 h-4 text-white" /> : <CloudArrowUp className="w-4 h-4 text-white" />}
              onClick={handleAppBackup}
            >
              {isDb ? '新建数据库备份' : '立即备份此应用'}
            </Button8State>
          </div>

          <div className="rounded-xl border border-line/80 bg-paper-2/60 dark:bg-[#111115] overflow-hidden shadow-subtle">
            {appBackups.length === 0 ? (
              <div className="py-14 text-center text-ink-muted text-xs">
                {isDb
                  ? '暂无此数据库的独立快照备份。点击右上角「新建数据库备份」选择要导出的数据库。'
                  : '暂无此应用的独立备份归档。点击右上角即可立即将编排与数据卷上传至 R2。'}
              </div>
            ) : (
              <div className="divide-y divide-line/40">
                {appBackups.map((b) => (
                  <div key={b.id} className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper-3/20 transition-colors">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-ink font-mono">{b.fileName}</span>
                        {b.databaseName && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                            {b.databaseName === 'all' ? '全部数据库' : `库: ${b.databaseName}`}
                          </span>
                        )}
                        {b.type === 'app_db' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            原生转储
                          </span>
                        )}
                        <Badge variant="running">已同步 R2</Badge>
                      </div>
                      <p className="text-xs text-ink-muted">
                        大小: <span className="font-mono text-ink font-medium">{formatBytes(b.fileSizeBytes)}</span> · 时间: {new Date(b.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {onRestoreBackup && (
                        <Button8State
                          size="sm"
                          variant="secondary"
                          icon={<ArrowCounterClockwise className="w-3.5 h-3.5 text-accent" />}
                          onClick={() => {
                            setRestoringBackup(b);
                            setRestoreConfirmInput('');
                          }}
                        >
                          恢复
                        </Button8State>
                      )}

                      <Button8State
                        size="sm"
                        variant="secondary"
                        icon={<DownloadSimple className="w-3.5 h-3.5" />}
                        onClick={() => handleDownloadBackup(b)}
                      >
                        下载
                      </Button8State>

                      {onDeleteBackup && (
                        <button
                          onClick={() => setDeletingBackup(b)}
                          className="p-1.5 text-ink-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="删除该备份记录"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT: LOGS (DOKPLOY RUNTIME CONTAINER LOGS) ================= */}
      {activeTab === 'logs' && mode === 'edit' && app && (
        <LogsPanel app={app} />
      )}

      {/* ================= TAB CONTENT 8: ADVANCED ================= */}
      {activeTab === 'advanced' && (
        <div className="space-y-8">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">高级设置</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">系统底层元数据与生命周期安全管理</p>
          </div>

          {/* 系统底层元数据 - 无框化键值对列表 */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-ink tracking-tight">系统底层元数据</h4>

            <div className="border-t border-b border-line/30 dark:border-white/[0.06] divide-y divide-line/30 dark:divide-white/[0.06] text-xs">
              {/* UUID Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-2 rounded-lg hover:bg-paper-2/40 transition-colors group">
                <span className="text-ink-muted">应用唯一标识 (UUID)</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-ink font-medium select-all">
                    {app?.id || '未生成 (创建后确定)'}
                  </span>
                  {app?.id && (
                    <button
                      type="button"
                      onClick={() => handleCopyUUID(app.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-ink-muted hover:text-ink hover:bg-paper-3 rounded-md transition-colors cursor-pointer"
                      title="复制应用 UUID"
                    >
                      {copiedUUID ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>复制</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Created At Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-2 rounded-lg hover:bg-paper-2/40 transition-colors">
                <span className="text-ink-muted">创建时间</span>
                <span className="font-mono text-ink font-medium">
                  {app?.createdAt || new Date().toISOString()}
                </span>
              </div>
            </div>
          </div>

          {/* 危险操作区域 (GitHub 风格 Danger Zone) */}
          {mode === 'edit' && app && (
            <div className="rounded-xl border border-rose-500/60 dark:border-rose-500/40 bg-rose-500/[0.02] p-5 sm:p-6 shadow-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    彻底删除此应用
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed max-w-xl">
                    一旦删除此 Docker Compose 应用栈，所有相关容器、网络与本地配置文件将被永久销毁，且不可恢复。请谨慎操作。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openDeleteModal}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-lg flex items-center gap-2 shadow-subtle transition-all active:translate-y-px whitespace-nowrap cursor-pointer self-start sm:self-center"
                >
                  <Trash className="w-4 h-4" />
                  <span>删除应用</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STICKY FLOATING ACTION BAR (GLOBAL FOR DIRTY STATE) ================= */}
      {isDirty && mode === 'edit' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-4xl backdrop-blur-xl bg-paper/85 dark:bg-[#121217]/85 border border-line/80 dark:border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.36),0_0_0_1px_rgba(255,255,255,0.05)] p-3 px-5 flex items-center justify-between gap-4 animate-sticky-bar">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <span className="text-xs font-semibold text-ink">检测到未保存的配置更改</span>
              <span className="text-[11px] text-ink-muted ml-2 hidden sm:inline">
                更改将在保存配置并重新部署后生效
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardChanges}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
            >
              放弃修改
            </button>
            <button
              onClick={handleSaveApp}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-paper-3 hover:bg-paper-4 text-ink border border-line transition-all shadow-subtle cursor-pointer"
            >
              {isSubmitting ? '保存中...' : '仅保存配置'}
            </button>
            <button
              onClick={handleSaveAndDeploy}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-all shadow-subtle flex items-center gap-1.5 active:translate-y-px cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-white" weight="fill" />
              <span>{isSubmitting ? '部署中...' : '保存并部署'}</span>
            </button>
          </div>
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

      {/* ================= STRICT DELETE APP CONFIRMATION MODAL ================= */}
      {app && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title={
            <div className="flex items-center gap-2 text-ink font-semibold">
              <Trash className="w-5 h-5 text-rose-500" weight="bold" />
              <span>危险操作：确认彻底删除应用</span>
            </div>
          }
          subtitle={`受管服务: ${app.name} (${app.id})`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            {/* Warning Message Box - Soft Red Background and Muted Text */}
            <div className="p-4 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 dark:border-rose-500/25 text-xs space-y-2 shadow-subtle">
              <div className="flex items-center gap-2 font-semibold text-sm text-ink dark:text-rose-200">
                <Warning className="w-4 h-4 text-rose-500 flex-shrink-0" weight="fill" />
                <span>此操作不可撤回，请务必谨慎！</span>
              </div>
              <p className="text-ink-muted leading-relaxed">
                删除后将立即执行 <code className="font-mono bg-paper-3 dark:bg-white/[0.08] px-1.5 py-0.5 rounded text-ink font-semibold">docker compose down</code> 销毁所有关联容器与网络，并彻底清理本地编排配置文件。
              </p>
            </div>

            {/* Input Verification Box - Standard Neutral Focus, Low Friction */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs text-ink-muted leading-relaxed">
                请输入应用标识 <strong className="text-ink font-semibold select-all font-mono">{targetAppId}</strong> 以确认删除：
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isDeleteConfirmed && !isDeleting) {
                    handleConfirmDeleteApp();
                  }
                }}
                placeholder={targetAppId}
                autoFocus
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 text-xs text-ink font-mono focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none transition-all shadow-subtle"
              />
            </div>

            {/* Modal Actions - Clean Spacing without Divider Line */}
            <div className="pt-4 mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle transition-colors cursor-pointer"
              >
                取消
              </button>

              {/* State A: Not matched -> Completely disabled, dark gray / muted */}
              {!isDeleteConfirmed ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 bg-paper-3 dark:bg-[#21262d] text-ink-muted/50 dark:text-[#8b949e] border border-line/50 dark:border-white/[0.06] text-xs font-medium rounded-lg cursor-not-allowed flex items-center gap-1.5 select-none"
                >
                  <Trash className="w-4 h-4 opacity-40" />
                  <span>确认删除应用</span>
                </button>
              ) : (
                /* State B: Matched -> High-intensity danger red + solid white bold text */
                <button
                  type="button"
                  onClick={handleConfirmDeleteApp}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 dark:bg-[#da3633] dark:hover:bg-[#f85149] text-white font-bold text-xs rounded-lg shadow-md shadow-red-600/25 transition-all flex items-center gap-1.5 active:translate-y-px cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <CircleNotch className="w-4 h-4 animate-spin text-white" />
                      <span>正在删除...</span>
                    </>
                  ) : (
                    <>
                      <Trash className="w-4 h-4 text-white" weight="bold" />
                      <span>确认删除应用</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Danger Modal: Confirm App Restore */}
      {restoringBackup && (
        <Modal
          isOpen={!!restoringBackup}
          onClose={() => !isRestoringBackup && setRestoringBackup(null)}
          title={restoringBackup.type === 'app_db' || isDb ? '⚠️ 确认恢复数据库快照' : '⚠️ 确认恢复应用快照'}
          subtitle={`快照归档: ${restoringBackup.fileName}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-ink">
                <Warning className="w-4 h-4 text-amber-500 flex-shrink-0" weight="fill" />
                <span>{restoringBackup.type === 'app_db' || isDb ? '数据库快照还原风险警示' : '快照恢复风险警示'}</span>
              </div>
              <p className="text-ink-muted leading-relaxed">
                {restoringBackup.type === 'app_db' || isDb
                  ? `恢复操作将直接将 SQL 转储/数据流导入正在运行的数据库容器中，覆盖现有 ${restoringBackup.databaseName && restoringBackup.databaseName !== 'all' ? `「${restoringBackup.databaseName}」` : '相应'} 数据库内容。`
                  : `恢复操作将使用快照归档覆盖当前应用 ${app?.name} 的本地 Compose 编排配置、.env 环境变量与数据卷。`}
              </p>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <label className="block text-ink-muted leading-relaxed">
                请输入应用标识 <strong className="text-ink font-semibold select-all font-mono">{app?.id}</strong> 以确认恢复：
              </label>
              <input
                type="text"
                value={restoreConfirmInput}
                onChange={(e) => setRestoreConfirmInput(e.target.value)}
                placeholder={app?.id}
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRestoringBackup(null)}
                disabled={isRestoringBackup}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line transition-colors cursor-pointer"
              >
                取消
              </button>
              <Button8State
                size="sm"
                variant="primary"
                state={isRestoringBackup ? 'loading' : 'default'}
                disabled={restoreConfirmInput !== app?.id || isRestoringBackup}
                onClick={handleConfirmRestoreBackup}
              >
                确认恢复快照
              </Button8State>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Confirm Delete Backup */}
      {deletingBackup && (
        <Modal
          isOpen={!!deletingBackup}
          onClose={() => !isDeletingBackup && setDeletingBackup(null)}
          title="删除备份归档"
          subtitle={`归档文件: ${deletingBackup.fileName}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-ink-muted leading-relaxed">
              确定要删除此备份归档吗？若已配置 Cloudflare R2，云端对应的存储快照也将一并永久删除。
            </p>

            <div className="pt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingBackup(null)}
                disabled={isDeletingBackup}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line transition-colors cursor-pointer"
              >
                取消
              </button>
              <Button8State
                size="sm"
                variant="danger"
                state={isDeletingBackup ? 'loading' : 'default'}
                disabled={isDeletingBackup}
                onClick={handleConfirmDeleteBackup}
              >
                确认删除
              </Button8State>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Database Backup Modal */}
      {showDbBackupModal && app && (
        <CreateDatabaseBackupModal
          isOpen={showDbBackupModal}
          onClose={() => setShowDbBackupModal(false)}
          app={app}
          engineName={dbInfo?.engine || 'Database'}
          onConfirm={handleConfirmDbBackup}
        />
      )}

      {/* Database Command Terminal Modal */}
      {showTerminalModal && app && (
        <DatabaseTerminalModal
          isOpen={showTerminalModal}
          onClose={() => setShowTerminalModal(false)}
          app={app}
        />
      )}
    </div>
  );
};
