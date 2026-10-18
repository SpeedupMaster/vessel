import fs from 'fs';
import os from 'os';
import path from 'path';
import { APPS_DATA_DIR, DATA_DIR } from '../db/index.js';
import { runDocker } from './process.js';

// Same rule the installer applies to VESSEL_INSTALL_DIR
const HOST_PATH_PATTERN = /^\/[a-zA-Z0-9_./-]+$/;
export const isHostPath = (value: string) => HOST_PATH_PATTERN.test(value) && !value.split('/').includes('..');

/**
 * Compose runs inside the Vessel container but the Docker daemon resolves bind mounts on the host.
 * A relative bind such as `./files:/data` would otherwise become `/app/data/apps/<id>/files` on the
 * host, outside the mounted data directory. Exposing the data directory inside the container under
 * its host path (e.g. /opt/vessel/data -> /app/data) lets Compose run from a directory whose path is
 * valid on both sides.
 */
class HostPathService {
  private appsRoot = APPS_DATA_DIR;
  private hostDataDir: string | null = null;
  private settled = false;
  private pending: Promise<void> | null = null;

  /** Directory Compose projects run from: the host path of the apps directory when it is mirrored. */
  appsDir() {
    return this.appsRoot;
  }

  hostDataPath() {
    return this.hostDataDir;
  }

  /** Resolves the mapping once; retried on the next Compose run while Docker is unreachable. */
  ready() {
    if (this.settled) return Promise.resolve();
    this.pending ??= this.init().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async detectHostDataDir(): Promise<string | null> {
    const configured = process.env.VESSEL_HOST_DATA_DIR;
    if (configured) return configured;
    const hostname = os.hostname();
    let info: any;
    try {
      const { stdout } = await runDocker(['container', 'inspect', hostname], { timeout: 15000 });
      info = JSON.parse(stdout)[0];
    } catch {
      // Docker offline, or not running in a container (development): nothing to mirror yet
      return null;
    }
    this.settled = true;
    // A hostname that names some other container
    if (!info?.Id?.startsWith(hostname) && info?.Config?.Hostname !== hostname) return null;
    const mount = (info.Mounts || []).find((m: any) => path.posix.normalize(m.Destination || '') === DATA_DIR);
    return mount?.Source || null;
  }

  async init() {
    const source = await this.detectHostDataDir();
    if (process.env.VESSEL_HOST_DATA_DIR) this.settled = true;
    if (!source || source === DATA_DIR) return;
    if (!isHostPath(source)) {
      console.warn(`[Vessel] Data directory host path ${source} is not usable inside the container; relative Compose mounts resolve outside it`);
      return;
    }
    try {
      if (!fs.existsSync(source)) {
        fs.mkdirSync(path.dirname(source), { recursive: true });
        fs.symlinkSync(DATA_DIR, source, 'dir');
      } else if (fs.realpathSync(source) !== fs.realpathSync(DATA_DIR)) {
        console.warn(`[Vessel] ${source} already exists inside the container and is not the data directory; relative Compose mounts resolve outside it`);
        return;
      }
    } catch (error: any) {
      console.warn(`[Vessel] Could not expose the data directory at ${source}: ${error?.message || error}`);
      return;
    }
    this.hostDataDir = source;
    this.appsRoot = path.posix.join(source, path.basename(APPS_DATA_DIR));
    console.log(`[Vessel] Compose projects run from ${this.appsRoot} so relative mounts land in the host data directory`);
  }
}

export const hostPathService = new HostPathService();
