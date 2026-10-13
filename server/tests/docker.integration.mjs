import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('real named-volume backup restores deleted data, removes newer data, and resumes running containers',
  { skip: process.env.VESSEL_DOCKER_TEST !== '1', timeout: 180000 }, async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vessel-docker-test-'));
    process.env.DATA_DIR = directory;
    process.env.VESSEL_ADMIN_PASSWORD = 'integration-test-password';
    const { db } = await import('../dist/db/index.js');
    const { dockerService } = await import('../dist/services/docker.js');
    const { exportVolumes, importVolumes } = await import('../dist/services/volumeBackup.js');
    const id = `integration-${Date.now()}`;
    const app = { id, name: id, description: '', status: 'stopped', autoUpdate: false, envContent: '', containers: [],
      createdAt: '', updatedAt: '', composeYaml: 'services:\n  web:\n    image: alpine:3.21\n    command: ["sleep", "600"]\n    volumes:\n      - data:/data\nvolumes:\n  data: {}\n' };
    db.set('apps', [app]);
    const archiveDir = path.join(directory, 'archive'); fs.mkdirSync(archiveDir);
    try {
      const deployment = await dockerService.deployApp(app);
      assert.equal(deployment.success, true, deployment.error);
      await dockerService.compose(app, ['exec', '-T', 'web', 'sh', '-c', 'echo original > /data/original.txt']);
      await exportVolumes(app, archiveDir);
      assert.ok(fs.existsSync(path.join(archiveDir, 'volume-0.tar')));
      await dockerService.compose(app, ['exec', '-T', 'web', 'sh', '-c', 'rm /data/original.txt; echo later > /data/later.txt']);
      await importVolumes(app, archiveDir);
      const data = await dockerService.compose(app, ['exec', '-T', 'web', 'cat', '/data/original.txt']);
      assert.equal(data.stdout.trim(), 'original');
      await dockerService.compose(app, ['exec', '-T', 'web', 'test', '!', '-e', '/data/later.txt']);
    } finally {
      await dockerService.compose(app, ['down', '-v', '--remove-orphans']);
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
