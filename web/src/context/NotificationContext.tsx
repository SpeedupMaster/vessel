import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import {
  CheckCircle,
  WarningCircle,
  Warning,
  Info,
  X,
} from '@phosphor-icons/react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
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
    }, 3800);
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

  // Keyboard shortcut for confirm modal (Escape to cancel)
  useEffect(() => {
    if (!confirmState?.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleConfirmClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState]);

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}

      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let icon = <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" weight="bold" />;
          let borderAccent = 'border-line';

          if (t.type === 'success') {
            icon = <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" weight="fill" />;
            borderAccent = 'border-emerald-200 dark:border-emerald-800/60';
          } else if (t.type === 'error') {
            icon = <WarningCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" weight="fill" />;
            borderAccent = 'border-rose-200 dark:border-rose-900/60';
          } else if (t.type === 'warning') {
            icon = <Warning className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" weight="bold" />;
            borderAccent = 'border-amber-200 dark:border-amber-800/60';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto bg-paper border ${borderAccent} rounded-xl shadow-floating p-4 flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-2 duration-200`}
            >
              {icon}
              <div className="flex-1 text-xs text-ink leading-relaxed font-sans pr-1">
                {t.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-ink-muted hover:text-ink transition-colors p-0.5 rounded"
                title="关闭"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <div
            onClick={() => handleConfirmClose(false)}
            className="fixed inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm transition-opacity"
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-paper border border-line rounded-xl shadow-floating p-6 sm:p-7 z-10 flex flex-col space-y-4 font-sans animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60'
                    : 'bg-accent/10 text-accent border border-accent/20'
                }`}
              >
                {confirmState.options.variant === 'danger' ? (
                  <Warning className="w-5 h-5" weight="bold" />
                ) : (
                  <Info className="w-5 h-5" weight="bold" />
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-base font-semibold text-ink tracking-tight">
                  {confirmState.options.title || '操作确认'}
                </h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  {confirmState.options.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="text-ink-muted hover:text-ink transition-colors p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-line/60 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line transition-colors shadow-subtle"
              >
                {confirmState.options.cancelText || '取消'}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all shadow-subtle active:translate-y-px ${
                  confirmState.options.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-200 dark:border dark:border-rose-800'
                    : 'bg-accent hover:bg-accent-hover text-white'
                }`}
                autoFocus
              >
                {confirmState.options.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
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
