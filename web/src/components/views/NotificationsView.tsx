import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  BellRinging,
  ChatCircleDots,
  ChatsCircle,
  ChatTeardropText,
  CheckCircle,
  CircleNotch,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  TelegramLogo,
  Trash,
  WebhooksLogo,
  XCircle,
} from '@phosphor-icons/react';
import { NotificationChannel, NotificationChannelType, NotificationEvent } from '../../types/index.js';
import { apiFetch } from '../../hooks/useData.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Modal } from '../common/Modal.js';
import { Switch } from '../common/Switch.js';
import { EmptyState } from '../common/EmptyState.js';
import { formatRelative } from './DeploymentsPanel.js';

const CHANNEL_META: Record<
  NotificationChannelType,
  { label: string; icon: React.ElementType; placeholder?: string; hint: string }
> = {
  feishu: {
    label: '飞书群机器人',
    icon: ChatCircleDots,
    placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...',
    hint: '群设置 → 群机器人 → 添加自定义机器人。若开启签名校验请改用关键词校验，关键词填写「Vessel」。',
  },
  dingtalk: {
    label: '钉钉群机器人',
    icon: ChatsCircle,
    placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...',
    hint: '安全设置请选择「自定义关键词」并填写「Vessel」，加签模式暂不支持。',
  },
  wecom: {
    label: '企业微信群机器人',
    icon: ChatTeardropText,
    placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...',
    hint: '群聊 → 添加群机器人，复制 Webhook 地址。',
  },
  telegram: {
    label: 'Telegram Bot',
    icon: TelegramLogo,
    hint: '通过 @BotFather 创建机器人获取 Token；Chat ID 可通过向机器人发消息后调用 getUpdates 获得。',
  },
  webhook: {
    label: '通用 Webhook',
    icon: WebhooksLogo,
    placeholder: 'https://example.com/hooks/vessel',
    hint: '以 POST JSON 发送 { event, title, message, appId, appName, timestamp }，可对接任意自建服务。',
  },
};

const EVENT_META: { value: NotificationEvent; label: string; hint: string }[] = [
  { value: 'deploy.failure', label: '部署失败', hint: '含失败原因摘要' },
  { value: 'deploy.success', label: '部署成功', hint: '需在应用中开启' },
  { value: 'update.available', label: '发现新版本镜像', hint: '每个新版本只提醒一次' },
  { value: 'backup.failure', label: '定时备份失败', hint: '系统快照与数据库备份' },
];

interface Draft {
  id?: string;
  name: string;
  type: NotificationChannelType;
  url: string;
  botToken: string;
  chatId: string;
  events: NotificationEvent[];
  enabled: boolean;
}

const emptyDraft = (): Draft => ({
  name: '',
  type: 'feishu',
  url: '',
  botToken: '',
  chatId: '',
  events: ['deploy.failure', 'update.available', 'backup.failure'],
  enabled: true,
});

const inputClass =
  'w-full min-h-[42px] bg-paper-2 dark:bg-paper-3 border border-line rounded-xl px-3.5 py-2 text-xs sm:text-sm text-ink placeholder:text-ink-faint/80 focus:outline-none transition-colors shadow-sm disabled:opacity-60';

