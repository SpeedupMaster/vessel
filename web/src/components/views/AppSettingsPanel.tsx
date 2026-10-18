import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowClockwise,
  ArrowSquareOut,
  BellRinging,
  Check,
  Copy,
  Database,
  Eye,
  EyeSlash,
  Gauge,
  Info,
  Trash,
  WebhooksLogo,
} from '@phosphor-icons/react';
import { AppDeploySettings, AppItem, NotificationChannel, PullPolicy } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Switch } from '../common/Switch.js';
import { NumberInput } from '../common/NumberInput.js';
import { formatRelative } from './DeploymentsPanel.js';

interface AppSettingsPanelProps {
  app: AppItem;
  onOpenDelete: () => void;
  onOpenFreshVolumes: () => void;
}

type EditableSettings = Omit<AppDeploySettings, 'webhookToken'>;

const EDITABLE_KEYS: (keyof EditableSettings)[] = [
  'webhookEnabled',
  'pullPolicy',
  'removeOrphans',
  'waitHealthy',
  'timeoutMinutes',
  'autoRollback',
  'historyLimit',
  'notifyOnSuccess',
  'notifyOnFailure',
  'notifyOnUpdate',
];

/** In-app navigation without prop drilling: App listens to popstate */
export function navigateTo(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, description, aside, children }) => (
  <section className="card-vessel overflow-hidden">
    <header className="flex items-start justify-between gap-4 px-4 sm:px-5 pt-4 pb-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-paper-3 border border-line-subtle flex items-center justify-center text-ink-muted shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold text-ink tracking-tight">{title}</h4>
          <p className="text-[11.5px] text-ink-muted mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {aside}
    </header>
    <div className="divide-y divide-line-subtle border-t border-line-subtle">{children}</div>
  </section>
);

