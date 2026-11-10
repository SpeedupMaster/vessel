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
import { formatRelative } from '../../utils/format.js';

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
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-muted max-w-2xl">
          支持飞书、钉钉、企业微信群机器人、Telegram 与通用 Webhook。每个应用可在其「设置」里选择推送的事件。
        </p>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft())}
          className="btn-vessel-primary shrink-0 min-h-[40px] px-3.5 text-[13px] inline-flex items-center gap-1.5 rounded-xl cursor-pointer"
        >
          <Plus className="w-4 h-4" weight="bold" />
          添加渠道
        </button>
      </div>

      <section aria-label="通知渠道" className="card-vessel !cursor-default overflow-hidden">
        {channels === null ? (
          <div className="p-4 space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="p-3 sm:p-4">
            <EmptyState
              icon={<BellRinging className="w-5 h-5" />}
              title="还没有通知渠道"
              description="部署失败、发现新版本、备份失败时推送消息到你的群聊或自建服务。"
              action={
                <button
                  type="button"
                  onClick={() => setDraft(emptyDraft())}
                  className="btn-vessel-primary text-xs px-3.5 py-2 gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" weight="bold" />
                  添加第一个渠道
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden md:grid grid-cols-[52px_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-4 px-5 h-10 items-center text-xs text-ink-faint border-b border-line-subtle"
            >
              <span>启用</span>
              <span>渠道</span>
              <span>订阅事件</span>
              <span>最近发送</span>
              <span className="w-[164px] text-right">操作</span>
            </div>
            <ul className="divide-y divide-line-subtle">
              {channels.map((channel) => {
                const Icon = CHANNEL_META[channel.type].icon;
                const subscribed = EVENT_META.filter((e) => channel.events.includes(e.value));
                return (
                  <li
                    key={channel.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[52px_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 sm:px-5 py-3 items-center"
                  >
                    <div className="row-span-2 md:row-span-1 self-start md:self-center pt-1.5 md:pt-0">
                      <Switch
                        checked={channel.enabled}
                        onChange={(v) => handleToggle(channel, v)}
                        size="sm"
                        aria-label={`启用 ${channel.name}`}
                      />
                    </div>

                    <div className={clsx('min-w-0 flex items-center gap-2.5', !channel.enabled && 'opacity-60')}>
                      <span className="w-8 h-8 rounded-lg bg-paper-3 text-ink flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate">{channel.name}</p>
                        <p className="text-[11px] text-ink-faint truncate">
                          {CHANNEL_META[channel.type].label}
                          {channel.type === 'telegram' && channel.chatId ? ` · ${channel.chatId}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className={clsx('min-w-0 col-start-2 md:col-start-auto flex flex-wrap gap-1', !channel.enabled && 'opacity-60')}>
                      {subscribed.map((e) => (
                        <span key={e.value} className="text-[11px] px-2 py-0.5 rounded-md bg-paper-3 text-ink-muted">
                          {e.label}
                        </span>
                      ))}
                      {subscribed.length === 0 && <span className="text-[11px] text-ink-faint">未订阅任何事件</span>}
                    </div>

                    <div className="min-w-0 col-start-2 md:col-start-auto text-xs text-ink-muted flex items-center gap-1.5">
                      {channel.lastStatus === 'success' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" weight="fill" />
                      ) : channel.lastStatus === 'failed' ? (
                        <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" weight="fill" />
                      ) : null}
                      <span className="truncate" title={channel.lastError}>
                        {channel.lastSentAt
                          ? `${formatRelative(channel.lastSentAt)}${channel.lastStatus === 'failed' ? ` · ${channel.lastError || '发送失败'}` : ''}`
                          : '尚未发送'}
                      </span>
                    </div>

                    <div className="col-start-2 md:col-start-auto flex items-center justify-end gap-1 -my-1">
                      <button
                        type="button"
                        onClick={() => handleTest(channel)}
                        disabled={testingId === channel.id}
                        className="btn-vessel-secondary min-h-[34px] !px-2.5 text-xs inline-flex items-center gap-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                      >
                        {testingId === channel.id ? (
                          <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PaperPlaneTilt className="w-3.5 h-3.5" />
                        )}
                        发送测试
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(channel)}
                        aria-label={`编辑 ${channel.name}`}
                        data-tooltip="编辑"
                        className="w-9 h-9 rounded-lg text-ink-muted hover:text-ink hover:bg-paper-3 flex items-center justify-center cursor-pointer"
                      >
                        <PencilSimple className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(channel)}
                        aria-label={`删除 ${channel.name}`}
                        data-tooltip="删除"
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
              共 {channels.length} 个渠道 · {channels.filter((c) => c.enabled).length} 个启用
            </div>
          </>
        )}
      </section>

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
