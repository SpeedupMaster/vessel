import React, { useState, useRef } from 'react';
import {
  GithubLogo,
  Package,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  Info,
  Eye,
  EyeSlash,
  X,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';
import { RegistryItem } from '../../types/index.js';
import { Button8State } from '../common/Button8State.js';
import { Badge } from '../common/Badge.js';

interface RegistriesViewProps {
  registries: RegistryItem[];
  onSaveRegistry: (reg: Partial<RegistryItem>) => Promise<any>;
  onTestRegistry: (id: string) => Promise<any>;
}

export const RegistriesView: React.FC<RegistriesViewProps> = ({
  registries,
  onSaveRegistry,
  onTestRegistry,
}) => {
  const [formData, setFormData] = useState<Record<string, { username: string; token: string }>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [feedbackMap, setFeedbackMap] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showTokenMap, setShowTokenMap] = useState<Record<string, boolean>>({});
  const [isTipsExpanded, setIsTipsExpanded] = useState(false);
  const tokenInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleInputChange = (id: string, field: 'username' | 'token', val: string) => {
    setFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        username: field === 'username' ? val : prev[id]?.username ?? (registries.find((r) => r.id === id)?.username || ''),
        token: field === 'token' ? val : prev[id]?.token ?? '',
      },
    }));
  };

  const toggleShowToken = (id: string) => {
    setShowTokenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleClearToken = (id: string) => {
    handleInputChange(id, 'token', '');
    tokenInputRefs.current[id]?.focus();
  };

  const handleSaveAndTest = async (reg: RegistryItem) => {
    const input = formData[reg.id] || { username: reg.username, token: '' };
    setLoadingMap((prev) => ({ ...prev, [reg.id]: true }));
    setFeedbackMap((prev) => ({ ...prev, [reg.id]: undefined! }));

    try {
      await onSaveRegistry({
        id: reg.id,
        name: reg.name,
        server: reg.server,
        username: input.username,
        token: input.token,
      });

      const testRes = await onTestRegistry(reg.id);
      setFeedbackMap((prev) => ({ ...prev, [reg.id]: testRes }));
      if (testRes?.success) {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([15, 30]);
        }
      } else {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    } catch (e: any) {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      setFeedbackMap((prev) => ({
        ...prev,
        [reg.id]: { success: false, message: e.message || '操作失败' },
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [reg.id]: false }));
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header (De-boxed, modern SaaS standard with compressed mobile footprint) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-paper-2 flex items-center justify-center text-ink flex-shrink-0 mt-0.5">
            <Package className="w-5 h-5 text-accent" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-base sm:text-lg text-ink tracking-tight font-sans">
                私有镜像凭证中心 (GHCR & Docker Hub)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted font-mono">
                {registries.filter((r) => r.status === 'connected').length} / {registries.length} 已连接
              </span>
            </div>

            {/* Compressed 1-line description with collapsible detailed explanation */}
            <div className="mt-1">
              <p className="text-xs text-ink-muted leading-relaxed inline">
                配置 GitHub Packages 与 Docker Hub 凭证，Compose 应用免密拉取。
              </p>
              <button
                type="button"
                onClick={() => setIsTipsExpanded(!isTipsExpanded)}
                className="inline-flex items-center gap-0.5 text-xs text-accent hover:underline font-medium ml-1 cursor-pointer select-none"
              >
                <span>{isTipsExpanded ? '收起说明' : '详细说明'}</span>
                {isTipsExpanded ? (
                  <CaretUp className="w-3 h-3" weight="bold" />
                ) : (
                  <CaretDown className="w-3 h-3" weight="bold" />
                )}
              </button>
            </div>

            {/* Collapsible Guidance Box */}
            {isTipsExpanded && (
              <div className="mt-2.5 p-4 rounded-2xl bg-paper-2 text-xs text-ink-muted space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Info className="w-3.5 h-3.5 text-accent flex-shrink-0" weight="fill" />
                  <span>自动化鉴权注入机制</span>
                </div>
                <p className="text-[11.5px] leading-relaxed">
                  绑定 GitHub 个人访问令牌（PAT）或 Docker Hub 凭据后，Vessel 将自动注入 Docker 运行时的登录鉴权状态，使得受管的 Compose 应用能够免密无缝拉取私有 Registry 镜像。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Registries Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {registries.map((reg) => {
          const isGHCR = reg.id === 'ghcr';
          const currentUsername = formData[reg.id]?.username ?? reg.username;
          const currentToken = formData[reg.id]?.token ?? '';
          const feedback = feedbackMap[reg.id];
          const isLoading = loadingMap[reg.id];
          const showToken = Boolean(showTokenMap[reg.id]);

          return (
            <div
              key={reg.id}
              className="card-vessel p-5 sm:p-7 flex flex-col justify-between space-y-5"
            >
              <div>
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-paper-3 flex items-center justify-center text-ink">
                      {isGHCR ? (
                        <GithubLogo className="w-4 h-4" weight="bold" />
                      ) : (
                        <Package className="w-4 h-4 text-accent" weight="bold" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-ink">{reg.name}</h4>
                      <p className="text-[11px] text-ink-muted/80 dark:text-zinc-500 font-mono">
                        {reg.server}
                      </p>
                    </div>
                  </div>
                  <Badge variant={reg.status === 'connected' ? 'connected' : 'unverified'}>
                    {reg.status === 'connected' ? '已授权' : '未验证'}
                  </Badge>
                </div>

                <div className="mt-5 space-y-4">
                  {/* 用户名输入框 */}
                  <div>
                    <label className="block text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-semibold mb-1.5">
                      {isGHCR ? 'GitHub 用户名' : '账号 / 用户名'}
                    </label>
                    <input
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={isLoading}
                      value={currentUsername}
                      onChange={(e) => handleInputChange(reg.id, 'username', e.target.value)}
                      placeholder={isGHCR ? '例如: your-github-id' : '例如: docker-username'}
                      className="w-full min-h-[42px] bg-paper-3 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:ring-1 focus:ring-ink transition-all disabled:opacity-60"
                    />
                  </div>

                  {/* 凭证/密码输入框 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-semibold">
                        {isGHCR ? 'GitHub PAT 令牌' : '密码 / 访问令牌'}
                      </label>
                      {isGHCR && (
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline flex items-center gap-1 text-xs font-normal"
                        >
                          <span>创建 PAT</span>
                          <ArrowSquareOut className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        ref={(el) => {
                          tokenInputRefs.current[reg.id] = el;
                        }}
                        type={showToken ? 'text' : 'password'}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        disabled={isLoading}
                        value={currentToken}
                        onChange={(e) => handleInputChange(reg.id, 'token', e.target.value)}
                        placeholder={
                          reg.token
                            ? '•••••••••••••••• (已保存，留空保持不变)'
                            : isGHCR
                            ? 'ghp_xxxxxxxxxxxx'
                            : 'dckr_pat_... 或 密码'
                        }
                        className="w-full min-h-[42px] bg-paper-3 rounded-xl pl-3.5 pr-20 py-2 text-xs sm:text-sm text-ink font-mono focus:outline-none focus:ring-1 focus:ring-ink transition-all disabled:opacity-60"
                      />

                      {/* Actions: Clear (X) + Toggle Visibility (Eye) */}
                      <div className="absolute right-1.5 flex items-center gap-0.5">
                        {currentToken && (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleClearToken(reg.id)}
                            aria-label="清空内容"
                            className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-4 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => toggleShowToken(reg.id)}
                          aria-label={showToken ? '隐藏令牌' : '显示令牌'}
                          className="p-1.5 text-ink-muted hover:text-ink hover:bg-paper-4 rounded-lg transition-colors cursor-pointer"
                        >
                          {showToken ? (
                            <EyeSlash className="w-4 h-4 text-accent" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Helper text moved below input */}
                    <p className="text-[11px] text-ink-faint mt-1.5">
                      {isGHCR
                        ? '需至少包含 read:packages 权限范围'
                        : '支持 Docker Hub 账户密码或个人访问令牌 (dckr_pat)'}
                    </p>
                  </div>
                </div>

                {/* Feedback banner */}
                {feedback && (
                  <div
                    className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2.5 ${
                      feedback.success
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {feedback.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" weight="fill" />
                    ) : (
                      <WarningCircle className="w-4 h-4 text-rose-500 flex-shrink-0" weight="fill" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>

              {/* Full-width submit button filling card padding */}
              <div className="pt-2">
                <Button8State
                  variant="primary"
                  size="md"
                  state={isLoading ? 'loading' : 'default'}
                  disabled={isLoading}
                  onClick={() => handleSaveAndTest(reg)}
                  className="w-full min-h-[44px] text-xs font-semibold active:scale-[0.99] transition-transform"
                >
                  {isLoading ? '正在验证鉴权...' : '保存并验证登录'}
                </Button8State>
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Guide */}
      <div className="card-vessel p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-accent" weight="bold" />
          <h4 className="text-xs uppercase text-ink-muted/80 dark:text-zinc-400 font-semibold tracking-wider">
            私有镜像使用指南
          </h4>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">
          绑定成功后，在任何应用的 <code className="text-ink font-mono bg-paper-3 px-1.5 py-0.5 rounded-md text-[11px]">docker-compose.yml</code> 中直接填写私有镜像路径即可拉取，无需在 compose 中声明认证：
        </p>
        <pre className="mt-3.5 p-4 bg-paper-2 rounded-2xl text-xs font-mono text-emerald-600 dark:text-emerald-400 leading-relaxed overflow-x-auto">
{`services:
  my-private-service:
    image: ghcr.io/<your-username>/<your-repo>:latest
    restart: unless-stopped
    ports:
      - "8080:80"`}
        </pre>
      </div>
    </div>
  );
};
