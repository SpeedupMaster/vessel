const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

const { servicePorts } = load('web/src/utils/composePorts.ts');

test('compose port detection reads expose and both ports syntaxes', () => {
  assert.deepEqual(servicePorts({ expose: [8045] }), { container: [8045], host: [] });
  assert.deepEqual(servicePorts({ expose: ['3000/tcp'] }), { container: [3000], host: [] });
  assert.deepEqual(servicePorts({ ports: ['8080:80', '127.0.0.1:9443:443/tcp', '5432', '[::1]:6380:6379'] }), {
    container: [80, 443, 5432, 6379], host: [8080, 9443, 6380],
  });
  assert.deepEqual(servicePorts({ ports: [{ target: 80, published: '8081' }, { target: 9000 }] }), { container: [80, 9000], host: [8081] });
  assert.deepEqual(servicePorts({ ports: ['${PORT}:80'], expose: ['${X}'] }), { container: [80], host: [] });
  assert.deepEqual(servicePorts({}), { container: [], host: [] });
});
