import React, { useState } from 'react';
import YAML from 'yaml';
import { createPortal } from 'react-dom';
import {
  Globe,
  Plus,
  ArrowsClockwise,
  Trash,
  LockKey,
  Anchor,
  Warning,
  CircleNotch,
  Info,
  X,
  CaretDown,
  CaretUp,
  ShieldCheck,
  CheckCircle,
  PencilSimple,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { DomainItem, AppItem } from '../../types/index.js';
import { servicePorts } from '../../utils/composePorts.js';
import { Badge } from '../common/Badge.js';
import { Button8State } from '../common/Button8State.js';
import { Modal } from '../common/Modal.js';
import { EmptyState } from '../common/EmptyState.js';
import { CustomSelect } from '../common/CustomSelect.js';
import clsx from 'clsx';
import { useNotification } from '../../context/NotificationContext.js';

interface DetectedService {
  name: string;
  ports: number[];
  hostPorts: number[];
}

const detectServices = (app?: AppItem): DetectedService[] => {
  if (!app?.composeYaml) return [];
  try {
    const services = YAML.parse(app.composeYaml)?.services;
    if (!services || typeof services !== 'object') return [];
    return Object.entries<any>(services).map(([name, config]) => {
      const { container, host } = servicePorts(config);
      return { name, ports: container, hostPorts: host };
    });
  } catch {
    return [];
  }
};

const candidatePorts = (service: DetectedService | undefined, type: 'internal' | 'host') =>
  service ? (type === 'host' ? service.hostPorts : service.ports) : [];

interface DomainsViewProps {
  domains: DomainItem[];
  apps: AppItem[];
  onCreateDomain: (domain: Partial<DomainItem>) => Promise<any>;
  onUpdateDomain?: (id: string, domainData: Partial<DomainItem>) => Promise<any>;
  onDeleteDomain: (id: string) => Promise<any>;
  onRenewDomain: (id: string) => Promise<any>;
}

export const DomainsView: React.FC<DomainsViewProps> = ({
  domains,
  apps,
  onCreateDomain,
  onUpdateDomain,
  onDeleteDomain,
  onRenewDomain,
}) => {
  const { toast } = useNotification();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainItem | null>(null);
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
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 50, 60]);
    }
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
      // Prefer a service that declares a port over e.g. a database listed first
      const services = detectServices(apps.find((a) => a.id === val));
      const service = services.find((s) => s.ports.length > 0) || services[0];
      setServiceNameInput(service?.name || 'web');
      setTargetPortInput(String(service?.ports[0] || 80));
      setTargetTypeInput('internal');
    }
  };

  const selectedServices = appIdInput === 'vessel-system' ? [] : detectServices(apps.find((a) => a.id === appIdInput));

  // Switching between container network and host port changes which side of a port mapping applies
  const handleSelectTargetType = (type: 'internal' | 'host') => {
    setTargetTypeInput(type);
    const candidates = candidatePorts(selectedServices.find((s) => s.name === serviceNameInput), type);
    if (candidates.length > 0 && !candidates.includes(Number(targetPortInput))) {
      setTargetPortInput(String(candidates[0]));
    }
  };

  // Set of appIds that already have an active domain binding
  const boundAppIds = new Set(domains.map((d) => d.appId));

  // Available options: filter out any app or system that already has a domain bound (unless editing it)
  const availableAppOptions = [
    ...(!boundAppIds.has('vessel-system') || editingDomain?.appId === 'vessel-system'
      ? [
          {
            value: 'vessel-system',
            label: '⚓ Vessel 管理控制台 (系统核心: 3900端口)',
            badge: '系统核心',
          },
        ]
      : []),
    ...apps
      .filter((a) => !boundAppIds.has(a.id) || editingDomain?.appId === a.id)
      .map((a) => ({
        value: a.id,
        label: a.name,
        badge: a.id.slice(0, 8),
      })),
  ];

  const handleOpenAdd = () => {
    setEditingDomain(null);
    setDomainInput('');
    if (availableAppOptions.length === 0) {
      toast.info('所有应用与控制台均已绑定独立域名路由。如需更换，请先解绑原域名。');
      return;
    }
    const firstAvailable = availableAppOptions[0].value;
    handleSelectApp(firstAvailable);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (dom: DomainItem) => {
    setEditingDomain(dom);
    setDomainInput(dom.domain);
    setAppIdInput(dom.appId);
    const fallback = detectServices(apps.find((a) => a.id === dom.appId)).find((s) => s.ports.length > 0);
    setServiceNameInput(dom.serviceName || (dom.appId === 'vessel-system' ? 'vessel' : fallback?.name || 'web'));
    setTargetPortInput(String(dom.targetPort || (dom.appId === 'vessel-system' ? 3900 : fallback?.ports[0] || 80)));
    setTargetTypeInput(dom.targetType || (dom.appId === 'vessel-system' ? 'host' : 'internal'));
    setIsAddOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDomain = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!cleanDomain || !appIdInput || !targetPortInput) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 40]);
    }
    setLoading(true);
    try {
      if (editingDomain && onUpdateDomain) {
        await onUpdateDomain(editingDomain.id, {
          domain: cleanDomain,
          appId: appIdInput,
          serviceName: serviceNameInput,
          targetPort: Number(targetPortInput),
          targetType: targetTypeInput,
        });
        setIsAddOpen(false);
        setEditingDomain(null);
        setDomainInput('');
        toast.success(`域名 ${cleanDomain} 配置已更新！Caddy 路由已同步重载`);
      } else {
        await onCreateDomain({
          domain: cleanDomain,
          appId: appIdInput,
          serviceName: serviceNameInput,
          targetPort: Number(targetPortInput),
          targetType: targetTypeInput,
        });
        setIsAddOpen(false);
        setEditingDomain(null);
        setDomainInput('');
        toast.success(`域名 ${cleanDomain} 绑定成功！Caddy 正在自动化签发 SSL 证书`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const DAY = 86_400_000;
  const daysLeft = (iso?: string) => (iso ? Math.floor((new Date(iso).getTime() - Date.now()) / DAY) : null);
  const certInfo = (d: DomainItem): { label: string; tone: 'ok' | 'warn' | 'bad' | 'pending' } => {
    const left = daysLeft(d.sslExpiresAt);
    if (d.sslStatus === 'expired') return { label: '已过期', tone: 'bad' };
    if (d.sslStatus === 'error') return { label: '签发失败', tone: 'bad' };
    if (d.sslStatus === 'issuing') return { label: '签发中', tone: 'pending' };
    if (d.sslStatus === 'unknown') return { label: '未检测', tone: 'pending' };
    if (left != null && left < 14) return { label: `${Math.max(0, left)} 天后到期`, tone: 'warn' };
    return { label: '有效', tone: 'ok' };
  };
  const CERT_TONE = {
    ok: 'text-emerald-700 dark:text-emerald-400',
    warn: 'text-amber-700 dark:text-amber-400',
    bad: 'text-rose-700 dark:text-rose-400',
    pending: 'text-ink-muted',
  } as const;
  const CERT_DOT = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500', pending: 'bg-ink-faint' } as const;
  const upstreamOf = (d: DomainItem) =>
    d.appId === 'vessel-system'
      ? '127.0.0.1:3900'
      : d.targetType === 'internal'
      ? `${d.serviceName}:${d.targetPort}`
      : `127.0.0.1:${d.targetPort}`;
  const sortedDomains = [...domains].sort((a, b) => a.domain.localeCompare(b.domain));
  const problemCount = domains.filter((d) => ['bad', 'warn'].includes(certInfo(d).tone)).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Intro + primary action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-muted max-w-2xl">
          内置 Caddy 负责反向代理。绑定后自动签发并续订 HTTPS 证书，修改即时生效、无需重启。绑定前请先把域名的 A / AAAA 记录解析到本机。
        </p>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-vessel-primary shrink-0 min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
        >
          <Plus className="w-4 h-4" weight="bold" />
          绑定域名
        </button>
      </div>

      <section aria-label="域名列表" className="card-vessel !cursor-default overflow-hidden">
        {domains.length === 0 ? (
          <div className="p-3 sm:p-4">
            <EmptyState
              icon={<Globe className="w-5 h-5" weight="duotone" />}
              title="还没有绑定域名"
              description="为应用或控制台本身绑定域名，Vessel 会自动签发并续期 HTTPS 证书。"
              action={
                <button type="button" onClick={handleOpenAdd} className="btn-vessel-primary text-xs px-3.5 py-2 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" weight="bold" />
                  绑定域名
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden md:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-4 px-5 h-10 items-center text-xs text-ink-faint border-b border-line-subtle"
            >
              <span>域名</span>
              <span>转发到</span>
              <span>证书</span>
              <span>到期</span>
              <span className="text-right">操作</span>
            </div>
            <ul className="divide-y divide-line-subtle">
              {sortedDomains.map((d) => {
                const matchedApp = apps.find((a) => a.id === d.appId);
                const isVesselSystem = d.appId === 'vessel-system';
                const cert = certInfo(d);
                return (
                  <li
                    key={d.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-x-4 gap-y-1.5 px-4 sm:px-5 py-3 items-center hover:bg-paper-3/50 transition-colors"
                  >
                    {/* Domain */}
                    <div className="min-w-0">
                      <a
                        href={`https://${d.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 max-w-full font-mono text-[13px] font-medium text-ink hover:text-signal"
                      >
                        <span className="truncate">{d.domain}</span>
                        <ArrowSquareOut className="w-3.5 h-3.5 shrink-0 text-ink-faint" />
                      </a>
                      <p className="text-xs text-ink-muted truncate flex items-center gap-1">
                        {isVesselSystem ? (
                          <>
                            <Anchor className="w-3 h-3" weight="bold" />
                            Vessel 控制台
                          </>
                        ) : (
                          matchedApp?.name || d.appId
                        )}
                      </p>
                    </div>

                    {/* Cert status on mobile sits at the right of the first row */}
                    <span className={clsx('md:hidden justify-self-end inline-flex items-center gap-1.5 text-xs', CERT_TONE[cert.tone])}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', CERT_DOT[cert.tone])} />
                      {cert.label}
                    </span>

                    {/* Upstream */}
                    <div className="min-w-0 col-span-2 md:col-span-1">
                      <span className="font-mono text-xs text-ink-muted truncate block">→ {upstreamOf(d)}</span>
                      <span className="hidden md:block text-[11px] text-ink-faint">
                        {isVesselSystem ? '本机控制台' : d.targetType === 'internal' ? '容器内网 · vessel-net' : '宿主机端口'}
                      </span>
                    </div>

                    {/* Cert */}
                    <div className="hidden md:block min-w-0">
                      <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', CERT_TONE[cert.tone])}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', CERT_DOT[cert.tone])} />
                        {cert.label}
                      </span>
                      <span className="block text-[11px] text-ink-faint truncate">{d.sslIssuer || '—'}</span>
                    </div>

                    {/* Expiry */}
                    <div className="hidden md:block text-xs text-ink-muted font-mono whitespace-nowrap">
                      {d.sslExpiresAt ? new Date(d.sslExpiresAt).toLocaleDateString() : '—'}
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 md:col-span-1 flex items-center justify-end gap-1 -my-1">
                      <button
                        type="button"
                        onClick={() => onRenewDomain(d.id)}
                        aria-label={`重新检测 ${d.domain} 的证书`}
                        data-tooltip="重新检测 / 续订"
                        className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowsClockwise className="w-4 h-4" />
                      </button>
                      {onUpdateDomain && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(d)}
                          aria-label={`编辑 ${d.domain}`}
                          data-tooltip="编辑"
                          className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center justify-center cursor-pointer"
                        >
                          <PencilSimple className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingDomain(d);
                          setDeleteDomainInput('');
                        }}
                        aria-label={`解绑 ${d.domain}`}
                        data-tooltip="解绑"
                        className="w-9 h-9 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-5 h-11 flex items-center border-t border-line-subtle text-xs text-ink-muted">
              共 {domains.length} 个域名
              {problemCount > 0 && <span className="ml-1 text-amber-700 dark:text-amber-400">· {problemCount} 个证书需要关注</span>}
            </div>
          </>
        )}
      </section>

      {/* DELETE CONFIRMATION MODAL WITH INPUT VERIFICATION */}
      <Modal
        isOpen={Boolean(deletingDomain)}
        onClose={() => !isDeleting && setDeletingDomain(null)}
        title="解绑域名路由"
        subtitle={deletingDomain ? `域名绑定: https://${deletingDomain.domain}` : ''}
        maxWidth="max-w-md"
      >
        {deletingDomain && (
          <div className="space-y-4 font-sans text-xs">
            <p className="text-ink-muted leading-relaxed">
              解绑后将立即清除反向代理服务中该域名的路由规则块并重载 Caddy。外部流量将无法再通过此域名访问容器服务。<strong>此操作无法撤销。</strong>
            </p>

            {/* Input Verification Box */}
            <div className="space-y-2 pt-1">
              <label htmlFor="delete-domain-input" className="flex items-center justify-between text-ink-muted">
                <span>
                  请输入完整域名 <strong className="font-mono font-semibold text-ink select-all">{deletingDomain.domain}</strong> 以确认：
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteDomainInput(deletingDomain.domain);
                    if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
                  }}
                  className="text-[11px] text-ink-muted hover:text-ink transition-colors cursor-pointer select-none underline decoration-dotted underline-offset-2"
                >
                  快速填入
                </button>
              </label>

              <input
                id="delete-domain-input"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={deleteDomainInput}
                onChange={(e) => setDeleteDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isDomainDeleteConfirmed && !isDeleting) {
                    handleConfirmDeleteDomain();
                  }
                }}
                placeholder={deletingDomain.domain}
                autoFocus
                className="w-full h-10 bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 text-xs font-mono text-ink placeholder:text-ink-faint/60 focus:outline-none transition-colors shadow-sm"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingDomain(null)}
                disabled={isDeleting}
                className="btn-vessel-secondary px-4 py-2 text-xs font-medium rounded-xl cursor-pointer select-none"
              >
                取消
              </button>
              <Button8State
                size="sm"
                variant="danger"
                state={isDeleting ? 'loading' : 'default'}
                disabled={!isDomainDeleteConfirmed || isDeleting}
                onClick={handleConfirmDeleteDomain}
                className="rounded-xl px-4 py-2 text-xs font-medium"
              >
                确认解绑
              </Button8State>
            </div>
          </div>
        )}
      </Modal>

      {/* ADD DOMAIN FULLSCREEN / RESPONSIVE MODAL */}
      {isAddOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-[3px] animate-fade-in font-sans"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-domain-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !loading) {
                setIsAddOpen(false);
                setEditingDomain(null);
              }
            }}
          >
            {/* Modal / Bottom Sheet Card */}
            <div
              className="w-full sm:max-w-xl max-h-[92vh] sm:max-h-[90vh] surface-pop rounded-t-[24px] sm:rounded-[22px] flex flex-col overflow-hidden animate-bottom-sheet sm:animate-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Drag Handle Indicator */}
              <div className="w-9 h-1 bg-ink-faint/30 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

              {/* Sticky Top Header */}
              <header className="px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-paper-3 text-ink flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" weight="bold" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      id="add-domain-title"
                      className="text-base sm:text-lg font-semibold text-ink tracking-tight font-sans truncate"
                    >
                      {editingDomain ? '编辑域名路由配置' : '绑定域名与配置 HTTPS 路由'}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-ink-muted truncate">
                      {editingDomain
                        ? `当前配置: ${editingDomain.domain}`
                        : '反向代理至指定的 Compose 容器或控制台'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!loading) {
                      setIsAddOpen(false);
                      setEditingDomain(null);
                    }
                  }}
                  disabled={loading}
                  aria-label="关闭窗口"
                  className="min-w-[44px] min-h-[44px] -mr-2 p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" weight="bold" />
                </button>
              </header>

              {/* Scrollable Form Body */}
              <form onSubmit={handleCreate} className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto px-5 sm:px-6 py-3 space-y-4 sm:space-y-5 pb-28 sm:pb-6">
                  {/* 1. 绑定域名 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-ink flex items-center gap-1">
                        <span>绑定域名 (FQDN)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-ink-faint">支持主域名或子域名</span>
                    </div>

                    <div className="flex items-stretch rounded-xl bg-paper-2 dark:bg-paper-3 border border-line shadow-sm overflow-hidden group focus-within:border-signal focus-within:ring-[3px] focus-within:ring-signal-soft transition-colors">
                      <div className="bg-paper-2 dark:bg-paper-4/40 px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none shrink-0 border-r border-line">
                        <LockKey className="w-3.5 h-3.5" weight="bold" />
                        <span>https://</span>
                      </div>
                      <input
                        type="text"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        value={domainInput}
                        onChange={(e) => {
                          let val = e.target.value.trim();
                          val = val.replace(/^https?:\/\//i, '');
                          setDomainInput(val);
                        }}
                        placeholder="app.example.com"
                        className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none min-h-[44px]"
                        autoFocus
                      />
                    </div>

                    {/* DNS Guidance Box */}
                    <div className="mt-2.5 p-3.5 rounded-2xl bg-paper-3/40 flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
                      <Info className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" weight="fill" />
                      <p className="text-[11.5px]">
                        请确保该域名的 <strong className="text-ink font-semibold">A / AAAA 记录</strong> 已解析至本机器公网 IP。Caddy 将通过 ACME 协议自动向 Let's Encrypt / ZeroSSL 申请并续订 SSL 证书。
                      </p>
                    </div>
                  </div>

                  {/* 2. 目标应用选择 */}
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      目标应用 <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      value={appIdInput}
                      onChange={handleSelectApp}
                      options={availableAppOptions}
                      placeholder="选择未绑定域名的目标应用..."
                    />
                  </div>

                  {/* 3. 核心控制台锁定 vs 普通应用配置 */}
                  {appIdInput === 'vessel-system' ? (
                    <div className="p-4 rounded-2xl bg-paper-3/50 flex items-start gap-3 text-xs">
                      <Anchor className="w-4 h-4 text-ink shrink-0 mt-0.5" weight="bold" />
                      <div>
                        <p className="font-semibold text-ink">已锁定为 Vessel 管理控制台核心服务</p>
                        <p className="text-[11.5px] text-ink-muted mt-1 leading-relaxed">
                          Caddy 将自动为此域名申请 SSL 证书，并配置反向代理至控制台的核心 Web / WebSocket 通道 (<code className="font-mono text-ink">127.0.0.1:3900</code>)。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 单列纵向堆叠（移动端） / 双列并排（桌面端） */}
                      <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-semibold text-ink mb-1.5">
                            Compose 内部服务名
                          </label>
                          <input
                            type="text"
                            value={serviceNameInput}
                            onChange={(e) => setServiceNameInput(e.target.value)}
                            placeholder="例如: web, app, n8n"
                            className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-ink mb-1.5">
                            容器端口 <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            required
                            value={targetPortInput}
                            onChange={(e) => setTargetPortInput(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="例如: 3000, 5678, 80"
                            className="w-full min-h-[44px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink font-mono placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm"
                          />
                        </div>
                      </div>

                      {selectedServices.some((s) => candidatePorts(s, targetTypeInput).length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5 -mt-1">
                          <span className="text-[11px] text-ink-faint font-medium">编排检测端口:</span>
                          {selectedServices.flatMap((s) =>
                            candidatePorts(s, targetTypeInput).map((port) => {
                              const active = serviceNameInput === s.name && targetPortInput === String(port);
                              return (
                                <button
                                  key={`${s.name}:${port}`}
                                  type="button"
                                  onClick={() => {
                                    setServiceNameInput(s.name);
                                    setTargetPortInput(String(port));
                                  }}
                                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono transition-colors ${
                                    active
                                      ? 'border-signal/70 bg-paper-3 dark:bg-paper-4 text-ink'
                                      : 'border-line-subtle bg-paper-2/60 dark:bg-paper-3/40 text-ink-muted hover:border-line-strong'
                                  }`}
                                >
                                  {s.name}:{port}
                                </button>
                              );
                            }),
                          )}
                        </div>
                      )}

                      {/* 代理对接方式 */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          代理对接方式
                        </label>
                        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 text-xs">
                          <label
                            className={`p-3.5 rounded-2xl cursor-pointer flex flex-col gap-1.5 transition-colors select-none border ${
                              targetTypeInput === 'internal'
                                ? 'bg-paper-3 dark:bg-paper-4 border-signal/70 ring-1 ring-signal-ring text-ink shadow-sm'
                                : 'bg-paper-2/60 dark:bg-paper-3/40 border-line-subtle text-ink-muted hover:bg-paper-3 hover:dark:bg-paper-3/80 hover:border-line-strong'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="targetType"
                                checked={targetTypeInput === 'internal'}
                                onChange={() => handleSelectTargetType('internal')}
                                className="text-accent focus:ring-accent"
                              />
                              <strong className={`text-xs ${targetTypeInput === 'internal' ? 'text-ink font-semibold' : 'text-ink/75 font-medium'}`}>容器内部网络 (推荐)</strong>
                            </div>
                            <span className={`text-[11px] pl-5 leading-relaxed ${targetTypeInput === 'internal' ? 'text-ink-muted' : 'text-ink-faint'}`}>
                              直通 vessel-net 内部网络，宿主机无需暴露端口
                            </span>
                          </label>

                          <label
                            className={`p-3.5 rounded-2xl cursor-pointer flex flex-col gap-1.5 transition-colors select-none border ${
                              targetTypeInput === 'host'
                                ? 'bg-paper-3 dark:bg-paper-4 border-signal/70 ring-1 ring-signal-ring text-ink shadow-sm'
                                : 'bg-paper-2/60 dark:bg-paper-3/40 border-line-subtle text-ink-muted hover:bg-paper-3 hover:dark:bg-paper-3/80 hover:border-line-strong'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="targetType"
                                checked={targetTypeInput === 'host'}
                                onChange={() => handleSelectTargetType('host')}
                                className="text-accent focus:ring-accent"
                              />
                              <strong className={`text-xs ${targetTypeInput === 'host' ? 'text-ink font-semibold' : 'text-ink/75 font-medium'}`}>宿主机端口转发</strong>
                            </div>
                            <span className={`text-[11px] pl-5 leading-relaxed ${targetTypeInput === 'host' ? 'text-ink-muted' : 'text-ink-faint'}`}>
                              代理至 127.0.0.1 映射端口
                            </span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </main>

                {/* Sticky Bottom Footer */}
                <footer className="p-4 bg-paper-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0">
                  <Button8State
                    variant="primary"
                    type="submit"
                    state={loading ? 'loading' : 'default'}
                    disabled={loading || !domainInput.trim() || !appIdInput || !targetPortInput}
                    icon={loading ? undefined : <ShieldCheck className="w-4 h-4" weight="bold" />}
                    className="w-full sm:w-auto min-h-[44px] text-xs font-semibold rounded-xl"
                  >
                    {loading
                      ? (editingDomain ? '正在同步配置...' : '证书申请中...')
                      : (editingDomain ? '保存修改并同步反代路由' : '确认绑定并自动签发证书')}
                  </Button8State>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddOpen(false);
                      setEditingDomain(null);
                    }}
                    disabled={loading}
                    className="btn-vessel-secondary w-full sm:w-auto min-h-[44px] px-4 text-xs font-medium rounded-xl cursor-pointer select-none text-center sm:order-first"
                  >
                    取消
                  </button>
                </footer>
              </form>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};
