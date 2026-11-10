import React, { useState } from 'react';
import clsx from 'clsx';
import {
  GithubLogo,
  Package,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  ArrowsClockwise,
  CircleNotch,
  Eye,
  EyeSlash,
  Key,
} from '@phosphor-icons/react';
import { RegistryItem } from '../../types/index.js';
import { formatRelative } from '../../utils/format.js';

interface RegistriesViewProps {
  registries: RegistryItem[];
  onSaveRegistry: (reg: Partial<RegistryItem>) => Promise<any>;
  onTestRegistry: (id: string) => Promise<any>;
}

type Feedback = { success: boolean; message: string };

const inputCls =
  'w-full min-h-[40px] bg-paper-2 border border-line-strong rounded-lg px-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-signal focus:ring-2 focus:ring-signal-ring disabled:opacity-60';

function statusOf(reg: RegistryItem): { label: string; tone: 'ok' | 'bad' | 'warn' | 'none' } {
  if (!reg.token && !reg.username) return { label: '未配置', tone: 'none' };
  if (reg.status === 'connected') return { label: '已登录', tone: 'ok' };
  if (reg.status === 'error') return { label: '验证失败', tone: 'bad' };
  return { label: '未验证', tone: 'warn' };
}

const TONE = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-rose-700 dark:text-rose-400',
  warn: 'text-amber-700 dark:text-amber-400',
  none: 'text-ink-muted',
} as const;
const DOT = { ok: 'bg-emerald-500', bad: 'bg-rose-500', warn: 'bg-amber-500', none: 'bg-ink-faint' } as const;

