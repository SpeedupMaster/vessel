const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pipeline, finished } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { load, appFixture, database, requireServer } = require('./helpers.cjs');

function fixture(directory, fail = false) {
  const commands = [];
  const runDocker = async (args, options = {}) => {
    commands.push(args);
    if (args[0] === 'inspect') return { stdout: JSON.stringify([{ Id: 'fixture-container', State: { Running: true },
      Config: { Labels: { 'com.docker.compose.service': 'database' } },
      Mounts: [{ Type: 'volume', Name: 'fixture-data', Destination: '/data', RW: true }], }]) };
    if (options.output) {
      if (fail) {
        const closed = finished(options.output).catch(() => {});
        options.output.destroy(new Error('tar export failed'));
        await closed;
        throw new Error('tar export failed');
      }
      await pipeline(Readable.from(['actual-volume-bytes']), options.output);
    }
    if (options.input) for await (const _chunk of options.input) {}
    return { stdout: '', stderr: '' };
  };
  const dockerService = { compose: async (_app, args) => { commands.push(['compose', ...args]); return { stdout: args[0] === 'ps' ? 'fixture-container' : '' }; },
    prepareAppFiles() {}, syncAppContainers: async () => [] };
  const volumes = load('server/src/services/volumeBackup.ts', { './process.js': { runDocker }, './docker.js': { dockerService } });
  return { commands, dockerService, volumes, runDocker };
}

test('volume export archives daemon mount data and resumes originally running containers', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-volume-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory);
  await context.volumes.exportVolumes(appFixture(), directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'volumes.json'), 'utf8'));
  assert.equal(manifest.entries[0].target, '/data');
  assert.equal(fs.readFileSync(path.join(directory, manifest.entries[0].archive), 'utf8'), 'actual-volume-bytes');
  assert.ok(context.commands.some(args => args.includes('type=volume,source=fixture-data,target=/volume,readonly')));
  assert.ok(context.commands.findIndex(args => args[0] === 'stop') < context.commands.findIndex(args => args[0] === 'run'));
  assert.equal(context.commands.at(-1)[0], 'start');
});

test('failed volume export resumes application without reporting a completed backup', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-volume-fail-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory, true);
  await assert.rejects(context.volumes.exportVolumes(appFixture(), directory), /tar export failed/);
  assert.equal(context.commands.at(-1)[0], 'start');
  assert.ok(!fs.existsSync(path.join(directory, 'volumes.json')));
});

test('application backup ZIP contains both manifest and actual volume payload', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-app-archive-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = fixture(directory); const store = database({ apps: [appFixture()] });
  const backup = load('server/src/services/r2Backup.ts', {
    '../db/index.js': { db: store.db, DATA_DIR: directory, APPS_DATA_DIR: path.join(directory, 'apps') },
    './docker.js': { dockerService: context.dockerService }, './caddy.js': { caddyService: {} },
    './process.js': { runDocker: context.runDocker }, './volumeBackup.js': context.volumes,
    '../middleware/validation.js': load('server/src/middleware/validation.ts'),
  }).r2BackupService;
  const result = await backup.runAppBackup(store.state.apps[0]);
  assert.equal(result.success, true, result.error);
  const zip = new (requireServer('adm-zip'))(path.join(directory, 'backups', result.record.fileName));
  assert.equal(zip.readAsText('volume-0.tar'), 'actual-volume-bytes');
  assert.ok(zip.getEntry('volumes.json'));
  assert.ok(zip.getEntry('docker-compose.yml'));
});

test('volume restore validates before stopping and makes rollback copy before replacement', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-volume-restore-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'volume-0.tar'), 'synthetic archive');
  fs.writeFileSync(path.join(directory, 'volumes.json'), JSON.stringify({ version: 1, entries: [{ service: 'database', target: '/data', archive: 'volume-0.tar' }] }));
  const context = fixture(directory);
  await context.volumes.importVolumes(appFixture(), directory);
  const validation = context.commands.findIndex(args => args.some(arg => arg.includes('tar xpf - -C /stage')));
  const stopped = context.commands.findIndex(args => args[0] === 'stop');
  const rollback = context.commands.findIndex(args => args.includes('cpf'));
  const replaced = context.commands.findIndex(args => args.some(arg => arg.includes('cp -a /stage/data/')));
  assert.ok(validation >= 0 && validation < stopped && stopped < rollback && rollback < replaced);
  assert.ok(context.commands.some(args => args[0] === 'compose' && args[1] === 'start'));
  assert.equal(context.commands.at(-1)[1], 'rm');
});
