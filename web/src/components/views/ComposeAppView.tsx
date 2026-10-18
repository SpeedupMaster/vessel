import { getStoredToken } from '../../hooks/useAuth.js';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import YAML from 'yaml';
import {
  ArrowLeft,
  Play,
  Stop,
  ArrowsClockwise,
  Trash,
  Terminal,
  FileText,
  Package,
  HardDrives,
  CloudArrowUp,
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
  X,
  CaretRight,
  Code,
  MagicWand,
  ArrowsInSimple,
  ArrowsOutSimple,
  Archive,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { AppItem, DomainItem, BackupRecord } from '../../types/index.js';
import { DATABASE_OPTIONS } from '../common/CreateDatabaseModal.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { CodeEditorWithLines } from '../common/CodeEditorWithLines.js';
import { Modal } from '../common/Modal.js';
import { EmptyState } from '../common/EmptyState.js';
import { DatabaseTerminalModal } from '../common/DatabaseTerminalModal.js';
import { CreateDatabaseBackupModal } from '../common/CreateDatabaseBackupModal.js';
import { RestoreDatabaseBackupModal } from '../common/RestoreDatabaseBackupModal.js';
import { RestoreAppBackupModal } from '../common/RestoreAppBackupModal.js';
import { CustomSelect } from '../common/CustomSelect.js';
import { Switch } from '../common/Switch.js';
import { LogsPanel } from './LogsPanel.js';
import { DeploymentsPanel } from './DeploymentsPanel.js';
import { AppSettingsPanel } from './AppSettingsPanel.js';
import { DatabaseMonitorPanel } from './DatabaseMonitorPanel.js';
import { useNotification } from '../../context/NotificationContext.js';
import { formatBytes } from '../../utils/format.js';

interface ComposeAppViewProps {
  mode: 'create' | 'edit';
  app?: AppItem | null;
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

export const ComposeAppView: React.FC<ComposeAppViewProps> = ({
  mode,
  app,
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
  onRestoreDatabaseFromFile,
  onDeleteBackup,
  onSubscribeLogs,
  onCreateDomain,
  onUpdateDomain,
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
  const [editingDomain, setEditingDomain] = useState<DomainItem | null>(null);
  const [modalDomain, setModalDomain] = useState('');
  const [modalServiceName, setModalServiceName] = useState('');
  const [modalTargetPort, setModalTargetPort] = useState('');
  const [modalTargetType, setModalTargetType] = useState<'internal' | 'host'>('internal');
  const [isBindingDomain, setIsBindingDomain] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [portError, setPortError] = useState('');
  const [recentFilledPort, setRecentFilledPort] = useState<string | null>(null);
  const domainInputRef = useRef<HTMLInputElement>(null);
  const portInputRef = useRef<HTMLInputElement>(null);
  const modalScrollBodyRef = useRef<HTMLDivElement>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
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
  const [showRestoreDbModal, setShowRestoreDbModal] = useState(false);
  const [showRestoreAppFileModal, setShowRestoreAppFileModal] = useState(false);

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
    } else if (desc.includes('libSQL') || /libsql|sqld/i.test(yaml) || n.includes('libsql') || envMap.SQLD_AUTH_TOKEN || envMap.LIBSQL_AUTH_TOKEN) {
      engine = 'libSQL';
    }

    const dbName = envMap.POSTGRES_DB || envMap.MYSQL_DATABASE || envMap.MARIADB_DATABASE || envMap.MONGO_INITDB_DATABASE || '';
    const user = envMap.POSTGRES_USER || envMap.MYSQL_USER || envMap.MARIADB_USER || envMap.MONGO_INITDB_ROOT_USERNAME || '';
    const password = envMap.POSTGRES_PASSWORD || envMap.MYSQL_PASSWORD || envMap.MARIADB_PASSWORD || envMap.MONGO_INITDB_ROOT_PASSWORD || envMap.REDIS_PASSWORD || envMap.LIBSQL_AUTH_TOKEN || envMap.SQLD_AUTH_TOKEN || '';
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

    const internalHost = app?.id || (name ? name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : 'database');

    let internalUrl = envMap.INTERNAL_DATABASE_URL || envMap.INTERNAL_MONGO_URL || envMap.INTERNAL_REDIS_URL || envMap.INTERNAL_LIBSQL_URL || '';
    if (internalUrl) {
      // Replace legacy placeholder/hardcoded 'database' host if present with actual internalHost (app.id)
      internalUrl = internalUrl.replace(/@database(?=[:/])/g, `@${internalHost}`).replace(/:\/\/database(?=[:/])/g, `://${internalHost}`);
    } else {
      if (engine === 'PostgreSQL') internalUrl = `postgresql://${user || 'postgres'}:${password}@${internalHost}:${port}/${dbName || 'postgres'}`;
      else if (engine === 'MySQL' || engine === 'MariaDB') internalUrl = `mysql://${user || 'root'}:${password}@${internalHost}:${port}/${dbName || 'app_db'}`;
      else if (engine === 'MongoDB') internalUrl = `mongodb://${user || 'mongo'}:${password}@${internalHost}:${port}/${dbName || 'app_db'}?authSource=admin`;
      else if (engine === 'Redis') internalUrl = `redis://default:${password}@${internalHost}:${port}`;
      else if (engine === 'libSQL') internalUrl = `http://${internalHost}:${port}`;
    }

    let internalRootUrl = envMap.INTERNAL_DATABASE_ROOT_URL || (rootPassword ? `mysql://root:${rootPassword}@${internalHost}:${port}/${dbName || 'app_db'}` : '');
    if (internalRootUrl) {
      internalRootUrl = internalRootUrl.replace(/@database(?=[:/])/g, `@${internalHost}`).replace(/:\/\/database(?=[:/])/g, `://${internalHost}`);
    }

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

      if (app?.id) {
        newEnv = newEnv.replace(/@database(?=[:/])/g, `@${app.id}`).replace(/:\/\/database(?=[:/])/g, `://${app.id}`);
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

  const handleConfirmDbBackup = async (
    targetDbName: string,
    schedule?: any,
    runNow: boolean = true
  ) => {
    if (!app) return;
    try {
      await onBackup(app.id, { databaseName: targetDbName, schedule, runNow });
      if (runNow) {
        toast.success(
          `数据库 ${app.name} (${targetDbName === 'all' ? '全部数据库' : targetDbName}) 快照备份已成功生成！`
        );
      } else {
        toast.success('定时自动备份配置已成功保存！');
      }
    } catch (err: any) {
      toast.error(`处理备份失败: ${err.message || '未知错误'}`);
      throw err;
    }
  };

  const handleDownloadBackup = (b: BackupRecord) => {
    if (onDownloadBackup) {
      onDownloadBackup(b.id, b.fileName);
    } else {
      const token = getStoredToken() || '';
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
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 60]);
    }
    setIsRestoringBackup(true);
    try {
      await onRestoreBackup(restoringBackup.id, {
        databaseName:
          restoringBackup.databaseName && restoringBackup.databaseName !== 'all'
            ? restoringBackup.databaseName
            : undefined,
      });
      toast.success(`应用 ${app?.name || ''} 快照恢复成功！`);
      setRestoringBackup(null);
    } catch (err: any) {
      toast.error(`恢复快照失败: ${err.message || '未知错误'}`);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const handleRestoreDbRecord = async (recordId: string, targetDatabaseName?: string) => {
    if (!onRestoreBackup) return;
    try {
      toast.info('正在还原数据库快照至容器...');
      await onRestoreBackup(recordId, { databaseName: targetDatabaseName });
      toast.success('数据库快照已成功恢复生效！');
    } catch (err: any) {
      toast.error(`恢复快照失败: ${err.message || '未知错误'}`);
      throw err;
    }
  };

  const handleRestoreDbFile = async (appId: string, file: File, targetDatabaseName?: string) => {
    if (!onRestoreDatabaseFromFile) return;
    try {
      toast.info(`正在上传并导入 ${file.name}...`);
      await onRestoreDatabaseFromFile(appId, file, targetDatabaseName);
      toast.success(`文件 ${file.name} 已成功恢复至数据库！`);
    } catch (err: any) {
      toast.error(`导入恢复失败: ${err.message || '未知错误'}`);
      throw err;
    }
  };

  const handleRestoreAppFile = async (appId: string, file: File) => {
    if (!onRestoreDatabaseFromFile) return;
    try {
      toast.info(`正在上传并还原 ${file.name}...`);
      await onRestoreDatabaseFromFile(appId, file);
      toast.success(`备份文件 ${file.name} 已成功恢复生效！`);
    } catch (err: any) {
      toast.error(`导入恢复失败: ${err.message || '未知错误'}`);
      throw err;
    }
  };

  const handleConfirmDeleteBackup = async () => {
    if (!deletingBackup || !onDeleteBackup || isDeletingBackup) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 60]);
    }
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
      if (typeof window !== 'undefined' && window.innerWidth < 768) return;
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
  }, [app?.id, app?.composeYaml, app?.envContent, app?.name, app?.description, app?.autoUpdate, mode]);

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
    setEditingDomain(null);
    const defaultSrv = detectedServices[0]?.name || 'web';
    const defaultPort = detectedServices[0]?.ports[0] ? String(detectedServices[0].ports[0]) : '80';
    setModalServiceName(defaultSrv);
    setModalTargetPort(defaultPort);
    setModalTargetType('internal');
    setModalDomain('');
    setDomainError('');
    setPortError('');
    setRecentFilledPort(null);
    setIsAddDomainModalOpen(true);
  };

  // Open Edit Domain Modal handler
  const openEditDomainModal = (dom: DomainItem) => {
    setEditingDomain(dom);
    setModalDomain(dom.domain);
    setModalServiceName(dom.serviceName || detectedServices[0]?.name || 'web');
    setModalTargetPort(String(dom.targetPort || detectedServices[0]?.ports[0] || '80'));
    setModalTargetType(dom.targetType || 'internal');
    setDomainError('');
    setPortError('');
    setRecentFilledPort(null);
    setIsAddDomainModalOpen(true);
  };

  // Submit Add / Edit Domain Modal
  const handleModalBindDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    if (!editingDomain && !onCreateDomain) return;
    if (editingDomain && !onUpdateDomain) return;

    setDomainError('');
    setPortError('');

    const cleanDomain = modalDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!cleanDomain) {
      setDomainError('请输入有效公网域名（如 app.yourdomain.com）');
      toast.error('请输入有效公网域名');
      domainInputRef.current?.focus();
      domainInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const portNum = Number(modalTargetPort);
    if (!modalTargetPort || isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      setPortError('请输入有效目标端口 (1 - 65535)');
      toast.error('请输入有效目标端口 (1 - 65535)');
      portInputRef.current?.focus();
      portInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setIsBindingDomain(true);
    try {
      if (editingDomain && onUpdateDomain) {
        await onUpdateDomain(editingDomain.id, {
          domain: cleanDomain,
          serviceName: modalServiceName.trim() || 'web',
          targetPort: portNum,
          targetType: modalTargetType,
        });
        toast.success(`域名 ${cleanDomain} 配置已更新！Caddy 路由已同步重载`);
      } else if (onCreateDomain) {
        await onCreateDomain({
          domain: cleanDomain,
          appId: app.id,
          serviceName: modalServiceName.trim() || 'web',
          targetPort: portNum,
          targetType: modalTargetType,
        });
        toast.success(`域名 ${cleanDomain} 绑定成功！Caddy 正在自动化签发 SSL 证书`);
      }
      setIsAddDomainModalOpen(false);
      setEditingDomain(null);
      setModalDomain('');
      setDomainError('');
      setPortError('');
      setRecentFilledPort(null);
    } catch (err: any) {
      toast.error(`${editingDomain ? '更新域名失败' : '绑定域名失败'}: ${err.message}`);
    } finally {
      setIsBindingDomain(false);
    }
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

    // Heavy haptic vibration on destructive action
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([30, 50, 60]);
      } catch {}
    }

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

  const handleFormatYaml = () => {
    if (!composeYaml.trim()) {
      toast.error('当前编排内容为空，无法格式化');
      return;
    }
    try {
      const parsed = YAML.parse(composeYaml);
      if (typeof parsed !== 'object' || parsed === null) {
        toast.error('YAML 内容格式不正确，无法格式化');
        return;
      }
      const formatted = YAML.stringify(parsed, { indent: 2 });
      setComposeYaml(formatted);
      toast.success('YAML 缩进与排版格式化完成');
    } catch (err: any) {
      toast.error(`格式化失败: ${err.message || '存在语法错误'}`);
    }
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

  // Discard uncommitted edits and revert back to app defaults with two-step confirmation
  const handleDiscardChanges = async () => {
    if (!app) return;
    const ok = await confirm({
      title: '⚠️ 确认放弃更改',
      subtitle: `${app.name} · 未保存的配置更改`,
      dangerTitle: '未保存的 YAML 与环境变量将立即丢弃',
      message: '确定要放弃当前所做的修改吗？代码与配置将恢复至上次部署的状态。',
      confirmText: '确认放弃',
      cancelText: '继续编辑',
      variant: 'danger',
    });
    if (!ok) return;

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
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 60]);
    }
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


  return (
    <div className="space-y-6 animate-fade-in pb-28 md:pb-16">
      {/* ================= VESSEL GLOBAL APP HEADER ================= */}
      {isDb ? (
        <div className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {/* Database Engine Official Icon with Live Status Dot */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-paper-2 flex items-center justify-center p-1.5">
                {dbOption?.icon || <Database className="w-6 h-6 text-emerald-500" />}
              </div>
              <span
                className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-paper ${
                  app?.status === 'running'
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : app?.status === 'deploying' || app?.status === 'rebuilding'
                    ? 'bg-signal animate-pulse'
                    : 'bg-rose-500'
                }`}
              />
            </div>

            {/* Title & Subtitle / ID */}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-ink leading-tight tracking-tight">
                  {app?.name || name}
                </h2>
                {app && <Badge variant={app.status}>{app.status}</Badge>}
              </div>
              <p className="text-xs font-mono text-ink-muted leading-tight mt-0.5">
                {app?.id || '新建数据库'}
              </p>
            </div>
          </div>

          <button
            onClick={onBack}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-ink-muted hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回列表</span>
          </button>
        </div>
      ) : (
        <div className="pb-4">
        {/* Top Navigation & Status Badges & Danger Action */}
        <div className="flex items-center justify-between mb-3.5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-2.5 py-1 -ml-2 rounded-xl text-xs text-ink-muted hover:text-ink hover:bg-paper-2 transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">返回受管应用列表</span>
            <span className="sm:hidden font-medium">返回列表</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Visual de-noised quiet badges: Hidden on mobile to save vertical space */}
            <span className="hidden md:inline-flex text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted select-none pointer-events-none">
              Docker Compose 模式
            </span>
            <span className="hidden md:inline-flex text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted select-none pointer-events-none">
              Vessel 控制中枢
            </span>

            {/* Global Danger Action: Delete App */}
            {mode === 'edit' && app && (
              <button
                onClick={openDeleteModal}
                data-tooltip="彻底删除此应用"
                className="p-1.5 rounded-xl text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
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
                <span className="status-dot text-accent" data-live="true" />
              ) : (
                <span
                  className={clsx(
                    'status-dot',
                    app?.status === 'running'
                      ? 'text-emerald-500'
                      : app?.status === 'deploying' || app?.status === 'rebuilding'
                      ? 'text-signal'
                      : 'text-rose-500'
                  )}
                  data-live={app?.status === 'running' || app?.status === 'deploying' || app?.status === 'rebuilding'}
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
                  <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
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
                        className="bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3 py-1 text-sm text-ink font-semibold focus:outline-none transition-colors shadow-sm"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveNameRename}
                        className="text-xs px-3 py-1 btn-vessel-primary font-semibold rounded-xl cursor-pointer"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setIsRenaming(false)}
                        className="text-xs px-3 py-1 bg-paper-2 text-ink-muted hover:text-ink rounded-xl cursor-pointer"
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
                        className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>
                      <Badge variant={app?.status || 'stopped'}>{app?.status || 'stopped'}</Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Elevated URL & Metadata Info Row (Desktop only in Edit mode, hidden on mobile for header compression) */}
              <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-muted mt-1 ${mode === 'edit' ? 'hidden md:flex' : ''}`}>
                {mode === 'create' ? (
                  <span>
                    {name
                      ? `应用标识: ${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`
                      : '配置独立的 Docker Compose 容器编排服务'}
                  </span>
                ) : (
                  <>
                    <span className="font-mono">应用 ID: {app?.id}</span>
                    <span className="text-ink-muted/40">·</span>
                    <span className="truncate max-w-xs" title={app?.currentImageTag || '由 Compose 编排托管'}>
                      镜像: {app?.currentImageTag || '由 Compose 编排托管'}
                    </span>
                    <span className="text-ink-muted/40">·</span>

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
                          <ArrowSquareOut className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(`https://${appDomains[0].domain}`)}
                          data-tooltip="复制公网链接"
                          className="p-0.5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        >
                          {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
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

        {/* Mobile Header Quick Actions Bar (md:hidden - GENERAL TAB ONLY) */}
        {mode === 'edit' && !isDb && activeTab === 'general' && (
          <div className="md:hidden flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar scrollbar-none pb-0.5">
            {app?.status !== 'running' && app?.status !== 'deploying' && app?.status !== 'rebuilding' && (
              <>
                <button
                  type="button"
                  onClick={() => !isDirty && app && onDeploy(app.id)}
                  disabled={isDirty}
                  data-tooltip={isDirty ? '配置已修改，请使用底部「保存并部署」或放弃更改' : undefined}
                  className={clsx(
                    "min-h-[36px] px-3.5 py-1.5 font-medium text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5",
                    isDirty
                      ? "bg-paper-3 text-ink-muted/50 cursor-not-allowed opacity-60"
                      : "bg-accent text-accent-contrast active:scale-95 cursor-pointer"
                  )}
                >
                  <Play className={clsx("w-3.5 h-3.5", isDirty ? "text-ink-muted" : "text-accent-contrast")} weight="fill" />
                  <span>启动应用</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className="btn-vessel-secondary min-h-[36px] px-3 py-1.5 text-xs rounded-xl shrink-0 flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span>查看日志</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(true)}
                  className="btn-vessel-secondary min-h-[36px] px-3 py-1.5 text-xs rounded-xl shrink-0 flex items-center gap-1.5"
                >
                  <span>更多操作</span>
                  <CaretDown className="w-3 h-3 text-ink-muted" />
                </button>
              </>
            )}

            {app?.status === 'running' && (
              <>
                <button
                  type="button"
                  onClick={() => !isDirty && app && onDeploy(app.id)}
                  disabled={isDirty}
                  data-tooltip={isDirty ? '配置已修改，请使用底部「保存并部署」或放弃更改' : undefined}
                  className={clsx(
                    "min-h-[36px] px-3.5 py-1.5 font-medium text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5",
                    isDirty
                      ? "bg-paper-3 text-ink-muted/50 cursor-not-allowed opacity-60"
                      : "bg-accent text-accent-contrast active:scale-95 cursor-pointer"
                  )}
                >
                  <Play className={clsx("w-3.5 h-3.5", isDirty ? "text-ink-muted" : "text-accent-contrast")} weight="fill" />
                  <span>重新部署</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className="btn-vessel-secondary min-h-[36px] px-3 py-1.5 text-xs rounded-xl shrink-0 flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span>查看日志</span>
                </button>

                <button
                  type="button"
                  onClick={() => app && onStop(app.id)}
                  className="min-h-[36px] px-2.5 py-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-medium rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <Stop className="w-3.5 h-3.5" />
                  <span>停止</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(true)}
                  className="btn-vessel-secondary min-h-[36px] px-3 py-1.5 text-xs rounded-xl shrink-0 flex items-center gap-1.5"
                >
                  <span>更多操作</span>
                  <CaretDown className="w-3 h-3 text-ink-muted" />
                </button>
              </>
            )}

            {(app?.status === 'deploying' || app?.status === 'rebuilding') && (
              <>
                <button
                  disabled
                  className="min-h-[36px] px-3 py-1.5 bg-accent/70 text-accent-contrast font-medium text-xs rounded-xl cursor-wait shrink-0 flex items-center gap-1.5"
                >
                  <CircleNotch className="w-3.5 h-3.5 text-accent-contrast animate-spin" />
                  <span>部署执行中...</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('deployments')}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>部署记录</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* ================= GLOBAL HORIZONTAL TAB NAVIGATION (Dokploy Capsule Style) ================= */}
      <div className="flex items-center gap-1 p-1 bg-paper-2 rounded-2xl w-fit max-w-full overflow-x-auto scrollbar-none no-scrollbar -mt-2">
        {(
          isDb
            ? [
                { key: 'general' as TabKey, label: '常规' },
                { key: 'environment' as TabKey, label: '环境变量' },
                { key: 'deployments' as TabKey, label: '部署记录' },
                { key: 'logs' as TabKey, label: '运行日志' },
                { key: 'monitoring' as TabKey, label: '监控' },
                { key: 'backups' as TabKey, label: '备份' },
                { key: 'advanced' as TabKey, label: '高级设置' },
              ]
            : mode === 'create'
            ? [
                { key: 'general' as TabKey, label: '常规' },
                { key: 'environment' as TabKey, label: '环境变量' },
                {
                  key: 'domains' as TabKey,
                  label: bindDomainOnDeploy && deployDomain ? '域名 (1)' : '域名',
                },
                { key: 'advanced' as TabKey, label: '高级设置' },
              ]
            : [
                { key: 'general' as TabKey, label: '常规' },
                { key: 'environment' as TabKey, label: '环境变量' },
                { key: 'deployments' as TabKey, label: '部署记录' },
                { key: 'containers' as TabKey, label: `容器 (${app?.containers?.length || 0})` },
                { key: 'domains' as TabKey, label: `域名 (${appDomains.length})` },
                { key: 'backups' as TabKey, label: `备份 (${appBackups.length})` },
                { key: 'logs' as TabKey, label: '运行日志' },
                { key: 'advanced' as TabKey, label: '高级设置' },
              ]
        ).map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={clsx(
                "px-4 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer whitespace-nowrap select-none",
                isActive
                  ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                  : "text-ink-muted hover:text-ink hover:bg-paper-3/60"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ================= MOBILE SECONDARY METADATA & AUTODEPLOY BAR (EDIT MODE) ================= */}
      {!isDb && mode === 'edit' && activeTab === 'general' && (
        <div className="md:hidden mt-2 mb-1 rounded-2xl bg-paper-2 overflow-hidden font-sans">
          <div className="px-3.5 py-2 flex items-center justify-between">
            {/* Autodeploy switch */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="autodeployToggleMobile"
                className="text-xs font-medium text-ink-muted flex items-center gap-1 cursor-pointer select-none"
              >
                <span>自动部署</span>
              </label>
              <Switch
                id="autodeployToggleMobile"
                checked={autoUpdate}
                onChange={setAutoUpdate}
                size="sm"
                aria-label="自动部署"
              />
            </div>

            {/* Accordion toggle button */}
            <button
              type="button"
              onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
              className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink px-2 py-1 rounded-xl hover:bg-paper-3 transition-colors cursor-pointer"
            >
              <span>应用元信息</span>
              <CaretDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isMetadataExpanded ? 'rotate-180 text-accent' : 'text-ink-muted'
                }`}
              />
            </button>
          </div>

          {/* Collapsible Content */}
          {isMetadataExpanded && (
            <div className="px-3.5 pt-1 pb-3 space-y-2 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-ink-faint">应用 ID</span>
                <div className="flex items-center gap-1 font-mono text-[11px] text-ink">
                  <span>{app?.id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (app?.id) {
                        navigator.clipboard.writeText(app.id);
                        setCopiedUUID(true);
                        toast.success('应用 ID 已复制');
                        setTimeout(() => setCopiedUUID(false), 2000);
                      }
                    }}
                    className="p-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    {copiedUUID ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-ink-faint">镜像标签</span>
                <span className="truncate max-w-[200px] font-mono text-[11px] text-ink" title={app?.currentImageTag || '由 Compose 编排托管'}>
                  {app?.currentImageTag || '由 Compose 编排托管'}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink-muted pt-1">
                <span className="text-ink-faint">公网路由</span>
                {appDomains.length > 0 ? (
                  <div className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                    <Globe className="w-3 h-3 text-emerald-500" />
                    <a
                      href={`https://${appDomains[0].domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accent hover:underline inline-flex items-center gap-0.5 truncate max-w-[140px]"
                    >
                      <span>{appDomains[0].domain}</span>
                      <ArrowSquareOut className="w-2.5 h-2.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(`https://${appDomains[0].domain}`)}
                      className="p-0.5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openAddDomainModal}
                    className="inline-flex items-center gap-1 text-accent hover:underline text-[11px] font-medium cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>+ 绑定公网路由</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= ACTION & CONTROL BAR (EDIT MODE - GENERAL TAB ONLY - DESKTOP ONLY) ================= */}
      {!isDb && mode === 'edit' && activeTab === 'general' && (
        <div className="hidden md:flex flex-wrap items-center justify-between gap-3 pt-3 pb-1">
          {/* Left: Core State-Driven Actions (Heuristic Principle 2 & Interaction Flow) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status: STOPPED */}
            {app?.status !== 'running' && app?.status !== 'deploying' && app?.status !== 'rebuilding' && (
              <>
                <button
                  onClick={() => !isDirty && app && onDeploy(app.id)}
                  disabled={isDirty}
                  data-tooltip={isDirty ? '配置已修改，请使用底部悬浮栏「保存并部署」或放弃更改' : undefined}
                  className={`inline-flex items-center gap-2 px-4 py-2 font-medium text-xs rounded-xl transition-all ${
                    isDirty
                      ? 'bg-paper-3 text-ink-muted/50 cursor-not-allowed opacity-60'
                      : 'bg-accent text-accent-contrast active:translate-y-px cursor-pointer'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isDirty ? 'text-ink-muted' : 'text-accent-contrast'}`} weight="fill" />
                  <span>启动应用</span>
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className="btn-vessel-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span>查看日志</span>
                </button>

                {/* Dropdown for Secondary Actions */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="btn-vessel-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer"
                  >
                    <span>更多操作</span>
                    <CaretDown className="w-3 h-3 text-ink-muted" />
                  </button>
                  {isMoreMenuOpen && (
                    <div className="absolute left-0 mt-1.5 w-48 surface-pop rounded-2xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
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
                            : 'text-ink hover:bg-paper-3 cursor-pointer'
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
                            : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer'
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
                  className={`inline-flex items-center gap-2 px-4 py-2 font-medium text-xs rounded-xl transition-all ${
                    isDirty
                      ? 'bg-paper-3 text-ink-muted/50 cursor-not-allowed opacity-60'
                      : 'bg-accent text-accent-contrast active:translate-y-px cursor-pointer'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isDirty ? 'text-ink-muted' : 'text-accent-contrast'}`} weight="fill" />
                  <span>重新部署</span>
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className="btn-vessel-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span>查看日志</span>
                </button>

                <button
                  onClick={() => app && onStop(app.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  <Stop className="w-3.5 h-3.5" />
                  <span>停止运行</span>
                </button>

                {/* Dropdown for Secondary Actions */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="btn-vessel-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer"
                  >
                    <span>更多操作</span>
                    <CaretDown className="w-3 h-3 text-ink-muted" />
                  </button>
                  {isMoreMenuOpen && (
                    <div className="absolute left-0 mt-1.5 w-48 surface-pop rounded-2xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
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
                            : 'text-ink hover:bg-paper-3 cursor-pointer'
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
                            : 'text-ink hover:bg-paper-3 cursor-pointer'
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
                            : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer'
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
                  className="inline-flex items-center gap-2 px-4 py-2 btn-vessel-primary opacity-80 font-medium text-xs rounded-lg cursor-wait"
                >
                  <CircleNotch className="w-3.5 h-3.5 text-current animate-spin" />
                  <span>部署执行中...</span>
                </button>

                <button
                  onClick={() => setActiveTab('deployments')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10 border border-accent/20 rounded-lg transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>查看部署记录</span>
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
            <Switch
              id="autodeployToggle"
              checked={autoUpdate}
              onChange={setAutoUpdate}
              size="sm"
              aria-label="自动部署"
            />
          </div>
        </div>
      )}

      {/* ================= TAB CONTENT 1: GENERAL (UNIFIED COMPOSE WORKSPACE) ================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {mode === 'create' ? (
            /* ================= CREATE MODE WORKSPACE ================= */
            <div className="card-vessel p-6 sm:p-7 space-y-6">
              <div className="pb-2">
                <h3 className="font-semibold text-base text-ink tracking-tight">应用基础配置</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  填写服务基础属性并指定初始编排文件与自动化部署策略
                </p>
              </div>

              {/* Name & Description Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    应用名称 <span className="text-rose-500 font-semibold">*</span>
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
                    className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink font-medium placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
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
                    className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                </div>
              </div>

              {/* Domain Binding Section */}
              <div className="pt-2">
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
                  <Switch
                    checked={bindDomainOnDeploy}
                    onChange={setBindDomainOnDeploy}
                    size="sm"
                    aria-label="部署时直接绑定公网域名"
                  />
                </div>

                {bindDomainOnDeploy && (
                  <div className="mt-3.5 p-4 bg-paper-2 rounded-2xl space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-ink flex items-center gap-1">
                          <span>公网域名 (FQDN)</span>
                          <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-ink-faint">部署时自动注册 Caddyfile</span>
                      </div>

                      <div className="flex items-stretch rounded-xl bg-paper-2 dark:bg-paper-3 border border-line shadow-sm overflow-hidden group focus-within:border-signal focus-within:ring-[3px] focus-within:ring-signal-soft transition-colors">
                        <div className="bg-paper-2 dark:bg-paper-4/40 px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none border-r border-line">
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
                          className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none"
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
                            className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
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
                          className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink font-mono font-medium placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Compose YAML Section */}
              <div className="pt-2 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-sm text-ink tracking-tight flex items-center gap-2">
                      <Code className="w-4 h-4 text-accent" />
                      <span>Compose 编排定义 (YAML)</span>
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      声明式管理多容器服务镜像、网络端口与卷挂载
                    </p>
                  </div>
                </div>

                {/* IDE Card Container */}
                <div className="rounded-2xl border border-line overflow-hidden bg-paper-2 shadow-card">
                  {/* Card Window Header */}
                  <div className="px-4 py-2.5 bg-paper-2/80 dark:bg-paper-3/40 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-ink flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-accent" />
                        <span>docker-compose.yml</span>
                      </span>

                      {/* YAML Validation Indicator */}
                      {!composeYaml.trim() ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-paper-3 text-ink-muted rounded-full font-medium">
                          待填写编排配置
                        </span>
                      ) : yamlValidation.valid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">
                          <Check className="w-3 h-3 text-emerald-500" />
                          YAML 语法有效
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            toast.error(
                              yamlValidation.error
                                ? `YAML 语法错误: ${yamlValidation.error}`
                                : 'YAML 格式有误，请检查缩进与语法规范'
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full font-medium cursor-pointer hover:bg-rose-500/20 transition-colors"
                          title={yamlValidation.error || '点击查看语法错误详情'}
                        >
                          <Warning className="w-3 h-3 text-rose-500" />
                          <span>语法错误</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
                      {/* Format YAML Button */}
                      <button
                        type="button"
                        onClick={handleFormatYaml}
                        disabled={!composeYaml.trim() || !yamlValidation.valid}
                        data-tooltip={
                          !composeYaml.trim()
                            ? '当前为空'
                            : !yamlValidation.valid
                            ? '存在语法错误无法格式化'
                            : '一键整理缩进与排版'
                        }
                        className="btn-vessel-secondary flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer disabled:cursor-not-allowed"
                      >
                        <MagicWand className="w-3.5 h-3.5 text-accent" />
                        <span>格式化</span>
                      </button>

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="btn-vessel-secondary flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-accent" />
                        <span>预览配置</span>
                      </button>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={handleCopyYaml}
                        className="btn-vessel-secondary flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedYaml ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Enhanced Code Editor with Borderless & Line Numbers */}
                  <CodeEditorWithLines
                    borderless
                    language="yaml"
                    value={composeYaml}
                    onChange={setComposeYaml}
                    onFocus={() => setIsEditorFocused(true)}
                    onBlur={() => setIsEditorFocused(false)}
                    placeholder={`services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "80:80"\n    restart: unless-stopped`}
                    minHeight="350px"
                    maxHeight="52vh"
                  />

                  {/* Card Window Footer */}
                  <div className="px-4 py-2 bg-paper-2/60 dark:bg-paper-3/20 border-t border-line flex items-center justify-between text-xs text-ink-muted">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span>Tab 键缩进 2 格</span>
                      <span className="text-ink-faint">·</span>
                      <span>支持 Docker Compose v2 规范</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span>已识别 {detectedServices.length} 个服务</span>
                      <span className="text-ink-faint">·</span>
                      <span>{composeYaml ? composeYaml.split('\n').length : 0} 行</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Create Mode Actions Footer */}
              <div className="hidden md:flex pt-5 mt-6 border-t border-line items-center justify-between">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCreate(false)}
                    disabled={isSubmitting}
                    className="btn-vessel-secondary px-5 py-2.5 rounded-xl transition-all active:translate-y-px"
                  >
                    {isSubmitting ? '保存中...' : '保存应用 (草稿)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreate(true)}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 btn-vessel-primary font-semibold text-xs rounded-xl cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <CircleNotch className="w-3.5 h-3.5 animate-spin text-current" />
                        <span>部署中...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-current" weight="fill" />
                        <span>创建并立即部署</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE: UNIFIED WORKSPACE ================= */
            <div className="space-y-6">
              {/* 部署设置 (Dokploy 1:1 Figure 3) */}
              {isDb && (
                <div className="rounded-2xl bg-paper-2 p-5 sm:p-6 space-y-4">
                  <h3 className="text-base font-semibold text-ink tracking-tight">部署设置</h3>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Deploy Button */}
                    <button
                      type="button"
                      onClick={() => app && onDeploy(app.id)}
                      disabled={app?.status === 'deploying' || app?.status === 'rebuilding'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold btn-vessel-primary cursor-pointer"
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
                      className="btn-vessel-secondary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowsClockwise className="w-3.5 h-3.5" />
                      <span>重载</span>
                    </button>

                    {/* Stop Button */}
                    <button
                      type="button"
                      onClick={() => app && onStop(app.id)}
                      disabled={app?.status !== 'running'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors disabled:opacity-50 cursor-pointer"
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
                      className="btn-vessel-secondary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
                    >
                      <span className="font-mono font-bold text-xs">&gt;_</span>
                      <span>打开终端</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 内部凭据 (Dokploy 1:1 Figure 3) */}
              {dbInfo && (
                <div className="rounded-2xl bg-paper-2 p-5 sm:p-6 space-y-5">
                  <h3 className="text-base font-semibold text-ink tracking-tight">内部凭据</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* User */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          用户名
                        </label>
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                <div className="rounded-2xl bg-paper-2 p-5 sm:p-6 space-y-4">
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
                        className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-4 py-2.5 text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                      />
                    </div>

                    {dbInfo.detectedExternalPort ? (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-ink mb-1.5">
                            外部连接字符串
                          </label>
                          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-paper-3 text-xs font-mono text-ink">
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
                        className="px-5 py-2 rounded-xl text-xs font-semibold btn-vessel-primary cursor-pointer flex items-center gap-1.5"
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
                <div className="rounded-2xl bg-paper-2 border border-line overflow-hidden shadow-card">
                  {/* Card Window Header */}
                  <div className="px-4 py-2.5 bg-paper-3/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-xs sm:text-sm text-ink tracking-tight">Compose 编排文件 (YAML)</h3>
                      {/* YAML Validation Indicator */}
                      {!composeYaml.trim() ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-paper-3 text-ink-muted rounded-full font-medium">
                          待填写编排配置
                        </span>
                      ) : yamlValidation.valid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">
                          <Check className="w-3 h-3 text-emerald-500" />
                          YAML 语法有效
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full truncate max-w-xs font-medium cursor-help"
                          data-tooltip={yamlValidation.error || ''}
                        >
                          <Warning className="w-3 h-3 text-rose-500" />
                          语法错误: {yamlValidation.error}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-auto">
                      {/* Mobile Done Editing button when focused */}
                      {isEditorFocused && (
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                              document.activeElement.blur();
                            }
                            setIsEditorFocused(false);
                          }}
                          className="md:hidden flex items-center gap-1 px-2.5 py-1 text-xs text-accent font-medium bg-accent/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>完成编辑</span>
                        </button>
                      )}

                      {/* Format Button */}
                      <button
                        type="button"
                        onClick={handleFormatYaml}
                        disabled={!composeYaml.trim() || !yamlValidation.valid}
                        data-tooltip={
                          !composeYaml.trim()
                            ? '当前为空'
                            : !yamlValidation.valid
                            ? '存在语法错误无法格式化'
                            : '一键整理缩进与排版'
                        }
                        className="btn-vessel-secondary flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer disabled:cursor-not-allowed"
                      >
                        <MagicWand className="w-3.5 h-3.5 text-accent" />
                        <span>格式化</span>
                      </button>

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="btn-vessel-secondary flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg cursor-pointer"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-accent" />
                        <span>预览配置</span>
                      </button>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={handleCopyYaml}
                        className="btn-vessel-secondary flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg cursor-pointer"
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
                    onFocus={() => setIsEditorFocused(true)}
                    onBlur={() => setIsEditorFocused(false)}
                    placeholder="services:&#10;  app:&#10;    image: ...&#10;    ports:&#10;      - '8080:80'"
                    minHeight="480px"
                  />

                  {/* Card Window Footer */}
                  <div className="px-4 py-2 bg-paper-3/20 flex items-center justify-between text-xs text-ink-muted">
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
          <div className="rounded-2xl bg-paper-2 border border-line overflow-hidden shadow-card">
            {/* Card Window Header */}
            <div className="px-4 py-2.5 bg-paper-3/40 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span className="font-semibold text-xs sm:text-sm text-ink tracking-tight">环境变量定义 (.env)</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted font-medium">
                .env 格式
              </span>
            </div>

            {/* Enhanced Code Editor with Syntax Highlighting and Borderless */}
            <CodeEditorWithLines
              borderless
              language="bash"
              value={envContent}
              onChange={setEnvContent}
              onFocus={() => setIsEditorFocused(true)}
              onBlur={() => setIsEditorFocused(false)}
              placeholder={'NODE_ENV=production\nDATABASE_URL=postgres://...\nPORT=8080'}
              minHeight="480px"
            />

            {/* Card Window Footer */}
            <div className="px-4 py-2 bg-paper-3/20 flex items-center justify-between text-xs text-ink-muted">
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
                className="btn-vessel-secondary px-3 py-1 text-xs font-medium rounded-lg cursor-pointer"
              >
                返回基础编排
              </button>
            )}
          </div>
        </div>
      )}
      {/* ================= TAB CONTENT 4: DEPLOYMENTS & TERMINAL (EDIT MODE) ================= */}
      {activeTab === 'deployments' && mode === 'edit' && app && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">部署记录</h3>
            <p className="text-xs text-ink-muted mt-0.5 leading-relaxed hidden sm:block">
              每次部署的完整日志与配置快照，失败时可一键回滚到任意成功版本
            </p>
          </div>
          <DeploymentsPanel app={app} onDeploy={onDeploy} />
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

          <div className="rounded-2xl bg-paper-2 border border-line overflow-hidden shadow-card">
            {(app.containers || []).length === 0 ? (
              <EmptyState
                className="m-3 sm:m-4"
                icon={<Package className="w-5 h-5" weight="duotone" />}
                title="暂未检测到运行中的容器实例"
                description="请点击上方「启动应用」启动应用编排。"
              />
            ) : (
              <div className="p-3 sm:p-4 space-y-1.5">
                {app.containers.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-xl hover:bg-paper-3/60 transition-colors flex items-center justify-between">
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
        <div className="p-6 sm:p-7 rounded-2xl bg-paper-2 space-y-5">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight">部署时域名绑定</h3>
              <p className="text-xs text-ink-muted mt-0.5">
                在创建并部署此应用的同时，自动为 Caddy 注册反向代理路由并申请免费自动续订 SSL 证书
              </p>
            </div>
            <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted">
              Caddy 自动化 HTTPS
            </span>
          </div>

          <div className="p-4 bg-paper-3 rounded-2xl space-y-4">
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
              <Switch
                checked={bindDomainOnDeploy}
                onChange={setBindDomainOnDeploy}
                size="sm"
                aria-label="部署时自动绑定公网域名"
              />
            </div>

            {bindDomainOnDeploy && (
              <div className="pt-3 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-ink flex items-center gap-1">
                      <span>绑定公网域名 (FQDN)</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-ink-faint">部署时自动下发至 Caddyfile</span>
                  </div>

                  <div className="flex items-stretch rounded-xl bg-paper-2 dark:bg-paper-3 border border-line shadow-sm overflow-hidden group focus-within:border-signal focus-within:ring-[3px] focus-within:ring-signal-soft transition-colors">
                    <div className="bg-paper-2 dark:bg-paper-4/40 px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none border-r border-line">
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
                      className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-500/10 flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
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
                        className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
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
                      className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink font-mono font-medium placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
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
                            className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-accent text-accent-contrast shadow-sm font-semibold'
                                : 'bg-paper-2 hover:bg-paper-4 text-ink-muted hover:text-ink'
                            }`}
                          >
                            <span>{s.name}:{p}</span>
                            {isSelected && <CheckCircle className="w-3.5 h-3.5" weight="bold" />}
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
                      className={`p-3.5 text-left rounded-xl transition-colors relative flex flex-col justify-between cursor-pointer border ${
                        deployTargetType === 'internal'
                          ? 'bg-paper-3 dark:bg-paper-4 border-signal/70 ring-1 ring-signal-ring shadow-sm'
                          : 'bg-paper-2/60 dark:bg-paper-3/40 border-line-subtle hover:bg-paper-3 hover:dark:bg-paper-3/80 hover:border-line-strong'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className={`w-4 h-4 ${deployTargetType === 'internal' ? 'text-accent' : 'text-ink-faint'}`} weight="bold" />
                            <span className={`text-xs font-semibold ${deployTargetType === 'internal' ? 'text-ink' : 'text-ink-muted'}`}>容器内部网络</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">推荐</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${deployTargetType === 'internal' ? 'border-accent bg-accent' : 'border-line-strong bg-transparent'}`}>
                            {deployTargetType === 'internal' && <div className="w-1.5 h-1.5 rounded-full bg-accent-contrast" />}
                          </div>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${deployTargetType === 'internal' ? 'text-ink-muted' : 'text-ink-faint'}`}>
                          基于 Docker 内部服务网络互通，容器端口无需向宿主机暴露更安全
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeployTargetType('host')}
                      className={`p-3.5 text-left rounded-xl transition-colors relative flex flex-col justify-between cursor-pointer border ${
                        deployTargetType === 'host'
                          ? 'bg-paper-3 dark:bg-paper-4 border-signal/70 ring-1 ring-signal-ring shadow-sm'
                          : 'bg-paper-2/60 dark:bg-paper-3/40 border-line-subtle hover:bg-paper-3 hover:dark:bg-paper-3/80 hover:border-line-strong'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <HardDrives className={`w-4 h-4 ${deployTargetType === 'host' ? 'text-accent' : 'text-ink-faint'}`} weight="bold" />
                            <span className={`text-xs font-semibold ${deployTargetType === 'host' ? 'text-ink' : 'text-ink-muted'}`}>宿主机端口</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${deployTargetType === 'host' ? 'border-accent bg-accent' : 'border-line-strong bg-transparent'}`}>
                            {deployTargetType === 'host' && <div className="w-1.5 h-1.5 rounded-full bg-accent-contrast" />}
                          </div>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${deployTargetType === 'host' ? 'text-ink-muted' : 'text-ink-faint'}`}>
                          代理至主机映射的 localhost 端口，适合本机网络直通场景
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => setActiveTab('general')}
              className="text-xs text-ink-muted hover:text-ink cursor-pointer"
            >
              返回基础编排
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCreate(false)}
                disabled={isSubmitting}
                className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer"
              >
                保存草稿
              </button>
              <button
                onClick={() => handleCreate(true)}
                disabled={isSubmitting}
                className="px-5 py-2 btn-vessel-primary font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-current" weight="fill" />
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
            <EmptyState
              className="bg-paper-2"
              icon={<Globe className="w-5 h-5" weight="duotone" />}
              title="该应用尚未绑定自定义公网域名"
              description="可直接在此为本应用添加公网域名。Vessel 内置 Caddy 将自动向证书机构签发 SSL/TLS 证书，并在到期前 30 天静默自动续期。"
              action={
                <button
                  type="button"
                  onClick={openAddDomainModal}
                  className="btn-vessel-primary text-xs px-3.5 py-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-current" weight="bold" />
                  <span>添加公网域名</span>
                </button>
              }
            />
          ) : (
            <div className="space-y-2">
              {appDomains.map((dom) => (
                <div
                  key={dom.id}
                  className="p-4 sm:p-5 rounded-2xl bg-paper-2 hover:bg-paper-2/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
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
                        <code className="font-mono text-[11.5px] text-ink font-medium bg-paper-3 px-1.5 py-0.5 rounded">
                          {dom.targetType === 'internal'
                            ? `${dom.serviceName}:${dom.targetPort} (容器内部)`
                            : `127.0.0.1:${dom.targetPort} (宿主机)`}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-muted">颁发机构:</span>
                        <span className="text-ink font-medium">
                          {dom.sslIssuer || "Let's Encrypt (Auto-Renew)"}
                        </span>
                      </div>
                      {dom.sslExpiresAt && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink-muted">到期时间:</span>
                          <span className="font-mono text-ink">{dom.sslExpiresAt}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center self-end pl-11 sm:pl-0">
                    {onUpdateDomain && (
                      <button
                        type="button"
                        onClick={() => openEditDomainModal(dom)}
                        className="px-3 py-1.5 rounded-xl text-ink-muted hover:text-ink hover:bg-paper-3 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="编辑域名路由"
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                        <span>编辑</span>
                      </button>
                    )}

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
                        className="px-3 py-1.5 rounded-xl text-ink-muted hover:text-ink hover:bg-paper-3 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
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
                        className="p-2 rounded-xl text-ink-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
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
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">运行监控</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              容器实时状态、健康检查、退出原因与重启情况，每 10 秒刷新
            </p>
          </div>
          <DatabaseMonitorPanel app={app} engine={dbInfo?.engine || '数据库'} onOpenLogs={() => setActiveTab('logs')} />
        </div>
      )}

      {/* ================= TAB CONTENT 7: BACKUPS (EDIT MODE) ================= */}
      {activeTab === 'backups' && mode === 'edit' && app && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {isDb && (
                <div className="w-9 h-9 rounded-xl bg-paper-3 flex items-center justify-center text-ink-muted shrink-0 mt-0.5">
                  <Database className="w-4.5 h-4.5 text-emerald-500" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm text-ink tracking-tight">
                  {isDb ? '备份 (Backups)' : 'Cloudflare R2 灾备记录'}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                  {isDb
                    ? '为数据库添加备份，将数据保存至不同存储服务提供商 (Add backups to your database to save data to a different provider).'
                    : '此应用对应的数据卷与 Compose 编排快照备份存档'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button8State
                size="sm"
                variant="primary"
                state={isBackingUp ? 'loading' : 'default'}
                icon={<Plus className="w-3.5 h-3.5" weight="bold" />}
                onClick={handleAppBackup}
              >
                {isDb ? '新建备份' : '立即备份此应用'}
              </Button8State>

              <Button8State
                size="sm"
                variant="secondary"
                icon={<ArrowCounterClockwise className="w-3.5 h-3.5 text-accent" />}
                onClick={() => {
                  if (isDb) {
                    setShowRestoreDbModal(true);
                  } else {
                    setShowRestoreAppFileModal(true);
                  }
                }}
              >
                恢复备份
              </Button8State>
            </div>
          </div>

          {/* Active Schedule Status Banner */}
          {isDb && app?.backupSchedule?.enabled && (
            <div className="p-4 rounded-2xl bg-paper-2 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-card">
              <div className="flex items-center gap-2.5">
                <span className="status-dot text-emerald-500 shrink-0" data-live="true" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">定时自动备份已开启</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      自动调度中
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    执行周期: <code className="font-mono text-ink bg-paper-3 px-1.5 py-0.5 rounded">{app.backupSchedule.cronSchedule}</code> · 
                    目标: <span className="font-mono text-ink font-medium">{app.backupSchedule.targetDatabase === 'all' ? '全部数据库' : app.backupSchedule.targetDatabase}</span> · 
                    保留最新 <span className="font-mono text-ink font-medium">{app.backupSchedule.retentionCount || 7}</span> 份
                    {app.backupSchedule.lastBackupAt && (
                      <span className="text-ink-faint ml-2">
                        (上次执行: {new Date(app.backupSchedule.lastBackupAt).toLocaleString()})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDbBackupModal(true)}
                className="btn-vessel-secondary self-end sm:self-center px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer shrink-0"
              >
                修改定时计划
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-paper-2 border border-line overflow-hidden shadow-card">
            {appBackups.length === 0 ? (
              isDb ? (
                <EmptyState
                  className="m-3 sm:m-4"
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3-3.58-3-8-3-8 1.34-8 3z" />
                      <path d="M4 6v6c0 1.66 3.58 3 8 3" />
                      <path d="M20 6v3" />
                      <path d="M4 12v6c0 1.66 3.58 3 8 3" />
                      <path d="M16 19h6m-3-3l3 3-3 3" />
                    </svg>
                  }
                  title="暂无备份配置"
                  description="No backups configured"
                  action={
                    <>
                    <button
                      type="button"
                      onClick={handleAppBackup}
                      className="px-4 py-2 btn-vessel-primary text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-current" weight="bold" />
                      <span>新建备份</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRestoreDbModal(true)}
                      className="btn-vessel-secondary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowCounterClockwise className="w-3.5 h-3.5 text-accent" />
                      <span>恢复备份</span>
                    </button>
                    </>
                  }
                />
              ) : (
                <EmptyState
                  className="m-3 sm:m-4"
                  icon={<Archive className="w-5 h-5" weight="duotone" />}
                  title="暂无此应用的独立备份归档"
                  description="点击「立即备份」可将 Compose 编排、.env 与持久化数据卷打包归档，或直接从本地上传备份包还原"
                  action={
                    <>
                    <button
                      type="button"
                      onClick={handleAppBackup}
                      className="px-4 py-2 btn-vessel-primary text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-current" weight="bold" />
                      <span>立即备份此应用</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRestoreAppFileModal(true)}
                      className="btn-vessel-secondary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowCounterClockwise className="w-3.5 h-3.5 text-accent" />
                      <span>从本地备份包恢复</span>
                    </button>
                    </>
                  }
                />
              )
            ) : (
              <div className="p-3 sm:p-4 space-y-1.5">
                {appBackups.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper-3/60 transition-colors">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-ink font-mono">{b.fileName}</span>
                        {b.databaseName && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                            {b.databaseName === 'all' ? '全部数据库' : `库: ${b.databaseName}`}
                          </span>
                        )}
                        {b.type === 'app_db' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
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
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-sm text-ink tracking-tight">高级设置</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">部署触发、部署策略、通知订阅与危险操作</p>
          </div>
          {mode === 'edit' && app ? (
            <AppSettingsPanel
              app={app}
              onOpenDelete={openDeleteModal}
              onOpenFreshVolumes={() => setIsFreshVolumesModalOpen(true)}
            />
          ) : (
            <p className="text-xs text-ink-muted">创建应用后即可配置 Webhook、部署策略与通知。</p>
          )}
        </div>
      )}

      {/* ================= MOBILE ACTION SHEET FOR MORE MENU (DOKPLOY NATIVE EXPERIENCE) ================= */}
      {typeof document !== 'undefined' &&
        isMoreMenuOpen &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 z-50 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[3px] animate-fade-in flex flex-col justify-end"
            onClick={() => setIsMoreMenuOpen(false)}
          >
            <div
              className="w-full surface-pop rounded-t-[24px] p-4 sm:p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-3 font-sans animate-bottom-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle Indicator */}
              <div className="w-9 h-1 bg-ink-faint/30 rounded-full mx-auto mb-1 shrink-0" />

              {/* Header */}
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h3 className="text-sm font-semibold text-ink">更多操作</h3>
                  <p className="text-[11px] text-ink-muted">{app?.name} · 容器实例高级控制</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(false)}
                  aria-label="关闭面板"
                  className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X className="w-4 h-4" weight="bold" />
                </button>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {/* Restart (if running) */}
                {app?.status === 'running' && (
                  <button
                    type="button"
                    disabled={isDirty}
                    onClick={() => {
                      if (isDirty) {
                        toast.warning('配置已修改，请先保存或放弃更改');
                        return;
                      }
                      setIsMoreMenuOpen(false);
                      app && onRestart(app.id);
                    }}
                    className={clsx(
                      'w-full min-h-[56px] p-3 rounded-2xl flex items-center gap-3.5 transition-all text-left',
                      isDirty
                        ? 'bg-paper-3 opacity-50 cursor-not-allowed'
                        : 'bg-paper-3 hover:bg-paper-4 cursor-pointer active:scale-[0.99]'
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <ArrowsClockwise className="w-5 h-5" weight="bold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink">重启服务实例</div>
                      <div className="text-xs text-ink-muted truncate">
                        平滑重启所有运行中的容器实例，不重新拉取镜像
                      </div>
                    </div>
                    <CaretRight className="w-4 h-4 text-ink-faint shrink-0" />
                  </button>
                )}

                {/* Rebuild container services */}
                <button
                  type="button"
                  disabled={isDirty}
                  onClick={() => {
                    if (isDirty) {
                      toast.warning('配置已修改，请先保存或放弃更改');
                      return;
                    }
                    setIsMoreMenuOpen(false);
                    app && onRebuild(app.id);
                  }}
                  className={clsx(
                    'w-full min-h-[56px] p-3 rounded-2xl flex items-center gap-3.5 transition-all text-left',
                    isDirty
                      ? 'bg-paper-3 opacity-50 cursor-not-allowed'
                      : 'bg-paper-3 hover:bg-paper-4 cursor-pointer active:scale-[0.99]'
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <ArrowsClockwise className="w-5 h-5" weight="bold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">重建容器服务</div>
                    <div className="text-xs text-ink-muted truncate">
                      强制重新构建并重新创建所有容器实例
                    </div>
                  </div>
                  <CaretRight className="w-4 h-4 text-ink-faint shrink-0" />
                </button>

                {/* Fresh Volumes Deploy (Danger) */}
                <button
                  type="button"
                  disabled={isDirty}
                  onClick={() => {
                    if (isDirty) {
                      toast.warning('配置已修改，请先保存或放弃更改');
                      return;
                    }
                    setIsMoreMenuOpen(false);
                    setIsFreshVolumesModalOpen(true);
                  }}
                  className={clsx(
                    'w-full min-h-[56px] p-3 rounded-2xl flex items-center gap-3.5 transition-all text-left',
                    isDirty
                      ? 'bg-rose-500/5 opacity-50 cursor-not-allowed'
                      : 'bg-rose-500/10 hover:bg-rose-500/15 cursor-pointer active:scale-[0.99]'
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5" weight="bold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">清空卷重新部署</div>
                    <div className="text-xs text-rose-500/80 truncate">
                      清空关联数据卷并全新初始化部署 (高危操作)
                    </div>
                  </div>
                  <CaretRight className="w-4 h-4 text-rose-400 shrink-0" />
                </button>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="btn-vessel-secondary w-full min-h-[48px] rounded-xl text-sm font-semibold flex items-center justify-center cursor-pointer mt-1"
              >
                取消
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* ================= DESKTOP STICKY FLOATING ACTION BAR (FOR DIRTY STATE) ================= */}
      {isDirty && mode === 'edit' && (
        <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-4xl backdrop-blur-xl bg-paper-2/90 border border-line rounded-2xl shadow-pop p-3 px-5 items-center justify-between gap-4 animate-sticky-bar">
          <div className="flex items-center gap-3">
            <span className="status-dot text-amber-500" data-live="true" />
            <div>
              <span className="text-xs font-semibold text-ink">检测到未保存的配置更改</span>
              <span className="text-[11px] text-ink-muted ml-2">
                更改将在保存配置并重新部署后生效
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardChanges}
              className="btn-vessel-ghost px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            >
              放弃
            </button>
            <button
              onClick={handleSaveApp}
              disabled={isSubmitting}
              className="btn-vessel-secondary px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
            >
              {isSubmitting ? '保存中...' : '仅保存'}
            </button>
            <button
              onClick={handleSaveAndDeploy}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold btn-vessel-primary flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <CircleNotch className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" weight="fill" />
              )}
              <span>{isSubmitting ? '部署中...' : '保存并部署'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MOBILE FULL-WIDTH STICKY ACTION BAR (FOR DIRTY STATE) ================= */}
      {typeof document !== 'undefined' &&
        isDirty &&
        mode === 'edit' &&
        createPortal(
          <div
            role="alert"
            className={clsx(
              "md:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper-2/90 backdrop-blur-xl border-t border-line shadow-pop p-3.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-transform duration-300 transform",
              isEditorFocused ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
            )}
          >
            <div className="text-xs text-ink-muted mb-2.5 font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="status-dot text-amber-500" data-live="true" />
                <span className="text-ink font-semibold">检测到未保存的更改</span>
              </div>
              <span className="text-[11px] text-ink-faint">请保存后生效</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="btn-vessel-ghost flex-1 min-h-[42px] px-2 py-2 text-xs font-semibold rounded-xl cursor-pointer text-center"
              >
                放弃
              </button>
              <button
                type="button"
                onClick={handleSaveApp}
                disabled={isSubmitting}
                className="btn-vessel-secondary flex-1 min-h-[42px] px-2 py-2 text-xs font-semibold rounded-xl cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '保存中...' : '仅保存'}
              </button>
              <button
                type="button"
                onClick={handleSaveAndDeploy}
                disabled={isSubmitting}
                className="flex-[2] min-h-[42px] px-2 py-2 text-xs font-semibold btn-vessel-primary rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" weight="fill" />
                )}
                <span>{isSubmitting ? '部署中...' : '保存并部署'}</span>
              </button>
            </div>
          </div>,
          document.body
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
            <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
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
                      className="p-4 rounded-2xl bg-paper-3 text-xs space-y-1.5"
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

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer"
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
          <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-300 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-300">
              <Warning className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" weight="fill" />
              <span>数据卷内所有数据将彻底清空且无法撤回！</span>
            </div>
            <p className="leading-relaxed">
              此操作将执行 <code className="font-mono bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded text-rose-900 dark:text-rose-100 font-semibold">docker compose down -v</code>。
              所有挂载在该应用下的<strong>持久化数据卷（Volumes）将被彻底销毁</strong>，包括数据库中所有数据表记录、用户上传的本地持久文件等，随后以<strong>全新空白初始状态</strong>重新创建容器。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-paper-3 text-xs space-y-2">
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

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={handleConfirmFreshVolumes}
              className="order-1 sm:order-2 w-full sm:w-auto min-h-[46px] sm:min-h-0 px-5 py-2.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shadow-rose-600/20"
            >
              <Database className="w-4 h-4 text-white" />
              <span>确认彻底清空并重新部署</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFreshVolumesModalOpen(false)}
              className="btn-vessel-secondary order-2 sm:order-1 w-full sm:w-auto py-2.5 sm:py-2 px-4 text-xs font-medium rounded-xl text-center cursor-pointer select-none"
            >
              取消并返回
            </button>
          </div>
        </div>
      </Modal>

      {/* ================= BIND DOMAIN MODAL (NATIVE BOTTOM SHEET ON MOBILE / CENTERED ON DESKTOP) ================= */}
      {isAddDomainModalOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[3px] animate-fade-in font-sans"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bind-domain-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isBindingDomain) {
              setIsAddDomainModalOpen(false);
              setEditingDomain(null);
            }
          }}
        >
          {/* Modal / Bottom Sheet Container: Native Bottom Sheet on mobile (rounded-t-3xl), centered dialog on desktop */}
          <div
            className="w-full sm:max-w-xl max-h-[92vh] sm:max-h-[90vh] surface-pop rounded-t-[24px] sm:rounded-[22px] flex flex-col overflow-hidden animate-bottom-sheet sm:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle Indicator (Image 2 style) */}
            <div className="w-9 h-1 bg-ink-faint/30 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

            {/* Top Header */}
            <div className="bg-paper-2/95 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" weight="bold" />
                </div>
                <div className="min-w-0">
                  <h3 id="bind-domain-title" className="text-base sm:text-lg font-semibold text-ink tracking-tight font-sans truncate">
                    {editingDomain ? '编辑域名路由配置' : '绑定公网域名与 SSL 路由'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-ink-muted truncate">
                    {editingDomain ? `当前配置: ${editingDomain.domain}` : `受管服务: ${app?.name || name || '当前应用'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddDomainModalOpen(false);
                  setEditingDomain(null);
                }}
                disabled={isBindingDomain}
                aria-label="关闭窗口"
                className="min-w-[44px] min-h-[44px] -mr-2 p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" weight="bold" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleModalBindDomain} className="flex-1 flex flex-col overflow-hidden">
              <div
                ref={modalScrollBodyRef}
                className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-5 pb-24 sm:pb-6"
              >
                {/* Domain Input with Addon & Error */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-ink flex items-center gap-1">
                      <span>公网域名 (FQDN)</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-ink-faint">支持一级主域名或子域名</span>
                  </div>

                  <div className={clsx(
                    "flex items-stretch rounded-xl bg-paper-2 dark:bg-paper-3 border shadow-sm overflow-hidden group transition-all",
                    domainError
                      ? "border-rose-500/70"
                      : "border-line focus-within:border-signal focus-within:ring-[3px] focus-within:ring-signal-soft"
                  )}>
                    <div className="bg-paper-2 dark:bg-paper-4/40 px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none border-r border-line shrink-0">
                      <LockKey className="w-3.5 h-3.5" weight="bold" />
                      <span>https://</span>
                    </div>
                    <input
                      ref={domainInputRef}
                      type="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      value={modalDomain}
                      onChange={(e) => {
                        let val = e.target.value.trim();
                        val = val.replace(/^https?:\/\//i, '');
                        setModalDomain(val);
                        if (domainError) setDomainError('');
                      }}
                      placeholder="app.yourdomain.com"
                      className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none min-h-[44px]"
                      autoFocus
                    />
                  </div>
                  {domainError && (
                    <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                      <Warning className="w-3.5 h-3.5 shrink-0" weight="fill" />
                      <span>{domainError}</span>
                    </p>
                  )}
                </div>

                {/* DNS Guidance Banner */}
                <div className="p-3.5 rounded-2xl bg-blue-500/10 flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
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
                            if (portError) setPortError('');
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
                        className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      目标端口 (上游端口) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={portInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={modalTargetPort}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setModalTargetPort(val);
                        if (portError) setPortError('');
                      }}
                      placeholder="8080"
                      className={clsx(
                        "w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink font-mono font-medium placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm",
                        portError
                          ? "border-rose-500/70"
                          : "border-line"
                      )}
                    />
                    {portError && (
                      <p className="mt-1.5 text-xs text-rose-500 flex items-center gap-1">
                        <Warning className="w-3.5 h-3.5 shrink-0" weight="fill" />
                        <span>{portError}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Select Pill Buttons */}
                {detectedServices.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <span className="text-[11px] text-ink-faint flex items-center gap-1 font-medium">
                      <Lightning className="w-3.5 h-3.5 text-amber-500" weight="fill" />
                      快速填入编排检测端口:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {detectedServices.flatMap((s) =>
                        s.ports.map((p) => {
                          const portStr = String(p);
                          const isSelected = modalServiceName === s.name && modalTargetPort === portStr;
                          const isJustFilled = recentFilledPort === `${s.name}-${portStr}`;
                          return (
                            <button
                              key={`${s.name}-${p}`}
                              type="button"
                              onClick={() => {
                                setModalServiceName(s.name);
                                setModalTargetPort(portStr);
                                if (portError) setPortError('');
                                setRecentFilledPort(`${s.name}-${portStr}`);
                                if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                                  try { navigator.vibrate(15); } catch {}
                                }
                                setTimeout(() => setRecentFilledPort(null), 1200);
                              }}
                              className={clsx(
                                "min-h-[36px] px-3 py-1.5 text-xs font-mono rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 select-none",
                                isSelected || isJustFilled
                                  ? 'bg-accent text-accent-contrast shadow-sm font-semibold'
                                  : 'bg-paper-3 hover:bg-paper-4 text-ink-muted hover:text-ink'
                              )}
                            >
                              <span>{s.name}:{p}</span>
                              {(isSelected || isJustFilled) && <CheckCircle className="w-3.5 h-3.5 text-accent-contrast animate-fade-in" weight="bold" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Target Network Mode Radio Cards */}
                <div role="radiogroup" aria-label="反向代理目标网络" className="space-y-2">
                  <label className="block text-xs font-semibold text-ink">
                    反向代理目标网络
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={modalTargetType === 'internal'}
                      onClick={() => setModalTargetType('internal')}
                      className={`p-3.5 sm:p-4 text-left rounded-xl transition-colors relative flex flex-col justify-between cursor-pointer select-none active:scale-[0.99] border ${
                        modalTargetType === 'internal'
                          ? 'bg-paper-3 dark:bg-paper-4 border-signal/70 ring-1 ring-signal-ring shadow-sm'
                          : 'bg-paper-2/60 dark:bg-paper-3/40 border-line-subtle hover:bg-paper-3 hover:dark:bg-paper-3/80 hover:border-line-strong'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className={`w-4 h-4 ${modalTargetType === 'internal' ? 'text-accent' : 'text-ink-faint'}`} weight="bold" />
                            <span className={`text-xs font-semibold ${modalTargetType === 'internal' ? 'text-ink' : 'text-ink-muted'}`}>容器内部网络</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">推荐</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${modalTargetType === 'internal' ? 'border-accent bg-accent' : 'border-line-strong bg-transparent'}`}>
                            {modalTargetType === 'internal' && <div className="w-1.5 h-1.5 rounded-full bg-accent-contrast" />}
                          </div>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${modalTargetType === 'internal' ? 'text-ink-muted' : 'text-ink-faint'}`}>
                          直通容器服务内网通信，无需向宿主机暴露端口，网络暴露面最小更安全
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={modalTargetType === 'host'}
                      onClick={() => setModalTargetType('host')}
                      className={`p-3.5 sm:p-4 text-left rounded-xl transition-colors relative flex flex-col justify-between cursor-pointer select-none active:scale-[0.99] border ${
                        modalTargetType === 'host'
                          ? 'bg-paper-3 dark:bg-paper-4 border-signal/70 ring-1 ring-signal-ring shadow-sm'
                          : 'bg-paper-2/60 dark:bg-paper-3/40 border-line-subtle hover:bg-paper-3 hover:dark:bg-paper-3/80 hover:border-line-strong'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <HardDrives className={`w-4 h-4 ${modalTargetType === 'host' ? 'text-accent' : 'text-ink-faint'}`} weight="bold" />
                            <span className={`text-xs font-semibold ${modalTargetType === 'host' ? 'text-ink' : 'text-ink-muted'}`}>宿主机端口</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${modalTargetType === 'host' ? 'border-accent bg-accent' : 'border-line-strong bg-transparent'}`}>
                            {modalTargetType === 'host' && <div className="w-1.5 h-1.5 rounded-full bg-accent-contrast" />}
                          </div>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${modalTargetType === 'host' ? 'text-ink-muted' : 'text-ink-faint'}`}>
                          反向代理至主机 127.0.0.1 映射端口，适合需要本地端口调试的场景
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sticky Bottom Action Bar: Native Bottom Sheet style matching Image 2 */}
              <div className="sticky bottom-0 z-10 bg-paper-2/95 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-3.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0">
                {/* Main Submit Button */}
                <button
                  type="submit"
                  disabled={isBindingDomain}
                  className="w-full sm:w-auto min-h-[46px] sm:min-h-[38px] px-6 py-2.5 sm:py-2 btn-vessel-primary text-sm sm:text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isBindingDomain ? (
                    <>
                      <CircleNotch className="w-4 h-4 animate-spin" />
                      <span>{editingDomain ? '正在同步配置并重载 Caddy...' : '正在配置 Caddy 并签发证书...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" weight="bold" />
                      <span>{editingDomain ? '保存修改并同步反代路由' : '确认绑定并自动签发证书'}</span>
                    </>
                  )}
                </button>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAddDomainModalOpen(false);
                    setEditingDomain(null);
                  }}
                  disabled={isBindingDomain}
                  className="btn-vessel-secondary w-full sm:w-auto py-2.5 sm:py-2 px-4 text-xs font-medium rounded-xl cursor-pointer text-center select-none sm:order-first"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ================= STRICT DELETE APP CONFIRMATION MODAL ================= */}
      {app && isDeleteModalOpen && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title={`彻底删除应用「${app.name}」`}
          subtitle="此操作无法撤销，所有关联容器与配置将被清除"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 font-sans text-xs">
            <p className="text-ink-muted leading-relaxed">
              将立即执行 <code className="font-mono bg-paper-3 border border-line px-1.5 py-0.5 rounded text-ink font-semibold">docker compose down</code> 销毁所有关联容器与虚拟网络，并彻底清除本地配置文件与持久化元数据。
            </p>

            {/* Target Identifier Input with Clean Minimalist Prompt */}
            <div className="space-y-2 pt-1">
              <label htmlFor="delete-app-confirm-input" className="flex items-center justify-between text-ink-muted">
                <span>
                  请输入 <strong className="font-mono font-semibold text-ink select-all">{targetAppId}</strong> 以确认：
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmInput(targetAppId);
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
                  }}
                  className="text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer select-none underline decoration-dotted underline-offset-2"
                >
                  快速填入
                </button>
              </label>

              <input
                id="delete-app-confirm-input"
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isDeleteConfirmed && !isDeleting) {
                    handleConfirmDeleteApp();
                  }
                }}
                placeholder={targetAppId}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                className="w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/60 focus:outline-none transition-colors shadow-sm"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none"
              >
                取消
              </button>
              <Button8State
                size="sm"
                variant="danger"
                state={isDeleting ? 'loading' : 'default'}
                disabled={!isDeleteConfirmed || isDeleting}
                onClick={handleConfirmDeleteApp}
                className="rounded-xl px-4 py-2 text-xs font-medium"
              >
                彻底删除
              </Button8State>
            </div>
          </div>
        </Modal>
      )}

      {/* Danger Modal: Confirm App Restore */}
      {restoringBackup && (
        <Modal
          isOpen={!!restoringBackup}
          onClose={() => !isRestoringBackup && setRestoringBackup(null)}
          title={restoringBackup.type === 'app_db' || isDb ? '恢复数据库快照' : '恢复应用快照'}
          subtitle={`快照归档: ${restoringBackup.fileName}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 font-sans text-xs">
            <p className="text-ink-muted leading-relaxed">
              {restoringBackup.type === 'app_db' || isDb
                ? `该操作将直接将 SQL 转储数据导入正在运行的数据库容器中，覆盖现有 ${restoringBackup.databaseName && restoringBackup.databaseName !== 'all' ? `「${restoringBackup.databaseName}」` : '相应'} 数据库内容。`
                : `该操作将使用快照归档覆盖当前应用 ${app?.name} 的本地 Compose 编排配置、.env 环境变量与数据卷。`}
            </p>

            <div className="space-y-2 pt-1">
              <label htmlFor="restore-app-confirm-input" className="flex items-center justify-between text-ink-muted">
                <span>
                  请输入应用标识 <strong className="font-mono font-semibold text-ink select-all">{app?.id}</strong> 以确认：
                </span>
                {app?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreConfirmInput(app.id);
                      if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
                    }}
                    className="text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer select-none underline decoration-dotted underline-offset-2"
                  >
                    快速填入
                  </button>
                )}
              </label>

              <input
                id="restore-app-confirm-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={restoreConfirmInput}
                onChange={(e) => setRestoreConfirmInput(e.target.value)}
                placeholder={app?.id}
                className="w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/60 focus:outline-none transition-colors shadow-sm"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestoringBackup(null)}
                disabled={isRestoringBackup}
                className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none"
              >
                取消
              </button>
              <Button8State
                size="sm"
                variant="primary"
                state={isRestoringBackup ? 'loading' : 'default'}
                disabled={restoreConfirmInput !== app?.id || isRestoringBackup}
                onClick={handleConfirmRestoreBackup}
                className="rounded-xl px-4 py-2 text-xs font-medium"
              >
                确认恢复
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

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
              <Button8State
                size="sm"
                variant="danger"
                state={isDeletingBackup ? 'loading' : 'default'}
                disabled={isDeletingBackup}
                onClick={handleConfirmDeleteBackup}
                className="order-1 sm:order-2 w-full sm:w-auto min-h-[46px] sm:min-h-0"
              >
                确认删除
              </Button8State>
              <button
                type="button"
                onClick={() => setDeletingBackup(null)}
                disabled={isDeletingBackup}
                className="btn-vessel-secondary order-2 sm:order-1 w-full sm:w-auto py-2.5 sm:py-2 px-4 text-xs font-medium rounded-xl text-center cursor-pointer select-none"
              >
                取消
              </button>
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

      {/* Restore Database Backup Modal */}
      {showRestoreDbModal && app && (
        <RestoreDatabaseBackupModal
          isOpen={showRestoreDbModal}
          onClose={() => setShowRestoreDbModal(false)}
          app={app}
          engineName={dbInfo?.engine || 'Database'}
          backups={backups}
          onRestoreRecord={handleRestoreDbRecord}
          onRestoreFile={handleRestoreDbFile}
        />
      )}

      {/* Restore Application Backup Modal (Compose apps) */}
      {showRestoreAppFileModal && app && (
        <RestoreAppBackupModal
          isOpen={showRestoreAppFileModal}
          onClose={() => setShowRestoreAppFileModal(false)}
          app={app}
          backups={backups}
          onRestoreRecord={async (recordId) => {
            if (onRestoreBackup) {
              await onRestoreBackup(recordId);
            }
          }}
          onRestoreFile={handleRestoreAppFile}
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

      {/* Mobile Sticky Footer for Create Mode (Portaled to body to stick to viewport cleanly) */}
      {mode === 'create' &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-paper-2/90 backdrop-blur-xl border-t border-line p-3.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 flex items-center gap-2.5 shadow-pop">
            <button
              type="button"
              onClick={() => handleCreate(false)}
              disabled={isSubmitting}
              className="btn-vessel-secondary w-1/3 min-h-[44px] font-medium text-xs rounded-xl cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '保存中...' : '保存草稿'}
            </button>
            <button
              type="button"
              onClick={() => handleCreate(true)}
              disabled={isSubmitting}
              className="flex-1 min-h-[44px] btn-vessel-primary font-semibold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <CircleNotch className="w-3.5 h-3.5 animate-spin text-current" />
                  <span>部署中...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-current" weight="fill" />
                  <span>创建并立即部署</span>
                </>
              )}
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
