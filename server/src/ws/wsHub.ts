import { WebSocketServer, WebSocket } from 'ws';
import type { Server, IncomingMessage } from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';
import { DATA_DIR, db } from '../db/index.js';
import { dockerService } from '../services/docker.js';
import { authService } from '../services/auth.js';
import { appEvents } from '../services/appOperations.js';
import { SystemMetrics } from '../types/index.js';

interface ClientMeta { token: string; subscriptions: Set<string> }
function requestToken(request: IncomingMessage) {
  return request.headers['sec-websocket-protocol']?.split(',').map(item => item.trim()).find(item => item.startsWith('auth.'))?.slice(5) || '';
}

export class WsHub {
  private wss?: WebSocketServer;
  private clients = new Map<WebSocket, ClientMeta>();
  private metricsTimer?: NodeJS.Timeout;
  private collecting = false;
  private previousCpu = os.cpus();
  private changed = () => this.broadcast({ type: 'apps-changed' });

  public init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192,
      verifyClient: (info: { origin: string; req: IncomingMessage }) => {
        const origin = info.origin;
        if (origin) {
          try { if (new URL(origin).host !== info.req.headers.host) return false; } catch { return false; }
        }
        return authService.verifyToken(requestToken(info.req)).valid && !authService.isDefaultPassword();
      },
      handleProtocols: protocols => protocols.has('vessel') ? 'vessel' : false,
    });
    this.wss.on('connection', (ws, request) => {
      this.clients.set(ws, { token: requestToken(request), subscriptions: new Set(['metrics']) });
      ws.on('error', () => ws.terminate());
      ws.on('message', message => {
        if (!this.authorized(ws)) return;
        try {
          const data = JSON.parse(message.toString());
          const meta = this.clients.get(ws)!;
          if (typeof data.channel !== 'string') return;
          const valid = data.channel === 'metrics' || (data.channel.startsWith('logs:') && db.get('apps').some(app => `logs:${app.id}` === data.channel));
          if (!valid) return;
          if (data.type === 'subscribe') meta.subscriptions.add(data.channel);
          else if (data.type === 'unsubscribe') meta.subscriptions.delete(data.channel);
        } catch { ws.close(1008, 'Invalid message'); }
      });
      ws.on('close', () => this.clients.delete(ws));
      void this.broadcastMetrics();
    });
    appEvents.on('changed', this.changed);
    this.metricsTimer = setInterval(() => { void this.broadcastMetrics(); }, 5000);
  }

  private authorized(ws: WebSocket): boolean {
    const meta = this.clients.get(ws);
    if (!meta || !authService.verifyToken(meta.token).valid || authService.isDefaultPassword()) {
      ws.close(1008, 'Session expired');
      return false;
    }
    return true;
  }

  private broadcast(value: unknown, channel?: string): void {
    const payload = JSON.stringify(value);
    for (const [ws, meta] of this.clients) {
      if (!this.authorized(ws)) continue;
      if (ws.readyState !== WebSocket.OPEN || (channel && !meta.subscriptions.has(channel))) continue;
      if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); continue; }
      ws.send(payload);
    }
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const [counts, disk] = await Promise.all([
      dockerService.getEngineCounts().catch(() => null), fs.statfs(DATA_DIR).catch(() => null),
    ]);
    const cpus = os.cpus();
    let total = 0, idle = 0;
    cpus.forEach((cpu, index) => {
      const previous = this.previousCpu[index];
      if (!previous) return;
      for (const key of Object.keys(cpu.times) as (keyof typeof cpu.times)[]) total += cpu.times[key] - previous.times[key];
      idle += cpu.times.idle - previous.times.idle;
    });
    this.previousCpu = cpus;
    return {
      cpuUsage: total > 0 ? Math.round(100 * (1 - idle / total)) : 0,
      memUsedBytes: os.totalmem() - os.freemem(), memTotalBytes: os.totalmem(),
      diskUsedBytes: disk ? (disk.blocks - disk.bfree) * disk.bsize : null,
      diskTotalBytes: disk ? disk.blocks * disk.bsize : null,
      dockerStatus: counts ? 'running' : 'disconnected',
      runningContainers: counts?.runningContainers ?? null, totalImages: counts?.totalImages ?? null,
      totalApps: db.get('apps').length, activeDomains: db.get('domains').length, totalBackups: db.get('backups').length,
    };
  }

  public async broadcastMetrics(): Promise<void> {
    if (!this.clients.size || this.collecting) return;
    this.collecting = true;
    try { this.broadcast({ type: 'metrics', data: await this.collectMetrics() }, 'metrics'); }
    catch (error) { console.error('[Metrics]', error); }
    finally { this.collecting = false; }
  }

  public broadcastLog(appId: string, text: string): void { this.broadcast({ type: 'log', appId, text }, `logs:${appId}`); }

  public destroy(): void {
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    appEvents.off('changed', this.changed);
    for (const ws of this.clients.keys()) ws.terminate();
    this.clients.clear();
    this.wss?.close();
  }
}

export const wsHub = new WsHub();
