import fs from 'fs';
import os from 'os';
import path from 'path';
import { DATA_DIR } from '../db/index.js';
import { runDocker } from './process.js';
import { withAppLock, hasActiveOperations } from './appOperations.js';
import { notifier } from './notifier.js';

// The image runs from /app and `pnpm dev` from server/; both reach server/package.json
export const CURRENT_VERSION: string = (() => {
  for (const file of [path.resolve('server/package.json'), path.resolve('package.json')]) {
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (pkg.name === '@vessel/server') return pkg.version;
    } catch { /* try the next location */ }
  }
  return '0.0.0';
})();

const CONTAINER = process.env.VESSEL_CONTAINER || 'vessel-hub';
const UPDATER = 'vessel-updater';
const DEFAULT_REPO = 'SpeedupMaster/vessel';
const STATE_FILE = path.join(DATA_DIR, 'update-state.json');
const CHECK_TTL = 60 * 60 * 1000;
const IMAGE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_./:@-]*$/;
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

export interface ReleaseInfo {
  version: string;
  tag: string;
  url: string;
  notes: string;
  publishedAt: string | null;
}

export interface UpdateResult {
  status: 'running' | 'success' | 'rolled_back' | 'failed';
  from?: string;
  to?: string;
  message?: string;
  finishedAt?: string;
}

interface Installation {
  installDir: string;
  socket: string;
  repository: string;
  image: string;
}

type Phase = 'idle' | 'pulling' | 'restarting' | 'failed';

function parseVersion(value: string) {
  const match = VERSION_PATTERN.exec(value.trim());
  return match ? match.slice(1, 4).map(Number) : null;
}

export function isNewer(candidate: string, current: string) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** `ghcr.io/owner/vessel@sha256:…` or `…:v1.0.0` → `ghcr.io/owner/vessel` */
export function imageRepository(image: string) {
  const withoutDigest = image.split('@')[0];
  const slash = withoutDigest.lastIndexOf('/');
  const colon = withoutDigest.lastIndexOf(':');
  return colon > slash ? withoutDigest.slice(0, colon) : withoutDigest;
}

function githubRepo(repository?: string) {
  if (process.env.VESSEL_UPDATE_REPO) return process.env.VESSEL_UPDATE_REPO;
  const match = repository && /^ghcr\.io\/([^/]+\/[^/]+)$/i.exec(repository);
  return match ? match[1] : DEFAULT_REPO;
}

// The updater runs from the new image, outside this container, so it survives the restart it triggers.
// The installer layout is the contract: one managed compose file with a single `image:` line.
const UPDATER_SCRIPT = String.raw`
set -u
cd "$VESSEL_DIR" || exit 1
STATE="$VESSEL_DIR/data/update-state.json"
finish() {
  printf '{"status":"%s","from":"%s","to":"%s","message":"%s","finishedAt":"%s"}\n' \
    "$1" "$FROM_VERSION" "$TO_VERSION" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE.tmp" && mv "$STATE.tmp" "$STATE"
  echo "[updater] $1: $2"
}
compose() { docker compose --project-name vessel --project-directory "$VESSEL_DIR" -f "$@"; }
healthy() {
  i=0
  while [ "$i" -lt 60 ]; do
    if docker exec vessel-hub node -e 'fetch("http://127.0.0.1:3900/api/auth/status", {signal: AbortSignal.timeout(2000)}).then(async r => { const b = await r.json(); if (!r.ok || b.initialized !== true) process.exit(1); }).catch(() => process.exit(1))' >/dev/null 2>&1; then return 0; fi
    i=$((i + 1))
    sleep 2
  done
  return 1
}
mkdir .install-lock 2>/dev/null || { finish failed 'Installer lock exists; another install or update is running'; exit 1; }
trap 'rmdir "$VESSEL_DIR/.install-lock" 2>/dev/null' EXIT
grep -q '^# Managed by Vessel installer$' docker-compose.yml || { finish failed 'docker-compose.yml is not managed by the Vessel installer'; exit 1; }
[ "$(grep -c '^    image: ' docker-compose.yml)" = 1 ] || { finish failed 'Unexpected docker-compose.yml layout'; exit 1; }
cp -p docker-compose.yml docker-compose.previous.yml
cp -p docker-compose.yml .docker-compose.update.yml
sed "s|^    image: .*|    image: '$NEW_IMAGE'|" docker-compose.previous.yml > .docker-compose.update.yml
compose .docker-compose.update.yml config --quiet || { rm -f .docker-compose.update.yml; finish failed 'Updated compose file failed validation'; exit 1; }
mv .docker-compose.update.yml docker-compose.yml
echo "[updater] Recreating vessel-hub with $NEW_IMAGE"
if compose docker-compose.yml up -d && healthy; then
  printf '%s\n' "$NEW_IMAGE" > .vessel-image
  finish success "Updated to $TO_VERSION"
  exit 0
fi
echo "[updater] New version failed to start; restoring previous configuration"
cp -p docker-compose.previous.yml docker-compose.yml
if compose docker-compose.yml up -d && healthy; then
  finish rolled_back "$TO_VERSION failed its health check; restored $FROM_VERSION"
else
  finish failed "$TO_VERSION failed and the rollback did not become healthy; inspect docker logs vessel-hub"
fi
exit 1
`;

