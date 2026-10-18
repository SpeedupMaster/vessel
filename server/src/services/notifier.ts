import { db } from '../db/index.js';
import { NotificationChannel, NotificationChannelType, NotificationEvent } from '../types/index.js';

export interface NotificationPayload {
  event: NotificationEvent;
  title: string;
  message: string;
  appId?: string;
  appName?: string;
}

export const CHANNEL_TYPES: NotificationChannelType[] = ['webhook', 'telegram', 'feishu', 'dingtalk', 'wecom'];
export const NOTIFICATION_EVENTS: NotificationEvent[] = ['deploy.success', 'deploy.failure', 'update.available', 'backup.failure'];

const MASK = '••••••••';
const SEND_TIMEOUT_MS = 8000;

/** Keep the origin visible so the user can still tell which service a channel points at */
function maskUrl(url: string): string {
  if (!url) return '';
  try { return `${new URL(url).origin}/${MASK}`; } catch { return MASK; }
}

export function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('••');
}

export function maskChannel(channel: NotificationChannel): NotificationChannel {
  return {
    ...channel,
    url: channel.type === 'telegram' ? '' : maskUrl(channel.url),
    botToken: channel.botToken ? MASK : '',
  };
}

function request(channel: NotificationChannel, payload: NotificationPayload): { url: string; body: unknown } {
  const text = `【Vessel】${payload.title}\n${payload.message}`;
  switch (channel.type) {
    case 'telegram':
      return {
        url: `https://api.telegram.org/bot${channel.botToken}/sendMessage`,
        body: { chat_id: channel.chatId, text, disable_web_page_preview: true },
      };
    case 'feishu':
      return { url: channel.url, body: { msg_type: 'text', content: { text } } };
    case 'dingtalk':
    case 'wecom':
      return { url: channel.url, body: { msgtype: 'text', text: { content: text } } };
    default:
      return {
        url: channel.url,
        body: {
          event: payload.event,
          title: payload.title,
          message: payload.message,
          appId: payload.appId,
          appName: payload.appName,
          timestamp: new Date().toISOString(),
        },
      };
  }
}

export class NotifierService {
  /** Deliver to one channel and record the outcome on it. Never throws. */
  public async send(channel: NotificationChannel, payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
    let outcome: { success: boolean; error?: string };
    try {
      const { url, body } = request(channel, payload);
      if (!/^https?:\/\//i.test(url)) throw new Error('通知地址必须以 http:// 或 https:// 开头');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}${raw ? `: ${raw.slice(0, 160)}` : ''}`);
      // Feishu / DingTalk / WeCom answer 200 with an error code in the body
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const code = parsed?.errcode ?? parsed?.code ?? parsed?.StatusCode;
      if (channel.type !== 'webhook' && code !== undefined && code !== 0) {
        throw new Error(String(parsed?.errmsg || parsed?.msg || parsed?.description || `错误码 ${code}`));
      }
      if (channel.type === 'telegram' && parsed && parsed.ok === false) throw new Error(String(parsed.description || 'Telegram 拒绝了请求'));
      outcome = { success: true };
    } catch (error: any) {
      outcome = { success: false, error: error?.name === 'TimeoutError' ? '请求超时' : String(error?.message || error) };
    }
    db.set('notifications', db.get('notifications').map(item => item.id === channel.id
      ? { ...item, lastSentAt: new Date().toISOString(), lastStatus: outcome.success ? 'success' as const : 'failed' as const, lastError: outcome.error }
      : item));
    return outcome;
  }

  /** Fan out to every enabled channel subscribed to the event. Never throws. */
  public async notify(payload: NotificationPayload): Promise<void> {
    const channels = (db.get('notifications') || []).filter(channel => channel.enabled && channel.events.includes(payload.event));
    if (!channels.length) return;
    const results = await Promise.allSettled(channels.map(channel => this.send(channel, payload)));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && !result.value.success) {
        console.warn(`[Notifier] ${channels[index].name}: ${result.value.error}`);
      }
    });
  }
}

export const notifier = new NotifierService();
