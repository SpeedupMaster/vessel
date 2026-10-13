import { createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { RegistryItem, AppItem } from '../types/index.js';
import { dockerService } from './docker.js';
import { runDocker } from './process.js';

const fingerprint = (values: string[]) => createHash('sha256').update(values.sort().join('|')).digest('hex');

export class RegistryService {
  public async testAndLogin(registry: RegistryItem): Promise<{ success: boolean; message: string }> {
    if (!registry.username || !registry.token || !/^[a-zA-Z0-9][a-zA-Z0-9.:/-]*$/.test(registry.server)) {
      return { success: false, message: 'Registry server, username and token are required' };
    }
    try {
      await runDocker(['login', registry.server, '-u', registry.username, '--password-stdin'], { input: registry.token, timeout: 15000 });
      this.updateRegistry(registry.id, { status: 'connected', lastTestedAt: new Date().toISOString(), errorMessage: undefined });
      return { success: true, message: `Successfully authenticated with ${registry.name}` };
    } catch (error: any) {
      this.updateRegistry(registry.id, { status: 'error', lastTestedAt: new Date().toISOString(), errorMessage: error.message });
      return { success: false, message: error.message };
    }
  }

  private updateRegistry(id: string, updates: Partial<RegistryItem>) {
    db.set('registries', db.get('registries').map(item => item.id === id ? { ...item, ...updates } : item));
  }

  private async runningImages(app: AppItem): Promise<{ service: string; tag: string; digest: string; os: string; arch: string; variant?: string }[]> {
    const { stdout } = await dockerService.compose(app, ['ps', '--all', '-q']);
    const ids = stdout.trim().split(/\s+/).filter(Boolean);
    if (!ids.length) return [];
    const containers = JSON.parse((await runDocker(['inspect', ...ids], { timeout: 10000 })).stdout);
    const images = [];
    for (const container of containers) {
      const [image] = JSON.parse((await runDocker(['image', 'inspect', container.Image], { timeout: 10000 })).stdout);
      images.push({ service: container.Config.Labels['com.docker.compose.service'], tag: container.Config.Image,
        digest: image.Id, os: image.Os, arch: image.Architecture, variant: image.Variant });
    }
    return images;
  }

  public async captureAppDigest(app: AppItem): Promise<void> {
    try {
      const images = await this.runningImages(app);
      if (images.length) db.updateApp(app.id, { currentDigest: fingerprint(images.map(image => `${image.service}:${image.digest}`)) });
    } catch (error) { console.warn('[Registry] Unable to capture local image digest', String(error)); }
  }

  public async checkAppUpdate(app: AppItem): Promise<{ hasUpdate: boolean; newDigest?: string; currentDigest?: string }> {
    try {
      const images = await this.runningImages(app);
      if (!images.length) return { hasUpdate: false };
      const local: string[] = [];
      const remote: string[] = [];
      for (const image of images) {
        local.push(`${image.service}:${image.digest}`);
        let manifest = JSON.parse((await runDocker(['manifest', 'inspect', image.tag], { timeout: 15000 })).stdout);
        if (manifest.manifests) {
          const descriptor = manifest.manifests.find((item: any) => item.platform?.os === image.os && item.platform?.architecture === image.arch &&
            (!image.variant || item.platform?.variant === image.variant));
          if (!descriptor) throw new Error('Remote image has no matching platform');
          const reference = image.tag.split('@')[0];
          const colon = reference.lastIndexOf(':');
          const repository = colon > reference.lastIndexOf('/') ? reference.slice(0, colon) : reference;
          manifest = JSON.parse((await runDocker(['manifest', 'inspect', `${repository}@${descriptor.digest}`], { timeout: 15000 })).stdout);
        }
        if (!manifest.config?.digest) throw new Error('Remote image has no configuration digest');
        remote.push(`${image.service}:${manifest.config.digest}`);
      }
      const currentDigest = fingerprint(local);
      const newDigest = fingerprint(remote);
      return { hasUpdate: currentDigest !== newDigest, currentDigest, newDigest };
    } catch (error) {
      console.warn(`[Registry] Update check failed for ${app.id}: ${String(error)}`);
      return { hasUpdate: false };
    }
  }
}

export const registryService = new RegistryService();
