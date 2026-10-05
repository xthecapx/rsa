const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { serviceFetch, setServiceTransport, serviceError, runtimeInfo } = loadTs(path.join(__dirname, '../lib/transport.ts'));

test('the embedded transport avoids HTTP and preserves service error details', async () => {
  const original = global.fetch;
  global.fetch = () => { throw new Error('Unexpected HTTP request'); };
  try {
    runtimeInfo.target = 'qollab';
    setServiceTransport(async (path, init) => {
      assert.equal(path, '/api/coin/simulate');
      assert.deepEqual(JSON.parse(init.body), { shots: 1 });
      return new Response(JSON.stringify({ counts: { '0': 1 } }));
    });
    const response = await serviceFetch('/api/coin/simulate', { body: '{"shots":1}' });
    assert.deepEqual(await response.json(), { counts: { '0': 1 } });
    const error = await serviceError(new Response('{"detail":"Needs 26 qubits"}', { status: 400 }), 'fallback');
    assert.equal(error.message, 'Needs 26 qubits');
    runtimeInfo.target = 'web';
    assert.equal((await serviceError(new Response('{"detail":"different"}', { status: 400 }), 'fallback')).message, 'fallback');
  } finally {
    global.fetch = original;
    runtimeInfo.target = 'web';
    setServiceTransport(null);
  }
});
