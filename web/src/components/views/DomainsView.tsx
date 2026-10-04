import React, { useState } from 'react';
import {
  Globe,
  Plus,
  ShieldCheck,
  ArrowsClockwise,
  Trash,
  ArrowRight,
  LockKey,
  CheckCircle,
} from '@phosphor-icons/react';
import { DomainItem, AppItem } from '../../types/index.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { Modal } from '../common/Modal.js';

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
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining Caddy Automatic HTTPS */}
      <div className="card-vessel p-5 bg-gradient-to-r from-paper-2 to-paper-3/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded bg-sky-950/80 border border-sky-600/40 text-accent">
              <LockKey className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-ink">Caddy 智能反向代理与自动证书续订</h3>
              <p className="text-xs text-ink-muted mt-1 max-w-2xl leading-relaxed">
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
      <div className="card-vessel overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h4 className="text-xs font-mono uppercase text-ink-muted font-bold tracking-wider">
            已挂载域名路由清单 ({domains.length})
          </h4>
        </div>

        {domains.length === 0 ? (
          <div className="py-12 text-center text-ink-muted text-xs">
            暂无已绑定的域名。点击右上角「绑定新域名」为应用配置 HTTPS 访问。
          </div>
        ) : (
          <div className="divide-y divide-line">
            {domains.map((d) => {
              const matchedApp = apps.find((a) => a.id === d.appId);
              return (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper-3/30 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://${d.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-semibold text-ink font-mono hover:text-accent flex items-center gap-1.5 transition-colors"
                      >
                        <span>https://{d.domain}</span>
                      </a>
                      <Badge variant={d.sslStatus}>{d.sslStatus === 'active' ? 'HTTPS 正常' : d.sslStatus}</Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-ink-muted">
                      <span>应用: <strong className="text-ink">{matchedApp?.name || d.appId}</strong></span>
                      <span>
                        转发上游:{' '}
                        <code className="text-sky-300 bg-paper-3 px-1.5 py-0.5 rounded">
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
                      onClick={() => {
                        if (confirm(`确定要解绑域名 ${d.domain} 吗？`)) {
                          onDeleteDomain(d.id);
                        }
                      }}
                      className="p-1.5 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
                      title="解绑并移除反向代理"
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
            <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
              绑定域名 (FQDN) *
            </label>
            <input
              type="text"
              required
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="例如: app.example.com"
              className="w-full bg-paper-3 border border-line rounded px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none font-mono"
            />
            <p className="text-[11px] text-ink-faint mt-1">
              请确保该域名的 A/AAAA 记录已正确解析至本机器的公网 IP。
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
              目标应用 *
            </label>
            <select
              value={appIdInput}
              onChange={(e) => setAppIdInput(e.target.value)}
              className="w-full bg-paper-3 border border-line rounded px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
                Compose 内部服务名
              </label>
              <input
                type="text"
                value={serviceNameInput}
                onChange={(e) => setServiceNameInput(e.target.value)}
                placeholder="例如: web, app, n8n"
                className="w-full bg-paper-3 border border-line rounded px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
                容器端口 *
              </label>
              <input
                type="number"
                required
                value={targetPortInput}
                onChange={(e) => setTargetPortInput(e.target.value)}
                placeholder="例如: 3000, 5678, 80"
                className="w-full bg-paper-3 border border-line rounded px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-ink-muted mb-1">
              代理对接方式
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className={`p-2.5 rounded border cursor-pointer flex flex-col gap-1 ${targetTypeInput === 'internal' ? 'bg-sky-950/70 border-sky-500 text-sky-200' : 'bg-paper-3 border-line text-ink-muted'}`}>
                <div className="flex items-center gap-1.5">
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

              <label className={`p-2.5 rounded border cursor-pointer flex flex-col gap-1 ${targetTypeInput === 'host' ? 'bg-sky-950/70 border-sky-500 text-sky-200' : 'bg-paper-3 border-line text-ink-muted'}`}>
                <div className="flex items-center gap-1.5">
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

          <div className="pt-3 border-t border-line flex justify-end gap-2">
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
