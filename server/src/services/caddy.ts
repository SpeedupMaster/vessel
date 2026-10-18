import fs from 'fs';
import tls from 'node:tls';
import http from 'node:http';
import { validateDomain } from '../middleware/validation.js';
import path from 'path';
import { DATA_DIR, db } from '../db/index.js';
import { DomainItem } from '../types/index.js';

export class CaddyService {
  private caddyApiUrl = process.env.CADDY_API || 'http://127.0.0.1:2019';
  // The certificate Caddy actually serves; probing the public name would hit a CDN edge (e.g. Cloudflare's proxy)
  private tlsProbeHost = process.env.CADDY_TLS_HOST || '127.0.0.1';
  private caddyfilePath = path.join(DATA_DIR, 'Caddyfile');
  private caddyProcess: any = null;
  private certificateChecks = new Map<string, { at: number; result: { status: 'active' | 'issuing' | 'expired' | 'error' | 'unknown'; issuer: string; expiresAt?: string } }>();
  private refreshingCertificates?: Promise<void>;

  constructor() {
    this.syncCaddyfile();
  }

  /**
   * Regenerate Caddyfile based on all active domains and default reverse proxies
   */
  public syncCaddyfile(): string {
    const domains = db.get('domains') || [];
    let content = `# Vessel Auto-Generated Caddyfile
# Automatic HTTPS & Let's Encrypt / ZeroSSL TLS provisioning

{
  admin 127.0.0.1:2019
  auto_https disable_redirects
}

# 默认基础反代：直接通过服务器 IP 访问 80 端口时，自动反向代理至 Vessel 控制台
:80 {
  reverse_proxy 127.0.0.1:3900 {
    header_up Host {host}
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
  }
}

`;

    for (const d of domains) {
      // If appId is 'vessel-system', it proxies directly to Vessel console at 127.0.0.1:3900
      const upstream = d.appId === 'vessel-system'
        ? '127.0.0.1:3900'
        : (d.targetType === 'internal'
            ? `${d.serviceName}:${d.targetPort}`
            : `${process.env.DOCKER_HOST_GATEWAY || "host.docker.internal"}:${d.targetPort}`);

      content += `${d.domain} {
  reverse_proxy ${upstream} {
    header_up Host {host}
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-For {remote_host}
    header_up X-Forwarded-Proto {scheme}
  }
}

`;
    }

    fs.writeFileSync(this.caddyfilePath, content, 'utf-8');
    void this.reloadCaddyApi(content).then(ok => { if (!ok) console.warn('[Caddy] Configuration reload failed; domains may not be active'); });
    return content;
  }

  /**
   * Ensure Caddy daemon is running in container / production environment
   */
  public async ensureDaemon(): Promise<void> {
    try {
      const res = await this.adminRequest('GET', '/config/', undefined, 1500);
      if (res.ok) {
        console.log('[Vessel] Caddy daemon API is active and reachable.');
        return;
      }
    } catch {}

    try {
      const { execFileSync, spawn } = await import('child_process');
      const bin = process.platform === 'win32' ? 'caddy.exe' : 'caddy';
      try {
        execFileSync(bin, ['version'], { stdio: 'ignore' });
      } catch {
        console.log('[Vessel] Caddy binary not detected in PATH; reverse proxy is unavailable.');
        return;
      }

      console.log(`[Vessel] Spawning Caddy reverse proxy daemon with config: ${this.caddyfilePath}`);
      this.caddyProcess = spawn(bin, ['run', '--config', this.caddyfilePath, '--adapter', 'caddyfile'], {
        stdio: 'inherit',
      });

      this.caddyProcess.on('error', (err: any) => {
        console.warn('[Vessel] Caddy daemon launch error:', err.message);
      });

      this.caddyProcess.on('exit', (code: number) => {
        console.log(`[Vessel] Caddy daemon exited with code ${code}`);
        this.caddyProcess = null;
      });
    } catch (e: any) {
      console.warn('[Vessel] Error checking Caddy daemon:', e.message);
    }
  }

  public stopDaemon(): void {
    if (this.caddyProcess) {
      try {
        this.caddyProcess.kill();
      } catch {}
      this.caddyProcess = null;
    }
  }

