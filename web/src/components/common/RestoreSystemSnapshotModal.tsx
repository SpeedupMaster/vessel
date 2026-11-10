import React, { useRef, useState } from 'react';
import { UploadSimple, FileArchive, LockKey, X, Warning } from '@phosphor-icons/react';
import { Modal } from './Modal.js';
import { Button8State } from './Button8State.js';
import { UploadProgressBar } from './UploadProgressBar.js';
import { formatBytes } from '../../utils/format.js';
import { useNotification } from '../../context/NotificationContext.js';
import type { UploadProgress } from '../../hooks/useData.js';

interface RestoreSystemSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreFile: (file: File, passphrase?: string, onProgress?: (progress: UploadProgress) => void) => Promise<any>;
}

const isSnapshotFile = (name: string) => /\.zip(?:\.enc)?$/i.test(name);

export const RestoreSystemSnapshotModal: React.FC<RestoreSystemSnapshotModalProps> = ({ isOpen, onClose, onRestoreFile }) => {
  const { toast } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseRequired, setPassphraseRequired] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const encrypted = Boolean(file && /\.enc$/i.test(file.name)) || passphraseRequired;
  const confirmText = confirmInput.trim();
  const confirmed = confirmText === '确认恢复' || confirmText.toUpperCase() === 'RESTORE';
  const canSubmit = Boolean(file) && confirmed && (!encrypted || passphrase.length > 0) && !isSubmitting;

  const reset = () => {
    setFile(null);
    setPassphrase('');
    setPassphraseRequired(false);
    setConfirmInput('');
    setProgress(null);
  };

  const close = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const pick = (picked?: File | null) => {
    if (!picked) return;
    if (!isSnapshotFile(picked.name)) {
      toast.error('请选择 Vessel 系统快照文件（.zip 或 .zip.enc）');
      return;
    }
    setFile(picked);
    setPassphraseRequired(false);
    setProgress(null);
  };

  const submit = async () => {
    if (!file || !canSubmit) return;
    setIsSubmitting(true);
    setProgress(null);
    try {
      const res = await onRestoreFile(file, encrypted ? passphrase : undefined, setProgress);
      toast.success(res?.message || '系统快照已恢复');
      reset();
      onClose();
    } catch (err: any) {
      setProgress(null);
      if (err.code === 'BACKUP_PASSPHRASE_REQUIRED') {
        setPassphraseRequired(true);
        toast.error(passphrase ? err.message : '该快照已加密，请输入备份口令');
        return;
      }
      toast.error(`恢复失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    'w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/60 focus:outline-none transition-colors shadow-sm';

  return (
    <Modal isOpen={isOpen} onClose={close} title="从文件恢复系统快照" subtitle="适用于重装或迁移到新服务器" maxWidth="max-w-md">
      <div className="space-y-4 font-sans text-xs">
        <div className="flex gap-2 p-3 rounded-xl bg-amber-500/[0.08] text-amber-800 dark:text-amber-300 leading-relaxed">
          <Warning className="w-4 h-4 shrink-0 mt-px" />
          <span>
            将用快照中的应用编排、环境变量、域名与设置覆盖当前配置；快照之后新建的应用会保留，管理员账号不变。应用数据卷与数据库内容需在应用详情中单独恢复。
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.enc"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 rounded-2xl transition-colors cursor-pointer text-center space-y-2 ${
              isDragging ? 'bg-paper-4 ring-1 ring-zinc-400 dark:ring-white/30' : 'bg-paper-3 hover:bg-paper-4/60'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-paper-4 text-ink-muted flex items-center justify-center mx-auto shadow-sm">
              <UploadSimple className="w-5 h-5 text-accent" />
            </div>
            <div>
              <span className="text-xs font-semibold text-ink hover:underline">点击选择快照文件</span>
              <span className="text-ink-muted text-xs"> 或拖拽至此处</span>
            </div>
            <p className="text-[11px] text-ink-faint font-mono">vessel_system_*.zip / *.zip.enc</p>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-paper-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-signal-soft text-signal flex items-center justify-center shrink-0">
                {encrypted ? <LockKey className="w-4 h-4" /> : <FileArchive className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-ink truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[11px] text-ink-muted">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => reset()}
              disabled={isSubmitting}
              aria-label="清除所选文件"
              className="disabled:opacity-40 disabled:cursor-not-allowed p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-4 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {progress && <UploadProgressBar progress={progress} />}

        {encrypted && (
          <div className="space-y-1.5">
            <label htmlFor="system-restore-passphrase" className="block text-xs font-medium text-ink/85">
              备份口令（该快照已加密）
            </label>
            <input
              id="system-restore-passphrase"
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="输入创建该快照时使用的口令"
              className={fieldClass}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="system-restore-confirm" className="block text-ink-muted">
            输入 <span className="font-medium text-ink">确认恢复</span> 或 <span className="font-mono text-ink">RESTORE</span> 以继续：
          </label>
          <input
            id="system-restore-confirm"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="确认恢复 或 RESTORE"
            className={fieldClass}
          />
        </div>

        <div className="pt-3 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none"
          >
            取消
          </button>
          <Button8State
            size="sm"
            variant="primary"
            state={isSubmitting ? 'loading' : 'default'}
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-xl px-4 py-2 text-xs font-medium"
          >
            上传并恢复
          </Button8State>
        </div>
      </div>
    </Modal>
  );
};