const Row: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode; disabled?: boolean }> = ({
  label,
  hint,
  children,
  disabled,
}) => (
  <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 transition-opacity', disabled && 'opacity-50')}>
    <div className="min-w-0 sm:pr-6">
      <div className="text-xs font-medium text-ink">{label}</div>
      {hint && <div className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">{hint}</div>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Segmented = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="term-tools">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        data-active={value === option.value}
        className="term-btn px-3"
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const AppSettingsPanel: React.FC<AppSettingsPanelProps> = ({ app, onOpenDelete, onOpenFreshVolumes }) => {
  const { toast, confirm } = useNotification();
  const [saved, setSaved] = useState<AppDeploySettings | null>(null);
  const [draft, setDraft] = useState<EditableSettings | null>(null);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [saving, setSaving] = useState(false);
  const [revealToken, setRevealToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [settings, list] = await Promise.all([
        apiFetch(`/api/apps/${app.id}/settings`).then((r) => r.json()),
        apiFetch('/api/notifications').then((r) => r.json()).catch(() => []),
      ]);
      setSaved(settings);
      setDraft(settings);
      setChannels(Array.isArray(list) ? list : []);
    } catch (err: any) {
      toast.error(`加载应用设置失败: ${err.message}`);
    }
  }, [app.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => !!saved && !!draft && EDITABLE_KEYS.some((key) => saved[key] !== draft[key]),
    [saved, draft]
  );

  const set = <K extends keyof EditableSettings>(key: K, value: EditableSettings[K]) =>
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const body = Object.fromEntries(EDITABLE_KEYS.map((key) => [key, draft[key]]));
      const next: AppDeploySettings = await (
        await apiFetch(`/api/apps/${app.id}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).json();
      setSaved(next);
      setDraft(next);
      toast.success('应用设置已保存');
    } catch (err: any) {
      toast.error(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    const ok = await confirm({
      title: '重新生成 Webhook 密钥',
      message: '旧的 Webhook 地址会立即失效，所有使用它的 CI 流水线都需要更新为新地址。',
      confirmText: '重新生成',
      variant: 'danger',
      dangerTitle: '旧地址将立即失效',
    });
    if (!ok) return;
    try {
      const next: AppDeploySettings = await (
        await apiFetch(`/api/apps/${app.id}/settings/webhook-token`, { method: 'POST' })
      ).json();
      setSaved((prev) => (prev ? { ...prev, webhookToken: next.webhookToken } : next));
      setRevealToken(true);
      toast.success('已生成新的 Webhook 地址');
    } catch (err: any) {
      toast.error(`生成失败: ${err.message}`);
    }
  };

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  };

  if (!saved || !draft) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[160px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const webhookUrl = `${window.location.origin}/api/hooks/deploy/${app.id}/${saved.webhookToken}`;
  const shownUrl = revealToken
    ? webhookUrl
    : `${window.location.origin}/api/hooks/deploy/${app.id}/${saved.webhookToken.slice(0, 4)}••••••••`;
  const curl = `curl -fsS -X POST "${webhookUrl}"`;
  const activeChannels = channels.filter((c) => c.enabled);

  const meta: { label: string; value: string; mono?: boolean; copy?: boolean }[] = [
    { label: '应用 ID', value: app.id, mono: true, copy: true },
    { label: '创建时间', value: new Date(app.createdAt).toLocaleString() },
    { label: '最近修改', value: app.updatedAt ? new Date(app.updatedAt).toLocaleString() : '—' },
    {
      label: '最近部署',
      value: app.lastDeployedAt ? `${new Date(app.lastDeployedAt).toLocaleString()} · ${formatRelative(app.lastDeployedAt)}` : '尚未部署',
    },
  ];

  return (
    <div className="space-y-5 pb-4">
      {/* 1. Deploy trigger */}
      <Section
        icon={<WebhooksLogo className="w-4 h-4" />}
        title="部署触发 · Webhook"
        description="CI 推送镜像后调用此地址即可自动拉取并重建，无需登录控制台。"
        aside={<Switch checked={draft.webhookEnabled} onChange={(v) => set('webhookEnabled', v)} size="sm" aria-label="启用部署 Webhook" />}
      >
        <div className={clsx('px-4 sm:px-5 py-4 space-y-3 transition-opacity', !draft.webhookEnabled && 'opacity-50')}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-paper-3/60 border border-line flex items-center font-mono text-[11.5px] text-ink-muted">
              <span className="truncate select-all">{shownUrl}</span>
            </div>
            <div className="term-tools shrink-0">
              <button
                type="button"
                onClick={() => setRevealToken(!revealToken)}
                className="term-btn"
                aria-label={revealToken ? '隐藏密钥' : '显示密钥'}
                data-tooltip={revealToken ? '隐藏密钥' : '显示完整地址'}
              >
                {revealToken ? <EyeSlash className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => copy('url', webhookUrl)} className="term-btn" data-tooltip="复制完整地址" aria-label="复制地址">
                {copied === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-500" weight="bold" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={handleRegenerate} className="term-btn" data-tooltip="重新生成密钥" aria-label="重新生成密钥">
                <ArrowClockwise className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-line-subtle bg-paper-3/40 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="eyebrow">CI 示例</span>
              <button
                type="button"
                onClick={() => copy('curl', curl)}
                className="text-[11px] text-ink-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer"
              >
                {copied === 'curl' ? <Check className="w-3 h-3 text-emerald-500" weight="bold" /> : <Copy className="w-3 h-3" />}
                复制
              </button>
            </div>
            <code className="block font-mono text-[11px] text-ink-muted break-all leading-relaxed">
              curl -fsS -X POST "{shownUrl}"
            </code>
            <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">
              默认执行「拉取并重建」；追加 <code className="font-mono text-ink-muted">?action=deploy</code> 则只按当前配置部署。应用忙碌时返回 409。
            </p>
          </div>
          {dirty && saved.webhookEnabled !== draft.webhookEnabled && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">保存后生效。</p>
          )}
        </div>
      </Section>

      {/* 2. Deploy behaviour */}
      <Section
        icon={<Gauge className="w-4 h-4" />}
        title="部署行为"
        description="控制 docker compose up 的参数，以及部署失败时的处理方式。"
      >
        <Row label="镜像拉取策略" hint="「总是」会在每次部署前检查远端镜像，适合使用 latest 等浮动标签的应用。">
          <Segmented<PullPolicy>
            value={draft.pullPolicy}
            onChange={(v) => set('pullPolicy', v)}
            options={[
              { value: 'missing', label: '仅缺失时' },
              { value: 'always', label: '总是' },
            ]}
          />
        </Row>
        <Row label="清理孤立容器" hint="部署时移除 Compose 文件中已删除服务遗留的容器 (--remove-orphans)。">
          <Switch checked={draft.removeOrphans} onChange={(v) => set('removeOrphans', v)} size="sm" aria-label="清理孤立容器" />
        </Row>
        <Row label="等待健康检查" hint="容器全部 running / healthy 后才判定成功 (--wait)，否则记为失败。需要服务定义 healthcheck 才有意义。">
          <Switch checked={draft.waitHealthy} onChange={(v) => set('waitHealthy', v)} size="sm" aria-label="等待健康检查" />
        </Row>
        <Row label="部署超时" hint="超过时长仍未完成的部署会被终止并记为失败。">
          <NumberInput value={draft.timeoutMinutes} onChange={(v) => set('timeoutMinutes', v)} min={1} max={120} unit="分钟" className="w-[150px]" />
        </Row>
        <Row
          label="失败时自动回滚"
          hint="部署失败后自动恢复到最近一次成功部署的 Compose 与环境变量配置，并重新部署。"
        >
          <Switch checked={draft.autoRollback} onChange={(v) => set('autoRollback', v)} size="sm" aria-label="失败时自动回滚" />
        </Row>
        <Row label="保留部署记录" hint="超出数量的旧记录及其日志会被自动清理。">
          <NumberInput value={draft.historyLimit} onChange={(v) => set('historyLimit', v)} min={1} max={100} unit="条" className="w-[150px]" />
        </Row>
      </Section>

      {/* 3. Notifications */}
      <Section
        icon={<BellRinging className="w-4 h-4" />}
        title="通知"
        description="选择此应用要推送的事件，消息会发到所有已启用、且订阅了该事件的通知渠道。"
        aside={
          <button
            type="button"
            onClick={() => navigateTo('/notifications')}
            className="text-[11.5px] text-ink-muted hover:text-ink inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
          >
            管理渠道
            <ArrowSquareOut className="w-3.5 h-3.5" />
          </button>
        }
      >
        {activeChannels.length === 0 && (
          <div className="px-4 sm:px-5 py-3 flex items-start gap-2 bg-amber-500/[0.06] text-[11.5px] text-amber-800 dark:text-amber-300">
            <Info className="w-4 h-4 shrink-0 mt-px" />
            <span>
              还没有启用的通知渠道，以下设置暂不会发出消息。
              <button type="button" onClick={() => navigateTo('/notifications')} className="ml-1 underline underline-offset-2 cursor-pointer">
                去添加
              </button>
            </span>
          </div>
        )}
        <Row label="部署失败" hint="包含失败原因摘要，建议保持开启。">
          <Switch checked={draft.notifyOnFailure} onChange={(v) => set('notifyOnFailure', v)} size="sm" aria-label="部署失败通知" />
        </Row>
        <Row label="部署成功">
          <Switch checked={draft.notifyOnSuccess} onChange={(v) => set('notifyOnSuccess', v)} size="sm" aria-label="部署成功通知" />
        </Row>
        <Row label="发现新版本镜像" hint="定时巡检发现远端镜像变化、且未开启自动更新时提醒一次。">
          <Switch checked={draft.notifyOnUpdate} onChange={(v) => set('notifyOnUpdate', v)} size="sm" aria-label="新版本镜像通知" />
        </Row>
      </Section>

      {/* 4. Metadata */}
      <section className="card-vessel p-1.5">
        <div className="px-3 pt-2 pb-1.5 eyebrow">元数据</div>
        {meta.map((item) => (
          <div
            key={item.label}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 px-3 py-2 rounded-xl hover:bg-paper-3/50 transition-colors text-xs"
          >
            <span className="text-ink-muted shrink-0">{item.label}</span>
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={clsx('text-ink truncate', item.mono && 'font-mono')}>{item.value}</span>
              {item.copy && (
                <button
                  type="button"
                  onClick={() => copy(item.label, item.value)}
                  className="p-1 rounded-md text-ink-faint hover:text-ink hover:bg-paper-3 cursor-pointer"
                  aria-label={`复制${item.label}`}
                >
                  {copied === item.label ? <Check className="w-3.5 h-3.5 text-emerald-500" weight="bold" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </span>
          </div>
        ))}
      </section>

      {/* 5. Danger zone */}
      <section className="rounded-2xl border border-rose-500/25 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 bg-rose-500/[0.06] border-b border-rose-500/20">
          <h4 className="text-[13px] font-semibold text-rose-600 dark:text-rose-400">危险操作</h4>
        </div>
        <div className="divide-y divide-rose-500/15">
          <Row label="重置数据卷并重建" hint="执行 down -v 后重新部署，所有命名数据卷中的数据将被清空。">
            <button
              type="button"
              onClick={onOpenFreshVolumes}
              className="h-8 px-3 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              重置数据卷
            </button>
          </Row>
          <Row label="删除此应用" hint="停止并移除全部容器、网络、本地配置与部署记录，且不可恢复。">
            <button
              type="button"
              onClick={onOpenDelete}
              className="h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash className="w-3.5 h-3.5" />
              删除应用
            </button>
          </Row>
        </div>
      </section>

      {/* Save bar */}
      {dirty && (
        <div className="sticky bottom-4 z-20 animate-in fade-in slide-in-from-bottom-2">
          <div className="surface-pop rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted flex items-center gap-2">
              <span className="status-dot !w-1.5 !h-1.5 text-amber-500" />
              有未保存的设置更改
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft(saved)}
                disabled={saving}
                className="btn-vessel-ghost h-8 px-3 rounded-xl text-xs"
              >
                放弃
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-vessel-primary h-8 px-4 rounded-xl text-xs"
              >
                {saving ? '保存中…' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
