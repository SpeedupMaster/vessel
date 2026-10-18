const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, database, appFixture } = require('./helpers.cjs');

function dockerWith(runDocker) {
  const store = database({ apps: [appFixture()] });
  const module = load('server/src/services/docker.ts', {
    '../db/index.js': { db: store.db, APPS_DATA_DIR: '/isolated' }, './process.js': { runDocker }, fs: {},
  });
  module.dockerService.prepareAppFiles = () => ({ composePath: 'compose.yml', appDir: '.', envPath: '.env' });
  return { ...module, app: store.state.apps[0] };
}

const crashed = {
  Id: '0123456789abcdef0123', Name: '/postgres-db',
  RestartCount: 7,
  State: {
    Status: 'restarting', Running: false, ExitCode: 137, OOMKilled: true, Error: '',
    StartedAt: '2026-10-18T02:45:03.1Z', FinishedAt: '2026-10-18T02:46:00Z',
    Health: { Status: 'unhealthy', FailingStreak: 4, Log: [{ End: '2026-10-18T02:45:59Z', ExitCode: 1, Output: '/var/run/postgresql:5432 - no response\n' }] },
  },
  Config: { Image: 'postgres:17', Labels: { 'com.docker.compose.service': 'database' } },
  HostConfig: { RestartPolicy: { Name: 'unless-stopped' } },
  Mounts: [{ Type: 'bind', Source: '/srv/vessel/apps/pg/data', Destination: '/var/lib/postgresql', RW: true }],
  NetworkSettings: { Networks: { 'pg_default': {}, 'vessel-net': {} }, Ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '15432' }], '9187/tcp': null } },
};

test('docker inspect output is mapped to container diagnostics', () => {
  const { toDiagnostics } = dockerWith(async () => ({ stdout: '' }));
  const result = toDiagnostics(crashed);
  assert.equal(result.id, '0123456789ab');
  assert.equal(result.name, 'postgres-db');
  assert.equal(result.service, 'database');
  assert.equal(result.exitCode, 137);
  assert.equal(result.oomKilled, true);
  assert.equal(result.restartCount, 7);
  assert.equal(result.restartPolicy, 'unless-stopped');
  assert.equal(result.health.status, 'unhealthy');
  assert.equal(result.health.failingStreak, 4);
  assert.match(result.health.lastOutput, /no response$/);
  assert.deepEqual(result.networks, ['pg_default', 'vessel-net']);
  assert.deepEqual(result.ports, [{ container: '5432/tcp', hostIp: '0.0.0.0', hostPort: '15432' }, { container: '9187/tcp' }]);
  assert.equal(result.mounts[0].destination, '/var/lib/postgresql');
});

test('never-started containers report no timestamps and no health', () => {
  const { toDiagnostics } = dockerWith(async () => ({ stdout: '' }));
  const result = toDiagnostics({ Id: 'x', State: { Status: 'created', StartedAt: '0001-01-01T00:00:00Z', FinishedAt: '0001-01-01T00:00:00Z', Health: { Status: 'none' } } });
  assert.equal(result.startedAt, undefined);
  assert.equal(result.finishedAt, undefined);
  assert.equal(result.health, undefined);
  assert.deepEqual(result.ports, []);
});

test('diagnoseApp inspects compose containers and degrades when docker is offline', async () => {
  const calls = [];
  const ok = dockerWith(async args => {
    calls.push(args);
    return { stdout: args[0] === 'inspect' ? JSON.stringify([crashed]) : 'abc123\n' };
  });
  const result = await ok.dockerService.diagnoseApp(ok.app);
  assert.equal(result.dockerAvailable, true);
  assert.equal(result.containers.length, 1);
  assert.deepEqual(calls[1], ['inspect', 'abc123']);

  const empty = dockerWith(async () => ({ stdout: '' }));
  assert.deepEqual((await empty.dockerService.diagnoseApp(empty.app)).containers, []);

  const offline = dockerWith(async () => { throw new Error('failed to connect to the docker API'); });
  const down = await offline.dockerService.diagnoseApp(offline.app);
  assert.equal(down.dockerAvailable, false);
  assert.match(down.error, /docker API/);
});
