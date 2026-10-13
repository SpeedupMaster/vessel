const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

function frontend() {
  const effects = [], sockets = [], timers = new Map(), calls = [], state = [];
  let nextTimer = 0, anchor;
  const stored = new Map([['vessel_auth_token', 'valid-test-token']]);
  const react = { useState: initial => { const index = state.length; state.push(initial); return [initial, value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useEffect: effect => effects.push(effect), useCallback: callback => callback, useRef: current => ({ current }) };
  const localStorage = { getItem: key => stored.get(key) ?? null };
  class FakeSocket {
    static OPEN = 1;
    constructor(url, protocols) { this.url = url; this.protocols = protocols; this.readyState = 1; this.sent = []; sockets.push(this); }
    close() { this.onclose?.({ code: 1000 }); }
    send(message) { this.sent.push(JSON.parse(message)); }
  }
  const globals = { Headers, URLSearchParams, Event, console, localStorage,
    window: { location: { protocol: 'https:', host: 'test.invalid' }, dispatchEvent() {} },
    document: { hidden: false, createElement: () => anchor = { click() {} }, body: { appendChild() {}, removeChild() {} } },
    WebSocket: FakeSocket, setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => String(url).includes('/config') ? {} : [] }; },
  };
  const module = load('web/src/hooks/useData.ts', { react, './useAuth.js': {
    getStoredToken: () => stored.get('vessel_auth_token'), getAuthHeaders: () => ({ Authorization: `Bearer ${stored.get('vessel_auth_token')}` }),
  } }, globals);
  return { module, effects, sockets, timers, calls, state, globals, getAnchor: () => anchor };
}

test('backup download and upload use the actual stored authentication token', async () => {
  const context = frontend();
  const data = context.module.useData('valid-test-token', true);
  data.downloadBackup('backup-id', 'backup.zip');
  assert.ok(context.getAnchor().href.endsWith('token=valid-test-token'));
  await data.restoreDatabaseFromFile('app', { name: 'backup.sql' });
  const upload = context.calls.find(call => call.url.includes('restore-file'));
  assert.equal(upload.options.headers.get('Authorization'), 'Bearer valid-test-token');
});

test('WebSocket cleanup cancels pending reconnect and cannot open another socket', async () => {
  const context = frontend(); context.module.useData('valid-test-token', true);
  const cleanup = context.effects[0]();
  const ws = context.sockets[0];
  assert.deepEqual(Array.from(ws.protocols), ['vessel', 'auth.valid-test-token']);
  ws.onclose({ code: 1006 });
  const retry = [...context.timers.values()][0];
  cleanup();
  assert.equal(context.timers.size, 0);
  retry();
  assert.equal(context.sockets.length, 1);
});

test('WebSocket reconnect restores subscriptions and task events refresh application data', async () => {
  const context = frontend(); const data = context.module.useData('valid-test-token', true);
  const cleanup = context.effects[0]();
  data.subscribeLogs('application');
  const first = context.sockets[0]; first.onclose({ code: 1006 });
  [...context.timers.values()][0]();
  const second = context.sockets[1]; second.onopen();
  assert.equal(second.sent[0].channel, 'logs:application');
  const count = context.calls.length;
  second.onmessage({ data: JSON.stringify({ type: 'apps-changed' }) });
  assert.ok(context.calls.length > count);
  cleanup();
});

test('unauthenticated sessions neither fetch private data nor open WebSockets', () => {
  const context = frontend(); context.module.useData(null, false); context.effects[0]();
  assert.equal(context.calls.length, 0); assert.equal(context.sockets.length, 0);
});

test('a failed domain refresh does not discard successful application updates', async () => {
  const context = frontend();
  context.globals.fetch = async url => {
    if (url === '/api/domains') throw new Error('certificate lookup failed');
    return { ok: true, json: async () => url === '/api/apps' ? [{ id: 'fresh', status: 'running' }] : [] };
  };
  const data = context.module.useData('valid-test-token', true);
  await data.refreshAll();
  assert.equal(context.state[1][0].id, 'fresh');
  assert.equal(context.state[7], false);
});

test('restore dialog lists only its database backups and keeps edited target across renders', async () => {
  const state = [], effects = [], callbacks = [];
  let cursor = 0, effectCursor = 0, callbackCursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useRef: current => ({ current }),
    useCallback(callback, deps) { const index = callbackCursor++; const previous = callbacks[index];
      if (!previous || !same(previous.deps, deps)) callbacks[index] = { deps, callback };
      return callbacks[index].callback; },
    useEffect(callback, deps) { const index = effectCursor++; const previous = effects[index];
      effects[index] = { deps, callback, pending: !previous || !same(previous.deps, deps) }; },
  };
  const jsx = (type, props, key) => ({ type, props, key });
  const component = load('web/src/components/common/RestoreDatabaseBackupModal.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@phosphor-icons/react': new Proxy({}, { get: (_target, name) => name }),
    './Modal.js': { Modal: 'Modal' }, './Button8State.js': { Button8State: 'Button' },
    '../../hooks/useData.js': { apiFetch: async () => ({ ok: true, json: async () => ({ databases: ['postgres'] }) }) },
    '../../utils/format.js': { formatBytes: () => '1 KB' },
  }).RestoreDatabaseBackupModal;
  const props = { isOpen: true, onClose() {}, app: { id: 'target', name: 'target', envContent: 'POSTGRES_DB=original' },
    engineName: 'PostgreSQL', onRestoreRecord: async () => {}, backups: [
      { id: 'other', targetId: 'another', type: 'app_db', fileName: 'other.sql' },
      { id: 'volume', targetId: 'target', type: 'app_volume', fileName: 'volume.zip' },
      { id: 'own', targetId: 'target', type: 'app_db', fileName: 'own.sql' },
    ] };
  const render = () => { cursor = effectCursor = callbackCursor = 0; return component(props); };
  const flush = () => { for (const effect of effects) if (effect.pending) { effect.pending = false; effect.callback(); } };
  function nodes(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
  }
  render(); flush(); await new Promise(resolve => setImmediate(resolve));
  const tree = render(); flush();
  assert.deepEqual(nodes(tree, node => ['own', 'other', 'volume'].includes(node.key)).map(node => node.key), ['own']);
  const input = nodes(tree, node => node.type === 'input' && node.props.type === 'text')[0];
  input.props.onChange({ target: { value: 'chosen-target' } });
  render(); flush();
  const updated = render();
  assert.equal(nodes(updated, node => node.type === 'input' && node.props.type === 'text')[0].props.value, 'chosen-target');
});
