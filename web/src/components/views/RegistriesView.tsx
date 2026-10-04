import React, { useState } from 'react';
import {
  GithubLogo,
  Package,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
  Info,
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
    } catch (e: any) {
      setFeedbackMap((prev) => ({
        ...prev,
        [reg.id]: { success: false, message: e.message || '操作失败' },
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [reg.id]: false }));
    }
  };

  return (
    <div className="space-y-8">
      {/* Intro Banner */}
      <div className="card-vessel p-7 sm:p-8 shadow-subtle">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-paper-3 flex items-center justify-center text-accent flex-shrink-0 shadow-subtle">
            <GithubLogo className="w-5 h-5" weight="bold" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-ink tracking-tight font-sans">
              私有镜像凭证中心 (GHCR & Docker Hub)
            </h3>
            <p className="text-xs text-ink-muted mt-1.5 max-w-2xl leading-relaxed">
              绑定 GitHub 个人访问令牌（PAT）或 Docker Hub 凭据，Vessel 将自动注入 Docker
              运行时的登录鉴权状态，使得受管的 Compose 应用能够免密无缝拉取私有 Registry 镜像。
            </p>
          </div>
        </div>
      </div>

      {/* Registries Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {registries.map((reg) => {
          const isGHCR = reg.id === 'ghcr';
          const currentUsername = formData[reg.id]?.username ?? reg.username;
          const currentToken = formData[reg.id]?.token ?? '';
          const feedback = feedbackMap[reg.id];
          const isLoading = loadingMap[reg.id];

          return (
            <div key={reg.id} className="card-vessel p-6 sm:p-7 flex flex-col justify-between space-y-5 shadow-subtle">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-line">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-paper-3 flex items-center justify-center text-ink shadow-subtle">
                      {isGHCR ? (
                        <GithubLogo className="w-4 h-4" weight="bold" />
                      ) : (
                        <Package className="w-4 h-4 text-accent" weight="bold" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-ink">{reg.name}</h4>
                      <p className="text-[11px] text-ink-faint">{reg.server}</p>
                    </div>
                  </div>
                  <Badge variant={reg.status === 'connected' ? 'connected' : 'unverified'}>
                    {reg.status === 'connected' ? '已授权' : '未验证'}
                  </Badge>
                </div>

                <div className="mt-5 space-y-3.5">
                  <div>
                    <label className="block text-xs uppercase text-ink-muted mb-1.5">
                      {isGHCR ? 'GitHub 用户名' : '账号 / 用户名'}
                    </label>
                    <input
                      type="text"
                      value={currentUsername}
                      onChange={(e) => handleInputChange(reg.id, 'username', e.target.value)}
                      placeholder={isGHCR ? '例如: your-github-id' : 'username'}
                      className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase text-ink-muted mb-1.5 flex items-center justify-between">
                      <span>{isGHCR ? 'GitHub PAT 令牌 (需包含 read:packages 权限)' : '密码 / 访问令牌'}</span>
                      {isGHCR && (
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline flex items-center gap-1 normal-case text-xs"
                        >
                          <span>创建 PAT</span>
                          <ArrowSquareOut className="w-3 h-3" />
                        </a>
                      )}
                    </label>
                    <input
                      type="password"
                      value={currentToken}
                      onChange={(e) => handleInputChange(reg.id, 'token', e.target.value)}
                      placeholder={reg.token ? '•••••••••••••••• (已保存，留空保持不变)' : 'ghp_xxxxxxxxxxxx'}
                      className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-xs text-ink focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Feedback banner */}
                {feedback && (
                  <div
                    className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2.5 ${
                      feedback.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
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

              <div className="pt-4 border-t border-line flex justify-end">
                <Button8State
                  variant="primary"
                  size="sm"
                  state={isLoading ? 'loading' : 'default'}
                  onClick={() => handleSaveAndTest(reg)}
                >
                  保存并验证登录
                </Button8State>
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Guide */}
      <div className="card-vessel p-7 sm:p-8 shadow-subtle">
        <h4 className="text-xs uppercase text-ink-muted font-bold tracking-wider mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-accent" weight="bold" />
          私有镜像使用指南
        </h4>
        <p className="text-xs text-ink-muted leading-relaxed">
          绑定成功后，在任何应用的 <code className="text-accent font-mono">docker-compose.yml</code> 中直接填写私有镜像路径即可拉取，无需在 compose 中声明认证：
        </p>
        <pre className="mt-3 p-4 bg-paper dark:bg-zinc-950 border border-line rounded-xl text-xs font-mono text-emerald-700 dark:text-emerald-400 leading-relaxed overflow-x-auto shadow-subtle">
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
