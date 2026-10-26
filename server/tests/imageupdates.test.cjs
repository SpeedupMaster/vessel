const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, database, appFixture } = require('./helpers.cjs');

const manifest = digest => ({ config: { digest } });
const index = (digest = 'sha256:platform', arch = 'amd64', variant) => ({ manifests: [
  { digest: 'sha256:attestation', platform: { os: 'unknown', architecture: 'unknown' } },
  { digest, platform: { os: 'linux', architecture: arch, variant } },
] });
const image = (overrides = {}) => ({ service: 'database', tag: 'redis:latest', id: 'sha256:old',
  repoDigests: ['redis@sha256:index'], os: 'linux', arch: 'amd64', ...overrides });

function registryWith(manifests, images = [image()]) {
  const store = database({ apps: [{ ...appFixture(), status: 'running' }] });
  const commands = [];
  const containers = images.map((item, i) => ({ Id: `container-${i}`, Image: item.id,
    Config: { Image: item.tag, Labels: { 'com.docker.compose.service': item.service } } }));
  const runDocker = async args => {
    commands.push(args);
    if (args[0] === 'inspect') return { stdout: JSON.stringify(containers) };
    if (args[0] === 'image' && args[1] === 'inspect') {
      const item = images.find(item => item.id === args[2]);
      assert.ok(item, `Unknown local image ${args[2]}`);
      return { stdout: JSON.stringify([{ Id: item.id, RepoDigests: item.repoDigests,
        Os: item.os, Architecture: item.arch, Variant: item.variant, Descriptor: item.descriptor }]) };
    }
    assert.deepEqual(args.slice(0, 2), ['manifest', 'inspect']);
    assert.ok(Object.hasOwn(manifests, args[2]), `Unexpected remote lookup ${args[2]}`);
    const result = manifests[args[2]];
    if (result instanceof Error) throw result;
    return { stdout: JSON.stringify(result) };
  };
  const registryService = load('server/src/services/registry.ts', {
    '../db/index.js': { db: store.db }, './process.js': { runDocker },
    './docker.js': { dockerService: { compose: async (_app, args) => {
      assert.deepEqual(args, ['ps', '--all', '-q']);
      return { stdout: containers.map(item => item.Id).join('\n') };
    } } },
  }).registryService;
  return { ...store, registryService, commands, images, containers, app: store.state.apps[0] };
}

function schedulerWith(context) {
  const deployments = [];
  const notifications = [];
  const operations = load('server/src/services/appOperations.ts');
  const service = load('server/src/services/scheduler.ts', {
    '../db/index.js': { db: context.db }, './registry.js': { registryService: context.registryService },
    './appOperations.js': operations,
    './r2Backup.js': { r2BackupService: {} }, './cleaner.js': { cleanerService: {} },
    './notifier.js': { notifier: { notify: async payload => { notifications.push(payload); } } },
    './deployments.js': { deploymentService: {
      run: async (...args) => { deployments.push(args); return { status: 'success' }; },
      settings: () => ({ notifyOnUpdate: true }),
    } },
  }).schedulerService;
  return { service, deployments, notifications, operations };
}

test('unchanged multi-platform images compare config to config on every inspection', async () => {
  const context = registryWith({ 'redis:latest': index(), 'redis@sha256:platform': manifest('sha256:old') });
  for (let i = 0; i < 2; i++) {
    const result = await context.registryService.checkAppUpdate(context.app);
    assert.equal(result.hasUpdate, false);
    assert.deepEqual(result.updatedServices, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.currentDigest, result.newDigest);
  }
  assert.ok(context.commands.every(args => args[0] === 'inspect' || args[0] === 'image' || args[0] === 'manifest'));
});

