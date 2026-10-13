import React, { useState, useEffect } from 'react';
import {
  Anchor,
  User,
  LockKey,
  Eye,
  EyeSlash,
  SignIn,
  WarningCircle,
  Key,
} from '@phosphor-icons/react';
import { useAuth } from '../../hooks/useAuth.js';
import { Button8State } from '../common/Button8State.js';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (res.success) {
        onLoginSuccess?.();
      } else {
        setError(res.error || '登录失败，请检查账号和密码');
      }
    } catch (err: any) {
      setError(err.message || '网络连接失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-start sm:justify-center items-center px-4 pt-12 pb-8 sm:py-12 relative overflow-x-hidden font-sans selection:bg-accent/20">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[250px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container: Mobile full-bleed flush, Desktop floating card */}
      <div className="w-full max-w-md bg-transparent sm:bg-paper-2 sm:rounded-3xl sm:shadow-2xl sm:p-8 p-1 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-7 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-paper-3 text-accent mb-3.5 sm:mb-4">
            <Anchor className="w-7 h-7" weight="duotone" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-sans">VESSEL 控制台</h1>
          <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
            Cloud-Native Docker Compose &amp; SSL Control Plane
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 flex items-center gap-3 text-rose-500 text-xs animate-shake">
            <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Form with native <form> tag and standard autocomplete semantics */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" method="POST" action="#">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">
              管理员账号
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
                <User className="w-4 h-4" weight="bold" />
              </div>
              <input
                type="text"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                disabled={loading}
                autoFocus
                className="w-full pl-10 pr-3.5 py-3 min-h-[48px] rounded-xl bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 text-base sm:text-xs text-ink placeholder:text-ink-faint/80 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors shadow-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1.5">
              访问密码
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
                <LockKey className="w-4 h-4" weight="bold" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                className="w-full pl-10 pr-12 py-3 min-h-[48px] rounded-xl bg-white dark:bg-paper-3 border border-zinc-200 dark:border-white/10 text-base sm:text-xs text-ink placeholder:text-ink-faint/80 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors shadow-sm disabled:opacity-50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer transition-colors rounded-lg"
              >
                {showPassword ? (
                  <EyeSlash className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <Button8State
              type="submit"
              variant="primary"
              size="lg"
              state={loading ? 'loading' : 'default'}
              disabled={loading}
              icon={<SignIn className="w-4 h-4" weight="bold" />}
              className="w-full min-h-[48px] py-3 justify-center text-sm font-semibold rounded-xl"
            >
              {loading ? '正在验证身份...' : '登录管理控制台'}
            </Button8State>
          </div>
        </form>

        <p className="mt-6 text-xs text-ink-muted">
          首次登录：账号为 admin，初始密码见服务器数据目录中的 initial-admin-password 文件，或使用安装时设置的密码。
        </p>
      </div>

      {/* Footer copyright / info */}
      <div className="mt-8 sm:mt-12 text-center text-xs text-ink-faint">
        Vessel Platform Engine &bull; Pure Docker &amp; Caddy Automation
      </div>
    </div>
  );
};
