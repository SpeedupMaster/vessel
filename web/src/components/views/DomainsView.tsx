import React, { useState } from 'react';
import {
  Globe,
  Plus,
  ArrowsClockwise,
  Trash,
  LockKey,
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
  const { toast, confirm } = useNotification();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [appIdInput, setAppIdInput] = useState(apps[0]?.id || '');
  const [serviceNameInput, setServiceNameInput] = useState('web');
  const [targetPortInput, setTargetPortInput] = useState('3000');
  const [targetTypeInput, setTargetTypeInput] = useState<'internal' | 'host'>('internal');
  const [loading, setLoading] = useState(false);

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
      {/* Top Banner explaining Caddy Automatic HTTPS */}
      <div className="card-vessel p-7 sm:p-8 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-paper-3 flex items-center justify-center text-accent flex-shrink-0 shadow-subtle">
              <LockKey className="w-5 h-5" weight="bold" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-ink tracking-tight font-sans">
                Caddy 智能反向代理与自动证书续订
              </h3>
              <p className="text-xs text-ink-muted mt-1.5 max-w-2xl leading-relaxed">
                绑定您的公网域名并解析至当前服务器 IP。Vessel 驱动内置 Caddy 引擎自动通过 ACME 协议向
                Let's Encrypt 或 ZeroSSL 申请安全 TLS 证书，并在到期前 30 天静默全自动续期，零人工干预。
              </p>
            </div>
          </div>

          <Button8State
            variant="primary"
            icon={<Plus className="w-4 h-4" weight="bold" />}
            onClick={() => {
              if (apps.length > 0 && !appIdInput) setAppIdInput(apps[0].id);
              setIsAddOpen(true);
            }}
          >
            绑定新域名
          </Button8State>
        </div>
      </div>

      {/* Domains Table */}
      <div className="card-vessel overflow-hidden shadow-subtle">
        <div className="p-5 border-b border-line flex items-center justify-between">
          <h4 className="text-xs uppercase text-ink-muted font-bold tracking-wider">
            已挂载域名路由清单 ({domains.length})
          </h4>
        </div>

        {domains.length === 0 ? (
          <div className="py-16 text-center text-ink-muted text-xs">
            暂无已绑定的域名。点击右上角「绑定新域名」为应用配置 HTTPS 访问。
          </div>
        ) : (
          <div className="divide-y divide-line">
            {domains.map((d) => {
              const matchedApp = apps.find((a) => a.id === d.appId);
              return (
                <div
                  key={d.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper-3/40 transition-colors"
                >
                  <div className="space-y-2">
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

                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                      <span>应用: <strong className="text-ink font-medium">{matchedApp?.name || d.appId}</strong></span>
                      <span>
                        转发上游:{' '}
                        <code className="text-accent bg-paper-3 px-2 py-0.5 rounded font-mono">
                          {d.targetType === 'internal' ? `${d.serviceName}:${d.targetPort} (容器内部)` : `127.0.0.1:${d.targetPort} (宿主机)`}
                        </code>
                      </span>
                      <span>证书机构: {d.sslIssuer}</span>
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
                      onClick={async () => {
                        const ok = await confirm({
                          title: '⚠️ 危险操作：解绑域名路由',
                          subtitle: `域名绑定: ${d.domain} -> ${d.serviceName}:${d.targetPort}`,
                          dangerTitle: '解绑操作不可撤回！',
                          message: `确定要解绑并移除域名 "${d.domain}" 吗？此操作将立即清除 Caddy 反向代理路由规则并重新加载服务配置。`,
                          details: [
                            'Caddy 配置文件中该域名的规则块将被完全移除',
                            '外部流量将无法再通过此域名访问目标容器服务',
                            'Caddy 服务将自动重新加载配置以使路由变更生效',
                          ],
                          confirmText: '确认解绑域名',
                          cancelText: '取消并返回',
                          variant: 'danger',
                        });
                        if (ok) {
                          try {
                            await onDeleteDomain(d.id);
                            toast.success(`域名 ${d.domain} 已成功解绑`);
                          } catch (err: any) {
                            toast.error(`解绑失败: ${err.message}`);
                          }
                        }
                      }}
                      className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border border-line cursor-pointer"
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
              onChange={(val) => setAppIdInput(val)}
              options={apps.map((a) => ({
                value: a.id,
                label: a.name,
                badge: a.id.slice(0, 8),
              }))}
              placeholder="选择目标应用..."
            />
          </div>

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