test('containerd index IDs are resolved to config digests, not compared directly to remote configs', async () => {
  for (const descriptor of [undefined, { digest: 'sha256:index', mediaType: 'application/vnd.oci.image.index.v1+json' }]) {
    const context = registryWith({ 'redis:latest': index(), 'redis@sha256:platform': manifest('sha256:config'),
      'redis@sha256:index': index() }, [image({ id: 'sha256:index', descriptor })]);
    const result = await context.registryService.checkAppUpdate(context.app);
    assert.equal(result.hasUpdate, false);
    assert.deepEqual(result.errors, []);
    assert.equal(result.currentDigest, result.newDigest);
  }
});

test('containerd index-only changes do not restart an unchanged platform image', async () => {
  const context = registryWith({ 'redis:latest': index('sha256:new-platform'),
    'redis@sha256:new-platform': manifest('sha256:config'),
    'redis@sha256:index': index('sha256:old-platform'),
    'redis@sha256:old-platform': manifest('sha256:config') }, [image({ id: 'sha256:index' })]);
  assert.equal((await context.registryService.checkAppUpdate(context.app)).hasUpdate, false);
});

test('containerd single-manifest IDs detect changes only when the underlying config changes', async () => {
  for (const remoteConfig of ['sha256:config', 'sha256:new-config']) {
    const context = registryWith({ 'redis:latest': manifest(remoteConfig),
      'redis@sha256:local-manifest': manifest('sha256:config') },
    [image({ id: 'sha256:local-manifest', repoDigests: ['redis@sha256:local-manifest'] })]);
    const result = await context.registryService.checkAppUpdate(context.app);
    assert.equal(result.hasUpdate, remoteConfig !== 'sha256:config');
    assert.deepEqual(result.errors, []);
  }
});

test('unavailable immutable containerd manifests are reported as errors, never updates', async () => {
  const context = registryWith({ 'redis:latest': manifest('sha256:config'),
    'redis@sha256:index': new Error('Old manifest unavailable') }, [image({ id: 'sha256:index' })]);
  const result = await context.registryService.checkAppUpdate(context.app);
  assert.equal(result.hasUpdate, false);
  assert.equal(result.newDigest, undefined);
  assert.match(result.errors[0], /Old manifest unavailable/);
});

test('failed child manifest lookup is unknown, not an image update', async () => {
  const context = registryWith({ 'redis:latest': index(), 'redis@sha256:platform': new Error('Registry timeout') });
  const result = await context.registryService.checkAppUpdate(context.app);
  assert.equal(result.hasUpdate, false);
  assert.deepEqual(result.updatedServices, []);
  assert.equal(result.newDigest, undefined);
  assert.match(result.errors[0], /Registry timeout/);
});

test('matching platform RepoDigest needs no optional child lookup', async () => {
  const context = registryWith({ 'redis:latest': index() }, [image({ repoDigests: ['redis@sha256:platform'] })]);
  const result = await context.registryService.checkAppUpdate(context.app);
  assert.equal(result.hasUpdate, false);
  assert.deepEqual(result.errors, []);
  assert.equal(context.commands.filter(args => args[0] === 'manifest').length, 1);
});

test('single-platform images identify only services with changed config digests', async () => {
  const context = registryWith({ 'redis:latest': manifest('sha256:new'), 'nginx:alpine': manifest('sha256:web') },
    [image(), image({ service: 'web', tag: 'nginx:alpine', id: 'sha256:web' })]);
  const result = await context.registryService.checkAppUpdate(context.app);
  assert.equal(result.hasUpdate, true);
  assert.deepEqual(result.updatedServices, ['database']);
  assert.notEqual(result.currentDigest, result.newDigest);
});

test('ARM variant selection ignores other architectures and attestation manifests', async () => {
  const list = index('sha256:arm-v8', 'arm64', 'v8');
  list.manifests.unshift({ digest: 'sha256:amd64', platform: { os: 'linux', architecture: 'amd64' } },
    { digest: 'sha256:arm-v9', platform: { os: 'linux', architecture: 'arm64', variant: 'v9' } });
  const context = registryWith({ 'redis:latest': list, 'redis@sha256:arm-v8': manifest('sha256:old') },
    [image({ arch: 'arm64', variant: 'v8' })]);
  assert.equal((await context.registryService.checkAppUpdate(context.app)).hasUpdate, false);
  assert.deepEqual(context.commands.at(-1), ['manifest', 'inspect', 'redis@sha256:arm-v8']);
});

