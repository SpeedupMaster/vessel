const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { load, database, requireServer, appFixture } = require('./helpers.cjs');

function fixture() {
  const store = database({ apps: [appFixture()] });
  const passwords = load('server/src/services/password.ts');
  store.state.admin = { initialized: true, username: 'admin', passwordHash: passwords.hashPassword('test-password-12345'), jwtSecret: 'test-secret' };
  const auth = load('server/src/services/auth.ts', { '../db/index.js': { db: store.db, DATA_DIR: '/isolated' }, './password.js': passwords, 'node:fs': { rmSync() {} } });
  const authService = auth.authService;
  const middleware = load('server/src/middleware/auth.ts', { '../services/auth.js': { authService } });
  const validation = load('server/src/middleware/validation.ts');
  const operations = load('server/src/services/appOperations.ts');
  const docker = {
    checkDaemon: async () => ({ available: false }), prepareAppFiles() {}, stopApp: async () => ({ success: true }),
    deployApp: async () => ({ success: true }), restartApp: async () => ({ success: true }),
    pullAndRebuild: async () => ({ success: true }), freshVolumesRebuild: async () => ({ success: false, error: 'rebuild failed' }),
    getAppLogs: async () => ['private'], getEngineCounts: async () => ({ runningContainers: 0, totalImages: 0 }),
  };
  const router = load('server/src/routes/api.ts', {
    '../db/index.js': { db: store.db, DATA_DIR: '/isolated' }, '../services/docker.js': { dockerService: docker },
    '../services/caddy.js': { caddyService: { syncCaddyfile() {} } }, '../services/r2Backup.js': { r2BackupService: {} },
    '../services/registry.js': { registryService: { captureAppDigest: async () => {} } }, '../services/cleaner.js': { cleanerService: {} },
    '../services/scheduler.js': { schedulerService: { reload() {} } }, '../services/auth.js': { authService },
    '../middleware/auth.js': middleware, '../middleware/validation.js': validation,
    '../services/appOperations.js': operations, '../ws/wsHub.js': { wsHub: { broadcastLog() {} } },
  }).apiRouter;
  const app = requireServer('express')(); app.use(requireServer('express').json()); app.use('/api', router);
  return { ...store, app, authService, middleware, validation, operations, docker };
}

async function serve(app, action) {
  const server = http.createServer(app); server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('anonymous management routes return 401 and expose no secrets', async () => {
  const context = fixture();
  await serve(context.app, async base => {
    for (const endpoint of ['/apps', '/apps/fixture', '/apps/fixture/logs?service=x', '/domains', '/r2/config', '/registries']) {
      const response = await fetch(base + '/api' + endpoint);
      assert.equal(response.status, 401, endpoint);
      assert.ok(!(await response.text()).includes('synthetic'));
    }
    const token = context.authService.login('admin', 'test-password-12345').token;
    const response = await fetch(base + '/api/apps', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
  });
});

test('initial password accounts can change password but cannot use management APIs', async () => {
  const context = fixture(); context.state.admin.mustChangePassword = true;
  const token = context.authService.login('admin', 'test-password-12345').token;
  await serve(context.app, async base => {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/api/apps', { headers })).status, 403);
    const changed = await fetch(base + '/api/auth/change-password', { method: 'POST', headers,
      body: JSON.stringify({ currentPassword: 'test-password-12345', newPassword: 'updated-password-12345' }) });
    assert.equal(changed.status, 200);
    assert.equal(context.authService.verifyToken(token).valid, false);
    const fresh = (await changed.json()).token;
    assert.equal((await fetch(base + '/api/apps', { headers: { Authorization: `Bearer ${fresh}` } })).status, 200);
  });
});

test('login attempts are rate limited and malformed credentials do not crash', async () => {
  const context = fixture();
  await serve(context.app, async base => {
    for (let index = 0; index < 10; index++) {
      assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: {}, password: [] }) })).status, 401);
    }
    assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 429);
  });
});

test('deploy blocks competing mutations and cannot resurrect a deleted record', async () => {
  const context = fixture(); let complete;
  context.docker.deployApp = () => new Promise(resolve => { complete = resolve; });
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}` };
  await serve(context.app, async base => {
    assert.equal((await fetch(base + '/api/apps/fixture/deploy', { method: 'POST', headers })).status, 202);
    assert.equal((await fetch(base + '/api/apps/fixture', { method: 'DELETE', headers })).status, 409);
    context.db.set('apps', []);
    complete({ success: true }); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(context.state.apps, []);
  });
});

test('failed rebuild persists error state', async () => {
  const context = fixture();
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}` };
  await serve(context.app, async base => {
    await fetch(base + '/api/apps/fixture/fresh-volumes', { method: 'POST', headers });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(context.state.apps[0].status, 'error');
  });
});

