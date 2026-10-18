const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const requireServer = createRequire(path.resolve(__dirname, '../package.json'));
const ts = requireServer('typescript');
const root = path.resolve(__dirname, '../..');

function load(relative, mocks = {}, globals) {
  const filename = path.join(root, relative);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const code = `(function(require,module,exports){${js}\n})`;
  const fn = globals ? vm.runInNewContext(code, globals, { filename }) : vm.runInThisContext(code, { filename });
  const fileRequire = createRequire(filename);
  fn(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.')) {
      const targetTs = path.resolve(path.dirname(filename), id.replace(/\.js$/, '.ts'));
      if (fs.existsSync(targetTs)) return load(path.relative(root, targetTs), mocks, globals);
      return fileRequire(id);
    }
    return requireServer(id);
  }, module, module.exports);
  return module.exports;
}

function database(initial = {}) {
  const state = { apps: [], domains: [], backups: [], registries: [], deployments: [], notifications: [], r2Config: { enabled: false, retentionCount: 7 }, maintenance: {}, ...initial };
  return { state, db: {
    get: key => state[key], set: (key, value) => { state[key] = value; },
    updateApp: (id, update) => {
      const index = state.apps.findIndex(app => app.id === id);
      if (index < 0) return undefined;
      state.apps[index] = typeof update === 'function' ? update(state.apps[index]) : { ...state.apps[index], ...update };
      return state.apps[index];
    },
  } };
}

const appFixture = () => ({ id: 'fixture', name: 'Fixture', description: '',
  composeYaml: 'services:\n  database:\n    image: postgres:16\n', envContent: 'PASSWORD=synthetic',
  status: 'stopped', autoUpdate: false, createdAt: '', updatedAt: '', containers: [] });

module.exports = { load, database, root, requireServer, appFixture };
