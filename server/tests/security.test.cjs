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
  const registry = {
    captureAppDigest: async () => {},
    checkAppUpdate: async () => ({ hasUpdate: false, updatedServices: [], currentDigest: 'same', newDigest: 'same', errors: [] }),
  };
  const dataDir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'vessel-api-'));
  const sent = [];
  const notifierModule = load('server/src/services/notifier.ts', { '../db/index.js': { db: store.db } });
  notifierModule.notifier.notify = async payload => { sent.push(payload); };
  const deployments = load('server/src/services/deployments.ts', {
    '../db/index.js': { db: store.db, DATA_DIR: dataDir }, './docker.js': { dockerService: docker },
    './registry.js': { registryService: registry }, './notifier.js': notifierModule,
    './appOperations.js': operations, '../ws/wsHub.js': { wsHub: { broadcastLog() {} } },
  });
  const router = load('server/src/routes/api.ts', {
    '../services/deployments.js': deployments, '../services/notifier.js': notifierModule,
    '../db/index.js': { db: store.db, DATA_DIR: '/isolated' }, '../services/docker.js': { dockerService: docker },
    '../services/caddy.js': { caddyService: { syncCaddyfile() {} } }, '../services/r2Backup.js': { r2BackupService: {} },
    '../services/registry.js': { registryService: registry }, '../services/cleaner.js': { cleanerService: {} },
    '../services/scheduler.js': { schedulerService: { reload() {} } }, '../services/auth.js': { authService },
    '../middleware/auth.js': middleware, '../middleware/validation.js': validation,
    '../services/appOperations.js': operations, '../ws/wsHub.js': { wsHub: { broadcastLog() {} } },
  }).apiRouter;
  const app = requireServer('express')(); app.use(requireServer('express').json()); app.use('/api', router);
  return { ...store, app, authService, middleware, validation, operations, docker, registry, deployments, sent, dataDir };
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
    assert.equal((await fetch(base + '/api/auth/change-password', { method: 'POST', headers, body: JSON.stringify({ currentPassword: 'test-password-12345', newPassword: 'short-7' }) })).status, 400);
    const changed = await fetch(base + '/api/auth/change-password', { method: 'POST', headers,
      body: JSON.stringify({ currentPassword: 'test-password-12345', newPassword: 'valid-8c' }) });
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

test('maintenance upgrade rechecks stale badges and skips all deployment work when unchanged', async t => {
  const context = fixture();
  t.after(() => require('node:fs').rmSync(context.dataDir, { recursive: true, force: true }));
  context.state.apps[0].updateAvailable = true;
  context.docker.pullAndRebuild = async () => assert.fail('Must not force a rebuild');
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}` };
  await serve(context.app, async base => {
    const response = await fetch(base + '/api/apps/fixture/upgrade', { method: 'POST', headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).updated, false);
    assert.equal(context.state.apps[0].updateAvailable, false);
    assert.equal(context.state.deployments.length, 0);
  });
});

test('maintenance upgrade reports registry errors without clearing the previous update state', async t => {
  const context = fixture();
  t.after(() => require('node:fs').rmSync(context.dataDir, { recursive: true, force: true }));
  context.state.apps[0].updateAvailable = true;
  context.registry.checkAppUpdate = async () => ({ hasUpdate: false, updatedServices: [], errors: ['Registry timeout'] });
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}` };
  await serve(context.app, async base => {
    const response = await fetch(base + '/api/apps/fixture/upgrade', { method: 'POST', headers });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /Registry timeout/);
    assert.equal(context.state.apps[0].updateAvailable, true);
    assert.equal(context.state.deployments.length, 0);
  });
});

