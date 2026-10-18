const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load, database } = require('./helpers.cjs');

const HOUR = 3600 * 1000;
const ago = hours => new Date(Date.now() - hours * HOUR).toISOString();

// Minimal Docker model: images, containers, and the commands the cleaner issues
function fixture({ images, containers = [], usage = {}, maintenance = {}, onBuilderPrune }) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-cleaner-'));
  fs.writeFileSync(path.join(dataDir, 'image-usage.json'), JSON.stringify(usage));
  const calls = [];
  const store = database({
    apps: [{ id: 'myapp' }],
    maintenance: { unusedRetentionHours: 72, pruneDangling: true, pruneBuilderCache: true, ...maintenance },
  });
  const runDocker = async args => {
    calls.push(args);
    const key = args.join(' ');
    if (key === 'image ls -q --no-trunc') return { stdout: images.map(i => i.id).join('\n') };
    if (key === 'image ls -q --no-trunc --filter dangling=true') return { stdout: images.filter(i => !i.tags.length).map(i => i.id).join('\n') };
    if (key.startsWith('container ls -a -q --no-trunc --filter')) return { stdout: containers.filter(c => c.State.Status !== 'running').map(c => c.Id).join('\n') };
    if (key === 'container ls -a -q --no-trunc') return { stdout: containers.map(c => c.Id).join('\n') };
    if (args[0] === 'container' && args[1] === 'inspect') return { stdout: JSON.stringify(containers.filter(c => args.includes(c.Id))) };
    if (args[0] === 'image' && args[1] === 'inspect') {
      const image = images.find(i => i.id === args[4]);
      return { stdout: JSON.stringify({ Size: image.size, RepoTags: image.tags }) };
    }
    if (args[1] === 'rm') return { stdout: '' };
    if (args[0] === 'builder') {
      onBuilderPrune?.(store);
      return { stdout: 'Total:\t1.5MB' };
    }
    throw new Error(`unexpected docker ${key}`);
  };
  const { cleanerService } = load('server/src/services/cleaner.ts', {
    '../db/index.js': { db: store.db, DATA_DIR: dataDir },
    './process.js': { runDocker },
    './hostPaths.js': { hostPathService: { selfImage: async () => null } },
  });
  return {
    cleaner: cleanerService,
    calls,
    store,
    usageFile: () => JSON.parse(fs.readFileSync(path.join(dataDir, 'image-usage.json'), 'utf8')),
    removed: () => calls.filter(a => a[1] === 'rm').map(a => a.slice(2)),
  };
}

const container = (id, image, extra = {}) => ({
  Id: id, Image: image, Name: `/${id}`, Created: ago(1000), SizeRw: 1000,
  State: { Status: 'exited', FinishedAt: ago(24 * 30) }, Config: { Labels: {} }, ...extra,
});

test('images are removed only after being unreferenced for the whole cooldown', async () => {
  const { cleaner, removed, usageFile, calls } = fixture({
    images: [
      { id: 'sha256:used', tags: ['app:1'], size: 10 },
      { id: 'sha256:old', tags: ['old:1', 'old:latest'], size: 2e6 },
      // Built long ago but only just replaced by an update: Docker's `until` would delete it at once
      { id: 'sha256:replaced', tags: [], size: 3e6 },
      { id: 'sha256:stale-dangling', tags: [], size: 4e6 },
    ],
    containers: [container('c1', 'sha256:used', { State: { Status: 'running' } })],
    usage: { 'sha256:old': ago(100), 'sha256:stale-dangling': ago(100), 'sha256:used': ago(500) },
  });
  const result = await cleaner.runSafePrune();
  assert.equal(result.success, true);
  assert.deepEqual(removed(), [['old:1', 'old:latest'], ['sha256:stale-dangling']]);
  const usage = usageFile();
  assert.equal(usage['sha256:used'], undefined, 'referenced images are not tracked');
  assert.ok(Date.now() - new Date(usage['sha256:replaced']).getTime() < HOUR, 'cooldown starts when the reference is lost');
  assert.deepEqual(calls.find(a => a[0] === 'builder'), ['builder', 'prune', '-a', '-f', '--filter', 'until=72h']);
  assert.equal(result.freedBytes, 2e6 + 4e6 + 1.5e6);
});

test('dangling images are kept when not enabled and build cache pruning is optional', async () => {
  const { cleaner, removed, calls } = fixture({
    images: [{ id: 'sha256:stale-dangling', tags: [], size: 1 }],
    usage: { 'sha256:stale-dangling': ago(100) },
    maintenance: { pruneDangling: false, pruneBuilderCache: false },
  });
  assert.equal((await cleaner.runSafePrune()).success, true);
  assert.deepEqual(removed(), []);
  assert.equal(calls.some(a => a[0] === 'builder'), false);
});

test('stopped containers outside Vessel apps are removed after the configured days', async () => {
  const { cleaner, removed } = fixture({
    images: [],
    containers: [
      container('leftover', 'sha256:x'),
      container('recent', 'sha256:x', { State: { Status: 'exited', FinishedAt: ago(24) } }),
      container('created', 'sha256:x', { State: { Status: 'created', FinishedAt: '0001-01-01T00:00:00Z' }, Created: ago(24 * 10) }),
      container('app-db', 'sha256:x', { Config: { Labels: { 'com.docker.compose.project': 'myapp' } } }),
      container('vessel-updater', 'sha256:x'),
      container('live', 'sha256:x', { State: { Status: 'running' } }),
    ],
    maintenance: { pruneStoppedContainers: true, stoppedContainerDays: 7 },
  });
  const result = await cleaner.runSafePrune();
  assert.deepEqual(removed(), [['leftover'], ['created']]);
  assert.match(result.summary, /2 个停止的容器/);
});

test('prune completion preserves configuration changed while Docker was running', async () => {
  const { cleaner, store } = fixture({
    images: [],
    maintenance: { autoPrune: true },
    onBuilderPrune: s => s.db.set('maintenance', { ...s.db.get('maintenance'), unusedRetentionHours: 120, autoPrune: false }),
  });
  assert.equal((await cleaner.runSafePrune()).success, true);
  assert.equal(store.state.maintenance.unusedRetentionHours, 120);
  assert.equal(store.state.maintenance.autoPrune, false);
  assert.ok(store.state.maintenance.lastPruneAt);
});
