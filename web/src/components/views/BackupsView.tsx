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
  LockKey,
  UploadSimple,
  CloudArrowDown,
} from '@phosphor-icons/react';
import { R2Config, BackupRecord } from '../../types/index.js';
import { Button8State } from '../common/Button8State.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
import { EmptyState } from '../common/EmptyState.js';
import { Switch } from '../common/Switch.js';
import { NumberInput } from '../common/NumberInput.js';
import { RestoreSystemSnapshotModal } from '../common/RestoreSystemSnapshotModal.js';
import type { UploadProgress } from '../../hooks/useData.js';
import { useNotification } from '../../context/NotificationContext.js';
import { formatBytes, formatRelative } from '../../utils/format.js';

interface BackupsViewProps {
  r2Config: R2Config | null;
  backups: BackupRecord[];
  onSaveConfig: (cfg: Partial<R2Config>) => Promise<any>;
  onTestConnection: (cfg: Partial<R2Config>) => Promise<any>;
  onTriggerBackupNow: () => Promise<any>;
  onDeleteBackup?: (id: string) => Promise<any>;
  onDownloadBackup?: (id: string, fileName: string) => void;
  onRestoreBackup?: (id: string, options?: { passphrase?: string }) => Promise<any>;
  onSyncRemoteBackups?: () => Promise<{ imported: number }>;
  onRestoreSystemFromFile?: (file: File, passphrase?: string, onProgress?: (progress: UploadProgress) => void) => Promise<any>;
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
  onSyncRemoteBackups,
  onRestoreSystemFromFile,
}) => {
  const { toast } = useNotification();
  const [typeFilter, setTypeFilter] = useState<'all' | BackupRecord['type']>('all');

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUploadRestore, setShowUploadRestore] = useState(false);
  const r2Ready = Boolean(r2Config?.enabled && r2Config.endpoint && r2Config.bucketName);

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

  const handleSyncRemote = async () => {
    if (!onSyncRemoteBackups || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await onSyncRemoteBackups();
      if (res.imported > 0) {
        toast.success(`已从 R2 导入 ${res.imported} 个系统快照，可在列表中选择恢复`);
        setTypeFilter('system');
      } else {
        toast.info('R2 中没有新的系统快照');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSyncing(false);
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

  const typeLabel = (t: BackupRecord['type']) => (t === 'system' ? '系统快照' : t === 'app_db' ? '数据库' : '数据卷');
  const filteredBackups = backups
    .filter((b) => typeFilter === 'all' || b.type === typeFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalBytes = backups.reduce((sum, b) => sum + (b.fileSizeBytes || 0), 0);
  const scheduleLabel = (expr: string) => BACKUP_CRON_PRESETS.find((p) => p.expr === expr.trim())?.label;
  const lastStatus = r2Config?.lastBackupStatus;

  const fieldClass =
    'w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-lg px-3 text-[13px] text-ink font-mono placeholder:text-ink-faint focus:outline-none focus:border-line-strong';
  const labelClass = 'block text-xs font-medium text-ink mb-1.5';

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Intro + primary action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-muted max-w-2xl">
          三类备份：系统快照（平台数据与全部编排）、应用数据卷、数据库逻辑转储。系统快照可加密后同步到 Cloudflare R2。
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onSyncRemoteBackups && r2Ready && (
            <button
              type="button"
              onClick={handleSyncRemote}
              disabled={isSyncing}
              title="把 R2 存储桶中已有、但不在本机列表里的系统快照加入列表"
              className="btn-vessel-secondary min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer disabled:opacity-60"
            >
              {isSyncing ? <CircleNotch className="w-4 h-4 animate-spin" /> : <CloudArrowDown className="w-4 h-4" />}
              从 R2 导入
            </button>
          )}
          {onRestoreSystemFromFile && (
            <button
              type="button"
              onClick={() => setShowUploadRestore(true)}
              className="btn-vessel-secondary min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
            >
              <UploadSimple className="w-4 h-4" />
              从文件恢复
            </button>
          )}
          <button
            type="button"
            onClick={handleManualBackup}
            disabled={isBackingUp}
            className="btn-vessel-primary min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer disabled:opacity-60"
          >
            {isBackingUp ? <CircleNotch className="w-4 h-4 animate-spin" /> : <CloudArrowUp className="w-4 h-4" />}
            立即创建系统快照
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            k: '最近快照',
            v: formatRelative(r2Config?.lastBackupAt),
            sub:
              lastStatus === 'failed'
                ? '失败：' + (r2Config?.lastBackupMessage || '查看日志')
                : lastStatus === 'running'
                ? '进行中…'
                : r2Config?.lastBackupAt
                ? '成功'
                : '尚未执行',
            alert: lastStatus === 'failed',
          },
          { k: '备份文件', v: String(backups.length), sub: `共 ${formatBytes(totalBytes)}` },
          {
            k: '定时计划',
            v: r2Config?.enabled ? scheduleLabel(r2Config.cronSchedule) || r2Config.cronSchedule : '未启用',
            sub: r2Config?.enabled ? `保留 ${r2Config.retentionCount} 份` : '只能手动创建快照',
            mono: r2Config?.enabled && !scheduleLabel(r2Config.cronSchedule),
          },
          {
            k: '加密',
            v: hasBackupPassphrase ? '已加密' : '未加密',
            sub: hasBackupPassphrase ? 'AES-256-GCM' : '快照将以明文上传',
            alert: !hasBackupPassphrase && r2Config?.enabled,
          },
        ].map((s) => (
          <div key={s.k} className="card-vessel !cursor-default p-4 sm:p-5 flex flex-col gap-2.5 min-h-[104px]">
            <span className="text-xs font-medium text-ink-muted flex items-center gap-1.5">
              {s.k}
              {s.alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="需要注意" />}
            </span>
            <span
              className={clsx(
                'text-[22px] leading-none font-semibold text-ink tracking-[-0.02em] truncate',
                s.mono && 'font-mono text-[18px]'
              )}
            >
              {s.v}
            </span>
            <span
              className={clsx('text-xs truncate', s.alert ? 'text-amber-700 dark:text-amber-400' : 'text-ink-muted')}
              title={s.sub}
            >
              {s.sub}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 sm:gap-6 items-start">
        {/* Backup files */}
        <section aria-labelledby="bk-files-h" className="card-vessel !cursor-default overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-line-subtle">
            <h2 id="bk-files-h" className="text-sm font-semibold text-ink">
              备份文件
            </h2>
            <div role="tablist" aria-label="按类型筛选" className="flex items-center p-1 rounded-lg bg-paper-3 w-fit">
              {(
                [
                  { key: 'all', label: '全部' },
                  { key: 'system', label: '系统快照' },
                  { key: 'app_volume', label: '数据卷' },
                  { key: 'app_db', label: '数据库' },
                ] as const
              ).map((g) => (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === g.key}
                  onClick={() => setTypeFilter(g.key)}
                  className={clsx(
                    'h-8 px-2.5 sm:px-3 rounded-md text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap',
                    typeFilter === g.key ? 'bg-paper-2 text-ink shadow-subtle' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {filteredBackups.length === 0 ? (
            <div className="p-3 sm:p-4">
              <EmptyState
                icon={<FileArchive className="w-5 h-5" weight="duotone" />}
                title={backups.length === 0 ? '还没有备份' : '这一类还没有备份'}
                description={
                  backups.length === 0
                    ? '点「立即创建系统快照」，或在应用详情的「备份」页签为数据卷和数据库设置计划。要恢复已有快照，用右上角「从文件恢复」' + (r2Ready ? '或「从 R2 导入」。' : '。')
                    : '切换到其他类型查看，或在应用详情中创建。'
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {filteredBackups.map((b) => (
                <li key={b.id} className="px-4 sm:px-5 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span
                      className={clsx(
                        'shrink-0 mt-0.5 text-[11px] px-1.5 py-px rounded-md font-medium whitespace-nowrap',
                        b.type === 'system'
                          ? 'bg-signal-soft text-signal'
                          : b.type === 'app_db'
                          ? 'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400'
                          : 'bg-paper-3 text-ink-muted'
                      )}
                    >
                      {typeLabel(b.type)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {b.targetName}
                        {b.databaseName && (
                          <span className="ml-1.5 text-xs font-normal text-ink-muted">
                            {b.databaseName === 'all' ? '全部数据库' : b.databaseName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-mono text-ink-faint truncate" title={b.fileName}>
                        {b.fileName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ink-muted md:w-[210px] shrink-0 pl-[52px] md:pl-0">
                    <span className="font-mono w-[72px]">{formatBytes(b.fileSizeBytes)}</span>
                    <span title={new Date(b.createdAt).toLocaleString()}>{formatRelative(b.createdAt)}</span>
                    {b.status !== 'completed' && (
                      <Badge variant={b.status === 'failed' ? 'error' : 'deploying'}>
                        {b.status === 'failed' ? '失败' : '上传中'}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pl-[46px] md:pl-0">
                    <button
                      type="button"
                      disabled={b.status !== 'completed'}
                      onClick={() => {
                        setRestoringBackup(b);
                        setRestoreConfirmInput('');
                        setNeedsRestorePassphrase(false);
                        setRestorePassphrase('');
                      }}
                      className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ArrowCounterClockwise className="w-3.5 h-3.5" />
                      恢复
                    </button>
                    <button
                      type="button"
                      disabled={b.status !== 'completed'}
                      onClick={() => handleDownload(b)}
                      className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-ink-muted hover:text-ink hover:bg-paper-3 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" />
                      下载
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingBackup(b);
                        setDeleteBackupInput('');
                      }}
                      aria-label={`删除 ${b.fileName}`}
                      data-tooltip="删除"
                      className="w-9 h-9 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {backups.length > 0 && (
            <div className="px-5 h-11 flex items-center border-t border-line-subtle text-xs text-ink-muted">
              共 {backups.length} 个 · {formatBytes(totalBytes)}
            </div>
          )}
        </section>

        {/* Snapshot policy */}
        <aside aria-labelledby="bk-policy-h" className="card-vessel !cursor-default">
          <form onSubmit={handleSave}>
            <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-line-subtle">
              <h2 id="bk-policy-h" className="text-sm font-semibold text-ink">
                系统快照策略
              </h2>
              <label className="flex items-center gap-2 text-xs text-ink-muted cursor-pointer">
                定时上传 R2
                <Switch checked={enabled} onChange={setEnabled} size="sm" aria-label="定时上传系统快照到 R2" />
              </label>
            </div>

            {enabled ? (
              <div className="p-5 space-y-5">
                <div>
                  <label htmlFor="bk-cron" className={labelClass}>
                    执行时间（Cron）
                  </label>
                  <input
                    id="bk-cron"
                    type="text"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    placeholder="0 3 * * *"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={fieldClass}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {BACKUP_CRON_PRESETS.map((preset) => {
                      const isSelected = cronSchedule.trim() === preset.expr;
                      return (
                        <button
                          key={preset.expr}
                          type="button"
                          onClick={() => setCronSchedule(preset.expr)}
                          aria-pressed={isSelected}
                          className={clsx(
                            'h-7 px-2.5 rounded-full text-xs whitespace-nowrap transition-colors cursor-pointer border',
                            isSelected
                              ? 'bg-accent text-accent-contrast border-transparent'
                              : 'border-line text-ink-muted hover:text-ink hover:border-line-strong'
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className={labelClass}>保留份数</span>
                  <NumberInput min={1} max={30} value={retentionCount} onChange={setRetentionCount} unit="份" />
                  <p className="text-xs text-ink-faint mt-1.5">新快照成功后，删除更早的系统快照。</p>
                </div>

                <div>
                  <label htmlFor="bk-pass" className={labelClass}>
                    加密口令
                  </label>
                  <div className="relative">
                    <input
                      id="bk-pass"
                      type={showPassphrase ? 'text' : 'password'}
                      value={backupPassphrase}
                      onChange={(e) => setBackupPassphrase(e.target.value)}
                      placeholder={hasBackupPassphrase ? '已设置，留空则保持不变' : '至少 8 个字符'}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className={clsx(fieldClass, 'pr-10')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      aria-label={showPassphrase ? '隐藏口令' : '显示口令'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md text-ink-muted hover:text-ink flex items-center justify-center cursor-pointer"
                    >
                      {showPassphrase ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div
                    className={clsx(
                      'mt-2 p-3 rounded-lg text-xs leading-relaxed flex gap-2',
                      hasBackupPassphrase
                        ? 'bg-paper-3/60 text-ink-muted'
                        : 'bg-amber-500/[0.08] text-amber-800 dark:text-amber-300'
                    )}
                  >
                    {hasBackupPassphrase ? (
                      <LockKey className="w-4 h-4 shrink-0 mt-px" />
                    ) : (
                      <Warning className="w-4 h-4 shrink-0 mt-px" />
                    )}
                    <span>
                      {hasBackupPassphrase
                        ? '在新服务器上恢复时需要它，丢失后无法解密。请离线保存。'
                        : '未设置口令：系统快照（含各应用 .env 与 R2 凭据）将以明文上传。'}
                    </span>
                  </div>
                </div>

                <fieldset className="space-y-3 pt-4 border-t border-line-subtle">
                  <legend className="text-xs font-semibold text-ink mb-3">Cloudflare R2</legend>
                  <div>
                    <label htmlFor="bk-endpoint" className={labelClass}>
                      S3 API Endpoint
                    </label>
                    <input
                      id="bk-endpoint"
                      type="text"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://<account_id>.r2.cloudflarestorage.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bk-bucket" className={labelClass}>
                      Bucket
                    </label>
                    <input
                      id="bk-bucket"
                      type="text"
                      value={bucketName}
                      onChange={(e) => setBucketName(e.target.value)}
                      placeholder="vessel-backups"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bk-key" className={labelClass}>
                      Access Key ID
                    </label>
                    <input
                      id="bk-key"
                      type="text"
                      value={accessKeyId}
                      onChange={(e) => setAccessKeyId(e.target.value)}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="bk-secret" className={labelClass}>
                      Secret Access Key
                    </label>
                    <div className="relative">
                      <input
                        id="bk-secret"
                        type={showSecret ? 'text' : 'password'}
                        value={secretAccessKey}
                        onChange={(e) => setSecretAccessKey(e.target.value)}
                        placeholder="留空则保持现有密钥不变"
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className={clsx(fieldClass, 'pr-10')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        aria-label={showSecret ? '隐藏密钥' : '显示密钥'}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md text-ink-muted hover:text-ink flex items-center justify-center cursor-pointer"
                      >
                        {showSecret ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </fieldset>

                {testResult && (
                  <div
                    role="status"
                    className={clsx(
                      'p-3 rounded-lg text-xs flex items-start gap-2',
                      testResult.success
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    )}
                  >
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0" weight="fill" />
                    ) : (
                      <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
                    )}
                    <span className="break-words min-w-0">{testResult.message}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="p-5 text-[13px] text-ink-muted leading-relaxed">
                定时上传已关闭，系统快照只在你手动创建时生成。打开右上角开关，填写 Cloudflare R2 凭据后即可每天自动异地备份。
              </p>
            )}

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line-subtle">
              {enabled && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="btn-vessel-secondary min-h-[40px] px-3.5 text-[13px] rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isTesting && <CircleNotch className="w-4 h-4 animate-spin" />}
                  测试连接
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="btn-vessel-primary min-h-[40px] px-3.5 text-[13px] rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isSaving && <CircleNotch className="w-4 h-4 animate-spin" />}
                保存策略
              </button>
            </div>
          </form>
        </aside>
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

      {onRestoreSystemFromFile && (
        <RestoreSystemSnapshotModal
          isOpen={showUploadRestore}
          onClose={() => setShowUploadRestore(false)}
          onRestoreFile={onRestoreSystemFromFile}
        />
      )}
    </div>
  );
};
