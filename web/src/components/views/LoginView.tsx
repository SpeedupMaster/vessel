import React, { useState, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  User,
  LockKey,
  Eye,
  EyeSlash,
  SignIn,
  WarningCircle,
} from '@phosphor-icons/react';
import { useAuth } from '../../hooks/useAuth.js';
import { Button8State } from '../common/Button8State.js';
import { VesselMark } from '../common/ViewReveal.js';
import { EASE_OUT, prefersReducedMotion } from '../../lib/motion.js';

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
  const [errorNonce, setErrorNonce] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Staggered entrance: brand, fields and footer settle in sequence
  useLayoutEffect(() => {
    if (prefersReducedMotion() || !rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-login-card]',
        { opacity: 0, y: 24, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: EASE_OUT, clearProps: 'transform,opacity' }
      );
      gsap.fromTo(
        '[data-login-item]',
        { opacity: 0, y: 12, filter: 'blur(4px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: EASE_OUT, stagger: 0.06, delay: 0.12, clearProps: 'transform,opacity,filter' }
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // Re-keying the alert replays the shake even when the message repeats
  const fail = (message: string) => {
    setError(message);
    setErrorNonce((n) => n + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      fail('请输入用户名和密码');
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
        fail(res.error || '登录失败，请检查账号和密码');
      }
    } catch (err: any) {
      fail(err.message || '网络连接失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="vessel-canvas min-h-screen bg-paper text-ink flex flex-col justify-start sm:justify-center items-center px-4 pt-12 pb-8 sm:py-12 relative overflow-hidden font-sans"
    >
      {/* Ambience: drifting aurora over a fading dot grid */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-dot-grid opacity-70 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_40%,black,transparent)]" />
        <div className="animate-aurora absolute left-1/2 top-[18%] -ml-[360px] w-[720px] h-[420px] rounded-full blur-[110px] opacity-60 dark:opacity-50 bg-[conic-gradient(from_180deg_at_50%_50%,var(--color-signal-ring),transparent_35%,rgba(16,185,129,0.14)_55%,transparent_75%,var(--color-signal-soft))]" />
      </div>

      <div
        data-login-card
        className="w-full max-w-[400px] relative z-10 p-1 sm:p-8 sm:rounded-[22px] sm:bg-paper-2/80 sm:backdrop-blur-xl sm:border sm:border-line sm:shadow-pop"
      >
        {/* Brand */}
        <div data-login-item className="text-center mb-7 sm:mb-8">
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent text-accent-contrast mb-4 shadow-[var(--shadow-button)] overflow-hidden">
            <span className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-transparent dark:to-black/10" />
            <VesselMark className="relative w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-[22px] font-semibold tracking-[-0.02em] text-ink">登录 Vessel 控制台</h1>
          <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
            Cloud-Native Docker Compose &amp; SSL Control Plane
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            key={errorNonce}
            role="alert"
            className="mb-5 p-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] flex items-center gap-2.5 text-rose-600 dark:text-rose-400 text-xs animate-shake"
          >
            <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Form with native <form> tag and standard autocomplete semantics */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" method="POST" action="#">
          {/* Username */}
          <div data-login-item>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
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
                className="w-full pl-10 pr-3.5 py-3 min-h-[48px] rounded-xl bg-paper-2 dark:bg-white/[0.03] border border-line text-base sm:text-[13px] text-ink placeholder:text-ink-faint/70 hover:border-line-strong shadow-subtle disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div data-login-item>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">
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
                className="w-full pl-10 pr-12 py-3 min-h-[48px] rounded-xl bg-paper-2 dark:bg-white/[0.03] border border-line text-base sm:text-[13px] text-ink placeholder:text-ink-faint/70 hover:border-line-strong shadow-subtle disabled:opacity-50 font-mono"
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
          <div data-login-item className="pt-2">
            <Button8State
              type="submit"
              variant="primary"
              size="lg"
              state={loading ? 'loading' : 'default'}
              disabled={loading}
              icon={<SignIn className="w-4 h-4" weight="bold" />}
              className="w-full min-h-[48px] py-3 justify-center text-sm font-semibold rounded-xl active:scale-[0.98]"
            >
              {loading ? '正在验证身份...' : '登录管理控制台'}
            </Button8State>
          </div>
        </form>

        <p data-login-item className="mt-6 pt-5 border-t border-line-subtle text-[11px] leading-relaxed text-ink-faint">
          首次登录：账号为 admin，初始密码见服务器数据目录中的 initial-admin-password 文件，或使用安装时设置的密码。
        </p>
      </div>

      {/* Footer copyright / info */}
      <div className="relative z-10 mt-8 sm:mt-10 text-center text-[11px] text-ink-faint tracking-wide">
        Vessel Platform Engine &bull; Pure Docker &amp; Caddy Automation
      </div>
    </div>
  );
};
