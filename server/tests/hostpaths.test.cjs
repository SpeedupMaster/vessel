const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

const HOSTNAME = 'abc123def456';

function fixture({ inspect, existing = {} } = {}) {
  const links = [];
  const inspects = [];
  const fsMock = {
    existsSync: p => p in existing,
    realpathSync: p => existing[p] || p,
    mkdirSync() {},
    symlinkSync: (target, p) => links.push([target, p]),
  };
  const runDocker = async args => {
    inspects.push(args.join(' '));
    if (!inspect) throw new Error('Cannot connect to the Docker daemon');
    return { stdout: JSON.stringify([inspect]) };
  };
  const { hostPathService } = load('server/src/services/hostPaths.ts', {
    fs: fsMock,
    os: { hostname: () => HOSTNAME },
    '../db/index.js': { DATA_DIR: '/app/data', APPS_DATA_DIR: '/app/data/apps' },
    './process.js': { runDocker },
  });
  return { service: hostPathService, links, inspects };
}

const container = source => ({
  Id: `${HOSTNAME}7890`,
  Mounts: [{ Type: 'bind', Source: source, Destination: '/app/data' }],
});

test('data directory is exposed under its host path so relative compose mounts land in it', async () => {
  const { service, links } = fixture({ inspect: container('/opt/vessel/data') });
  await service.ready();
  assert.deepEqual(links, [['/app/data', '/opt/vessel/data']]);
  assert.equal(service.appsDir(), '/opt/vessel/data/apps');
});

test('host path mapping is left alone when unusable or conflicting', async () => {
  for (const [inspect, existing] of [
    [container('/app/data'), {}],
    [container('/var/lib/docker/volumes/x y/_data'), {}],
    [container('/opt/vessel/data'), { '/opt/vessel/data': '/opt/vessel/data' }],
    [{ Id: 'someoneelse', Config: { Hostname: 'other' }, Mounts: container('/opt/vessel/data').Mounts }, {}],
  ]) {
    const { service, links } = fixture({ inspect, existing });
    await service.ready();
    assert.deepEqual(links, []);
    assert.equal(service.appsDir(), '/app/data/apps');
  }
});

test('detection is retried while Docker is unreachable and cached once it answers', async () => {
  const { service, inspects } = fixture();
  await service.ready();
  await service.ready();
  assert.equal(inspects.length, 2);
  assert.equal(service.appsDir(), '/app/data/apps');

  const reachable = fixture({ inspect: container('/opt/vessel/data') });
  await reachable.service.ready();
  await reachable.service.ready();
  assert.equal(reachable.inspects.length, 1);
});
