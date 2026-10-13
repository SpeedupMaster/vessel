const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { load } = require('./helpers.cjs');
const { runProcess } = load('server/src/services/process.ts');
const operations = load('server/src/services/appOperations.ts');

test('process arguments remain literal, including shell operators and spaces', async () => {
  const payload = 'name; echo SHOULD_NOT_EXECUTE && $(echo nope)';
  const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', payload]);
  assert.equal(result.stdout, payload);
});

test('process failures, launch errors and timeouts reject', async () => {
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.stderr.write("failed"); process.exit(7)']), /failed/);
  await assert.rejects(runProcess('vessel-nonexistent-binary', []), /ENOENT/);
  await assert.rejects(runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 50 }), /timed out/);
});

test('process waits for both child exit and writable completion', async () => {
  let finished = false;
  const sink = new Writable({ write(_chunk, _encoding, callback) { setTimeout(callback, 40); } });
  sink.on('finish', () => { finished = true; });
  await runProcess(process.execPath, ['-e', 'process.stdout.write("dump")'], { output: sink });
  assert.equal(finished, true);
});

test('process handles output and input stream errors', async () => {
  const sink = new Writable({ write(_chunk, _encoding, callback) { callback(new Error('disk full')); } });
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.stdout.write("dump")'], { output: sink }), /disk full/);
  const source = new Readable({ read() { this.destroy(new Error('invalid archive')); } });
  await assert.rejects(runProcess(process.execPath, ['-e', 'process.stdin.resume()'], { input: source }), /invalid archive/);
});

test('same application operations conflict, other applications proceed, locks release on failure', async () => {
  let release;
  const running = operations.withAppLock('one', () => new Promise(resolve => { release = resolve; }));
  await assert.rejects(operations.withAppLock('one', async () => {}), /其他任务/);
  await assert.rejects(operations.withAppLock('*', async () => {}), /仍有应用任务/);
  await operations.withAppLock('two', async () => {});
  release(); await running;
  await assert.rejects(operations.withAppLock('one', async () => { throw new Error('failure'); }), /failure/);
  await operations.withAppLock('one', async () => {});
});
