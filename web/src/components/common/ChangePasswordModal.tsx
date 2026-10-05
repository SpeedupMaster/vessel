import React, { useState } from 'react';
import {
  X,
  Key,
  LockKey,
  CheckCircle,
  WarningCircle,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react';
import { useAuth } from '../../hooks/useAuth.js';
import { Button8State } from './Button8State.js';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('请完整填写所有密码字段');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码长度不能少于 6 位字符');
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
          setSuccess(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          onClose();
        }, 1500);
      } else {
        setError(res.error || '密码修改失败');
      }
    } catch (err: any) {
      setError(err.message || '网络异常，无法完成修改');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-md bg-paper-2 border border-line rounded-2xl shadow-2xl p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-paper-3 border border-line text-accent">
              <Key className="w-4 h-4" weight="bold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">修改管理员密码</h2>
              <p className="text-[11px] text-ink-muted">更新当前账号的登录访问凭证</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4 shrink-0" weight="fill" />
            <span className="font-medium">密码已成功修改！已自动刷新凭证。</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-red-600 dark:text-red-400 text-xs">
            <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
              当前密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-faint">
                <LockKey className="w-3.5 h-3.5" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
                disabled={loading || success}
                autoFocus
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-paper border border-line text-xs text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-faint hover:text-ink"
              >
                {showCurrent ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
              新密码 (至少 6 位)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-faint">
                <LockKey className="w-3.5 h-3.5" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="设置新密码"
                disabled={loading || success}
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-paper border border-line text-xs text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-faint hover:text-ink"
              >
                {showNew ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
              确认新密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-faint">
                <LockKey className="w-3.5 h-3.5" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                disabled={loading || success}
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-paper border border-line text-xs text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent font-mono"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <Button8State
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={loading || success}
            >
              取消
            </Button8State>
            <Button8State
              type="submit"
              variant="primary"
              size="sm"
              state={loading ? 'loading' : 'default'}
              disabled={loading || success}
              icon={<Key className="w-3.5 h-3.5" weight="bold" />}
            >
              确认修改
            </Button8State>
          </div>
        </form>
      </div>
    </div>
  );
};
