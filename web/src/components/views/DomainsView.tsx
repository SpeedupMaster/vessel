import React, { useState } from 'react';
import {
  Globe,
  Plus,
  ArrowsClockwise,
  Trash,
  LockKey,
  Anchor,
  Warning,
  CircleNotch,
} from '@phosphor-icons/react';
import { DomainItem, AppItem } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { Modal } from '../common/Modal.js';
import { CustomSelect } from '../common/CustomSelect.js';
import { useNotification } from '../../context/NotificationContext.js';

interface DomainsViewProps {
  domains: DomainItem[];
  apps: AppItem[];
  onCreateDomain: (domain: Partial<DomainItem>) => Promise<any>;
  onDeleteDomain: (id: string) => Promise<any>;
  onRenewDomain: (id: string) => Promise<any>;
}

export const DomainsView: React.FC<DomainsViewProps> = ({
  domains,
  apps,
  onCreateDomain,
  onDeleteDomain,
  onRenewDomain,
}) => {
  const { toast } = useNotification();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [appIdInput, setAppIdInput] = useState(apps[0]?.id || 'vessel-system');
  const [serviceNameInput, setServiceNameInput] = useState('vessel');
  const [targetPortInput, setTargetPortInput] = useState('3900');
  const [targetTypeInput, setTargetTypeInput] = useState<'internal' | 'host'>('host');
  const [loading, setLoading] = useState(false);

  // Danger delete modal state
  const [deletingDomain, setDeletingDomain] = useState<DomainItem | null>(null);
  const [deleteDomainInput, setDeleteDomainInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isDomainDeleteConfirmed = Boolean(
    deletingDomain &&
      deleteDomainInput.trim().length > 0 &&
      deleteDomainInput.trim().toLowerCase() === deletingDomain.domain.trim().toLowerCase()
  );

  const handleConfirmDeleteDomain = async () => {
    if (!deletingDomain || !isDomainDeleteConfirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDeleteDomain(deletingDomain.id);
      toast.success(`域名 ${deletingDomain.domain} 已成功解绑`);
      setDeletingDomain(null);
      setDeleteDomainInput('');
    } catch (err: any) {
      toast.error(`解绑失败: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectApp = (val: string) => {
    setAppIdInput(val);
    if (val === 'vessel-system') {
      setServiceNameInput('vessel');
      setTargetPortInput('3900');
      setTargetTypeInput('host');
    } else {
      setServiceNameInput('web');
      setTargetPortInput('3000');
      setTargetTypeInput('internal');
    }
  };

  // Set of appIds that already have an active domain binding
  const boundAppIds = new Set(domains.map((d) => d.appId));

  // Available options: filter out any app or system that already has a domain bound
  const availableAppOptions = [
    ...(!boundAppIds.has('vessel-system')
      ? [
          {
            value: 'vessel-system',
            label: '⚓ Vessel 管理控制台 (系统核心: 3900端口)',
            badge: '系统核心',
          },
        ]
      : []),
    ...apps
      .filter((a) => !boundAppIds.has(a.id))
      .map((a) => ({
        value: a.id,
        label: a.name,
        badge: a.id.slice(0, 8),
      })),
  ];

  const handleOpenAdd = () => {
    if (availableAppOptions.length === 0) {
      toast.info('所有应用与控制台均已绑定独立域名路由。如需更换，请先解绑原域名。');
      return;
    }
    const firstAvailable = availableAppOptions[0].value;
    handleSelectApp(firstAvailable);
    setIsAddOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput || !appIdInput || !targetPortInput) return;
    setLoading(true);
    try {
      await onCreateDomain({
        domain: domainInput,
        appId: appIdInput,
        serviceName: serviceNameInput,
        targetPort: Number(targetPortInput),
        targetType: targetTypeInput,
      });
      setIsAddOpen(false);
      setDomainInput('');
      toast.success(`域名 ${domainInput} 绑定成功！Caddy 正在自动化签发 SSL 证书`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header (De-boxed, modern SaaS standard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-paper-2 dark:bg-white/[0.04] border border-line/60 dark:border-white/[0.08] flex items-center justify-center text-accent flex-shrink-0 shadow-subtle">
            <LockKey className="w-5 h-5" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-lg text-ink tracking-tight font-sans">
                Caddy 智能反向代理与自动证书续订
              </h2>
              {domains.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper-2 dark:bg-white/[0.05] text-ink-muted border border-line/50 dark:border-white/[0.06] font-mono">
                  共 {domains.length} 个路由
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-1.5 max-w-2xl leading-relaxed">
              绑定您的公网域名并解析至当前服务器 IP。支持反代任何 Docker Compose 容器，亦可直接为
              <strong className="text-ink dark:text-zinc-200 font-semibold"> Vessel 管理控制台自身</strong> 配置独立访问域名与 HTTPS。由内置 Caddy 引擎全自动签发与静默续期证书。
            </p>
          </div>
        </div>

        <Button8State
          variant="primary"
          icon={<Plus className="w-4 h-4" weight="bold" />}
          onClick={handleOpenAdd}
        >
          绑定新域名
        </Button8State>
      </div>

      {/* Domains List Card */}
      <div className="card-vessel overflow-hidden shadow-subtle">
        {domains.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-xs">
            暂无已绑定的域名。点击右上角「绑定新域名」为应用或控制台配置 HTTPS 访问。
          </div>
        ) : (
          <div className="divide-y divide-line/60 dark:divide-white/[0.06]">
            {domains.map((d) => {
              const matchedApp = apps.find((a) => a.id === d.appId);
              const isVesselSystem = d.appId === 'vessel-system';
              return (
                <div
                  key={d.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper-2/50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://${d.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-semibold text-ink hover:text-accent flex items-center gap-1.5 transition-colors"
                      >
                        <span>https://{d.domain}</span>
                      </a>
                      <Badge variant={d.sslStatus}>{d.sslStatus === 'active' ? 'HTTPS 已生效' : d.sslStatus}</Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                      {/* 所属应用 */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-muted/80 dark:text-zinc-500 font-normal">所属应用:</span>
                        {isVesselSystem ? (
                          <span className="inline-flex items-center gap-1.5 text-accent font-semibold">
                            <Anchor className="w-3.5 h-3.5" weight="bold" />
                            <span>Vessel 管理控制台</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent/10 text-accent font-mono">系统核心</span>
                          </span>
                        ) : (
                          <span className="text-ink dark:text-zinc-100 font-medium">{matchedApp?.name || d.appId}</span>
                        )}
                      </div>

                      {/* 转发上游 */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-muted/80 dark:text-zinc-500 font-normal">转发上游:</span>
                        <code className="font-mono text-[11.5px] text-ink dark:text-zinc-100 font-medium bg-paper-3/50 dark:bg-white/[0.05] px-1.5 py-0.5 rounded border border-line/40 dark:border-white/[0.08]">
                          {isVesselSystem
                            ? '127.0.0.1:3900 (本机控制台)'
                            : (d.targetType === 'internal' ? `${d.serviceName}:${d.targetPort} (容器内部)` : `127.0.0.1:${d.targetPort} (宿主机)`)}
                        </code>
                      </div>

                      {/* 证书机构 */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink-muted/80 dark:text-zinc-500 font-normal">证书机构:</span>
                        <span className="text-ink dark:text-zinc-100 font-medium">{d.sslIssuer}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button8State
                      size="sm"
                      variant="secondary"
                      icon={<ArrowsClockwise className="w-3.5 h-3.5" />}
                      onClick={() => onRenewDomain(d.id)}
                    >
                      检测/续订
                    </Button8State>
                    <button
                      onClick={() => {
                        setDeletingDomain(d);
                        setDeleteDomainInput('');
                      }}
                      className="p-2 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                      data-tooltip="解绑并移除反向代理"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION MODAL WITH INPUT VERIFICATION */}
      <Modal
        isOpen={Boolean(deletingDomain)}
        onClose={() => !isDeleting && setDeletingDomain(null)}
        title={
          <div className="flex items-center gap-2 text-ink font-semibold">
            <Trash className="w-5 h-5 text-rose-500" weight="bold" />
            <span>危险操作：确认解绑域名路由</span>
          </div>
        }
        subtitle={deletingDomain ? `域名绑定: https://${deletingDomain.domain}` : ''}
        maxWidth="max-w-lg"
      >
        {deletingDomain && (
          <div className="space-y-4">
            {/* Warning Message Box */}
            <div className="p-4 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 dark:border-rose-500/25 text-xs space-y-2 shadow-subtle">
              <div className="flex items-center gap-2 font-semibold text-sm text-ink dark:text-rose-200">
                <Warning className="w-4 h-4 text-rose-500 flex-shrink-0" weight="fill" />
                <span>此操作不可撤回，请务必谨慎！</span>
              </div>
              <p className="text-ink-muted leading-relaxed">
                解绑后将立即清除 Caddy 配置文件中该域名的规则块并重载服务。外部流量将无法再通过此域名访问目标容器或控制台。
              </p>
            </div>

            {/* Input Verification Box */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs text-ink-muted leading-relaxed">
                请输入完整域名 <strong className="text-ink font-semibold select-all font-mono">{deletingDomain.domain}</strong> 以确认解绑：
              </label>
              <input
                type="text"
                value={deleteDomainInput}
                onChange={(e) => setDeleteDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isDomainDeleteConfirmed && !isDeleting) {
                    handleConfirmDeleteDomain();
                  }
                }}
                placeholder={deletingDomain.domain}
                autoFocus
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 text-xs text-ink font-mono focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none transition-all shadow-subtle"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingDomain(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-lg border border-line shadow-subtle transition-colors cursor-pointer"
              >
                取消
              </button>

              {!isDomainDeleteConfirmed ? (
                <button
                  type="button"
                  disabled
                  className="px-4 py-2 bg-paper-3 dark:bg-[#21262d] text-ink-muted/50 dark:text-[#8b949e] border border-line/50 dark:border-white/[0.06] text-xs font-medium rounded-lg cursor-not-allowed flex items-center gap-1.5 select-none"
                >
                  <Trash className="w-4 h-4 opacity-40" />
                  <span>确认解绑域名</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDeleteDomain}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 dark:bg-[#da3633] dark:hover:bg-[#f85149] text-white font-bold text-xs rounded-lg shadow-md shadow-red-600/25 transition-all flex items-center gap-1.5 active:translate-y-px cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <CircleNotch className="w-4 h-4 animate-spin text-white" />
                      <span>正在解绑...</span>
                    </>
                  ) : (
                    <>
                      <Trash className="w-4 h-4 text-white" weight="bold" />
                      <span>确认解绑域名</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ADD DOMAIN MODAL */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="绑定域名与配置 HTTPS 路由"
        subtitle="将外部访问流量反向代理至指定的 Compose 容器服务"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs uppercase text-ink-muted mb-1.5">
              绑定域名 *
            </label>
            <input
              type="text"
              required
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="例如: app.example.com"
              className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-ink-faint mt-1.5">
              请确保该域名的 A/AAAA 记录已正确解析至本机器的公网 IP。
            </p>
          </div>

          <div>
            <label className="block text-xs uppercase text-ink-muted mb-1.5">
              目标应用 *
            </label>
            <CustomSelect
              value={appIdInput}
              onChange={handleSelectApp}
              options={availableAppOptions}
              placeholder="选择未绑定域名的目标应用..."
            />
          </div>

          {appIdInput === 'vessel-system' ? (
            <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/20 flex items-start gap-3 text-xs">
              <Anchor className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" />
              <div>
                <p className="font-semibold text-accent">已锁定为 Vessel 管理控制台核心服务</p>
                <p className="text-[11.5px] text-ink-muted mt-1 leading-relaxed">
                  Caddy 将自动为此域名申请 SSL 证书，并配置反向代理至控制台的核心 Web / WebSocket 通道 (<code className="font-mono text-ink">127.0.0.1:3900</code>)。
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs uppercase text-ink-muted mb-1.5">
                    Compose 内部服务名
                  </label>
                  <input
                    type="text"
                    value={serviceNameInput}
                    onChange={(e) => setServiceNameInput(e.target.value)}
                    placeholder="例如: web, app, n8n"
                    className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase text-ink-muted mb-1.5">
                    容器端口 *
                  </label>
                  <input
                    type="number"
                    required
                    value={targetPortInput}
                    onChange={(e) => setTargetPortInput(e.target.value)}
                    placeholder="例如: 3000, 5678, 80"
                    className="w-full bg-paper border border-line rounded-lg px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase text-ink-muted mb-1.5">
                  代理对接方式
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition-all ${
                      targetTypeInput === 'internal'
                        ? 'bg-accent/10 border-accent text-ink font-medium shadow-subtle'
                        : 'bg-paper-2 border-line text-ink-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="targetType"
                        checked={targetTypeInput === 'internal'}
                        onChange={() => setTargetTypeInput('internal')}
                      />
                      <strong className="text-ink">容器内部网络 (推荐)</strong>
                    </div>
                    <span className="text-[11px] text-ink-faint">
                      直通 vessel-net 内部网络，宿主机无需暴露端口
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition-all ${
                      targetTypeInput === 'host'
                        ? 'bg-accent/10 border-accent text-ink font-medium shadow-subtle'
                        : 'bg-paper-2 border-line text-ink-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="targetType"
                        checked={targetTypeInput === 'host'}
                        onChange={() => setTargetTypeInput('host')}
                      />
                      <strong className="text-ink">宿主机端口转发</strong>
                    </div>
                    <span className="text-[11px] text-ink-faint">
                      代理至 127.0.0.1 映射端口
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="pt-4 border-t border-line flex justify-end gap-2.5">
            <Button8State variant="ghost" type="button" onClick={() => setIsAddOpen(false)}>
              取消
            </Button8State>
            <Button8State variant="primary" type="submit" state={loading ? 'loading' : 'default'}>
              确认绑定并申请证书
            </Button8State>
          </div>
        </form>
      </Modal>
    </div>
  );
};