class SelfUpdateService {
  private latest: ReleaseInfo | null = null;
  private checkedAt = 0;
  private checkError: string | null = null;
  private checking: Promise<void> | null = null;
  private phase: Phase = 'idle';
  private phaseError: string | null = null;
  private targetVersion: string | null = null;
  private notifiedVersion: string | null = null;

  start() {
    void this.check().catch(() => {});
    setInterval(() => void this.check().catch(() => {}), 6 * 60 * 60 * 1000).unref();
    void this.cleanupUpdater();
  }

  async check(force = false) {
    if (!force && this.checkedAt && Date.now() - this.checkedAt < CHECK_TTL) return;
    this.checking ??= this.fetchLatest().finally(() => { this.checking = null; });
    await this.checking;
  }

  private async fetchLatest() {
    let repository: string | undefined;
    try { repository = (await this.inspectSelf()).repository; } catch { /* outside the managed container */ }
    const repo = githubRepo(repository);
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': `vessel/${CURRENT_VERSION}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 404) throw new Error(`未找到 ${repo} 的正式发布版本`);
      if (!res.ok) throw new Error(`GitHub 返回 ${res.status}`);
      const body: any = await res.json();
      const tag = String(body.tag_name || '');
      if (!parseVersion(tag)) throw new Error(`无法识别的版本标签 ${tag}`);
      this.latest = {
        version: tag.replace(/^v/, ''),
        tag,
        url: String(body.html_url || `https://github.com/${repo}/releases/tag/${tag}`),
        notes: String(body.body || '').slice(0, 20000),
        publishedAt: body.published_at || null,
      };
      this.checkError = null;
      if (isNewer(this.latest.version, CURRENT_VERSION) && this.notifiedVersion !== this.latest.version) {
        this.notifiedVersion = this.latest.version;
        void notifier.notify({
          event: 'update.available',
          title: `Vessel ${this.latest.tag} 已发布`,
          message: `当前版本 v${CURRENT_VERSION}，可在控制台中一键更新。`,
        });
      }
    } catch (error: any) {
      this.checkError = error?.name === 'TimeoutError' ? '连接 GitHub 超时' : String(error?.message || error);
    } finally {
      this.checkedAt = Date.now();
    }
  }

  /** Only the installer-managed container can update itself; anything else is reported as unsupported. */
  private async inspectSelf(): Promise<Installation> {
    let info: any;
    try {
      const { stdout } = await runDocker(['container', 'inspect', CONTAINER], { timeout: 15000 });
      info = JSON.parse(stdout)[0];
    } catch {
      throw new Error(`未找到 ${CONTAINER} 容器，请使用安装脚本部署后再在线更新`);
    }
    if (!info?.Id?.startsWith(os.hostname())) throw new Error('当前进程不在 Vessel 容器中运行，无法在线更新，请在服务器上重新运行安装脚本升级');
    const labels = info.Config?.Labels || {};
    const installDir = labels['com.docker.compose.project.working_dir'];
    // config_files is not checked: the installer runs Compose against a staged copy in a temporary
    // directory. The updater verifies the managed header of <installDir>/docker-compose.yml instead.
    if (labels['com.docker.compose.project'] !== 'vessel' || !installDir) {
      throw new Error('当前容器不是由安装脚本创建的，请通过安装脚本升级');
    }
    const mounts: any[] = info.Mounts || [];
    const dataMount = mounts.find(mount => mount.Destination === '/app/data');
    if (dataMount?.Source !== path.posix.join(installDir, 'data')) throw new Error('数据目录与安装目录不一致，无法在线更新，请在服务器上重新运行安装脚本升级');
    const socket = mounts.find(mount => mount.Destination === '/var/run/docker.sock')?.Source;
    if (!socket) throw new Error('未挂载 Docker socket，请在服务器上重新运行安装脚本升级');
    const image = String(info.Config?.Image || '');
    if (!IMAGE_PATTERN.test(image) || !IMAGE_PATTERN.test(installDir)) throw new Error('无法识别当前镜像，请在服务器上重新运行安装脚本升级');
    return { installDir, socket, repository: imageRepository(image), image };
  }

  private readResult(): UpdateResult | null {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    } catch {
      return null;
    }
  }

  private async cleanupUpdater() {
    try {
      const { stdout } = await runDocker(['container', 'inspect', '--format', '{{.State.Running}}', UPDATER], { timeout: 15000 });
      if (stdout.trim() === 'false') await runDocker(['container', 'rm', UPDATER], { timeout: 15000 });
    } catch { /* not present */ }
  }

  async status() {
    await this.check();
    let supported = true;
    let unsupportedReason: string | null = null;
    try { await this.inspectSelf(); } catch (error: any) { supported = false; unsupportedReason = error.message; }
    const latest = this.latest;
    return {
      currentVersion: CURRENT_VERSION,
      latest,
      updateAvailable: !!latest && isNewer(latest.version, CURRENT_VERSION),
      checkedAt: this.checkedAt ? new Date(this.checkedAt).toISOString() : null,
      checkError: this.checkError,
      supported,
      unsupportedReason,
      phase: this.phase,
      phaseError: this.phaseError,
      targetVersion: this.targetVersion,
      lastResult: this.readResult(),
    };
  }

  /** Pull the new image here, then hand the container swap to a detached updater. Resolves once pulling starts. */
  async apply() {
    if (this.phase === 'pulling' || this.phase === 'restarting') throw Object.assign(new Error('更新已在进行中'), { status: 409 });
    await this.check(true);
    const latest = this.latest;
    if (!latest) throw Object.assign(new Error(this.checkError || '无法获取最新版本'), { status: 502 });
    if (!isNewer(latest.version, CURRENT_VERSION)) throw Object.assign(new Error('已是最新版本'), { status: 400 });
    if (hasActiveOperations()) throw Object.assign(new Error('仍有部署或备份任务在运行，请稍后再更新'), { status: 409 });
    const install = await this.inspectSelf().catch((error: Error) => { throw Object.assign(error, { status: 400 }); });

    this.phase = 'pulling';
    this.phaseError = null;
    this.targetVersion = latest.version;
    const task = withAppLock('*', () => this.swap(install, latest));
    task.catch((error: any) => {
      this.phase = 'failed';
      this.phaseError = String(error?.message || error);
      console.error('[SelfUpdate]', error);
    });
    return { phase: this.phase, targetVersion: latest.version };
  }

  private async swap(install: Installation, latest: ReleaseInfo) {
    const tagged = `${install.repository}:${latest.tag}`;
    console.log(`[SelfUpdate] Pulling ${tagged}`);
    await runDocker(['pull', tagged], { timeout: 15 * 60 * 1000 });
    const { stdout } = await runDocker(['image', 'inspect', '--format', '{{json .RepoDigests}}', tagged], { timeout: 15000 });
    const digests: string[] = JSON.parse(stdout) || [];
    const target = digests.find(ref => imageRepository(ref) === install.repository) || tagged;
    if (!IMAGE_PATTERN.test(target)) throw new Error('无法识别新镜像引用');

    try {
      const { stdout: running } = await runDocker(['container', 'inspect', '--format', '{{.State.Running}}', UPDATER], { timeout: 15000 });
      if (running.trim() === 'true') throw new Error('已有更新任务在运行');
      await runDocker(['container', 'rm', UPDATER], { timeout: 15000 });
    } catch (error: any) {
      if (error.message === '已有更新任务在运行') throw error;
    }

    const result: UpdateResult = { status: 'running', from: CURRENT_VERSION, to: latest.version };
    fs.writeFileSync(STATE_FILE, JSON.stringify(result) + '\n', { mode: 0o600 });
    this.phase = 'restarting';
    console.log(`[SelfUpdate] Starting updater for ${target}`);
    await runDocker([
      'run', '-d', '--name', UPDATER,
      '--label', 'vessel.role=updater',
      '-v', `${install.socket}:/var/run/docker.sock`,
      '-v', `${install.installDir}:${install.installDir}`,
      '-e', `VESSEL_DIR=${install.installDir}`,
      '-e', `NEW_IMAGE=${target}`,
      '-e', `FROM_VERSION=${CURRENT_VERSION}`,
      '-e', `TO_VERSION=${latest.version}`,
      '--entrypoint', 'sh',
      target, '-c', UPDATER_SCRIPT,
    ], { timeout: 60000 });
  }
}

export const selfUpdateService = new SelfUpdateService();
