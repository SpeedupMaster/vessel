import React, { useState, useEffect, useRef } from 'react';
import {
  Archive,
  UploadSimple,
  Warning,
  CircleNotch,
  CheckCircle,
  FileCode,
  X,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import { Modal } from './Modal.js';
import { Button8State } from './Button8State.js';
import { AppItem, BackupRecord } from '../../types/index.js';
import { formatBytes } from '../../utils/format.js';
import { UploadProgressBar } from './UploadProgressBar.js';
import type { UploadProgress } from '../../hooks/useData.js';
import { useNotification } from '../../context/NotificationContext.js';

interface RestoreAppBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppItem;
  backups: BackupRecord[];
  onRestoreRecord: (recordId: string) => Promise<any>;
  onRestoreFile?: (appId: string, file: File, onProgress?: (progress: UploadProgress) => void) => Promise<any>;
}

export const RestoreAppBackupModal: React.FC<RestoreAppBackupModalProps> = ({
  isOpen,
  onClose,
  app,
  backups,
  onRestoreRecord,
  onRestoreFile,
}) => {
  const { toast } = useNotification();
  const [sourceType, setSourceType] = useState<'existing' | 'upload'>('existing');
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter backups for this app (type app_volume or targetId === app.id)
  const appBackups = backups.filter(
    (b) => b.targetId === app.id && b.type !== 'app_db'
  );

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setSelectedFile(null);
      if (appBackups.length > 0) {
        setSelectedRecordId(appBackups[0].id);
        setSourceType('existing');
      } else {
        setSourceType('upload');
      }
    }
  }, [isOpen, app.id, appBackups.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        toast.error('请选择有效的 .zip 备份压缩归档文件');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        toast.error('请选择有效的 .zip 备份压缩归档文件');
        return;
      }
      setSelectedFile(file);
    }
  };

  const isConfirmed = confirmInput.trim() === app.id.trim();

  const handleRestore = async () => {
    if (!isConfirmed || isSubmitting) return;

    if (sourceType === 'existing') {
      if (!selectedRecordId) {
        toast.error('请先选择要恢复的历史备份快照');
        return;
      }
      setIsSubmitting(true);
      try {
        await onRestoreRecord(selectedRecordId);
        toast.success(`应用 ${app.name} 快照恢复成功！`);
        onClose();
      } catch (err: any) {
        toast.error(`恢复快照失败: ${err.message || '未知错误'}`);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!selectedFile) {
        toast.error('请先选择或拖拽本地 .zip 备份文件');
        return;
      }
      if (!onRestoreFile) {
        toast.error('当前环境不支持从文件直接导入恢复');
        return;
      }
      setIsSubmitting(true);
      try {
        setUploadProgress({ loaded: 0, total: selectedFile.size, done: false });
        await onRestoreFile(app.id, selectedFile, setUploadProgress);
        toast.success(`文件 ${selectedFile.name} 已成功恢复至应用 ${app.name}！`);
        onClose();
      } catch (err: any) {
        toast.error(`导入恢复失败: ${err.message || '未知错误'}`);
      } finally {
        setIsSubmitting(false);
        setUploadProgress(null);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="恢复应用备份快照"
      subtitle={`目标应用: ${app.name} (${app.id})`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Source Mode Tabs */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-ink-muted">恢复来源方式</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-paper-3 rounded-2xl">
            <button
              type="button"
              disabled={appBackups.length === 0}
              onClick={() => setSourceType('existing')}
              className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                sourceType === 'existing'
                  ? 'bg-paper-2 shadow-sm text-ink font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Archive className="w-4 h-4 text-accent" />
              <span>历史快照 ({appBackups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSourceType('upload')}
              className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                sourceType === 'upload'
                  ? 'bg-paper-2 shadow-sm text-ink font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <UploadSimple className="w-4 h-4 text-emerald-500" />
              <span>上传本地 .zip 文件</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Existing Backup Records */}
        {sourceType === 'existing' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink-muted">选择历史备份归档</label>
            {appBackups.length === 0 ? (
              <div className="p-4 rounded-2xl text-center text-ink-muted bg-paper-3 space-y-2">
                <p>暂无此应用的历史备份快照。</p>
                <button
                  type="button"
                  onClick={() => setSourceType('upload')}
                  className="text-accent hover:opacity-80 font-medium text-xs cursor-pointer inline-flex items-center gap-1"
                >
                  <UploadSimple className="w-3.5 h-3.5" />
                  <span>切换至「上传本地 .zip 文件」导入</span>
                </button>
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                {appBackups.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedRecordId(b.id)}
                    className={`p-3.5 rounded-2xl transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      selectedRecordId === b.id
                        ? 'bg-paper-4 ring-1 ring-zinc-400 dark:ring-white/30'
                        : 'bg-paper-3 hover:bg-paper-4/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="font-mono text-ink font-semibold truncate text-[11.5px]">
                          {b.fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10.5px] text-ink-muted pl-6">
                        <span>{formatBytes(b.fileSizeBytes)}</span>
                        <span>•</span>
                        <span>{new Date(b.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <input
                        type="radio"
                        name="restoreAppRecord"
                        checked={selectedRecordId === b.id}
                        onChange={() => setSelectedRecordId(b.id)}
                        className="text-accent focus:ring-accent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Upload Local File */}
        {sourceType === 'upload' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink-muted">选择本地 .zip 备份包</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />
            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 rounded-2xl transition-colors cursor-pointer text-center space-y-2 ${
                  isDragging
                    ? 'bg-paper-4 ring-1 ring-zinc-400 dark:ring-white/30'
                    : 'bg-paper-3 hover:bg-paper-4/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-paper-4 text-ink-muted flex items-center justify-center mx-auto shadow-sm">
                  <UploadSimple className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-ink">点击或拖拽文件到此处</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    支持 Vessel 导出的应用备份包 <code className="font-mono text-ink">vessel_app_*.zip</code>
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-paper-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4" weight="bold" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-ink font-semibold truncate text-[11.5px]">{selectedFile.name}</p>
                    <p className="text-[10.5px] text-ink-muted">{formatBytes(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  disabled={isSubmitting}
                  className="disabled:opacity-40 disabled:cursor-not-allowed p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-4 transition-colors cursor-pointer"
                  title="重新选择"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {uploadProgress && <UploadProgressBar progress={uploadProgress} />}
          </div>
        )}

        {/* Warning & Coverage description */}
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-ink-muted leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-[11.5px]">
            <Warning className="w-3.5 h-3.5 shrink-0" weight="fill" />
            <span>恢复覆盖说明</span>
          </div>
          <p className="text-[11px]">
            恢复操作将自动解压并覆盖当前应用的 <code className="font-mono text-ink bg-paper-3 px-1 py-0.2 rounded">docker-compose.yml</code> 编排文件、<code className="font-mono text-ink bg-paper-3 px-1 py-0.2 rounded">.env</code> 环境变量配置以及持久化挂载的数据卷内容。
          </p>
        </div>

        {/* Double-confirmation Input */}
        <div className="space-y-1.5 pt-1">
          <label htmlFor="restore-app-input" className="flex items-center justify-between text-ink-muted text-[11.5px]">
            <span>
              请输入应用标识 <strong className="font-mono font-semibold text-ink select-all">{app.id}</strong> 以确认：
            </span>
            <button
              type="button"
              onClick={() => setConfirmInput(app.id)}
              className="text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer underline decoration-dotted underline-offset-2"
            >
              快速填入
            </button>
          </label>
          <input
            id="restore-app-input"
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isConfirmed && !isSubmitting) {
                handleRestore();
              }
            }}
            placeholder={app.id}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-10 bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/60 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors shadow-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none"
          >
            取消
          </button>
          <Button8State
            size="sm"
            variant="danger"
            state={isSubmitting ? 'loading' : 'default'}
            disabled={!isConfirmed || (sourceType === 'upload' && !selectedFile) || isSubmitting}
            onClick={handleRestore}
            icon={isSubmitting ? undefined : <ArrowCounterClockwise className="w-3.5 h-3.5 text-current" />}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
          >
            {uploadProgress
              ? uploadProgress.done
                ? '正在还原…'
                : `上传中 ${uploadProgress.total ? Math.floor((uploadProgress.loaded / uploadProgress.total) * 100) : 0}%`
              : isSubmitting ? '正在恢复快照...' : '确认恢复应用'}
          </Button8State>
        </div>
      </div>
    </Modal>
  );
};
