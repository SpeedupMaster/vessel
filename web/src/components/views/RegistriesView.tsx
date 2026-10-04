import React, { useState } from 'react';
import {
  GithubLogo,
  Package,
  CheckCircle,
  WarningCircle,
  Key,
  ShieldCheck,
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
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="card-vessel p-5 bg-gradient-to-r from-paper-2 to-paper-3/40">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded bg-sky-950/80 border border-sky-600/40 text-accent">
            <GithubLogo className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-ink">私有镜像凭证中心 (GHCR & Docker Hub)</h3>
            <p className="text-xs text-ink-muted mt-1 max-w-2xl leading-relaxed">
              绑定 GitHub 个人访问令牌（PAT）或 Docker Hub 凭据，Vessel 将自动注入 Docker
              运行时的登录鉴权状态，使得受管的 Compose 应用能够免密无缝拉取私有 Registry 镜像。
            </p>
          </div>
        </div>
      </div>

      {/* Registries Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {registries.map((reg) => {
          const isGHCR = reg.id === 'ghcr';
          const currentUsername = formData[reg.id]?.username ?? reg.username;
          const currentToken = formData[reg.id]?.token ?? '';
          const feedback = feedbackMap[reg.id];
          const isLoading = loadingMap[reg.id];

          return (
            <div key={reg.id} className="card-vessel p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div className="flex items-center gap-2.5">
                    {isGHCR ? (
                      <GithubLogo className="w-5 h-5 text-ink" />
                    ) : (
                      <Package className="w-5 h-5 text-sky-400" />
                    )}
                    <div>
                      <h4 className="font-semibold text-sm text-ink">{reg.name}</h4>
                      <p className="text-[11px] font-mono text-ink-faint">{reg.server}</p>
                    </div>
                  </div>
                  <Badge variant={reg.status === 'connected' ? 'connected' : 'unverified'}>
                    {reg.status === 'connected' ? '已授权' : '未验证'}
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
                      {isGHCR ? 'GitHub 用户名 (Username)' : '账号 / 用户名'}
                    </label>
                    <input
                      type="text"
                      value={currentUsername}
                      onChange={(e) => handleInputChange(reg.id, 'username', e.target.value)}
                      placeholder={isGHCR ? '例如: your-github-id' : 'username'}
                      className="w-full bg-paper-3 border border-line rounded px-3 py-1.5 text-xs text-ink font-mono focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-ink-muted mb-1 flex items-center justify-between">
                      <span>{isGHCR ? 'GitHub PAT 令牌 (read:packages 权限)' : '密码 / Access Token'}</span>
                      {isGHCR && (
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline flex items-center gap-0.5 normal-case"
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
                      className="w-full bg-paper-3 border border-line rounded px-3 py-1.5 text-xs text-ink font-mono focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                {/* Feedback banner */}
                {feedback && (
                  <div
                    className={`mt-3 p-2.5 rounded text-xs flex items-center gap-2 ${
                      feedback.success
                        ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/60 border border-rose-800 text-rose-300'
                    }`}
                  >
                    {feedback.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <WarningCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-line flex justify-end">
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
      <div className="card-vessel p-5 bg-paper-2/60">
        <h4 className="text-xs font-mono uppercase text-ink-muted font-bold tracking-wider mb-2 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-sky-400" />
          私有镜像使用指南
        </h4>
        <p className="text-xs text-ink-muted leading-relaxed">
          绑定成功后，在任何应用的 <code className="text-sky-300 font-mono">docker-compose.yml</code> 中直接填写私有镜像路径即可拉取，无需在 compose 中声明认证：
        </p>
        <pre className="mt-2 p-3 bg-paper border border-line rounded text-xs font-mono text-emerald-400 leading-relaxed overflow-x-auto">
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