  /**
   * Attempt to push configuration to live Caddy admin API
   */
  public async reloadCaddyApi(caddyfileContent: string): Promise<boolean> {
    try {
      const res = await this.adminRequest('POST', '/load', caddyfileContent, 5000);
      if (!res.ok) console.warn(`[Caddy] Admin API rejected /load (${res.status}): ${res.body.slice(0, 500)}`);
      return res.ok;
    } catch {
      // Caddy daemon may not be directly reachable in dev mode, Caddyfile on disk is preserved
      return false;
    }
  }

  /**
   * Caddy's admin API refuses requests carrying Sec-Fetch-Mode without an allowed Origin, and Node's
   * fetch always sends `Sec-Fetch-Mode: cors`. Plain node:http sends only the headers given here.
   */
  private adminRequest(method: 'GET' | 'POST', pathname: string, body: string | undefined, timeout: number) {
    return new Promise<{ ok: boolean; status: number; body: string }>((resolve, reject) => {
      const url = new URL(pathname, this.caddyApiUrl);
      const req = http.request(url, {
        method,
        headers: body === undefined ? {} : { 'Content-Type': 'text/caddyfile', 'Content-Length': Buffer.byteLength(body) },
        timeout,
      }, res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          resolve({ ok: status >= 200 && status < 300, status, body: data });
        });
      });
      req.on('timeout', () => req.destroy(new Error('Caddy admin API timed out')));
      req.on('error', reject);
      req.end(body);
    });
  }

  /**
   * Inspect SSL certificate status for a given domain
   */
  public async checkCertStatus(domain: string): Promise<{
    status: 'active' | 'issuing' | 'expired' | 'error' | 'unknown'; issuer: string; expiresAt?: string;
  }> {
    validateDomain(domain);
    return new Promise(resolve => {
      let settled = false;
      const socket = tls.connect({ host: this.tlsProbeHost, port: 443, servername: domain, rejectUnauthorized: false });
      const finish = (result: { status: 'active' | 'expired' | 'error' | 'unknown'; issuer: string; expiresAt?: string }) => {
        if (settled) return;
        settled = true; socket.destroy(); resolve(result);
      };
      socket.setTimeout(4000, () => finish({ status: 'unknown', issuer: '未知' }));
      socket.once('error', () => finish({ status: 'unknown', issuer: '未知' }));
      socket.once('secureConnect', () => {
        const cert = socket.getPeerCertificate();
        const expiry = Date.parse(cert.valid_to);
        if (!cert.raw || !Number.isFinite(expiry)) return finish({ status: 'unknown', issuer: '未知' });
        const invalidHost = tls.checkServerIdentity(domain, cert);
        finish({ status: expiry <= Date.now() ? 'expired' : invalidHost || !socket.authorized ? 'error' : 'active',
          issuer: String(cert.issuer?.O || cert.issuer?.CN || '未知'), expiresAt: new Date(expiry).toISOString() });
      });
    });
  }

  public async refreshCertificateStatuses(): Promise<void> {
    if (this.refreshingCertificates) return this.refreshingCertificates;
    this.refreshingCertificates = (async () => {
      const pending = db.get('domains').filter(domain => Date.now() - (this.certificateChecks.get(domain.domain)?.at || 0) > 5 * 60 * 1000);
      for (let index = 0; index < pending.length; index += 4) {
        await Promise.all(pending.slice(index, index + 4).map(async domain => {
          const result = await this.checkCertStatus(domain.domain).catch(() => ({ status: 'unknown' as const, issuer: '未知', expiresAt: undefined }));
          this.certificateChecks.set(domain.domain, { at: Date.now(), result });
        }));
      }
      if (pending.length) db.set('domains', db.get('domains').map(domain => {
        const cached = this.certificateChecks.get(domain.domain);
        return cached ? { ...domain, sslStatus: cached.result.status, sslIssuer: cached.result.issuer, sslExpiresAt: cached.result.expiresAt } : domain;
      }));
    })();
    try { await this.refreshingCertificates; }
    finally { this.refreshingCertificates = undefined; }
  }

  public getCaddyfilePath(): string {
    return this.caddyfilePath;
  }
}

export const caddyService = new CaddyService();