export const RegistriesView: React.FC<RegistriesViewProps> = ({ registries, onSaveRegistry, onTestRegistry }) => {
  const [formData, setFormData] = useState<Record<string, { username: string; token: string }>>({});
  const [openForm, setOpenForm] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, 'save' | 'test' | undefined>>({});
  const [feedbackMap, setFeedbackMap] = useState<Record<string, Feedback | undefined>>({});
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});

  const setField = (reg: RegistryItem, field: 'username' | 'token', val: string) => {
    setFormData((prev) => {
      const cur = prev[reg.id] ?? { username: reg.username, token: '' };
      return { ...prev, [reg.id]: { ...cur, [field]: val } };
    });
  };

  const run = async (reg: RegistryItem, kind: 'save' | 'test') => {
    setBusy((p) => ({ ...p, [reg.id]: kind }));
    setFeedbackMap((p) => ({ ...p, [reg.id]: undefined }));
    try {
      if (kind === 'save') {
        const input = formData[reg.id] ?? { username: reg.username, token: '' };
        await onSaveRegistry({
          id: reg.id,
          name: reg.name,
          server: reg.server,
          username: input.username,
          token: input.token,
        });
      }
      const res: Feedback = await onTestRegistry(reg.id);
      setFeedbackMap((p) => ({ ...p, [reg.id]: res }));
      if (res?.success && kind === 'save') {
        setOpenForm((p) => ({ ...p, [reg.id]: false }));
        setFormData((p) => ({ ...p, [reg.id]: { username: p[reg.id]?.username ?? reg.username, token: '' } }));
      }
    } catch (e: any) {
      setFeedbackMap((p) => ({ ...p, [reg.id]: { success: false, message: e.message || '操作失败' } }));
    } finally {
      setBusy((p) => ({ ...p, [reg.id]: undefined }));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <p className="text-sm text-ink-muted max-w-2xl">
        登录后，Compose 中可直接写私有镜像地址，无需在编排里声明认证。
      </p>

      <div className="space-y-4">
        {registries.map((reg) => {
          const isGHCR = reg.id === 'ghcr';
          const st = statusOf(reg);
          const configured = st.tone !== 'none';
          const formOpen = !configured || Boolean(openForm[reg.id]);
          const username = formData[reg.id]?.username ?? reg.username;
          const token = formData[reg.id]?.token ?? '';
          const feedback = feedbackMap[reg.id];
          const working = busy[reg.id];
          const reveal = Boolean(showToken[reg.id]);

          return (
            <section
              key={reg.id}
              aria-labelledby={`reg-${reg.id}`}
              className="card-vessel !cursor-default overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-10 h-10 rounded-xl bg-paper-3 text-ink flex items-center justify-center shrink-0">
                    {isGHCR ? <GithubLogo className="w-5 h-5" weight="bold" /> : <Package className="w-5 h-5" weight="bold" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 id={`reg-${reg.id}`} className="text-sm font-semibold text-ink">
                        {reg.name}
                      </h2>
                      <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', TONE[st.tone])}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', DOT[st.tone])} />
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted font-mono truncate">
                      {reg.server}
                      {reg.username && (
                        <>
                          <span className="mx-1.5 text-ink-faint">·</span>
                          {reg.username}
                        </>
                      )}
                    </p>
                    {reg.lastTestedAt && (
                      <p className="text-[11px] text-ink-faint">{formatRelative(reg.lastTestedAt)}验证</p>
                    )}
                  </div>
                </div>

                {configured && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenForm((p) => ({ ...p, [reg.id]: !p[reg.id] }))}
                      aria-expanded={formOpen}
                      aria-controls={`reg-form-${reg.id}`}
                      className="btn-vessel-secondary min-h-[36px] !px-3 text-[13px] inline-flex items-center gap-1.5 rounded-lg cursor-pointer"
                    >
                      <Key className="w-4 h-4" />
                      更新令牌
                    </button>
                    <button
                      type="button"
                      onClick={() => run(reg, 'test')}
                      disabled={Boolean(working)}
                      className="btn-vessel-secondary min-h-[36px] !px-3 text-[13px] inline-flex items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                    >
                      <ArrowsClockwise className={clsx('w-4 h-4', working === 'test' && 'animate-spin')} />
                      重新验证
                    </button>
                  </div>
                )}
              </div>

              {reg.status === 'error' && reg.errorMessage && !feedback && (
                <p className="mx-4 sm:mx-5 mb-4 p-3 rounded-lg bg-rose-500/10 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                  <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
                  {reg.errorMessage}
                </p>
              )}

              {feedback && (
                <p
                  role="status"
                  className={clsx(
                    'mx-4 sm:mx-5 mb-4 p-3 rounded-lg text-xs flex items-start gap-2',
                    feedback.success
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                  )}
                >
                  {feedback.success ? (
                    <CheckCircle className="w-4 h-4 shrink-0" weight="fill" />
                  ) : (
                    <WarningCircle className="w-4 h-4 shrink-0" weight="fill" />
                  )}
                  {feedback.message}
                </p>
              )}

              {formOpen && (
                <form
                  id={`reg-form-${reg.id}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(reg, 'save');
                  }}
                  className="px-4 sm:px-5 py-4 border-t border-line-subtle bg-paper-3/40 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] gap-3 md:items-end"
                >
                  <div>
                    <label htmlFor={`reg-user-${reg.id}`} className="block text-xs font-medium text-ink mb-1.5">
                      用户名
                    </label>
                    <input
                      id={`reg-user-${reg.id}`}
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={Boolean(working)}
                      value={username}
                      onChange={(e) => setField(reg, 'username', e.target.value)}
                      placeholder={isGHCR ? 'GitHub 用户名' : 'Docker Hub 用户名'}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor={`reg-token-${reg.id}`} className="text-xs font-medium text-ink">
                        访问令牌
                      </label>
                      {isGHCR && (
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-signal hover:underline inline-flex items-center gap-1"
                        >
                          创建 PAT
                          <ArrowSquareOut className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id={`reg-token-${reg.id}`}
                        type={reveal ? 'text' : 'password'}
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={Boolean(working)}
                        value={token}
                        onChange={(e) => setField(reg, 'token', e.target.value)}
                        placeholder={reg.token ? '已保存，留空保持不变' : isGHCR ? 'ghp_…（需 read:packages）' : 'dckr_pat_… 或密码'}
                        className={clsx(inputCls, 'font-mono pr-10')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((p) => ({ ...p, [reg.id]: !p[reg.id] }))}
                        aria-label={reveal ? '隐藏令牌' : '显示令牌'}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md text-ink-muted hover:text-ink flex items-center justify-center cursor-pointer"
                      >
                        {reveal ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={Boolean(working)}
                    className="btn-vessel-primary min-h-[40px] px-4 text-[13px] inline-flex items-center justify-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    {working === 'save' && <CircleNotch className="w-4 h-4 animate-spin" />}
                    {working === 'save' ? '验证中…' : '登录并验证'}
                  </button>
                </form>
              )}
            </section>
          );
        })}
      </div>

      <section aria-labelledby="reg-usage" className="card-vessel !cursor-default p-4 sm:p-5">
        <h2 id="reg-usage" className="text-sm font-semibold text-ink">在 Compose 中使用</h2>
        <p className="mt-1 text-xs text-ink-muted">登录成功后，直接写私有镜像地址即可拉取：</p>
        <pre className="mt-3 p-4 bg-paper-3 rounded-xl text-xs font-mono text-ink leading-relaxed overflow-x-auto">
{`services:
  web:
    image: ghcr.io/<owner>/<repo>:latest
    restart: unless-stopped`}
        </pre>
      </section>
    </div>
  );
};
