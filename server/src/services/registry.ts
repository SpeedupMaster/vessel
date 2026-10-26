import { createHash } from 'node:crypto';
import { db } from '../db/index.js';
import { RegistryItem, AppItem } from '../types/index.js';
import { dockerService } from './docker.js';
import { runDocker } from './process.js';

const fingerprint = (values: string[]) => createHash('sha256').update(values.sort().join('|')).digest('hex');

interface RunningImage {
  service: string;
  tag: string;
  digest: string;
  repoDigests: string[];
  manifestDigest?: string;
  os: string;
  arch: string;
  variant?: string;
}

interface ImageManifest {
  config?: { digest?: string };
  manifests?: { digest?: string; platform?: { os?: string; architecture?: string; variant?: string } }[];
}

export interface AppUpdateCheck {
  hasUpdate: boolean;
  updatedServices: string[];
  currentDigest?: string;
  newDigest?: string;
  errors: string[];
}

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

  private async runningImages(app: AppItem): Promise<RunningImage[]> {
    const { stdout } = await dockerService.compose(app, ['ps', '--all', '-q']);
    const ids = stdout.trim().split(/\s+/).filter(Boolean);
    if (!ids.length) return [];
    const containers = JSON.parse((await runDocker(['inspect', ...ids], { timeout: 10000 })).stdout);
    const images: RunningImage[] = [];
    const seenImages = new Set<string>();
    for (const container of containers) {
      const service = container.Config.Labels?.['com.docker.compose.service'] || container.Name?.replace(/^\//, '') || 'default';
      const key = `${service}:${container.Image}`;
      if (seenImages.has(key)) continue;
      seenImages.add(key);
      const [image] = JSON.parse((await runDocker(['image', 'inspect', container.Image], { timeout: 10000 })).stdout);
      const rawRepoDigests: string[] = Array.isArray(image.RepoDigests) ? image.RepoDigests : [];
      const repoDigests = rawRepoDigests.map((rd: string) => rd.includes('@') ? rd.split('@')[1] : rd).filter(Boolean);
      images.push({
        service,
        tag: container.Config.Image,
        digest: image.Id,
        repoDigests,
        manifestDigest: image.Descriptor?.digest || (repoDigests.includes(image.Id) ? image.Id : undefined),
        os: image.Os || 'linux',
        arch: image.Architecture || 'amd64',
        variant: image.Variant,
      });
    }
    return images;
  }

  public async captureAppDigest(app: AppItem): Promise<void> {
    try {
      const images = await this.runningImages(app);
      if (images.length) {
        const currentDigest = fingerprint(images.map(image => `${image.service}:${image.digest}`));
        db.updateApp(app.id, { currentDigest, latestDigest: currentDigest, updateAvailable: false });
      }
    } catch (error) { console.warn('[Registry] Unable to capture local image digest', String(error)); }
  }

  private repository(reference: string): string {
    const name = reference.split('@')[0];
    const colon = name.lastIndexOf(':');
    return colon > name.lastIndexOf('/') ? name.slice(0, colon) : name;
  }

  private async inspectManifest(reference: string): Promise<ImageManifest> {
    return JSON.parse((await runDocker(['manifest', 'inspect', reference], { timeout: 15000 })).stdout);
  }

  private platformDigest(manifest: ImageManifest, image: RunningImage): string {
    const descriptor = manifest.manifests?.find(item =>
      item.platform?.os === image.os &&
      item.platform?.architecture === image.arch &&
      (!image.variant || item.platform?.variant === image.variant)
    );
    if (!descriptor?.digest) throw new Error('Remote image has no matching platform digest');
    return descriptor.digest;
  }

  private async configDigest(reference: string, image: RunningImage, manifest?: ImageManifest): Promise<string> {
    manifest = manifest || await this.inspectManifest(reference);
    if (manifest.manifests) {
      const digest = this.platformDigest(manifest, image);
      manifest = await this.inspectManifest(`${this.repository(reference)}@${digest}`);
    }
    if (!manifest.config?.digest) throw new Error('Image manifest has no config digest');
    return manifest.config.digest;
  }

  private async remoteImageDigest(image: RunningImage): Promise<string> {
    // Digest-pinned references cannot move to another version.
    if (image.tag.includes('@')) return image.digest;
    const manifest = await this.inspectManifest(image.tag);
    if (manifest.manifests) {
      const digest = this.platformDigest(manifest, image);
      if (image.repoDigests.includes(digest) || image.manifestDigest === digest) return image.digest;
    }
    const remoteConfig = await this.configDigest(image.tag, image, manifest);
    // The classic image store exposes the config as image.Id. The containerd
    // store can expose an index/manifest instead; resolve its immutable digest
    // rather than comparing different digest kinds or a locally retagged image.
    const localConfig = image.manifestDigest
      ? await this.configDigest(`${this.repository(image.tag)}@${image.manifestDigest}`, image)
      : image.digest;
    return remoteConfig === localConfig ? image.digest : remoteConfig;
  }

  public async checkAppUpdate(app: AppItem): Promise<AppUpdateCheck> {
    try {
      const images = await this.runningImages(app);
      if (!images.length) return { hasUpdate: false, updatedServices: [], errors: [] };
      const local: string[] = [];
      const remote: string[] = [];
      const updatedServices = new Set<string>();
      const errors: string[] = [];

      for (const image of images) {
        local.push(`${image.service}:${image.digest}`);
        try {
          const digest = await this.remoteImageDigest(image);
          remote.push(`${image.service}:${digest}`);
          if (digest !== image.digest) updatedServices.add(image.service);
        } catch (error) {
          const message = `${image.service}: ${String(error)}`;
          console.warn(`[Registry] Update check failed for ${app.id} (${message})`);
          errors.push(message);
        }
      }

      const currentDigest = fingerprint(local);
      // An incomplete inspection must neither trigger upgrades nor clear an
      // existing update indication as if the app had been verified up to date.
      if (errors.length) return { hasUpdate: false, updatedServices: [], currentDigest, errors };
      return { hasUpdate: updatedServices.size > 0, updatedServices: [...updatedServices], currentDigest, newDigest: fingerprint(remote), errors };
    } catch (error) {
      console.warn(`[Registry] Update check failed for ${app.id}: ${String(error)}`);
      return { hasUpdate: false, updatedServices: [], errors: [String(error)] };
    }
  }
}

export const registryService = new RegistryService();