export const NotificationsView: React.FC = () => {
  const { toast, confirm } = useNotification();
  const [channels, setChannels] = useState<NotificationChannel[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setChannels(await (await apiFetch('/api/notifications')).json());
    } catch (err: any) {
      setChannels((prev) => prev ?? []);
      toast.error(`加载通知渠道失败: ${err.message}`);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (body: Record<string, unknown>) => {
    const res = await apiFetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as NotificationChannel;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name.trim() || CHANNEL_META[draft.type].label,
        type: draft.type,
        events: draft.events,
        enabled: draft.enabled,
      };
      if (draft.type === 'telegram') {
        body.botToken = draft.botToken;
        body.chatId = draft.chatId;
      } else {
        body.url = draft.url;
      }
      await save(body);
      toast.success(draft.id ? '通知渠道已更新' : '通知渠道已添加');
      setDraft(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (channel: NotificationChannel, enabled: boolean) => {
    setChannels((prev) => prev?.map((c) => (c.id === channel.id ? { ...c, enabled } : c)) ?? prev);
    try {
      await save({ id: channel.id, enabled });
    } catch (err: any) {
      toast.error(err.message);
      await load();
    }
  };

  const handleTest = async (channel: NotificationChannel) => {
    setTestingId(channel.id);
    try {
      const res = await (await apiFetch(`/api/notifications/${channel.id}/test`, { method: 'POST' })).json();
      if (res.success) toast.success(`测试消息已发送到「${channel.name}」`);
      else toast.error(`发送失败: ${res.error}`);
      if (res.channel) setChannels((prev) => prev?.map((c) => (c.id === channel.id ? res.channel : c)) ?? prev);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (channel: NotificationChannel) => {
    const ok = await confirm({
      title: '删除通知渠道',
      message: `确定删除「${channel.name}」？之后的事件不会再推送到这里。`,
      confirmText: '删除',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/notifications/${channel.id}`, { method: 'DELETE' });
      setChannels((prev) => prev?.filter((c) => c.id !== channel.id) ?? prev);
      toast.success('通知渠道已删除');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openEdit = (channel: NotificationChannel) =>
    setDraft({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      url: channel.url,
      botToken: channel.botToken || '',
      chatId: channel.chatId || '',
      events: channel.events,
      enabled: channel.enabled,
    });

  const meta = draft ? CHANNEL_META[draft.type] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink tracking-tight">通知渠道</h2>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed max-w-xl">
            部署失败、发现新版本、备份失败时推送消息。每个应用可在「高级设置 → 通知」中选择要推送的事件。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft())}
          className="btn-vessel-primary h-9 px-4 rounded-xl text-xs gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" weight="bold" />
          添加渠道
        </button>
      </div>

      {channels === null ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-[150px] rounded-2xl" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <EmptyState
          icon={<BellRinging className="w-5 h-5" />}
          title="还没有通知渠道"
          description="支持飞书、钉钉、企业微信群机器人、Telegram 与通用 Webhook。"
          action={
            <button type="button" onClick={() => setDraft(emptyDraft())} className="btn-vessel-primary h-9 px-4 rounded-xl text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" weight="bold" />
              添加第一个渠道
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const Icon = CHANNEL_META[channel.type].icon;
            return (
              <div key={channel.id} className={clsx('card-vessel p-4 flex flex-col gap-3.5 transition-opacity', !channel.enabled && 'opacity-70')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-paper-3 border border-line-subtle flex items-center justify-center text-ink shrink-0">
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{channel.name}</div>
                      <div className="text-[11px] text-ink-faint mt-0.5 truncate">
                        {CHANNEL_META[channel.type].label}
                        {channel.type === 'telegram' ? ` · Chat ${channel.chatId}` : channel.url ? ` · ${channel.url.replace(/\/•+$/, '')}` : ''}
                      </div>
                    </div>
                  </div>
                  <Switch checked={channel.enabled} onChange={(v) => handleToggle(channel, v)} size="sm" aria-label={`启用 ${channel.name}`} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {EVENT_META.filter((e) => channel.events.includes(e.value)).map((e) => (
                    <span key={e.value} className="text-[10.5px] px-2 py-0.5 rounded-full border border-line bg-paper-3/60 text-ink-muted">
                      {e.label}
                    </span>
                  ))}
                  {channel.events.length === 0 && <span className="text-[11px] text-ink-faint">未订阅任何事件</span>}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-line-subtle">
                  <div className="text-[11px] text-ink-faint min-w-0 flex items-center gap-1.5">
                    {channel.lastStatus === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" weight="fill" />
                    ) : channel.lastStatus === 'failed' ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" weight="fill" />
                    ) : null}
                    <span className="truncate" title={channel.lastError}>
                      {channel.lastSentAt
                        ? `${formatRelative(channel.lastSentAt)}${channel.lastStatus === 'failed' ? ` · ${channel.lastError || '发送失败'}` : ' · 发送成功'}`
                        : '尚未发送过消息'}
                    </span>
                  </div>
                  <div className="term-tools shrink-0">
                    <button type="button" onClick={() => handleTest(channel)} disabled={testingId === channel.id} className="term-btn">
                      {testingId === channel.id ? <CircleNotch className="w-3.5 h-3.5 animate-spin" /> : <PaperPlaneTilt className="w-3.5 h-3.5" />}
                      <span>测试</span>
                    </button>
                    <button type="button" onClick={() => openEdit(channel)} className="term-btn" aria-label="编辑" data-tooltip="编辑">
                      <PencilSimple className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDelete(channel)} className="term-btn hover:!text-rose-500" aria-label="删除" data-tooltip="删除">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!draft}
        onClose={() => !saving && setDraft(null)}
        title={draft?.id ? '编辑通知渠道' : '添加通知渠道'}
        subtitle="密钥只保存在本机，列表中会以掩码显示"
        maxWidth="max-w-lg"
      >
        {draft && meta && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink/85 mb-1.5">渠道类型</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(CHANNEL_META) as NotificationChannelType[]).map((type) => {
                  const TypeIcon = CHANNEL_META[type].icon;
                  const active = draft.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={!!draft.id}
                      onClick={() => setDraft({ ...draft, type })}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors text-left',
                        active ? 'border-signal-ring bg-signal-soft text-ink font-medium' : 'border-line text-ink-muted hover:text-ink hover:bg-paper-3/60',
                        draft.id && !active && 'opacity-40 cursor-not-allowed',
                        !draft.id && 'cursor-pointer'
                      )}
                    >
                      <TypeIcon className={clsx('w-4 h-4 shrink-0', active && 'text-signal')} />
                      <span className="truncate">{CHANNEL_META[type].label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-faint mt-2 leading-relaxed">{meta.hint}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/85 mb-1.5">名称</label>
              <input
                className={inputClass}
                value={draft.name}
                maxLength={60}
                placeholder={meta.label}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>

            {draft.type === 'telegram' ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">Bot Token</label>
                  <input
                    className={clsx(inputClass, 'font-mono')}
                    value={draft.botToken}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="123456:ABC-DEF..."
                    onChange={(e) => setDraft({ ...draft, botToken: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/85 mb-1.5">Chat ID</label>
                  <input
                    className={clsx(inputClass, 'font-mono')}
                    value={draft.chatId}
                    spellCheck={false}
                    placeholder="-1001234567890"
                    onChange={(e) => setDraft({ ...draft, chatId: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-ink/85 mb-1.5">Webhook 地址</label>
                <input
                  className={clsx(inputClass, 'font-mono')}
                  value={draft.url}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={meta.placeholder}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                />
                {draft.id && <p className="text-[11px] text-ink-faint mt-1.5">保持掩码不变即沿用原地址。</p>}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink/85 mb-1.5">订阅事件</label>
              <div className="grid sm:grid-cols-2 gap-2">
                {EVENT_META.map((event) => {
                  const checked = draft.events.includes(event.value);
                  return (
                    <label
                      key={event.value}
                      className={clsx(
                        'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
                        checked ? 'border-signal-ring bg-signal-soft' : 'border-line hover:bg-paper-3/60'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            events: checked ? draft.events.filter((e) => e !== event.value) : [...draft.events, event.value],
                          })
                        }
                        className="mt-0.5 accent-[var(--color-signal)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-ink">{event.label}</span>
                        <span className="block text-[11px] text-ink-faint mt-0.5">{event.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDraft(null)} disabled={saving} className="btn-vessel-ghost h-9 px-4 rounded-xl text-xs">
                取消
              </button>
              <button type="submit" disabled={saving} className="btn-vessel-primary h-9 px-4 rounded-xl text-xs gap-1.5">
                {saving && <CircleNotch className="w-3.5 h-3.5 animate-spin" />}
                {draft.id ? '保存' : '添加渠道'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
