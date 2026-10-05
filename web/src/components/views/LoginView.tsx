import React, { useState, useEffect } from 'react';
import {
  Anchor,
  User,
  LockKey,
  Eye,
  EyeSlash,
  SignIn,
  Sparkle,
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

  const [isDefaultPassword, setIsDefaultPassword] = useState(false);

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]');

  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.isDefaultPassword === 'boolean') {
          setIsDefaultPassword(data.isDefaultPassword);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
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

  const handleFillDefault = () => {
    setUsername('admin');
    setPassword('vessel2026');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-accent/20">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[250px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-paper-2/90 backdrop-blur-xl border border-line rounded-2xl shadow-2xl p-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-paper-3 border border-line text-accent shadow-inner mb-4">
            <Anchor className="w-7 h-7 animate-pulse" weight="duotone" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink">VESSEL 控制台</h1>
          <p className="text-xs text-ink-muted mt-1.5">
            Cloud-Native Docker Compose &amp; SSL Control Plane
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-600 dark:text-red-400 text-xs animate-shake">
            <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
              管理员账号
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                <User className="w-4 h-4" weight="bold" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                disabled={loading}
                autoFocus
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-paper border border-line text-xs text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-ink-muted">
                访问密码
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                <LockKey className="w-4 h-4" weight="bold" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-paper border border-line text-xs text-ink placeholder-ink-faint focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-all disabled:opacity-50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink cursor-pointer transition-colors"
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
              size="md"
              state={loading ? 'loading' : 'default'}
              disabled={loading}
              icon={<SignIn className="w-4 h-4" weight="bold" />}
              className="w-full py-3 justify-center text-xs font-semibold shadow-md"
            >
              {loading ? '正在验证身份...' : '登录管理控制台'}
            </Button8State>
          </div>
        </form>

        {/* Default Account Hint Box - ONLY visible on localhost when password is still default */}
        {isLocalhost && isDefaultPassword && (
          <div className="mt-6 pt-5 border-t border-line">
            <div className="p-3.5 rounded-xl bg-paper border border-line/60 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Key className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="duotone" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-ink font-medium">初始默认凭证</p>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono scale-90">
                      本地调试可见 · 公网自动隐藏
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1">
                    账号: <code className="px-1 py-0.5 rounded bg-paper-2 font-mono text-ink">admin</code>
                    <span className="mx-1.5 opacity-40">|</span>
                    密码: <code className="px-1 py-0.5 rounded bg-paper-2 font-mono text-ink">vessel2026</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillDefault}
                className="text-[11px] font-medium text-accent hover:underline shrink-0 cursor-pointer pt-0.5"
              >
                一键填入
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer copyright / info */}
      <div className="mt-8 text-center text-xs text-ink-faint">
        Vessel Platform Engine &bull; Pure Docker &amp; Caddy Automation
      </div>
    </div>
  );
};
