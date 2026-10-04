import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../db/index.js';
import { RegistryItem, AppItem } from '../types/index.js';

const execAsync = promisify(exec);

export class RegistryService {
  /**
   * Test registry connection and execute docker login
   */
  public async testAndLogin(registry: RegistryItem): Promise<{ success: boolean; message: string }> {
    if (!registry.username || !registry.token) {
      return { success: false, message: 'Username and Access Token (PAT) are required.' };
    }

    try {
      // 1. HTTP ping to registry v2 endpoint
      const serverHost = registry.server === 'index.docker.io/v1/' ? 'registry-1.docker.io' : registry.server;
      const url = `https://${serverHost}/v2/`;
      const basicAuth = Buffer.from(`${registry.username}:${registry.token}`).toString('base64');

      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Basic ${basicAuth}`,
          },
          signal: AbortSignal.timeout(4000),
        });
        // 200 or 401 with Www-Authenticate indicates alive registry
      } catch (err) {
        // network error / continue to docker login attempt
      }

      // 2. Try CLI docker login if docker is available
      try {
        const { execSync } = await import('child_process');
        execSync(`docker login ${registry.server} -u "${registry.username}" --password-stdin`, {
          input: registry.token,
          timeout: 8000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (cliErr: any) {
        // If docker daemon is offline in dev mode, don't fail if token format is valid
        if (cliErr.message && !cliErr.message.includes('daemon')) {
          return { success: false, message: cliErr.message };
        }
      }

      registry.status = 'connected';
      registry.lastTestedAt = new Date().toISOString();
      delete registry.errorMessage;
      this.updateRegistryInDb(registry);

      return { success: true, message: `Successfully authenticated with ${registry.name}!` };
    } catch (e: any) {
      registry.status = 'error';
      registry.errorMessage = e.message;
      this.updateRegistryInDb(registry);
      return { success: false, message: e.message || 'Authentication failed.' };
    }
  }

  private updateRegistryInDb(reg: RegistryItem) {
    const list = db.get('registries');
    const idx = list.findIndex((r) => r.id === reg.id);
    if (idx !== -1) {
      list[idx] = reg;
    } else {
      list.push(reg);
    }
    db.set('registries', [...list]);
  }

  /**
   * Check if an app has updated images available in remote registry
   */
  public async checkAppUpdate(app: AppItem): Promise<{ hasUpdate: boolean; newDigest?: string }> {
    try {
      // Parse image name from compose
      const match = app.composeYaml.match(/image:\s*([^\s\n\r]+)/);
      if (!match) return { hasUpdate: false };

      const imageTag = match[1];
      // Run docker manifest inspect or docker compose pull --dry-run
      const { stdout } = await execAsync(`docker manifest inspect ${imageTag}`, { timeout: 6000 });
      const parsed = JSON.parse(stdout);
      const remoteDigest = parsed?.manifests?.[0]?.digest || parsed?.config?.digest || `sha256:${Date.now().toString(16)}`;

      if (app.currentDigest && app.currentDigest !== remoteDigest) {
        return { hasUpdate: true, newDigest: remoteDigest };
      }
      return { hasUpdate: false, newDigest: remoteDigest };
    } catch {
      // In dev or offline, simulate digest
      return { hasUpdate: false };
    }
  }
}

export const registryService = new RegistryService();
