const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { load, database, appFixture, requireServer } = require('./helpers.cjs');

function fixture(directory, processMock = async () => ({ stdout: '', stderr: '' })) {
  const store = database({ apps: [appFixture()] });
  const docker = { prepareAppFiles: () => ({ composePath: '/isolated/file.yml', appDir: directory, envPath: '/isolated/.env' }) };
  const caddy = { syncCaddyfile() {} };
  const backup = load('server/src/services/r2Backup.ts', {
    '../db/index.js': { db: store.db, DATA_DIR: directory, APPS_DATA_DIR: path.join(directory, 'apps') },
    './docker.js': { dockerService: docker }, './caddy.js': { caddyService: caddy },
    './process.js': { runDocker: processMock }, './volumeBackup.js': { exportVolumes: async () => {}, importVolumes: async () => {} },
    '../middleware/validation.js': load('server/src/middleware/validation.ts'),
  });
  return { ...store, ...backup, docker, caddy, service: backup.r2BackupService };
}

test('database dump finishes when output completes before process completion', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-backup-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory, async (_args, options) => {
    await pipeline(Readable.from(['SELECT 1;']), options.output);
    await new Promise(resolve => setTimeout(resolve, 20));
    return { stdout: '', stderr: '' };
  });
  const result = await context.service.runDatabaseBackup(context.state.apps[0]);
  assert.equal(result.success, true);
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(directory, 'backups', result.record.fileName))).toString(), 'SELECT 1;');
  assert.equal(context.state.backups.length, 1);
});

test('failed database export creates no successful record', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-backup-fail-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory, async (_args, options) => {
    options.output.destroy(new Error('export failed'));
    throw new Error('export failed');
  });
  const result = await context.service.runDatabaseBackup(context.state.apps[0]);
  assert.equal(result.success, false);
  assert.equal(context.state.backups.length, 0);
});

test('database R2 download restore and delete all use the upload prefix', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-r2-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory);
  const record = { id: 'db-test', type: 'app_db', targetId: 'fixture', fileName: 'dump.sql.gz' };
  context.state.backups = [record]; context.state.r2Config.bucketName = 'synthetic';
  const keys = [];
  context.service.getS3Client = () => ({ send: async command => {
    keys.push(command.input.Key);
    return { Body: Readable.from([zlib.gzipSync('synthetic dump')]) };
  } });
  const downloaded = await context.service.getBackupDownload(record.id);
  downloaded.stream.destroy();
  context.service.restoreDatabaseDump = async () => ({ success: true });
  assert.equal((await context.service.restoreBackup(record.id)).success, true);
  assert.equal((await context.service.deleteBackup(record.id)).success, true);
  assert.deepEqual(keys, Array(3).fill('databases/fixture/dump.sql.gz'));
  assert.equal(context.backupObjectKey({ ...record, type: 'system' }), 'system/dump.sql.gz');
  assert.equal(context.backupObjectKey({ ...record, type: 'app_volume' }), 'apps/fixture/dump.sql.gz');
});

test('R2 deletion failure preserves the local backup and catalogue for retry', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-retention-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'backups'));
  fs.writeFileSync(path.join(directory, 'backups', 'dump.sql.gz'), 'synthetic');
  const context = fixture(directory);
  context.state.backups = [{ id: 'old', type: 'app_db', targetId: 'fixture', fileName: 'dump.sql.gz' }];
  context.state.r2Config.bucketName = 'synthetic';
  context.service.getS3Client = () => ({ send: async () => { throw new Error('offline'); } });
  assert.equal((await context.service.deleteBackup('old')).success, false);
  assert.equal(context.state.backups.length, 1);
  assert.ok(fs.existsSync(path.join(directory, 'backups', 'dump.sql.gz')));
});

test('corrupt compressed restore fails without crashing the process', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-restore-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'invalid.sql.gz'); fs.writeFileSync(file, 'not gzip');
  const context = fixture(directory, async (_args, options) => { for await (const _chunk of options.input) {} return { stdout: '', stderr: '' }; });
  const result = await context.service.restoreDatabaseDump({ targetId: 'fixture', fileName: 'invalid.sql.gz' }, file);
  assert.equal(result.success, false);
});

