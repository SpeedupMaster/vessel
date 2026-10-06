import React, { useState } from 'react';
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
  const [isTipsExpanded, setIsTipsExpanded] = useState(false);
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
    const cleanDomain = domainInput.trim().replace(/^https?:\/\//i, '');
    if (!cleanDomain || !appIdInput || !targetPortInput) return;
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([20, 40]);
    }
    setLoading(true);
    try {
      await onCreateDomain({
        domain: cleanDomain,
        appId: appIdInput,
        serviceName: serviceNameInput,
        targetPort: Number(targetPortInput),
        targetType: targetTypeInput,
      });
      setIsAddOpen(false);
      setDomainInput('');
      toast.success(`域名 ${cleanDomain} 绑定成功！Caddy 正在自动化签发 SSL 证书`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header (De-boxed, modern SaaS standard with compressed mobile footprint) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-paper-2 dark:bg-white/[0.04] border border-line/60 dark:border-white/[0.08] flex items-center justify-center text-accent flex-shrink-0 shadow-subtle mt-0.5">
            <LockKey className="w-5 h-5" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-base sm:text-lg text-ink tracking-tight font-sans">
                Caddy 智能反向代理与自动证书续订
              </h2>
              {domains.length > 0 && (
                <span className="text-[11px] px-2 py-0.2 rounded-full bg-paper-2 dark:bg-white/[0.05] text-ink-muted border border-line/50 dark:border-white/[0.06] font-mono">
                  共 {domains.length} 个路由
                </span>
              )}
            </div>

            {/* Compressed 1-line description with collapsible detailed explanation */}
            <div className="mt-1">
              <p className="text-xs text-ink-muted leading-relaxed inline">
                绑定公网域名自动签发 SSL 证书并反向代理至容器或控制台。
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
              <div className="mt-2.5 p-3 rounded-xl bg-paper-2/80 dark:bg-white/[0.03] border border-line/80 dark:border-white/[0.08] text-xs text-ink-muted space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 font-medium text-ink">
                  <Info className="w-3.5 h-3.5 text-accent flex-shrink-0" weight="fill" />
                  <span>服务反向代理与 SSL 运作机制</span>
                </div>
                <p className="text-[11.5px] leading-relaxed">
                  解析公网域名至服务器 IP 后，支持反代任何 Docker Compose 容器，亦可直接为 <strong className="text-ink dark:text-zinc-200 font-semibold">Vessel 管理控制台自身</strong> 配置独立访问域名与 HTTPS。由内置 Caddy 引擎全自动签发与静默续期证书。
                </p>
              </div>
            )}
          </div>
        </div>

        <Button8State
          variant="primary"
          icon={<Plus className="w-4 h-4" weight="bold" />}
          onClick={handleOpenAdd}
          className="w-full sm:w-auto min-h-[42px] sm:min-h-0"
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
                  className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-paper-2/50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <a
                        href={`https://${d.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm sm:text-base font-semibold text-ink hover:text-accent flex items-center gap-1.5 transition-colors break-all"
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
                请输入完整域名 <strong className="text-ink font-semibold select-none font-mono">{deletingDomain.domain}</strong> 以确认解绑：
              </label>
              <input
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
                className="w-full bg-paper border border-line rounded-lg px-3.5 py-2.5 text-xs text-ink font-mono focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none transition-all shadow-subtle"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 mt-2 border-t border-line flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
              {!isDomainDeleteConfirmed ? (
                <button
                  type="button"
                  disabled
                  className="order-1 sm:order-2 w-full sm:w-auto min-h-[46px] sm:min-h-0 px-4 py-2 bg-paper-3 dark:bg-[#21262d] text-ink-muted/50 dark:text-[#8b949e] border border-line/50 dark:border-white/[0.06] text-xs font-medium rounded-xl sm:rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5 select-none"
                >
                  <Trash className="w-4 h-4 opacity-40" />
                  <span>确认解绑域名</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDeleteDomain}
                  disabled={isDeleting}
                  className="order-1 sm:order-2 w-full sm:w-auto min-h-[46px] sm:min-h-0 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl sm:rounded-lg shadow-md shadow-red-600/25 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] sm:active:scale-100 cursor-pointer"
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

              <button
                type="button"
                onClick={() => setDeletingDomain(null)}
                disabled={isDeleting}
                className="order-2 sm:order-1 w-full sm:w-auto py-2.5 sm:py-2 px-4 text-xs font-medium text-ink-muted hover:text-ink sm:bg-paper-2 sm:hover:bg-paper-3 sm:border sm:border-line sm:rounded-lg text-center transition-colors cursor-pointer select-none"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ADD DOMAIN FULLSCREEN / RESPONSIVE MODAL */}
      {isAddOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-black/60 sm:bg-black/50 sm:dark:bg-black/75 backdrop-blur-sm animate-fade-in font-sans"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-domain-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !loading) {
                setIsAddOpen(false);
              }
            }}
          >
            {/* Modal / Bottom Sheet Card: Native Bottom Sheet on mobile (rounded-t-2xl), centered dialog on desktop */}
            <div
              className="w-full sm:max-w-xl max-h-[92vh] sm:max-h-[90vh] bg-paper rounded-t-2xl sm:rounded-2xl border-t sm:border border-line shadow-2xl sm:shadow-floating flex flex-col overflow-hidden animate-bottom-sheet sm:animate-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Drag Handle Indicator (Image 2 style) */}
              <div className="w-10 h-1 bg-ink-muted/30 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

              {/* Sticky Top Header */}
              <header className="bg-paper/95 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-3.5 border-b border-line flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" weight="bold" />
                  </div>
                  <div className="min-w-0">
                    <h3
                      id="add-domain-title"
                      className="text-base sm:text-lg font-semibold text-ink tracking-tight font-sans truncate"
                    >
                      绑定域名与配置 HTTPS 路由
                    </h3>
                    <p className="text-[11px] sm:text-xs text-ink-muted truncate">
                      反向代理至指定的 Compose 容器或控制台
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !loading && setIsAddOpen(false)}
                  disabled={loading}
                  aria-label="关闭窗口"
                  className="min-w-[44px] min-h-[44px] -mr-2 p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 transition-colors flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" weight="bold" />
                </button>
              </header>

              {/* Scrollable Form Body */}
              <form onSubmit={handleCreate} className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 pb-28 sm:pb-6">
                  {/* 1. 绑定域名 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-ink flex items-center gap-1">
                        <span>绑定域名 (FQDN)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-ink-faint">支持主域名或子域名</span>
                    </div>

                    <div className="flex items-stretch rounded-xl border border-line bg-paper shadow-subtle transition-colors overflow-hidden group focus-within:ring-2 focus-within:border-accent focus-within:ring-accent/15">
                      <div className="bg-paper-2 border-r border-line px-3.5 flex items-center gap-1.5 text-ink-muted text-xs font-mono font-medium select-none group-focus-within:text-accent transition-colors shrink-0">
                        <LockKey className="w-3.5 h-3.5" weight="bold" />
                        <span>https://</span>
                      </div>
                      <input
                        type="url"
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
                        className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-sm text-ink font-mono placeholder:text-ink-faint focus:outline-none min-h-[44px]"
                        autoFocus
                      />
                    </div>

                    {/* DNS Guidance Box */}
                    <div className="mt-2 p-3 rounded-xl bg-accent/5 border border-accent/15 flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
                      <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="fill" />
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
                            className="w-full min-h-[44px] bg-paper border border-line rounded-lg px-3.5 py-2 text-xs sm:text-sm text-ink focus:border-accent focus:outline-none transition-colors shadow-subtle"
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
                            className="w-full min-h-[44px] bg-paper border border-line rounded-lg px-3.5 py-2 text-xs sm:text-sm text-ink font-mono focus:border-accent focus:outline-none transition-colors shadow-subtle"
                          />
                        </div>
                      </div>

                      {/* 代理对接方式：移动端单列纵向堆叠 / 桌面端双列并排 */}
                      <div>
                        <label className="block text-xs font-semibold text-ink mb-1.5">
                          代理对接方式
                        </label>
                        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 text-xs">
                          <label
                            className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all select-none ${
                              targetTypeInput === 'internal'
                                ? 'bg-accent/10 border-accent text-ink font-medium shadow-subtle ring-1 ring-accent/20'
                                : 'bg-paper-2 border-line text-ink-muted hover:border-line-focus hover:bg-paper-2/80'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="targetType"
                                checked={targetTypeInput === 'internal'}
                                onChange={() => setTargetTypeInput('internal')}
                                className="text-accent focus:ring-accent"
                              />
                              <strong className="text-ink text-xs">容器内部网络 (推荐)</strong>
                            </div>
                            <span className="text-[11px] text-ink-faint pl-5 leading-relaxed">
                              直通 vessel-net 内部网络，宿主机无需暴露端口
                            </span>
                          </label>

                          <label
                            className={`p-3.5 rounded-xl border cursor-pointer flex flex-col gap-1.5 transition-all select-none ${
                              targetTypeInput === 'host'
                                ? 'bg-accent/10 border-accent text-ink font-medium shadow-subtle ring-1 ring-accent/20'
                                : 'bg-paper-2 border-line text-ink-muted hover:border-line-focus hover:bg-paper-2/80'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="targetType"
                                checked={targetTypeInput === 'host'}
                                onChange={() => setTargetTypeInput('host')}
                                className="text-accent focus:ring-accent"
                              />
                              <strong className="text-ink text-xs">宿主机端口转发</strong>
                            </div>
                            <span className="text-[11px] text-ink-faint pl-5 leading-relaxed">
                              代理至 127.0.0.1 映射端口
                            </span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </main>

                {/* Sticky Bottom Footer: Native Bottom Sheet layout matching Image 2 */}
                <footer className="p-4 border-t border-line bg-paper/95 backdrop-blur-md pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0 shadow-subtle">
                  <Button8State
                    variant="primary"
                    type="submit"
                    state={loading ? 'loading' : 'default'}
                    disabled={loading || !domainInput.trim() || !appIdInput || !targetPortInput}
                    icon={loading ? undefined : <ShieldCheck className="w-4 h-4" weight="bold" />}
                    className="w-full sm:w-auto min-h-[46px] sm:min-h-[38px] text-xs font-semibold rounded-xl sm:rounded-lg"
                  >
                    {loading ? '证书申请中...' : '确认绑定并自动签发证书'}
                  </Button8State>
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    disabled={loading}
                    className="w-full sm:w-auto py-2.5 sm:py-2 px-4 bg-paper-2 hover:bg-paper-3 text-ink text-xs font-medium rounded-xl sm:rounded-lg border border-line transition-colors cursor-pointer select-none text-center sm:order-first"
                  >
                    取消
                  </button>
                </footer>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Mobile Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(15);
          }
          handleOpenAdd();
        }}
        aria-label="绑定新域名"
        className="sm:hidden fixed bottom-6 right-5 z-40 w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white shadow-floating flex items-center justify-center active:scale-95 transition-all focus:outline-none cursor-pointer"
      >
        <Plus className="w-5 h-5" weight="bold" />
      </button>
    </div>
  );
};