test('registry ports are preserved when inspecting a child manifest by digest', async () => {
  const context = registryWith({ 'registry.local:5000/team/redis:latest': index(),
    'registry.local:5000/team/redis@sha256:platform': manifest('sha256:new') },
  [image({ tag: 'registry.local:5000/team/redis:latest' })]);
  assert.equal((await context.registryService.checkAppUpdate(context.app)).hasUpdate, true);
});

test('digest-pinned references are immutable and do not contact a registry', async () => {
  const context = registryWith({}, [image({ tag: 'redis:latest@sha256:pinned' })]);
  assert.equal((await context.registryService.checkAppUpdate(context.app)).hasUpdate, false);
  assert.ok(!context.commands.some(args => args[0] === 'manifest'));
});

test('unsupported or incomplete manifests never claim an update', async () => {
  for (const remote of [{}, { manifests: [] }, { manifests: [{ platform: { os: 'linux', architecture: 'arm64' } }] }]) {
    const context = registryWith({ 'redis:latest': remote });
    const result = await context.registryService.checkAppUpdate(context.app);
    assert.equal(result.hasUpdate, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.newDigest, undefined);
  }
});

test('mixed-version replicas are all inspected and the service is updated once', async () => {
  const context = registryWith({ 'redis:latest': manifest('sha256:new') },
    [image({ id: 'sha256:new' }), image(), image()]);
  const result = await context.registryService.checkAppUpdate(context.app);
  assert.equal(result.hasUpdate, true);
  assert.deepEqual(result.updatedServices, ['database']);
  assert.equal(context.commands.filter(args => args[0] === 'image').length, 2);
});

test('repeated unchanged inspections clear stale badges without starting deployments', async () => {
  const context = registryWith({ 'redis:latest': index(), 'redis@sha256:platform': manifest('sha256:old') });
  context.app.autoUpdate = true;
  context.app.updateAvailable = true;
  const scheduler = schedulerWith(context);
  assert.deepEqual(await scheduler.service.runUpdateCheck(), []);
  assert.deepEqual(await scheduler.service.runUpdateCheck(), []);
  assert.equal(context.state.apps[0].updateAvailable, false);
  assert.deepEqual(scheduler.deployments, []);
  assert.deepEqual(scheduler.notifications, []);
});

test('automatic upgrades pass only confirmed changed services to recorded deployments', async () => {
  const context = registryWith({ 'redis:latest': manifest('sha256:new'), 'nginx:alpine': manifest('sha256:web') },
    [image(), image({ service: 'web', tag: 'nginx:alpine', id: 'sha256:web' })]);
  context.app.autoUpdate = true;
  const scheduler = schedulerWith(context);
  assert.deepEqual(await scheduler.service.runUpdateCheck(), []);
  assert.deepEqual(scheduler.deployments, [['fixture', 'rebuild', 'auto-update', { updateServices: ['database'] }]]);
});

test('the next inspection after a containerd upgrade does not deploy the same version again', async () => {
  const context = registryWith({ 'redis:latest': index('sha256:new-platform'),
    'redis@sha256:new-platform': manifest('sha256:new-config'),
    'redis@sha256:index': index('sha256:old-platform'),
    'redis@sha256:old-platform': manifest('sha256:old-config'),
    'redis@sha256:new-index': index('sha256:new-platform') }, [image({ id: 'sha256:index' })]);
  context.app.autoUpdate = true;
  const scheduler = schedulerWith(context);
  assert.deepEqual(await scheduler.service.runUpdateCheck(), []);
  assert.equal(scheduler.deployments.length, 1);
  context.containers[0].Image = 'sha256:new-index';
  Object.assign(context.images[0], { id: 'sha256:new-index', repoDigests: ['redis@sha256:new-index'] });
  await context.registryService.captureAppDigest(context.state.apps[0]);
  assert.deepEqual(await scheduler.service.runUpdateCheck(), []);
  assert.equal(scheduler.deployments.length, 1);
  assert.equal(context.state.apps[0].updateAvailable, false);
});