test('new applications detect updates using actual container image digests', async () => {
  const store = database({ apps: [appFixture()] });
  const commands = [];
  const processMock = async args => {
    commands.push(args);
    if (args[0] === 'inspect') return { stdout: JSON.stringify([{ Image: 'sha256:old', Config: { Image: 'registry/image:tag', Labels: { 'com.docker.compose.service': 'database' } } }]) };
    if (args[0] === 'image') return { stdout: JSON.stringify([{ Id: 'sha256:old', Os: 'linux', Architecture: 'amd64' }]) };
    return { stdout: JSON.stringify({ config: { digest: 'sha256:new' } }) };
  };
  const registry = load('server/src/services/registry.ts', { '../db/index.js': { db: store.db },
    './docker.js': { dockerService: { compose: async () => ({ stdout: 'container-id' }) } }, './process.js': { runDocker: processMock } }).registryService;
  const result = await registry.checkAppUpdate(store.state.apps[0]);
  assert.equal(result.hasUpdate, true);
  assert.notEqual(result.currentDigest, result.newDigest);
  await registry.captureAppDigest(store.state.apps[0]);
  assert.equal(store.state.apps[0].currentDigest, result.currentDigest);
});

test('log service names cannot inject commands and tail is bounded', async () => {
  const store = database({ apps: [appFixture()] }); let command;
  const docker = load('server/src/services/docker.ts', { '../db/index.js': { db: store.db, APPS_DATA_DIR: '/isolated' },
    './process.js': { runDocker: async args => { command = args; return { stdout: 'log line', stderr: '' }; } }, fs: {} }).dockerService;
  docker.prepareAppFiles = () => ({ composePath: '/path with spaces/compose.yml', appDir: '.', envPath: '.env' });
  await assert.rejects(docker.getAppLogs(store.state.apps[0], { service: 'database; echo BAD' }), /Unknown Compose service/);
  await docker.getAppLogs(store.state.apps[0], { service: 'database', tail: 1e9 });
  assert.equal(command[2], '/path with spaces/compose.yml');
  assert.equal(command[command.indexOf('--tail') + 1], '5000');
});

test('simultaneous backup completions have unique IDs and archive names', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-backup-ids-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory, async (_args, options) => {
    await pipeline(Readable.from(['SELECT 1;']), options.output);
    return { stdout: '', stderr: '' };
  });
  const originalNow = Date.now;
  Date.now = () => 123456789;
  try {
    const results = await Promise.all(Array.from({ length: 3 }, () => context.service.runDatabaseBackup(context.state.apps[0])));
    assert.ok(results.every(result => result.success), JSON.stringify(results));
    assert.equal(new Set(results.map(result => result.record.id)).size, 3);
    assert.equal(new Set(results.map(result => result.record.fileName)).size, 3);
  } finally { Date.now = originalNow; }
});

test('retention preserves other backup types and database targets', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-retention-types-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory);
  context.state.r2Config.retentionCount = 1;
  const record = (id, type, databaseName, createdAt) => ({ id, type, databaseName, createdAt, targetId: 'fixture' });
  const latest = record('new', 'app_db', 'main', '2026-10-13');
  context.state.backups = [record('old', 'app_db', 'main', '2026-10-12'), latest,
    record('volume', 'app_volume', undefined, '2026-10-11'), record('other-db', 'app_db', 'other', '2026-10-10')];
  const deleted = [];
  context.service.deleteBackup = async id => { deleted.push(id); return { success: true }; };
  await context.service.enforceRetention(latest);
  assert.deepEqual(deleted, ['old']);
});

test('MongoDB restores full archives without filtering and remaps single database namespaces', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-mongo-restore-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'dump.archive.gz'); fs.writeFileSync(file, zlib.gzipSync('archive'));
  const commands = [];
  const context = fixture(directory, async (args, options) => {
    commands.push(args); for await (const _chunk of options.input) {}
    return { stdout: '', stderr: '' };
  });
  context.state.apps[0].composeYaml = 'services:\n  database:\n    image: mongo:7\n';
  const record = { targetId: 'fixture', fileName: 'dump.archive.gz', databaseName: 'all' };
  assert.equal((await context.service.restoreDatabaseDump(record, file)).success, true);
  assert.ok(!commands[0].includes('-d') && !commands[0].includes('--nsInclude'));
  assert.ok(commands[0].includes('--stopOnError'));
  assert.equal((await context.service.restoreDatabaseDump(record, file, { databaseName: 'partial' })).success, false);
  assert.equal(commands.length, 1);
  assert.equal((await context.service.restoreDatabaseDump({ ...record, databaseName: 'source' }, file, { databaseName: 'target' })).success, true);
  assert.equal(commands[1][commands[1].indexOf('--nsFrom') + 1], 'source.*');
  assert.equal(commands[1][commands[1].indexOf('--nsTo') + 1], 'target.*');
});