test('system restore lock blocks configuration mutations and allows reads', async () => {
  const context = fixture(); let release;
  const task = context.operations.withAppLock('*', () => new Promise(resolve => { release = resolve; }));
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  try {
    await serve(context.app, async base => {
      for (const route of ['/apps', '/domains', '/r2/config', '/registries', '/maintenance/config']) {
        const response = await fetch(base + '/api' + route, { method: 'POST', headers, body: '{}' });
        assert.equal(response.status, 409, route);
      }
      assert.equal((await fetch(base + '/api/apps', { headers })).status, 200);
    });
  } finally { release(); await task; }
});

test('domain writes validate ownership and uniqueness without waiting on TLS', async () => {
  const context = fixture();
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  await serve(context.app, async base => {
    const domain = { domain: 'app.example.com', appId: 'fixture', targetPort: 8080, serviceName: 'database', targetType: 'internal' };
    const post = body => fetch(base + '/api/domains', { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal((await post({ ...domain, appId: 'missing' })).status, 400);
    assert.equal((await post({ ...domain, serviceName: '' })).status, 400);
    const created = await post(domain);
    assert.equal(created.status, 201);
    const saved = await created.json(); assert.equal(saved.sslStatus, 'unknown');
    assert.equal((await post({ ...domain, domain: 'APP.EXAMPLE.COM' })).status, 400);
    assert.equal((await post({ ...domain, domain: 'other.example.com' })).status, 201);
    const update = await fetch(base + '/api/domains/' + saved.id, { method: 'PUT', headers, body: JSON.stringify({ domain: 'changed.example.com' }) });
    assert.equal(update.status, 200);
    assert.equal(context.state.domains.length, 2);
    assert.ok(context.state.domains.some(item => item.domain === 'other.example.com'));
  });
});

test('failed application file preparation preserves existing configuration', async () => {
  const context = fixture();
  context.docker.prepareAppFiles = () => { throw new Error('disk full'); };
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  await serve(context.app, async base => {
    const response = await fetch(base + '/api/apps/fixture', { method: 'PUT', headers, body: JSON.stringify({ name: 'unsaved' }) });
    assert.equal(response.status, 500);
    assert.equal(context.state.apps[0].name, 'Fixture');
  });
});

test('invalid Compose service arrays and nested domain bindings fail validation', () => {
  const context = fixture();
  assert.throws(() => context.validation.validateCompose('services:\n  web: []\n'), /Invalid Compose service/);
  for (const domainBinding of [null, [], { domain: 'app.example.com', targetPort: 80, serviceName: ['web'] }]) {
    let failure;
    context.validation.validateRequest({ path: '/apps', body: { domainBinding } }, {}, error => { failure = error; });
    assert.equal(failure?.status, 400);
  }
});

test('WebSocket refuses anonymous upgrades and delivers authenticated task changes', async () => {
  const context = fixture();
  const hub = load('server/src/ws/wsHub.ts', {
    '../db/index.js': { db: context.db, DATA_DIR: '.' }, '../services/docker.js': { dockerService: context.docker },
    '../services/auth.js': { authService: context.authService }, '../services/appOperations.js': context.operations,
  }).wsHub;
  const server = http.createServer(); hub.init(server); server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const { WebSocket } = requireServer('ws');
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  try {
    const anonymous = new WebSocket(url);
    const refused = await new Promise(resolve => { anonymous.once('error', () => resolve(true)); anonymous.once('open', () => { anonymous.close(); resolve(false); }); });
    assert.equal(refused, true);
    const token = context.authService.login('admin', 'test-password-12345').token;
    const client = new WebSocket(url, ['vessel', `auth.${token}`]);
    await new Promise((resolve, reject) => { client.once('open', resolve); client.once('error', reject); });
    const changed = new Promise(resolve => client.on('message', data => { if (JSON.parse(data).type === 'apps-changed') resolve(); }));
    context.operations.appEvents.emit('changed', 'fixture'); await changed;
    const closed = new Promise(resolve => client.once('close', (code) => resolve(code)));
    context.state.admin.jwtSecret = 'rotated';
    context.operations.appEvents.emit('changed', 'fixture');
    assert.equal(await closed, 1008);
  } finally { hub.destroy(); await new Promise(resolve => server.close(resolve)); }
});
