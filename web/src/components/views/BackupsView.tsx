import { getStoredToken } from '../../hooks/useAuth.js';
import React, { useState } from 'react';
import clsx from 'clsx';
import {
  CloudArrowUp,
  CheckCircle,
  WarningCircle,
  Lightning,
  DownloadSimple,
  ArrowCounterClockwise,
  Trash,
  Eye,
  EyeSlash,
  Warning,
  CircleNotch,
  FileArchive,
  Clock,
  FloppyDiskBack,
  Info,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';
import { R2Config, BackupRecord } from '../../types/index.js';
import { Button8State } from '../common/Button8State.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import { EmptyState } from '../common/EmptyState.js';
import { Switch } from '../common/Switch.js';
import { NumberInput } from '../common/NumberInput.js';
import { useNotification } from '../../context/NotificationContext.js';
import { formatBytes } from '../../utils/format.js';

interface BackupsViewProps {
  r2Config: R2Config | null;
  backups: BackupRecord[];
  onSaveConfig: (cfg: Partial<R2Config>) => Promise<any>;
  onTestConnection: (cfg: Partial<R2Config>) => Promise<any>;
  onTriggerBackupNow: () => Promise<any>;
  onDeleteBackup?: (id: string) => Promise<any>;
  onDownloadBackup?: (id: string, fileName: string) => void;
  onRestoreBackup?: (id: string, options?: { passphrase?: string }) => Promise<any>;
}

const BACKUP_CRON_PRESETS = [
  { label: '每天 03:00', expr: '0 3 * * *' },
  { label: '每天 04:00', expr: '0 4 * * *' },
  { label: '每 12 小时', expr: '0 */12 * * *' },
  { label: '每周日 03:00', expr: '0 3 * * 0' },
  { label: '周一/四 03:00', expr: '0 3 * * 1,4' },
];

export const BackupsView: React.FC<BackupsViewProps> = ({
  r2Config,
  backups,
  onSaveConfig,
  onTestConnection,
  onTriggerBackupNow,
  onDeleteBackup,
  onDownloadBackup,
  onRestoreBackup,
}) => {
  const { toast } = useNotification();
  const [isTipsExpanded, setIsTipsExpanded] = useState(false);

  const [enabled, setEnabled] = useState(r2Config?.enabled ?? false);
  const [endpoint, setEndpoint] = useState(r2Config?.endpoint || '');
  const [bucketName, setBucketName] = useState(r2Config?.bucketName || '');
  const [accessKeyId, setAccessKeyId] = useState(r2Config?.accessKeyId || '');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [cronSchedule, setCronSchedule] = useState(r2Config?.cronSchedule || '0 3 * * *');
  const [retentionCount, setRetentionCount] = useState(r2Config?.retentionCount || 7);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const hasBackupPassphrase = Boolean(r2Config?.backupPassphrase);

  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Deletion modal state
  const [deletingBackup, setDeletingBackup] = useState<BackupRecord | null>(null);
  const [deleteBackupInput, setDeleteBackupInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Restore modal state
  const [restoringBackup, setRestoringBackup] = useState<BackupRecord | null>(null);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  // Shown once the server reports the snapshot is encrypted and no usable passphrase is configured
  const [needsRestorePassphrase, setNeedsRestorePassphrase] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');

  const isBackupDeleteConfirmed = Boolean(
    deletingBackup &&
      deleteBackupInput.trim().length > 0 &&
      deleteBackupInput.trim().toLowerCase() === deletingBackup.fileName.trim().toLowerCase()
  );

  const handleConfirmDeleteBackup = async () => {
    if (!deletingBackup || !isBackupDeleteConfirmed || isDeleting) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 60]);
    }
    setIsDeleting(true);
    try {
      if (onDeleteBackup) {
        await onDeleteBackup(deletingBackup.id);
      }
      toast.success(`快照归档 ${deletingBackup.fileName} 已成功删除`);
      setDeletingBackup(null);
      setDeleteBackupInput('');
    } catch (err: any) {
      toast.error(`删除失败: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const isRestoreConfirmed = Boolean(
    restoringBackup &&
      (restoreConfirmInput.trim() === '确认恢复' ||
        restoreConfirmInput.trim().toUpperCase() === 'RESTORE' ||
        restoreConfirmInput.trim().toLowerCase() === restoringBackup.fileName.trim().toLowerCase())
  );

  const handleConfirmRestore = async () => {
    if (!restoringBackup || !isRestoreConfirmed || isRestoring) return;
    if (needsRestorePassphrase && !restorePassphrase) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 60]);
    }
    setIsRestoring(true);
    try {
      if (onRestoreBackup) {
        const passphrase = needsRestorePassphrase ? restorePassphrase : undefined;
        const res = await onRestoreBackup(restoringBackup.id, passphrase ? { passphrase } : undefined);
        toast.success(res?.message || `快照 ${restoringBackup.fileName} 已成功恢复生效！`);
      }
      setRestoringBackup(null);
      setRestoreConfirmInput('');
      setNeedsRestorePassphrase(false);
      setRestorePassphrase('');
    } catch (err: any) {
      if (err.code === 'BACKUP_PASSPHRASE_REQUIRED') {
        setNeedsRestorePassphrase(true);
        toast.error(needsRestorePassphrase ? err.message : '该快照已加密，请输入备份时使用的口令');
        return;
      }
      toast.error(`恢复失败: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleTest = async () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection({
        endpoint,
        bucketName,
        accessKeyId,
        secretAccessKey,
      });
      setTestResult(res);
      if (res.success) {
        toast.success('Cloudflare R2 连接测试成功！');
      } else {
        toast.error(`R2 连接测试失败: ${res.message}`);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
      toast.error(`R2 连接异常: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    setIsSaving(true);
    try {
      await onSaveConfig({
        enabled,
        endpoint,
        bucketName,
        accessKeyId,
        secretAccessKey,
        cronSchedule,
        retentionCount,
        ...(backupPassphrase ? { backupPassphrase } : {}),
      });
      setBackupPassphrase('');
      toast.success('Cloudflare R2 备份策略保存成功！');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualBackup = async () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 40]);
    }
    setIsBackingUp(true);
    toast.info('正在创建系统快照并同步上传 R2...');
    try {
      await onTriggerBackupNow();
      toast.success('已成功生成并上传快照至 Cloudflare R2！');
    } catch (e: any) {
      toast.error(`备份失败: ${e.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownload = (record: BackupRecord) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    if (onDownloadBackup) {
      onDownloadBackup(record.id, record.fileName);
    } else {
      const token = getStoredToken() || '';
      window.open(`/api/r2/backups/${record.id}/download?token=${encodeURIComponent(token)}`);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-paper-3 flex items-center justify-center text-ink flex-shrink-0 mt-0.5">
            <CloudArrowUp className="w-5 h-5" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-base sm:text-lg text-ink tracking-tight font-sans">
                Cloudflare R2 远程对象存储灾备配置
              </h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-paper-3 text-ink-muted font-mono">
                {enabled ? '自动灾备已启用' : '自动化备份未开启'}
              </span>
            </div>

            {/* Compressed 1-line description with collapsible detailed explanation */}
            <div className="mt-1">
              <p className="text-xs text-ink-muted leading-relaxed inline">
                将平台数据、编排文件与数据卷定时压缩归档上传至 Cloudflare R2。
              </p>
              <button
                type="button"
                onClick={() => setIsTipsExpanded(!isTipsExpanded)}
                className="inline-flex items-center gap-0.5 text-xs text-ink hover:underline font-semibold ml-1 cursor-pointer select-none"
              >
                <span>{isTipsExpanded ? '收起说明' : '详细说明'}</span>
                {isTipsExpanded ? (
                  <CaretUp className="w-3 h-3" weight="bold" />
                ) : (
                  <CaretDown className="w-3 h-3" weight="bold" />
                )}
              </button>
            </div>

            {/* Collapsible Guidance Box */}
            {isTipsExpanded && (
              <div className="mt-2.5 p-3.5 rounded-2xl bg-paper-3/40 text-xs text-ink-muted space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Info className="w-3.5 h-3.5 text-ink flex-shrink-0" weight="fill" />
                  <span>异地高可靠灾难恢复机制</span>
                </div>
                <p className="leading-relaxed">
                  系统定时将平台 SQLite 数据、全部 Compose 编排文件以及应用数据卷定时压缩归档并上传至 Cloudflare R2，实现异地高可靠灾难恢复与秒级快照回滚。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Manual snapshot trigger action */}
        <div className="flex items-center gap-3 shrink-0">
          <Button8State
            variant="secondary"
            size="sm"
            icon={<Lightning className="w-4 h-4 text-amber-500" weight="fill" />}
            state={isBackingUp ? 'loading' : 'default'}
            onClick={handleManualBackup}
            className="w-full sm:w-auto min-h-[40px]"
          >
            立即执行系统快照
          </Button8State>
        </div>
      </div>

      {/* Configuration Form Card */}
      <div className="card-vessel p-5 sm:p-7">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Toggle Switch Row */}
          <div className="flex items-center justify-between pb-5 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-ink font-sans">
                开启 Cloudflare R2 定时自动化备份任务
              </h4>
              <p className="text-xs text-ink-muted mt-0.5">
                {enabled
                  ? '定时将平台核心数据库与 Compose 编排文件打包并自动推送至指定的 R2 Bucket 存储桶'
                  : '已关闭自动备份任务。平台仅保留手动快照或应用内按需备份。'}
              </p>
            </div>

            <Switch
              checked={enabled}
              onChange={setEnabled}
              size="md"
              aria-label="全量定时自动备份任务"
            />
          </div>

          {/* Form Fields Grid - Progressive Disclosure */}
          {enabled ? (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">
                    R2 S3 API Endpoint <span className="text-rose-500 font-semibold">*</span>
                  </label>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="https://<account_id>.r2.cloudflarestorage.com"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">
                    Bucket 存储桶名称 <span className="text-rose-500 font-semibold">*</span>
                  </label>
                  <input
                    type="text"
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    placeholder="vessel-backups"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">
                    Access Key ID <span className="text-rose-500 font-semibold">*</span>
                  </label>
                  <input
                    type="text"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                    placeholder="R2 API Token Access Key"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">
                    Secret Access Key <span className="text-rose-500 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={secretAccessKey}
                      onChange={(e) => setSecretAccessKey(e.target.value)}
                      placeholder="留空则保持现有密钥不变"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl pl-3.5 pr-10 py-2.5 min-h-[42px] text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors p-1.5 cursor-pointer rounded-lg hover:bg-paper-3"
                      title={showSecret ? '隐藏密钥' : '显示密钥'}
                    >
                      {showSecret ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">
                    系统快照加密口令
                  </label>
                  <div className="relative">
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={backupPassphrase}
                      onChange={(e) => setBackupPassphrase(e.target.value)}
                      placeholder={hasBackupPassphrase ? '已设置，留空则保持不变' : '至少 12 个字符'}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl pl-3.5 pr-10 py-2.5 min-h-[42px] text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors p-1.5 cursor-pointer rounded-lg hover:bg-paper-3"
                      title={showPassphrase ? '隐藏口令' : '显示口令'}
                    >
                      {showPassphrase ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className={`mt-1.5 text-[11px] leading-relaxed ${hasBackupPassphrase ? 'text-ink-muted' : 'text-amber-600 dark:text-amber-400'}`}>
                    {hasBackupPassphrase
                      ? '系统快照使用 AES-256-GCM 加密。请离线妥善保存口令：在新服务器恢复时需要输入，丢失后快照无法解密。'
                      : '未设置口令：系统快照（含各应用 .env 与 R2 凭据）将以明文上传。'}
                  </p>
                </div>

                {/* CRON Schedule with Quick-pick Chips */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink/85">
                    Cron 定时周期表达式
                  </label>
                  <input
                    type="text"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    placeholder="0 3 * * *"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 text-xs text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                  />
                  {/* Quick-pick Chips Container */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    <span className="text-[11px] text-ink-muted flex-shrink-0 flex items-center gap-1 mr-0.5">
                      <Clock className="w-3.5 h-3.5 text-ink-muted" />
                      快捷填入:
                    </span>
                    {BACKUP_CRON_PRESETS.map((preset) => {
                      const isSelected = cronSchedule.trim() === preset.expr;
                      return (
                        <button
                          key={preset.expr}
                          type="button"
                          onClick={() => {
                            setCronSchedule(preset.expr);
                            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                              navigator.vibrate(10);
                            }
                          }}
                          className={clsx(
                            'text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all select-none flex-shrink-0 cursor-pointer',
                            isSelected
                              ? 'bg-accent text-accent-contrast font-medium shadow-sm'
                              : 'bg-paper-3/80 hover:bg-paper-4 text-ink-muted hover:text-ink border border-line-subtle'
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Retention Count with numeric constraint */}
                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">
                    保留版本数 <span className="text-ink-muted font-normal">(超过自动清理旧归档)</span>
                  </label>
                  <NumberInput
                    min={1}
                    max={30}
                    value={retentionCount}
                    onChange={setRetentionCount}
                    unit="份"
                  />
                  <span className="text-[11px] text-ink-faint block mt-1.5">
                    系统将仅保留最新的 {retentionCount} 个备份，超出的旧版本将在下一次备份成功后自动从 R2 清理。
                  </span>
                </div>
              </div>

              {/* Test feedback banner */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" weight="fill" />
                  ) : (
                    <WarningCircle className="w-4 h-4 text-rose-500 flex-shrink-0" weight="fill" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Button8State
                  type="button"
                  variant="secondary"
                  size="md"
                  state={isTesting ? 'loading' : 'default'}
                  onClick={handleTest}
                  className="w-full sm:w-auto min-h-[42px]"
                >
                  测试 R2 连通性
                </Button8State>

                <Button8State
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={<FloppyDiskBack className="w-4 h-4" weight="bold" />}
                  state={isSaving ? 'loading' : 'default'}
                  className="w-full sm:w-auto min-h-[42px]"
                >
                  保存备份策略
                </Button8State>
              </div>
            </div>
          ) : (
            /* Collapsed state actions */
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-xs text-ink-muted">
                保存后将停用系统的 CRON 定时灾备任务。
              </span>
              <Button8State
                type="submit"
                variant="primary"
                size="md"
                state={isSaving ? 'loading' : 'default'}
                className="w-full sm:w-auto min-h-[42px]"
              >
                保存配置更改
              </Button8State>
            </div>
          )}
        </form>
      </div>

      {/* Backup History Card */}
      <div className="card-vessel p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <h4 className="text-sm font-semibold text-ink font-sans">
                归档版本历史记录
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted font-mono font-medium">
                {backups.length}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              平台系统级灾备快照与数据库转储归档
              {backups.length > 0 && (
                <span className="ml-1 text-ink-faint">
                  · 自动保留最新 {retentionCount} 份
                </span>
              )}
            </p>
          </div>
        </div>

        {backups.length === 0 ? (
          <EmptyState
            icon={<FileArchive className="w-5 h-5" weight="duotone" />}
            title="暂无备份历史"
            description="点击上方「立即执行系统快照」或在应用详情中进行备份。"
          />
        ) : (
          <div className="space-y-3">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-4 sm:p-5 space-y-2.5 rounded-2xl bg-paper-3/40 hover:bg-paper-3/70 transition-colors"
              >
                {/* 行 1: 标题与状态标签 */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-semibold text-ink text-sm font-sans truncate">
                      {b.targetName}
                    </span>
                    {b.databaseName && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                        {b.databaseName === 'all' ? '全部数据库' : `库: ${b.databaseName}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <Badge variant={b.type === 'system' ? 'accent' : b.type === 'app_db' ? 'running' : 'default'}>
                      {b.type === 'system' ? '系统级快照' : b.type === 'app_db' ? '数据库转储' : '应用卷备份'}
                    </Badge>
                    <Badge variant="running">已同步 R2</Badge>
                  </div>
                </div>

                {/* 行 2: 文件名 (等宽字体，允许 break-all，绝不撑破卡片) */}
                <div className="text-xs font-mono text-ink-muted/90 break-all select-all flex items-start gap-1.5">
                  <FileArchive className="w-3.5 h-3.5 text-ink-muted/70 flex-shrink-0 mt-0.5" />
                  <span>{b.fileName}</span>
                </div>

                {/* 行 3: 元数据 (尺寸与时间) */}
                <div className="flex items-center gap-2 text-xs text-ink-muted/80 font-mono">
                  <span>{formatBytes(b.fileSizeBytes)}</span>
                  <span className="w-1 h-1 bg-ink-muted/40 rounded-full"></span>
                  <span className="font-sans">{new Date(b.createdAt).toLocaleString()}</span>
                </div>

                {/* 行 4: 独立的操作栏 (Action Bar) */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button8State
                      size="sm"
                      variant="secondary"
                      icon={<ArrowCounterClockwise className="w-3.5 h-3.5 text-ink" />}
                      onClick={() => {
                        setRestoringBackup(b);
                        setRestoreConfirmInput('');
                        setNeedsRestorePassphrase(false);
                        setRestorePassphrase('');
                      }}
                      className="min-h-[36px] px-3 text-xs whitespace-nowrap"
                    >
                      恢复
                    </Button8State>

                    <Button8State
                      size="sm"
                      variant="secondary"
                      icon={<DownloadSimple className="w-3.5 h-3.5" />}
                      onClick={() => handleDownload(b)}
                      className="min-h-[36px] px-3 text-xs whitespace-nowrap"
                    >
                      下载
                    </Button8State>
                  </div>

                  {/* 删除按钮推到最右侧 */}
                  <button
                    onClick={() => {
                      setDeletingBackup(b);
                      setDeleteBackupInput('');
                    }}
                    className="p-2 min-h-[36px] min-w-[36px] rounded-xl text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                    title="删除此备份归档"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE BACKUP CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingBackup)}
        onClose={() => !isDeleting && setDeletingBackup(null)}
        title={
          <div className="flex items-center gap-2 text-ink font-semibold">
            <Trash className="w-5 h-5 text-rose-500" weight="bold" />
            <span>危险操作：确认删除灾备归档</span>
          </div>
        }
        subtitle={deletingBackup ? `归档文件: ${deletingBackup.fileName}` : ''}
        maxWidth="max-w-lg"
      >
        {deletingBackup && (
          <div className="space-y-4">
            {/* Warning Message Box */}
            <div className="p-4 rounded-2xl bg-rose-500/[0.08] text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-ink dark:text-rose-200">
                <Warning className="w-4 h-4 text-rose-500 flex-shrink-0" weight="fill" />
                <span>此操作不可撤回，请务必谨慎！</span>
              </div>
              <p className="text-ink-muted leading-relaxed">
                删除后将同时清除本地归档快照文件以及远端 Cloudflare R2 存储桶中的对应对象，无法再通过此备份恢复数据。
              </p>
            </div>

            {/* Input Verification Box */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs text-ink-muted leading-relaxed">
                请输入文件名{' '}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setDeleteBackupInput(deletingBackup.fileName);
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDeleteBackupInput(deletingBackup.fileName);
                    }
                  }}
                  className="inline-flex items-center font-mono font-semibold text-ink hover:text-accent bg-paper-3 hover:bg-paper-4 border border-line px-1.5 py-0.5 rounded-md cursor-pointer transition-all active:scale-95 text-xs select-all"
                  title="点击直接填入"
                >
                  {deletingBackup.fileName}
                </span>{' '}
                以确认删除：
              </label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={deleteBackupInput}
                onChange={(e) => setDeleteBackupInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isBackupDeleteConfirmed && !isDeleting) {
                    handleConfirmDeleteBackup();
                  }
                }}
                placeholder={deletingBackup.fileName}
                autoFocus
                className="w-full bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2.5 min-h-[42px] text-xs text-ink font-mono placeholder:text-ink-faint/70 focus:outline-none focus:border-rose-500/80 dark:focus:border-rose-500/70 transition-colors shadow-sm"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
              {!isBackupDeleteConfirmed ? (
                <button
                  type="button"
                  disabled
                  className="order-1 sm:order-2 w-full sm:w-auto min-h-[42px] px-4 py-2 bg-paper-3 text-ink-muted/40 text-xs font-medium rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 select-none"
                >
                  <Trash className="w-4 h-4 opacity-40" />
                  <span>确认删除备份</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDeleteBackup}
                  disabled={isDeleting}
                  className="order-1 sm:order-2 w-full sm:w-auto min-h-[42px] px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] sm:active:scale-100 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <CircleNotch className="w-4 h-4 animate-spin text-white" />
                      <span>正在删除...</span>
                    </>
                  ) : (
                    <>
                      <Trash className="w-4 h-4 text-white" weight="bold" />
                      <span>确认删除备份</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setDeletingBackup(null)}
                disabled={isDeleting}
                className="btn-vessel-secondary order-2 sm:order-1 w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-medium rounded-xl text-center cursor-pointer select-none"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* RESTORE BACKUP CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(restoringBackup)}
        onClose={() => !isRestoring && setRestoringBackup(null)}
        title="恢复快照数据"
        subtitle={restoringBackup ? `目标快照: ${restoringBackup.targetName} (${restoringBackup.fileName})` : ''}
        maxWidth="max-w-md"
      >
        {restoringBackup && (
          <div className="space-y-4 font-sans text-xs">
            <p className="text-ink-muted leading-relaxed">
              {restoringBackup.type === 'app_db'
                ? `执行恢复后，将把该原生转储流直接导入至目标容器，覆盖现有 ${restoringBackup.databaseName && restoringBackup.databaseName !== 'all' ? `「${restoringBackup.databaseName}」` : '所有匹配'} 数据库内容。`
                : '执行恢复后，将解压该快照并全面还原系统核心数据库记录、配置文件与容器编排规则。当前未备份的变更将被覆盖。'}
            </p>

            {/* Input Verification Box */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                <label htmlFor="restore-backup-input" className="text-ink-muted">
                  请输入确认口令以确认执行：
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreConfirmInput('确认恢复');
                      if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
                    }}
                    className="text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer select-none underline decoration-dotted underline-offset-2"
                  >
                    确认恢复
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreConfirmInput('RESTORE');
                      if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
                    }}
                    className="text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer select-none underline decoration-dotted underline-offset-2 font-mono"
                  >
                    RESTORE
                  </button>
                </div>
              </div>

              <input
                id="restore-backup-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={restoreConfirmInput}
                onChange={(e) => setRestoreConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isRestoreConfirmed && !isRestoring) {
                    handleConfirmRestore();
                  }
                }}
                placeholder="确认恢复 或 RESTORE"
                autoFocus
                className="w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/60 focus:outline-none transition-colors shadow-sm"
              />

              {needsRestorePassphrase && (
                <div className="space-y-1.5">
                  <label htmlFor="restore-passphrase-input" className="block text-xs font-medium text-ink/85">
                    备份口令（该快照已加密）
                  </label>
                  <input
                    id="restore-passphrase-input"
                    type="password"
                    autoComplete="off"
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isRestoreConfirmed && restorePassphrase && !isRestoring) {
                        handleConfirmRestore();
                      }
                    }}
                    placeholder="输入创建该快照时使用的口令"
                    autoFocus
                    className="w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/60 focus:outline-none transition-colors shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestoringBackup(null)}
                disabled={isRestoring}
                className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none"
              >
                取消
              </button>
              <Button8State
                size="sm"
                variant="primary"
                state={isRestoring ? 'loading' : 'default'}
                disabled={!isRestoreConfirmed || isRestoring || (needsRestorePassphrase && !restorePassphrase)}
                onClick={handleConfirmRestore}
                className="rounded-xl px-4 py-2 text-xs font-medium"
              >
                确认恢复
              </Button8State>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
