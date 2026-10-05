import React, { useState } from 'react';
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
} from '@phosphor-icons/react';
import { R2Config, BackupRecord } from '../../types/index.js';
import { Button8State } from '../common/Button8State.js';
import { Badge } from '../common/Badge.js';
import { Modal } from '../common/Modal.js';
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
  onRestoreBackup?: (id: string) => Promise<any>;
}

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
  const [enabled, setEnabled] = useState(r2Config?.enabled ?? false);
  const [endpoint, setEndpoint] = useState(r2Config?.endpoint || '');
  const [bucketName, setBucketName] = useState(r2Config?.bucketName || '');
  const [accessKeyId, setAccessKeyId] = useState(r2Config?.accessKeyId || '');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [cronSchedule, setCronSchedule] = useState(r2Config?.cronSchedule || '0 3 * * *');
  const [retentionCount, setRetentionCount] = useState(r2Config?.retentionCount || 7);

  const [showSecret, setShowSecret] = useState(false);
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

  const isBackupDeleteConfirmed = Boolean(
    deletingBackup &&
      deleteBackupInput.trim().length > 0 &&
      deleteBackupInput.trim().toLowerCase() === deletingBackup.fileName.trim().toLowerCase()
  );

  const handleConfirmDeleteBackup = async () => {
    if (!deletingBackup || !isBackupDeleteConfirmed || isDeleting) return;
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
      (restoreConfirmInput.trim().toUpperCase() === 'RESTORE' ||
        restoreConfirmInput.trim().toLowerCase() === restoringBackup.fileName.trim().toLowerCase())
  );

  const handleConfirmRestore = async () => {
    if (!restoringBackup || !isRestoreConfirmed || isRestoring) return;
    setIsRestoring(true);
    try {
      if (onRestoreBackup) {
        const res = await onRestoreBackup(restoringBackup.id);
        toast.success(res?.message || `快照 ${restoringBackup.fileName} 已成功恢复生效！`);
      }
      setRestoringBackup(null);
      setRestoreConfirmInput('');
    } catch (err: any) {
      toast.error(`恢复失败: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleTest = async () => {
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
      });
      toast.success('Cloudflare R2 备份策略保存成功！');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualBackup = async () => {
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
    if (onDownloadBackup) {
      onDownloadBackup(record.id, record.fileName);
    } else {
      const token = localStorage.getItem('vessel_token') || '';
      window.open(`/api/r2/backups/${record.id}/download?token=${encodeURIComponent(token)}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header (De-boxed, modern SaaS standard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-paper-2 dark:bg-white/[0.04] border border-line/60 dark:border-white/[0.08] flex items-center justify-center text-accent flex-shrink-0 shadow-subtle">
            <CloudArrowUp className="w-5 h-5 text-accent" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-lg text-ink tracking-tight font-sans">
                Cloudflare R2 远程对象存储灾备配置
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-2 dark:bg-white/[0.05] text-ink-muted border border-line/50 dark:border-white/[0.06] font-mono">
                {enabled ? '自动灾备已启用' : '自动化备份未开启'}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1.5 max-w-2xl leading-relaxed">
              将平台 SQLite 数据、全部 Compose 编排文件以及应用数据卷定时压缩归档并上传至 Cloudflare R2，实现异地高可靠灾难恢复。
            </p>
          </div>
        </div>

        {/* Secondary Action: Ghost / Subtle Button (avoiding primary CTA competition) */}
        <div className="flex items-center gap-3 shrink-0">
          <Button8State
            variant="secondary"
            size="sm"
            icon={<Lightning className="w-4 h-4 text-amber-500" weight="fill" />}
            state={isBackingUp ? 'loading' : 'default'}
            onClick={handleManualBackup}
          >
            立即执行系统快照
          </Button8State>
        </div>
      </div>

      {/* Configuration Form Card */}
      <div className="card-vessel p-6 sm:p-7 shadow-subtle">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Modern Toggle Switch Row (De-boxed) */}
          <div className="flex items-center justify-between pb-5 border-b border-line/50 dark:border-white/[0.06]">
            <div>
              <h4 className="text-sm font-semibold text-ink font-sans">
                开启 Cloudflare R2 定时自动化备份任务
              </h4>
              <p className="text-xs text-ink-muted mt-0.5">
                定时将平台核心数据库与 Compose 编排文件打包并自动推送至指定的 R2 Bucket 存储桶
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? 'bg-accent' : 'bg-paper-3 dark:bg-white/[0.12]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                R2 S3 API Endpoint *
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://<account_id>.r2.cloudflarestorage.com"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                Bucket 存储桶名称 *
              </label>
              <input
                type="text"
                value={bucketName}
                onChange={(e) => setBucketName(e.target.value)}
                placeholder="vessel-backups"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                Access Key ID *
              </label>
              <input
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="R2 API Token Access Key"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                Secret Access Key *
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder="留空则保持现有密钥不变"
                  className="w-full bg-paper border border-line rounded-lg pl-3.5 pr-10 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors p-1"
                  title={showSecret ? '隐藏密钥' : '显示密钥'}
                >
                  {showSecret ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                Cron 定时周期表达式
              </label>
              <input
                type="text"
                value={cronSchedule}
                onChange={(e) => setCronSchedule(e.target.value)}
                placeholder="0 3 * * * (每日凌晨3点)"
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-normal mb-1.5">
                保留版本数 (超过自动清理旧归档)
              </label>
              <input
                type="number"
                value={retentionCount}
                onChange={(e) => setRetentionCount(Number(e.target.value))}
                min={1}
                max={30}
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink font-mono focus:border-accent focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Test feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-lg text-xs flex items-center gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
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

          {/* Action Row: Single Primary Button */}
          <div className="pt-4 border-t border-line/50 dark:border-white/[0.06] flex items-center justify-between">
            <Button8State
              type="button"
              variant="secondary"
              size="sm"
              state={isTesting ? 'loading' : 'default'}
              onClick={handleTest}
            >
              测试 R2 连通性
            </Button8State>

            <Button8State
              type="submit"
              variant="primary"
              size="sm"
              state={isSaving ? 'loading' : 'default'}
            >
              保存备份策略
            </Button8State>
          </div>
        </form>
      </div>

      {/* Backup History Table */}
      <div className="card-vessel overflow-hidden shadow-subtle">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h4 className="text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-bold tracking-wider">
              归档版本历史记录 ({backups.length})
            </h4>
            {backups.length > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-2 dark:bg-white/[0.05] text-ink-muted border border-line/50 dark:border-white/[0.06] font-mono">
                保留策略: 最新 {retentionCount} 个
              </span>
            )}
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-xs">
            暂无备份历史。点击上方「立即执行系统快照」或在应用详情中进行备份。
          </div>
        ) : (
          <div className="divide-y divide-line/60 dark:divide-white/[0.06]">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-paper-2/50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-ink dark:text-zinc-100 text-sm font-sans">{b.targetName}</span>
                    <Badge variant={b.type === 'system' ? 'accent' : 'default'}>
                      {b.type === 'system' ? '系统级快照' : '应用卷备份'}
                    </Badge>
                    <Badge variant="running">已同步 R2</Badge>
                  </div>
                  <p className="text-ink-muted/80 dark:text-zinc-500 font-mono text-[11px] truncate max-w-lg">{b.fileName}</p>
                </div>

                <div className="flex items-center gap-4 text-ink-muted/80 dark:text-zinc-400">
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span>{formatBytes(b.fileSizeBytes)}</span>
                    <span className="text-ink-muted/60 dark:text-zinc-600 font-sans">•</span>
                    <span className="font-sans">{new Date(b.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2 pl-2">
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

                    <Button8State
                      size="sm"
                      variant="secondary"
                      icon={<DownloadSimple className="w-3.5 h-3.5" />}
                      onClick={() => handleDownload(b)}
                    >
                      下载
                    </Button8State>

                    <button
                      onClick={() => {
                        setDeletingBackup(b);
                        setDeleteBackupInput('');
                      }}
                      className="p-2 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                      data-tooltip="删除此备份归档"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
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
            <div className="p-4 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 dark:border-rose-500/25 text-xs space-y-2 shadow-subtle">
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
                请输入文件名 <strong className="text-ink font-semibold select-all font-mono">{deletingBackup.fileName}</strong> 以确认删除：
              </label>
              <input
                type="text"
                value={deleteBackupInput}
                onChange={(e) => setDeleteBackupInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isBackupDeleteConfirmed && !isDeleting) {
                    handleConfirmDeleteBackup();
                  }
                }}
                placeholder={deletingBackup.fileName}
                autoFocus
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 text-xs text-ink font-mono focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none transition-all shadow-subtle"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingBackup(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle transition-colors cursor-pointer"
              >
                取消
              </button>

              {!isBackupDeleteConfirmed ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 bg-paper-3 dark:bg-[#21262d] text-ink-muted/50 dark:text-[#8b949e] border border-line/50 dark:border-white/[0.06] text-xs font-medium rounded-lg cursor-not-allowed flex items-center gap-1.5 select-none"
                >
                  <Trash className="w-4 h-4 opacity-40" />
                  <span>确认删除备份</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDeleteBackup}
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
                      <span>确认删除备份</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* RESTORE BACKUP CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(restoringBackup)}
        onClose={() => !isRestoring && setRestoringBackup(null)}
        title={
          <div className="flex items-center gap-2 text-ink font-semibold">
            <ArrowCounterClockwise className="w-5 h-5 text-accent" weight="bold" />
            <span>高危操作：确认从快照恢复数据与编排</span>
          </div>
        }
        subtitle={restoringBackup ? `目标快照: ${restoringBackup.targetName} (${restoringBackup.fileName})` : ''}
        maxWidth="max-w-lg"
      >
        {restoringBackup && (
          <div className="space-y-4">
            {/* Warning Message Box */}
            <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 text-xs space-y-2 shadow-subtle">
              <div className="flex items-center gap-2 font-semibold text-sm text-ink dark:text-amber-200">
                <Warning className="w-4 h-4 text-amber-500 flex-shrink-0" weight="fill" />
                <span>快照回滚将覆盖当前数据与容器编排！</span>
              </div>
              <p className="text-ink-muted leading-relaxed">
                执行恢复后，将解压该快照并全面还原系统：
              </p>
              <ul className="list-disc list-inside text-ink-muted space-y-1 pl-1">
                <li>平台核心数据库记录与元数据将还原至快照备份时刻</li>
                <li>受管应用与服务配置文件将被覆盖，未备份的变更将丢失</li>
                <li>Caddy 路由引擎将自动依据恢复后的域名规则重新加载</li>
              </ul>
            </div>

            {/* Input Verification Box */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs text-ink-muted leading-relaxed">
                请输入 <strong className="text-accent font-semibold font-mono">RESTORE</strong> 或完整文件名 <strong className="text-ink font-semibold select-all font-mono">{restoringBackup.fileName}</strong> 以确认恢复：
              </label>
              <input
                type="text"
                value={restoreConfirmInput}
                onChange={(e) => setRestoreConfirmInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isRestoreConfirmed && !isRestoring) {
                    handleConfirmRestore();
                  }
                }}
                placeholder="RESTORE"
                autoFocus
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 text-xs text-ink font-mono focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none transition-all shadow-subtle"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRestoringBackup(null)}
                disabled={isRestoring}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle transition-colors cursor-pointer"
              >
                取消
              </button>

              {!isRestoreConfirmed ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 bg-paper-3 dark:bg-[#21262d] text-ink-muted/50 dark:text-[#8b949e] border border-line/50 dark:border-white/[0.06] text-xs font-medium rounded-lg cursor-not-allowed flex items-center gap-1.5 select-none"
                >
                  <ArrowCounterClockwise className="w-4 h-4 opacity-40" />
                  <span>确认恢复快照</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="px-4 py-2 bg-accent hover:bg-accent/90 text-white font-bold text-xs rounded-lg shadow-md shadow-accent/25 transition-all flex items-center gap-1.5 active:translate-y-px cursor-pointer"
                >
                  {isRestoring ? (
                    <>
                      <CircleNotch className="w-4 h-4 animate-spin text-white" />
                      <span>正在恢复...</span>
                    </>
                  ) : (
                    <>
                      <ArrowCounterClockwise className="w-4 h-4 text-white" weight="bold" />
                      <span>确认恢复快照</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