test('local deletion failure retains the backup catalogue entry', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-delete-fail-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'backups', 'archive.zip'), { recursive: true });
  const context = fixture(directory);
  context.state.backups = [{ id: 'local', type: 'app_volume', targetId: 'fixture', fileName: 'archive.zip' }];
  const result = await context.service.deleteBackup('local');
  assert.equal(result.success, false);
  assert.equal(context.state.backups.length, 1);
});

test('database commands use the selected image and decoded dotenv credentials', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-db-engine-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const commands = [];
  const context = fixture(directory, async (args, options) => {
    commands.push(args);
    if (options.output) await pipeline(Readable.from(['dump']), options.output);
    if (options.input) for await (const _chunk of options.input) {}
    return { stdout: '', stderr: '' };
  });
  const app = context.state.apps[0];
  app.composeYaml = '# migrated from postgres\nservices:\n  database:\n    image: mysql:8\n';
  app.envContent = 'MYSQL_USER="operator"\nMYSQL_PASSWORD="pass with spaces"\nMYSQL_DATABASE=main';
  const result = await context.service.runDatabaseBackup(app, { databaseName: 'main' });
  assert.equal(result.success, true, result.error);
  assert.ok(commands[0].includes('mysqldump'));
  assert.ok(commands[0].some(arg => typeof arg === 'string' && arg.includes('[client]')));
  assert.equal((await context.service.restoreDatabaseDump(result.record, path.join(directory, 'backups', result.record.fileName))).success, true);
  assert.ok(commands[1].includes('mysql'));
  assert.ok(commands[1].some(arg => typeof arg === 'string' && arg.includes('[client]')));
});

function systemFixture(directory) {
  const context = fixture(directory);
  context.state.admin = { username: 'current-admin', jwtSecret: 'current-secret' };
  const record = { id: 'system', type: 'system', targetId: 'vessel_system', fileName: 'system.zip' };
  context.state.backups = [record];
  const databasePath = path.join(directory, 'vessel_db.json');
  fs.writeFileSync(databasePath, JSON.stringify(context.state));
  context.db.reload = () => Object.assign(context.state, JSON.parse(fs.readFileSync(databasePath, 'utf8')));
  const appDir = path.join(directory, 'apps', 'fixture'); fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, 'Dockerfile'), 'original build context');
  fs.writeFileSync(path.join(appDir, 'unarchived.txt'), 'keep existing data');
  const restored = { ...context.state, admin: { username: 'old-admin' }, apps: [{ ...appFixture(), name: 'Restored' }], backups: [] };
  const zip = new (requireServer('adm-zip'))();
  zip.addFile('vessel_db.json', Buffer.from(JSON.stringify(restored)));
  zip.addFile('apps/fixture/Dockerfile', Buffer.from('restored build context'));
  zip.addFile('apps/fixture/config/settings.json', Buffer.from('{"restored":true}'));
  fs.mkdirSync(path.join(directory, 'backups'));
  zip.writeZip(path.join(directory, 'backups', record.fileName));
  return { ...context, appDir, databasePath };
}

test('system snapshots restore application build contexts and preserve current credentials', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-system-files-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = systemFixture(directory);
  const result = await context.service.restoreBackup('system');
  assert.equal(result.success, true, result.error);
  assert.equal(fs.readFileSync(path.join(context.appDir, 'Dockerfile'), 'utf8'), 'restored build context');
  assert.ok(fs.existsSync(path.join(context.appDir, 'config', 'settings.json')));
  assert.equal(fs.readFileSync(path.join(context.appDir, 'unarchived.txt'), 'utf8'), 'keep existing data');
  assert.equal(context.state.apps[0].name, 'Restored');
  assert.equal(context.state.admin.username, 'current-admin');
  assert.equal(context.state.backups[0].id, 'system');
});

test('failed system publication rolls back configuration files and database', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-system-rollback-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = systemFixture(directory);
  const originalDatabase = fs.readFileSync(context.databasePath, 'utf8');
  let attempts = 0;
  context.caddy.syncCaddyfile = () => { if (++attempts === 1) throw new Error('Caddyfile write failed'); };
  const result = await context.service.restoreBackup('system');
  assert.equal(result.success, false);
  assert.match(result.error, /Caddyfile write failed/);
  assert.equal(fs.readFileSync(context.databasePath, 'utf8'), originalDatabase);
  assert.equal(fs.readFileSync(path.join(context.appDir, 'Dockerfile'), 'utf8'), 'original build context');
  assert.ok(!fs.existsSync(path.join(context.appDir, 'config', 'settings.json')));
  assert.equal(context.state.apps[0].name, 'Fixture');
  assert.equal(attempts, 2);
});
