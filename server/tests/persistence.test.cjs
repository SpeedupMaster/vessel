const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { root, load, database, appFixture } = require('./helpers.cjs');

function readDatabase(directory, code = '') {
  const url = pathToFileURL(path.join(root, 'server/dist/db/index.js')).href;
  return spawnSync(process.execPath, ['--input-type=module', '-e', `const {db,DATA_DIR}=await import(${JSON.stringify(url)}); ${code}`], {
    env: { ...process.env, DATA_DIR: directory, VESSEL_ADMIN_PASSWORD: '' }, encoding: 'utf8', timeout: 10000,
  });
}

test('fresh install uses configured data directory and a unique random initial password', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-initial-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const run = readDatabase(directory);
  assert.equal(run.status, 0, run.stderr);
  const password = fs.readFileSync(path.join(directory, 'initial-admin-password'), 'utf8').trim();
  const saved = JSON.parse(fs.readFileSync(path.join(directory, 'vessel_db.json'), 'utf8'));
  assert.notEqual(password, 'vessel2026'); assert.ok(password.length >= 24);
  assert.equal(saved.admin.mustChangePassword, true);
  assert.deepEqual(saved.apps, []);
  assert.deepEqual(saved.domains, []);
  assert.deepEqual(saved.backups, []);
  assert.ok(saved.registries.every(registry => !registry.username && !registry.token && registry.status === 'unverified'));
  assert.ok(load('server/src/services/password.ts').matchesPassword(password, saved.admin.passwordHash));
  const restarted = readDatabase(directory);
  assert.equal(restarted.status, 0, restarted.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'vessel_db.json'), 'utf8')).admin.jwtSecret, saved.admin.jwtSecret);
});

test('corrupt database fails closed and original content remains untouched', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-corrupt-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'vessel_db.json'); fs.writeFileSync(file, '{broken original');
  const run = readDatabase(directory);
  assert.notEqual(run.status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken original');
});

test('database app updates preserve intervening additions and never recreate missing records', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-updates-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const run = readDatabase(directory, `
    db.set('apps',[{id:'one',name:'original'},{id:'two',name:'new'}]);
    db.updateApp('one',{status:'running'});
    if(db.get('apps').length!==2) throw Error('Lost application');
    db.set('apps',db.get('apps').filter(app=>app.id!=='one'));
    if(db.updateApp('one',{status:'running'})!==undefined) throw Error('Resurrected application');
  `);
  assert.equal(run.status, 0, run.stderr);
});

test('unreachable certificate reports unknown instead of a fabricated expiry', async () => {
  const { EventEmitter } = require('node:events');
  const context = database();
  const caddy = load('server/src/services/caddy.ts', {
    '../db/index.js': { db: context.db, DATA_DIR: '/isolated' }, fs: { writeFileSync() {} },
    '../middleware/validation.js': { validateDomain() {} },
    'node:tls': { connect() { const socket = new EventEmitter(); socket.setTimeout = () => {}; socket.destroy = () => {}; setImmediate(() => socket.emit('error', new Error('offline'))); return socket; } },
  }, { fetch: async () => ({ ok: true }), AbortSignal, console, process }).caddyService;
  const result = await caddy.checkCertStatus('example.invalid');
  assert.equal(result.status, 'unknown'); assert.equal(result.expiresAt, undefined);
});

test('Caddy reloads are sent without browser fetch headers the admin API rejects', async () => {
  const http = require('node:http');
  const seen = [];
  // Mirrors Caddy's admin origin check: browser-style requests without an allowed Origin get 403
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      seen.push({ url: req.url, type: req.headers['content-type'], body });
      res.statusCode = req.headers['sec-fetch-mode'] && !req.headers.origin ? 403 : 200;
      res.end();
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const previous = process.env.CADDY_API;
  process.env.CADDY_API = `http://127.0.0.1:${server.address().port}`;
  try {
    const context = database();
    const caddy = load('server/src/services/caddy.ts', {
      '../db/index.js': { db: context.db, DATA_DIR: '/isolated' }, fs: { writeFileSync() {} },
      '../middleware/validation.js': { validateDomain() {} },
    }, { Buffer, URL, AbortSignal, console, process }).caddyService;
    assert.equal(await caddy.reloadCaddyApi(':80 {\n}\n'), true);
    const load_ = seen.find(request => request.body === ':80 {\n}\n');
    assert.equal(load_.url, '/load');
    assert.equal(load_.type, 'text/caddyfile');
  } finally {
    if (previous === undefined) delete process.env.CADDY_API; else process.env.CADDY_API = previous;
    server.close();
  }
});

test('prune completion preserves configuration changed while Docker was running', async () => {
  const store = database({ maintenance: { unusedRetentionHours: 72, autoPrune: true } });
  const cleaner = load('server/src/services/cleaner.ts', {
    '../db/index.js': { db: store.db }, './process.js': { runDocker: async () => {
      store.db.set('maintenance', { unusedRetentionHours: 120, autoPrune: false });
      return { stdout: 'Total reclaimed space: 1MB' };
    } },
  }).cleanerService;
  assert.equal((await cleaner.runSafePrune()).success, true);
  assert.equal(store.state.maintenance.unusedRetentionHours, 120);
  assert.equal(store.state.maintenance.autoPrune, false);
  assert.ok(store.state.maintenance.lastPruneAt);
});
