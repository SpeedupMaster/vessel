import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  CheckCircle,
  WarningCircle,
  Warning,
  Info,
  X,
  Trash,
  Check,
} from '@phosphor-icons/react';
import { Modal } from '../components/common/Modal';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  subtitle?: string;
  message: string;
  details?: string[];
  dangerTitle?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

interface NotificationContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Toast controls
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const toast = useRef({
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
    warning: (msg: string) => addToast('warning', msg),
  }).current;

  // Confirm dialog control
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}

      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let icon = <Info className="w-4 h-4 text-accent flex-shrink-0" weight="fill" />;
          let bgIcon = 'bg-accent/10 text-accent';
          let borderAccent = 'border-line';
          let label = '系统提示';

          if (t.type === 'success') {
            icon = <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" weight="fill" />;
            bgIcon = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400';
            borderAccent = 'border-emerald-200 dark:border-emerald-800/60';
            label = '操作成功';
          } else if (t.type === 'error') {
            icon = <WarningCircle className="w-4 h-4 text-rose-500 flex-shrink-0" weight="fill" />;
            bgIcon = 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400';
            borderAccent = 'border-rose-200 dark:border-rose-900/60';
            label = '执行失败';
          } else if (t.type === 'warning') {
            icon = <Warning className="w-4 h-4 text-amber-500 flex-shrink-0" weight="fill" />;
            bgIcon = 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400';
            borderAccent = 'border-amber-200 dark:border-amber-800/60';
            label = '系统警告';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto bg-paper/95 backdrop-blur-md border ${borderAccent} rounded-xl shadow-floating p-3.5 flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-3 duration-200`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${bgIcon}`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0 pr-1">
                <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-0.5">
                  {label}
                </div>
                <div className="text-xs text-ink leading-relaxed font-sans select-text">
                  {t.message}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-ink-muted hover:text-ink hover:bg-paper-2 transition-colors p-1 rounded-lg flex-shrink-0 -mr-1 -mt-1 cursor-pointer"
                data-tooltip="关闭"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmState && (
        <Modal
          isOpen={confirmState.isOpen}
          onClose={() => handleConfirmClose(false)}
          title={
            confirmState.options.title ||
            (confirmState.options.variant === 'danger' ? '⚠️ 高风险操作确认' : '操作确认')
          }
          subtitle={confirmState.options.subtitle}
          maxWidth="max-w-xl"
          zIndex="z-[9999]"
        >
          <div className="space-y-4">
            {confirmState.options.variant === 'danger' ? (
              <div className="p-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60 text-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-300">
                  <Warning className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" weight="fill" />
                  <span>{confirmState.options.dangerTitle || '高风险操作确认'}</span>
                </div>
                <p className="leading-relaxed font-sans">
                  {confirmState.options.message}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-paper-2 text-ink border border-line text-xs space-y-2.5 shadow-subtle">
                <div className="flex items-center gap-2 font-semibold text-sm text-ink">
                  <Info className="w-5 h-5 text-accent flex-shrink-0" weight="fill" />
                  <span>提示说明</span>
                </div>
                <p className="leading-relaxed text-ink-muted font-sans">
                  {confirmState.options.message}
                </p>
              </div>
            )}

            {confirmState.options.details && confirmState.options.details.length > 0 && (
              <div className="p-4 rounded-xl bg-paper-2 border border-line text-xs space-y-2 shadow-subtle">
                <div className="font-semibold text-ink">影响范围确认：</div>
                <ul className="space-y-1.5 text-ink-muted list-disc list-inside">
                  {confirmState.options.details.map((item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-line flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle transition-colors"
              >
                {confirmState.options.cancelText || '取消并返回'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-5 py-2 font-medium text-xs rounded-lg transition-all shadow-subtle active:translate-y-px flex items-center gap-2 ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-200 dark:border dark:border-rose-800'
                    : 'bg-accent hover:bg-accent-hover text-white'
                }`}
                autoFocus
              >
                {confirmState.options.variant === 'danger' ? (
                  <Trash className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>
                  {confirmState.options.confirmText ||
                    (confirmState.options.variant === 'danger' ? '确认彻底删除' : '确认')}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