test('stopped and manual-policy apps are inspected but not automatically upgraded', async () => {
  for (const updates of [{ status: 'stopped', autoUpdate: true }, { status: 'running', autoUpdate: false }]) {
    const context = registryWith({ 'redis:latest': manifest('sha256:new') });
    Object.assign(context.app, updates);
    const scheduler = schedulerWith(context);
    await scheduler.service.runUpdateCheck();
    await scheduler.service.runUpdateCheck();
    assert.deepEqual(scheduler.deployments, []);
    assert.equal(context.state.apps[0].updateAvailable, true);
    assert.equal(scheduler.notifications.length, 1);
  }
});

test('partial lookup failure preserves previous state and prevents automatic upgrades', async () => {
  const context = registryWith({ 'redis:latest': manifest('sha256:new'), 'nginx:alpine': new Error('Unauthorized') },
    [image(), image({ service: 'web', tag: 'nginx:alpine', id: 'sha256:web' })]);
  Object.assign(context.app, { autoUpdate: true, updateAvailable: true, latestDigest: 'previous' });
  const scheduler = schedulerWith(context);
  const errors = await scheduler.service.runUpdateCheck();
  assert.match(errors[0], /Unauthorized/);
  assert.deepEqual(scheduler.deployments, []);
  assert.equal(context.state.apps[0].latestDigest, 'previous');
  assert.equal(context.state.apps[0].updateAvailable, true);
});

function dockerWith() {
  const commands = [];
  const docker = load('server/src/services/docker.ts', {
    '../db/index.js': { db: database().db }, './process.js': { runDocker: async () => ({ stdout: '' }) },
    './hostPaths.js': { hostPathService: {} },
  }).dockerService;
  docker.compose = async (_app, args) => { commands.push(args); return { stdout: '' }; };
  docker.syncAppContainers = async () => [];
  docker.ensureNetwork = async () => {};
  return { docker, commands };
}

test('selective image upgrade never forces recreation, pulls dependencies, or builds images', async () => {
  const { docker, commands } = dockerWith();
  const result = await docker.updateAppImages(appFixture(), ['database', 'database'], undefined,
    { pullPolicy: 'always', removeOrphans: true, waitHealthy: true, timeoutMinutes: 2 });
  assert.equal(result.success, true);
  assert.deepEqual(commands, [
    ['pull', '--policy', 'always', 'database'],
    ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '120', 'database'],
  ]);
});

test('empty service updates are no-ops and unknown service names are rejected', async () => {
  const { docker, commands } = dockerWith();
  assert.equal((await docker.updateAppImages(appFixture(), [])).success, true);
  await assert.rejects(docker.updateAppImages(appFixture(), ['--all']), /Unknown Compose service/);
  await assert.rejects(docker.updateAppImages(appFixture(), ['unknown']), /Unknown Compose service/);
  assert.deepEqual(commands, []);
});

test('failed selective pulls never proceed to container reconciliation', async () => {
  const { docker, commands } = dockerWith();
  docker.compose = async (_app, args) => { commands.push(args); throw new Error('Pull failed'); };
  const result = await docker.updateAppImages(appFixture(), ['database']);
  assert.equal(result.success, false);
  assert.deepEqual(commands, [['pull', '--policy', 'always', 'database']]);
});

test('explicit force rebuild retains its original full-project semantics', async () => {
  const { docker, commands } = dockerWith();
  assert.equal((await docker.pullAndRebuild(appFixture())).success, true);
  assert.deepEqual(commands[0], ['pull']);
  assert.ok(commands[1].includes('--force-recreate'));
});
