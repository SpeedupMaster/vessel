const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load } = require('./helpers.cjs');

const HOSTNAME = 'abc123def456';
// Shaped like `docker container inspect vessel-hub` on a host provisioned by scripts/install.sh
const installerContainer = (overrides = {}) => ({
  Id: `${HOSTNAME}7890fedcba`,
  Config: {
    Image: 'ghcr.io/speedupmaster/vessel@sha256:old',
    Labels: {
      'com.docker.compose.project': 'vessel',
      'com.docker.compose.project.working_dir': '/opt/vessel',
      // The installer runs Compose against a staged copy
      'com.docker.compose.project.config_files': '/opt/vessel/.install.AbC123/docker-compose.yml',
    },
  },
  Mounts: [
    { Type: 'bind', Source: '/var/run/docker.sock', Destination: '/var/run/docker.sock' },
    { Type: 'bind', Source: '/opt/vessel/data', Destination: '/app/data' },
  ],
  ...overrides,
});

function fixture(container = installerContainer()) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-update-'));
  const calls = [];
  const runDocker = async args => {
    calls.push(args);
    const key = args.join(' ');
    if (key === 'container inspect vessel-hub') return { stdout: JSON.stringify([container]) };
    if (key.startsWith('container inspect --format {{.State.Running}} vessel-updater')) throw new Error('No such container');
    if (args[0] === 'pull') return { stdout: '' };
    if (args[0] === 'image') return { stdout: JSON.stringify(['ghcr.io/speedupmaster/vessel@sha256:new']) };
    if (args[0] === 'run') return { stdout: 'updater-id\n' };
    throw new Error(`unexpected docker ${key}`);
  };
  const service = load('server/src/services/selfUpdate.ts', {
    os: { hostname: () => HOSTNAME },
    '../db/index.js': { DATA_DIR: dataDir },
    './process.js': { runDocker },
    './notifier.js': { notifier: { notify: async () => {} } },
  }).selfUpdateService;
  return { service, calls, dataDir };
}

async function withRelease(tag, action) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ tag_name: tag, html_url: 'https://example.invalid', body: 'notes' }) });
  try { return await action(); } finally { globalThis.fetch = original; }
}

test('installer-provisioned container is recognised as updatable', async () => {
  const { service } = fixture();
  const status = await withRelease('v99.0.0', () => service.status());
  assert.equal(status.unsupportedReason, null);
  assert.equal(status.supported, true);
  assert.equal(status.updateAvailable, true);
  assert.equal(status.latest.tag, 'v99.0.0');
});

test('containers outside the installer layout are reported as unsupported', async () => {
  for (const container of [
    installerContainer({ Id: 'someoneelse0000' }),
    installerContainer({ Mounts: [{ Source: '/srv/data', Destination: '/app/data' }, { Source: '/var/run/docker.sock', Destination: '/var/run/docker.sock' }] }),
    installerContainer({ Config: { Image: 'vessel:dev', Labels: { 'com.docker.compose.project': 'vessel', 'com.docker.compose.project.working_dir': '/opt/../etc' } } }),
  ]) {
    const status = await withRelease('v99.0.0', () => fixture(container).service.status());
    assert.equal(status.supported, false);
    assert.ok(status.unsupportedReason);
  }
});

test('apply pulls the tagged image and launches the updater pinned by digest', async () => {
  const { service, calls, dataDir } = fixture();
  const started = await withRelease('v99.0.0', () => service.apply());
  assert.deepEqual(started, { phase: 'pulling', targetVersion: '99.0.0' });
  for (let i = 0; i < 50 && !calls.some(args => args[0] === 'run'); i++) await new Promise(r => setTimeout(r, 10));

  assert.ok(calls.some(args => args.join(' ') === 'pull ghcr.io/speedupmaster/vessel:v99.0.0'));
  const run = calls.find(args => args[0] === 'run');
  assert.ok(run, 'updater container was not started');
  const pairs = (flag) => run.flatMap((arg, i) => run[i - 1] === flag ? [arg] : []);
  assert.deepEqual(pairs('-v'), ['/var/run/docker.sock:/var/run/docker.sock', '/opt/vessel:/opt/vessel']);
  assert.ok(pairs('-e').includes('VESSEL_DIR=/opt/vessel'));
  assert.ok(pairs('-e').includes('NEW_IMAGE=ghcr.io/speedupmaster/vessel@sha256:new'));
  assert.ok(pairs('-e').includes('TO_VERSION=99.0.0'));
  assert.equal(run[run.indexOf('--entrypoint') + 1], 'sh');
  assert.equal(run[run.length - 3], 'ghcr.io/speedupmaster/vessel@sha256:new');

  const state = JSON.parse(fs.readFileSync(path.join(dataDir, 'update-state.json'), 'utf8'));
  assert.equal(state.status, 'running');
  assert.equal(state.to, '99.0.0');
  assert.equal((await withRelease('v99.0.0', () => service.status())).phase, 'restarting');
});
