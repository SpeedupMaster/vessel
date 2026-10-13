import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runDocker } from './process.js';
import { dockerService } from './docker.js';
import { AppItem } from '../types/index.js';

interface VolumeEntry { service: string; target: string; archive: string }
interface Mount { Type: string; Source: string; Name?: string; Destination: string; RW: boolean }
const helperImage = process.env.VESSEL_BACKUP_IMAGE || 'alpine:3.21';

async function containers(app: AppItem, allowEmpty = false): Promise<any[]> {
  const { stdout } = await dockerService.compose(app, ['ps', '--all', '-q']);
  const ids = stdout.trim().split(/\s+/).filter(Boolean);
  if (!ids.length) {
    if (allowEmpty) return [];
    throw new Error('应用没有已创建的容器，无法发现或备份数据卷；请先部署应用');
  }
  return JSON.parse((await runDocker(['inspect', ...ids])).stdout);
}

function mountArgument(mount: Mount, readonly: boolean) {
  if (!['volume', 'bind'].includes(mount.Type)) throw new Error('Unsupported mount type');
  const source = mount.Type === 'volume' ? mount.Name : mount.Source;
  if (!source || source.includes(',')) throw new Error('Unsupported volume source');
  return `type=${mount.Type},source=${source},target=/volume${readonly ? ',readonly' : ''}`;
}

async function withStoppedContainers<T>(items: any[], action: () => Promise<T>): Promise<T> {
  const running = items.filter(item => item.State.Running).map(item => item.Id);
  try {
    if (running.length) await runDocker(['stop', ...running]);
    return await action();
  } finally {
    if (running.length) await runDocker(['start', ...running]);
  }
}

/** Docker performs mount access on the daemon host, including remote/bind-mounted data. */
export async function exportVolumes(app: AppItem, directory: string): Promise<void> {
  const items = await containers(app);
  // Pull before stopping applications, so unavailable helper images do not prolong downtime.
  await runDocker(['image', 'inspect', helperImage]).catch(() => runDocker(['pull', helperImage]));
  await withStoppedContainers(items, async () => {
    const entries: VolumeEntry[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const service = item.Config.Labels['com.docker.compose.service'];
      for (const mount of item.Mounts as Mount[]) {
        if (!mount.RW || !['volume', 'bind'].includes(mount.Type)) continue;
        const key = `${mount.Type}:${mount.Name || mount.Source}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const archive = `volume-${entries.length}.tar`;
        await runDocker(['run', '--rm', '--network', 'none', '--read-only', '--mount', mountArgument(mount, true), helperImage,
          'sh', '-c', 'test -d /volume || { echo "Only directory mounts are supported" >&2; exit 1; }; tar cpf - -C /volume .'],
        { output: fs.createWriteStream(path.join(directory, archive)), timeout: 30 * 60 * 1000 });
        entries.push({ service, target: mount.Destination, archive });
      }
    }
    fs.writeFileSync(path.join(directory, 'volumes.json'), JSON.stringify({ version: 1, entries }, null, 2));
  });
}

export async function importVolumes(app: AppItem, directory: string): Promise<void> {
  const manifestPath = path.join(directory, 'volumes.json');
  if (!fs.existsSync(manifestPath)) throw new Error('这是旧版配置备份，不包含可恢复的数据卷');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) throw new Error('Invalid volume manifest');
  const entries = manifest.entries as VolumeEntry[];
  for (const entry of entries) {
    if (!/^volume-\d+\.tar$/.test(entry.archive) || !fs.existsSync(path.join(directory, entry.archive)) ||
      typeof entry.service !== 'string' || typeof entry.target !== 'string') throw new Error('Invalid or incomplete volume archive');
  }
  if (!entries.length) return;
  await runDocker(['image', 'inspect', helperImage]).catch(() => runDocker(['pull', helperImage]));
  // Fully extract and validate before touching any live mount. No host directories are mounted here.
  const originals = await containers(app, true);
  const stagingVolume = `vessel-restore-${randomUUID()}`;
  await runDocker(['volume', 'create', stagingVolume]);
  const stagedMount = `type=volume,source=${stagingVolume},target=/stage`;
  const runningServices = [...new Set<string>(originals.filter(item => item.State.Running)
    .map(item => item.Config.Labels['com.docker.compose.service']))];
  let stopped = false;
  const restoredTargets: { mount: Mount; rollback: string }[] = [];
  try {
    for (const [index, entry] of entries.entries()) {
      // BusyBox tar rejects traversal entries. Extract in an isolated scratch volume first.
      await runDocker(['run', '--rm', '-i', '--network', 'none', '--read-only', '--mount', stagedMount, helperImage,
        'sh', '-ec', 'mkdir -p /stage/data; mkdir /stage/data/"$1"; tar xpf - -C /stage/data/"$1"', 'restore', String(index)],
      { input: fs.createReadStream(path.join(directory, entry.archive)), timeout: 30 * 60 * 1000 });
    }
    if (originals.some(item => item.State.Running)) {
      stopped = true;
      await runDocker(['stop', ...originals.filter(item => item.State.Running).map(item => item.Id)]);
    }
    // Do not recreate existing containers during a data restore: that can change mount identities.
    await dockerService.compose(app, ['create', '--no-recreate']);
    const items = await containers(app);
    const targets = entries.map((entry, index) => {
      const item = items.find(container => container.Config.Labels['com.docker.compose.service'] === entry.service);
      const mount = item?.Mounts.find((m: Mount) => m.Destination === entry.target && m.RW);
      if (!mount) throw new Error(`Restore target is missing: ${entry.service}:${entry.target}`);
      return { mount: mount as Mount, index };
    });
    for (const { mount, index } of targets) {
      const rollback = path.join(directory, `rollback-${index}.tar`);
      await runDocker(['run', '--rm', '--network', 'none', '--read-only', '--mount', mountArgument(mount, true), helperImage,
        'tar', 'cpf', '-', '-C', '/volume', '.'], { output: fs.createWriteStream(rollback), timeout: 30 * 60 * 1000 });
      restoredTargets.push({ mount, rollback });
      await runDocker(['run', '--rm', '--network', 'none', '--read-only', '--mount', `${stagedMount},readonly`,
        '--mount', mountArgument(mount, false), helperImage, 'sh', '-ec',
        'test -d /volume || exit 1; find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} +; cp -a /stage/data/"$1"/. /volume/', 'restore', String(index)],
      { timeout: 30 * 60 * 1000 });
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const { mount, rollback } of restoredTargets.reverse()) {
      try {
        await runDocker(['run', '--rm', '-i', '--network', 'none', '--read-only', '--mount', mountArgument(mount, false), helperImage,
          'sh', '-ec', 'find /volume -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar xpf - -C /volume'],
        { input: fs.createReadStream(rollback), timeout: 30 * 60 * 1000 });
      } catch (rollbackError) { rollbackErrors.push(String(rollbackError)); }
    }
    if (rollbackErrors.length) {
      stopped = false; // Leave affected databases stopped for manual recovery.
      throw Object.assign(new Error(`恢复与回滚失败；恢复前副本保留在 ${directory}: ${rollbackErrors.join('; ')}`), { preserveRecovery: true });
    }
    throw error;
  } finally {
    try {
      if (stopped && runningServices.length) await dockerService.compose(app, ['start', ...runningServices]);
    } finally {
      await runDocker(['volume', 'rm', stagingVolume]).catch(error => console.warn('[Restore cleanup]', String(error)));
    }
  }
}
