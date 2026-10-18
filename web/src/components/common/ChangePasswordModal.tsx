import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Key,
  LockKey,
  CheckCircle,
  WarningCircle,
  Eye,
  EyeSlash,
  Warning,
} from '@phosphor-icons/react';
import { useAuth } from '../../hooks/useAuth.js';
import { Button8State } from './Button8State.js';
import clsx from 'clsx';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  required?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  required = false,
}) => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [touched, setTouched] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  if (!isOpen) return null;

  // Validation checks
  const isCurrentEmpty = touched.current && !currentPassword;
  const isNewTooShort = touched.new && newPassword.length > 0 && newPassword.length < 8;
  const isNewEmpty = touched.new && !newPassword;
  const isConfirmMismatch =
    touched.confirm && confirmPassword.length > 0 && confirmPassword !== newPassword;
  const isConfirmEmpty = touched.confirm && !confirmPassword;

  // Progressive Enablement: all fields must be non-empty and valid
  const isFormValid =
    currentPassword.trim().length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const hasDirtyInput = Boolean(currentPassword || newPassword || confirmPassword);

  const handleAttemptClose = () => {
    if (loading || required) return;
    if (hasDirtyInput && !success) {
      setShowDiscardConfirm(true);
    } else {
      handleFinalClose();
    }
  };

  const handleFinalClose = () => {
    setShowDiscardConfirm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setTouched({ current: false, new: false, confirm: false });
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Trigger touched for all
    setTouched({ current: true, new: true, confirm: true });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请完整填写所有密码字段');
      return;
    }

    if (newPassword.length < 8) {
      setError('新密码长度不能少于 8 位字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          handleFinalClose();
        }, 1200);
      } else {
        setError(res.error || '密码修改失败');
      }
    } catch (err: any) {
      setError(err.message || '网络异常，无法完成修改');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[3px] animate-fade-in font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleAttemptClose();
        }
      }}
    >
      {/* Modal / Bottom Sheet Container */}
      <div
        className={clsx(
          'w-full max-h-[92vh] flex flex-col surface-pop transition-all overflow-hidden',
          'rounded-t-[24px] md:rounded-[22px] md:max-w-md md:w-full md:max-h-[85vh]'
        )}
      >
        {/* Mobile Drag Indicator */}
        <div className="md:hidden w-9 h-1 bg-ink-faint/30 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="bg-paper-2 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-paper-3 flex items-center justify-center text-accent shrink-0">
              <Key className="w-4 h-4" weight="bold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink leading-tight">修改管理员密码</h2>
              <p className="text-[11px] text-ink-muted mt-0.5">{required ? '首次使用必须先修改初始密码' : '更新当前账号的登录访问凭证'}</p>
            </div>
          </div>
          {/* Close Button with >=44px Touch Target */}
          <button
            type="button"
            onClick={handleAttemptClose}
            disabled={loading || required}
            aria-label="关闭弹窗"
            className="w-8 h-8 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 no-scrollbar">
            {/* Success Alert */}
            {success && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 text-xs animate-fade-in">
                <CheckCircle className="w-4 h-4 shrink-0" weight="fill" />
                <span className="font-medium">密码已成功修改！已自动刷新凭证。</span>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 flex items-center gap-2.5 text-rose-500 text-xs animate-fade-in">
                <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Current Password Field */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                当前密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                  <LockKey className="w-4 h-4" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, current: true }))}
                  placeholder="输入当前密码"
                  disabled={loading || success}
                  autoComplete="current-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={isCurrentEmpty}
                  className={clsx(
                    'w-full pl-10 pr-11 py-2.5 rounded-xl text-xs text-ink placeholder:text-ink-faint/80 focus:outline-none font-mono transition-colors',
                    isCurrentEmpty
                      ? 'bg-rose-500/10 border border-rose-500/50 focus:border-rose-500/80 dark:focus:border-rose-500/70'
                      : 'bg-paper-2 dark:bg-paper-3 border border-line shadow-sm'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? '隐藏当前密码' : '显示当前密码'}
                  className="absolute inset-y-0 right-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-faint hover:text-ink transition-colors cursor-pointer"
                >
                  {showCurrent ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isCurrentEmpty && (
                <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1 animate-fade-in font-sans">
                  <WarningCircle className="w-3.5 h-3.5 shrink-0" weight="fill" />
                  <span>请输入当前使用的管理员密码</span>
                </p>
              )}
            </div>

            {/* New Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-ink-muted">
                  新密码
                </label>
                <span className="text-[11px] text-ink-muted">至少 8 位字符</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                  <LockKey className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, new: true }))}
                  placeholder="设置新密码 (≥8 位)"
                  disabled={loading || success}
                  autoComplete="new-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={isNewEmpty || isNewTooShort}
                  className={clsx(
                    'w-full pl-10 pr-11 py-2.5 rounded-xl text-xs text-ink placeholder:text-ink-faint/80 focus:outline-none font-mono transition-colors',
                    isNewEmpty || isNewTooShort
                      ? 'bg-rose-500/10 border border-rose-500/50 focus:border-rose-500/80 dark:focus:border-rose-500/70'
                      : 'bg-paper-2 dark:bg-paper-3 border border-line shadow-sm'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? '隐藏新密码' : '显示新密码'}
                  className="absolute inset-y-0 right-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-faint hover:text-ink transition-colors cursor-pointer"
                >
                  {showNew ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isNewEmpty && (
                <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1 animate-fade-in font-sans">
                  <WarningCircle className="w-3.5 h-3.5 shrink-0" weight="fill" />
                  <span>请输入新密码</span>
                </p>
              )}
              {isNewTooShort && (
                <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1 animate-fade-in font-sans">
                  <WarningCircle className="w-3.5 h-3.5 shrink-0" weight="fill" />
                  <span>密码长度不能少于 8 位 (当前仅 {newPassword.length} 位)</span>
                </p>
              )}
            </div>

            {/* Confirm Password Field (Equipped with Eye Toggle) */}
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                确认新密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                  <LockKey className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
                  placeholder="再次输入新密码"
                  disabled={loading || success}
                  autoComplete="new-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={isConfirmEmpty || isConfirmMismatch}
                  className={clsx(
                    'w-full pl-10 pr-11 py-2.5 rounded-xl text-xs text-ink placeholder:text-ink-faint/80 focus:outline-none font-mono transition-colors',
                    isConfirmEmpty || isConfirmMismatch
                      ? 'bg-rose-500/10 border border-rose-500/50 focus:border-rose-500/80 dark:focus:border-rose-500/70'
                      : 'bg-paper-2 dark:bg-paper-3 border border-line shadow-sm'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? '隐藏确认新密码' : '显示确认新密码'}
                  className="absolute inset-y-0 right-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-faint hover:text-ink transition-colors cursor-pointer"
                >
                  {showConfirm ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isConfirmEmpty && (
                <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1 animate-fade-in font-sans">
                  <WarningCircle className="w-3.5 h-3.5 shrink-0" weight="fill" />
                  <span>请再次输入新密码进行确认</span>
                </p>
              )}
              {isConfirmMismatch && (
                <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1 animate-fade-in font-sans">
                  <WarningCircle className="w-3.5 h-3.5 shrink-0" weight="fill" />
                  <span>两次输入的密码不一致，请仔细检查</span>
                </p>
              )}
            </div>
          </div>

          {/* Sticky Bottom Actions - Always visible above virtual keyboard */}
          <div className="sticky bottom-0 z-10 bg-paper-2 px-6 py-4 flex items-center justify-end gap-3 shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
            <Button8State
              type="button"
              variant="secondary"
              size="md"
              onClick={handleAttemptClose}
              disabled={loading || success || required}
              className="min-h-[40px] px-4 rounded-xl"
            >
              取消
            </Button8State>
            <Button8State
              type="submit"
              variant="primary"
              size="md"
              state={loading ? 'loading' : 'default'}
              disabled={!isFormValid || loading || success}
              icon={<Key className="w-4 h-4" weight="bold" />}
              className="min-h-[40px] px-5 rounded-xl"
            >
              {loading ? '提交中...' : '确认修改'}
            </Button8State>
          </div>
        </form>
      </div>

      {/* Discard Confirmation Action Modal (Prevents accidental loss of input) */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[3px] animate-fade-in font-sans">
          <div className="w-full max-w-xs surface-pop rounded-[18px] p-5 space-y-3.5 overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Warning className="w-4 h-4" weight="bold" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-ink">放弃修改密码？</h4>
                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                  当前输入的内容尚未保存，关闭后将清空输入。确定要退出吗？
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="btn-vessel-secondary min-h-[36px] px-3 text-xs font-medium rounded-xl cursor-pointer"
              >
                继续编辑
              </button>
              <button
                type="button"
                onClick={handleFinalClose}
                className="min-h-[36px] px-3.5 text-xs font-semibold rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer"
              >
                放弃修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
