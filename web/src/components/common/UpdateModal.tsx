import React, { useState } from 'react';
import clsx from 'clsx';
import { ArrowSquareOut, ArrowsClockwise, CheckCircle, CircleNotch, DownloadSimple, Warning } from '@phosphor-icons/react';
import { Modal } from './Modal.js';
import { Button8State } from './Button8State.js';
import { useNotification } from '../../context/NotificationContext.js';
import { ApplyState, UpdateStatus } from '../../hooks/useSystemUpdate.js';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: UpdateStatus | null;
  checking: boolean;
  apply: ApplyState;
  onCheck: () => Promise<UpdateStatus>;
  onStart: () => Promise<void>;
  onReset: () => void;
}

const STEPS = [
  { key: 'pulling', label: '拉取新版本镜像' },
  { key: 'restarting', label: '重建容器并等待健康检查' },
] as const;

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, status, checking, apply, onCheck, onStart, onReset }) => {
  const { toast } = useNotification();
  const [starting, setStarting] = useState(false);
  const busy = apply.stage === 'pulling' || apply.stage === 'restarting';
  const latest = status?.latest;

  const handleCheck = async () => {
    try {
      const next = await onCheck();
      if (next.checkError) toast.error(`检查更新失败：${next.checkError}`);
      else if (!next.updateAvailable) toast.success('当前已是最新版本');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStart();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setStarting(false);
    }
  };

  const close = () => {
    if (busy) return;
    if (apply.stage === 'failed') onReset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="系统更新" subtitle="Vessel 控制面板版本" maxWidth="max-w-lg">
      <div className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3.5 rounded-2xl bg-paper-3">
            <div className="text-ink-muted text-[11px]">当前版本</div>
            <div className="mt-1 font-mono text-sm font-semibold text-ink">v{status?.currentVersion ?? __APP_VERSION__}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-paper-3">
            <div className="text-ink-muted text-[11px]">最新版本</div>
            <div className="mt-1 font-mono text-sm font-semibold text-ink flex items-center gap-2">
              {latest ? latest.tag : '—'}
              {status?.updateAvailable && <span className="status-dot !w-1.5 !h-1.5 text-emerald-500" data-live="true" />}
            </div>
          </div>
        </div>

        {status?.checkError && (
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex gap-2">
            <Warning className="w-4 h-4 shrink-0 mt-px" />
            <span>无法获取最新版本：{status.checkError}</span>
          </div>
        )}

        {latest && status?.updateAvailable && !busy && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-muted">更新说明</span>
              <a
                href={latest.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-ink-muted hover:text-ink transition-colors"
              >
                在 GitHub 查看 <ArrowSquareOut className="w-3.5 h-3.5" />
              </a>
            </div>
            <pre className="max-h-56 overflow-y-auto p-3.5 rounded-2xl bg-paper-3 text-ink whitespace-pre-wrap break-words font-sans leading-relaxed">
              {latest.notes.trim() || '此版本没有填写更新说明。'}
            </pre>
          </div>
        )}

        {status && !status.updateAvailable && !status.checkError && latest && (
          <div className="p-3.5 rounded-2xl bg-paper-3 flex items-center gap-2 text-ink">
            <CheckCircle className="w-4 h-4 text-emerald-500" weight="fill" />
            当前已是最新版本
          </div>
        )}

        {status?.updateAvailable && !status.supported && (
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex gap-2">
            <Warning className="w-4 h-4 shrink-0 mt-px" />
            <span>{status.unsupportedReason} 可在服务器上重新运行新版本的安装脚本完成升级。</span>
          </div>
        )}

        {(busy || apply.stage === 'failed') && (
          <div className="p-3.5 rounded-2xl bg-paper-3 space-y-2.5">
            {STEPS.map((step, index) => {
              const current = STEPS.findIndex(s => s.key === apply.stage);
              const done = busy && index < current;
              const active = busy && index === current;
              return (
                <div key={step.key} className={clsx('flex items-center gap-2', active || done ? 'text-ink' : 'text-ink-faint')}>
                  {done ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" weight="fill" />
                  ) : active ? (
                    <CircleNotch className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-line" />
                  )}
                  {step.label}
                </div>
              );
            })}
            {apply.stage === 'failed' && (
              <div className="pt-1 text-rose-500 flex gap-2">
                <Warning className="w-4 h-4 shrink-0 mt-px" />
                <span>{apply.error}</span>
              </div>
            )}
            {busy && <p className="text-ink-faint">更新完成后页面会自动刷新。</p>}
          </div>
        )}

        {status?.updateAvailable && status.supported && !busy && apply.stage !== 'failed' && (
          <p className="text-ink-faint leading-relaxed">
            更新期间控制面板会短暂不可用，已部署的应用不受影响。新版本启动失败时会自动回滚到当前版本。
          </p>
        )}

        <div className="pt-1 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking || busy}
            className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none mr-auto inline-flex items-center gap-1.5"
          >
            <ArrowsClockwise className={clsx('w-3.5 h-3.5', checking && 'animate-spin')} />
            检查更新
          </button>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none"
          >
            {status?.updateAvailable ? '稍后' : '关闭'}
          </button>
          {status?.updateAvailable && status.supported && (
            <Button8State
              size="sm"
              state={busy || starting ? 'loading' : 'default'}
              onClick={apply.stage === 'failed' ? () => { onReset(); void handleStart(); } : handleStart}
              icon={busy || starting ? undefined : <DownloadSimple className="w-3.5 h-3.5 text-current" />}
              className="rounded-xl px-4 py-2 text-xs font-semibold"
            >
              {busy ? '正在更新…' : apply.stage === 'failed' ? '重试' : `更新到 ${latest?.tag}`}
            </Button8State>
          )}
        </div>
      </div>
    </Modal>
  );
};