test('confirmed maintenance upgrades target changed services and retain the lock after HTTP acceptance', async t => {
  const context = fixture();
  t.after(() => require('node:fs').rmSync(context.dataDir, { recursive: true, force: true }));
  context.registry.checkAppUpdate = async () => ({ hasUpdate: true, updatedServices: ['database'],
    currentDigest: 'old', newDigest: 'new', errors: [] });
  let complete;
  const calls = [];
  context.docker.updateAppImages = (app, services) => {
    calls.push({ appId: app.id, services });
    return new Promise(resolve => { complete = resolve; });
  };
  context.docker.pullAndRebuild = async () => assert.fail('Must not force a rebuild');
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}` };
  await serve(context.app, async base => {
    try {
      const response = await fetch(base + '/api/apps/fixture/upgrade', { method: 'POST', headers });
      assert.equal(response.status, 202);
      assert.equal((await response.json()).updated, true);
      assert.deepEqual(calls, [{ appId: 'fixture', services: ['database'] }]);
      assert.equal(context.state.deployments[0].status, 'running');
      assert.equal((await fetch(base + '/api/apps/fixture/upgrade', { method: 'POST', headers })).status, 409);
      assert.equal((await fetch(base + '/api/apps/fixture', { method: 'DELETE', headers })).status, 409);
    } finally {
      complete?.({ success: true });
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(context.state.deployments[0].status, 'success');
    assert.equal(context.operations.hasActiveOperations(), false);
    assert.match(context.deployments.deploymentService.readLog(context.state.deployments[0]), /仅升级已确认镜像更新的服务: database/);
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

const settle = async (context, appId = 'fixture') => {
  for (let index = 0; index < 50; index++) {
    await new Promise(resolve => setImmediate(resolve));
    if (!context.state.deployments.some(item => item.appId === appId && item.status === 'running')) return;
  }
  throw new Error('deployment did not settle');
};

test('deployments are recorded with a config snapshot, log and one-click rollback', async () => {
  const context = fixture();
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  context.docker.deployApp = async (_app, log) => { log('pulling layers\n'); return { success: true }; };
  await serve(context.app, async base => {
    const first = await fetch(base + '/api/apps/fixture/deploy', { method: 'POST', headers });
    assert.equal(first.status, 202);
    assert.equal((await first.json()).seq, 1);
    await settle(context);
    const original = context.state.apps[0].composeYaml;
    context.state.apps[0].composeYaml = 'services:\n  database:\n    image: postgres:17\n';
    await fetch(base + '/api/apps/fixture/deploy', { method: 'POST', headers });
    await settle(context);

    const list = await (await fetch(base + '/api/apps/fixture/deployments', { headers })).json();
    assert.deepEqual(list.map(item => [item.seq, item.status, item.trigger]), [[2, 'success', 'manual'], [1, 'success', 'manual']]);
    assert.equal(list[1].composeYaml, original);
    const { log } = await (await fetch(base + `/api/apps/fixture/deployments/${list[1].id}/log`, { headers })).json();
    assert.match(log, /pulling layers/);

    assert.equal((await fetch(base + `/api/apps/fixture/deployments/${list[1].id}/rollback`, { method: 'POST', headers })).status, 202);
    await settle(context);
    assert.equal(context.state.apps[0].composeYaml, original);
    const latest = context.deployments.deploymentService.list('fixture')[0];
    assert.equal(latest.action, 'rollback'); assert.equal(latest.rollbackOf, list[1].id); assert.equal(latest.status, 'success');
  });
});

test('failed deployment notifies and auto-rolls back to the last good config', async () => {
  const context = fixture();
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  await serve(context.app, async base => {
    await fetch(base + '/api/apps/fixture/deploy', { method: 'POST', headers });
    await settle(context);
    const good = context.state.apps[0].composeYaml;
    assert.equal((await fetch(base + '/api/apps/fixture/settings', { method: 'PUT', headers, body: JSON.stringify({ autoRollback: true }) })).status, 200);
    context.state.apps[0].composeYaml = 'services:\n  database:\n    image: broken\n';
    let calls = 0;
    context.docker.deployApp = async () => (++calls === 1 ? { success: false, error: 'image not found' } : { success: true });
    await fetch(base + '/api/apps/fixture/deploy', { method: 'POST', headers });
    await settle(context);
    const [rollback, failed] = context.deployments.deploymentService.list('fixture');
    assert.equal(failed.status, 'failed'); assert.equal(failed.error, 'image not found');
    assert.equal(rollback.trigger, 'auto-rollback'); assert.equal(rollback.status, 'success');
    assert.equal(context.state.apps[0].composeYaml, good);
    assert.ok(context.sent.some(item => item.event === 'deploy.failure'));
  });
});

test('deploy webhook needs to be enabled and requires the exact token', async () => {
  const context = fixture();
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  await serve(context.app, async base => {
    const settings = await (await fetch(base + '/api/apps/fixture/settings', { headers })).json();
    assert.ok(settings.webhookToken.length >= 32);
    const hook = token => fetch(base + `/api/hooks/deploy/fixture/${token}`, { method: 'POST' });
    assert.equal((await hook(settings.webhookToken)).status, 404, 'disabled by default');
    await fetch(base + '/api/apps/fixture/settings', { method: 'PUT', headers, body: JSON.stringify({ webhookEnabled: true, webhookToken: 'attacker-chosen' }) });
    assert.equal((await hook('attacker-chosen')).status, 404, 'token cannot be set through settings');
    assert.equal((await hook(settings.webhookToken + 'x')).status, 404);
    const accepted = await hook(settings.webhookToken);
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).action, 'rebuild');
    await settle(context);
    assert.equal(context.deployments.deploymentService.list('fixture')[0].trigger, 'webhook');
    const rotated = await (await fetch(base + '/api/apps/fixture/settings/webhook-token', { method: 'POST', headers })).json();
    assert.equal((await hook(settings.webhookToken)).status, 404, 'old token revoked');
    assert.notEqual(rotated.webhookToken, settings.webhookToken);
  });
});

test('deploy settings are validated', async () => {
  const context = fixture();
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  await serve(context.app, async base => {
    const put = body => fetch(base + '/api/apps/fixture/settings', { method: 'PUT', headers, body: JSON.stringify(body) });
    assert.equal((await put({ pullPolicy: 'sometimes' })).status, 400);
    assert.equal((await put({ timeoutMinutes: 0 })).status, 400);
    assert.equal((await put({ waitHealthy: 'yes' })).status, 400);
    const saved = await (await put({ pullPolicy: 'always', waitHealthy: true, timeoutMinutes: 5 })).json();
    assert.equal(saved.pullPolicy, 'always'); assert.equal(context.state.apps[0].deploySettings.timeoutMinutes, 5);
  });
});

test('notification channel secrets are masked and preserved on edit', async () => {
  const context = fixture();
  const headers = { Authorization: `Bearer ${context.authService.login('admin', 'test-password-12345').token}`, 'Content-Type': 'application/json' };
  const secretUrl = 'https://open.feishu.cn/open-apis/bot/v2/hook/synthetic-secret';
  await serve(context.app, async base => {
    assert.equal((await fetch(base + '/api/notifications', { method: 'POST', headers, body: JSON.stringify({ name: 'x', type: 'feishu', url: 'ftp://nope' }) })).status, 400);
    const created = await (await fetch(base + '/api/notifications', { method: 'POST', headers, body: JSON.stringify({ name: '飞书', type: 'feishu', url: secretUrl }) })).json();
    const listed = await (await fetch(base + '/api/notifications', { headers })).text();
    assert.ok(!listed.includes('synthetic-secret'));
    assert.match(listed, /open\.feishu\.cn/);
    await fetch(base + '/api/notifications', { method: 'POST', headers, body: JSON.stringify({ id: created.id, name: '飞书群', url: JSON.parse(listed)[0].url }) });
    assert.equal(context.state.notifications[0].url, secretUrl);
    assert.equal(context.state.notifications[0].name, '飞书群');
  });
});

test('logout revokes only the presented session token', async () => {
  const context = fixture();
  await serve(context.app, async base => {
    const first = context.authService.login('admin', 'test-password-12345').token;
    const second = context.authService.login('admin', 'test-password-12345').token;
    const headers = token => ({ Authorization: `Bearer ${token}` });
    assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: headers(first) })).status, 200);
    assert.equal((await fetch(base + '/api/apps', { headers: headers(first) })).status, 401);
    assert.equal((await fetch(base + '/api/apps', { headers: headers(second) })).status, 200);
    assert.equal(context.state.admin.revokedTokens.length, 1);
  });
});
