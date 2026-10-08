const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');

const modules = [['town', 'useTown'], ['progress', 'useProgress'], ['medals', 'useMedals'], ['knowledge', 'useKnowledge'], ['wallet', 'useWallet']];
const stores = () => modules.map(([file, name]) => loadTs(path.join(__dirname, `../game/${file}.ts`))[name]);

test('blocked iframe storage retains hydration APIs and progress across repeated hydration', async () => {
  const previous = Object.getOwnPropertyDescriptor(global, 'window');
  Object.defineProperty(global, 'window', { configurable: true, value: {
    get localStorage() { throw new DOMException('Storage is blocked', 'SecurityError'); },
  } });
  try {
    const [town, progress, medals, knowledge, wallet] = stores();
    await Promise.all(stores().map((store) => store.persist.rehydrate()));
    assert.ok(stores().every((store) => store.persist.hasHydrated()));
    town.getState().patch({ welcomed: true });
    progress.getState().complete('coin', 'coin');
    knowledge.getState().learn(loadTs(path.join(__dirname, '../content/knowledge.ts')).COIN_KNOWLEDGE_IDS[0]);
    wallet.getState().advance();
    const earned = medals.getState().earned;
    assert.equal(Object.keys(earned).length, 1);
    await Promise.all(stores().map((store) => store.persist.rehydrate()));
    assert.equal(town.getState().welcomed, true);
    assert.deepEqual(progress.getState().completed.coin, ['coin']);
    assert.equal(knowledge.getState().cards.length, 1);
    assert.deepEqual(medals.getState().earned, earned);
    assert.equal(wallet.getState().advanced, true);
    assert.equal(loadTs(path.join(__dirname, '../game/storage.ts')).storageUnavailable, true);
  } finally {
    if (previous) Object.defineProperty(global, 'window', previous);
    else delete global.window;
  }
});

test('available storage preserves existing save keys and restores serialized progress', async () => {
  const previous = Object.getOwnPropertyDescriptor(global, 'window');
  const saved = new Map([['quantum-playground-progress-v1', JSON.stringify({ state: { completed: { rsa: ['1', '2'] } }, version: 0 })]]);
  Object.defineProperty(global, 'window', { configurable: true, value: { localStorage: {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  } } });
  try {
    const [, progress, medals] = stores();
    // Start a new save session after the preceding blocked-storage test.
    for (const store of stores()) store.persist.clearStorage();
    saved.set('quantum-playground-progress-v1', JSON.stringify({ state: { completed: { rsa: ['1', '2'] } }, version: 0 }));
    await progress.persist.rehydrate();
    assert.deepEqual(progress.getState().completed.rsa, ['1', '2']);
    progress.getState().complete('rsa', '3');
    assert.deepEqual(JSON.parse(saved.get('quantum-playground-progress-v1')).state.completed.rsa, ['1', '2', '3']);
    await medals.persist.rehydrate();
    progress.getState().complete('coin', 'coin');
    progress.getState().reset('coin');
    await Promise.all([progress.persist.rehydrate(), medals.persist.rehydrate()]);
    const { currentCheckpoint } = loadTs(path.join(__dirname, '../game/checkpoints.ts'));
    assert.equal(currentCheckpoint('coinTown', [], progress.getState().completed, medals.getState().earned), 'ct3');
    assert.deepEqual(progress.getState().completed.coin, []);
    progress.getState().reset();
    medals.getState().reset();
    await Promise.all([progress.persist.rehydrate(), medals.persist.rehydrate()]);
    assert.equal(currentCheckpoint('coinTown', [], progress.getState().completed, medals.getState().earned), 'ct1');
    assert.deepEqual(stores().map((store) => store.persist.getOptions().name), ['quantum-town-v1', 'quantum-playground-progress-v1', 'quantum-town-medals-v1', 'quantum-town-knowledge-v1', 'quantum-town-wallet-v1']);
  } finally {
    if (previous) Object.defineProperty(global, 'window', previous);
    else delete global.window;
  }
});

test('readable but unwritable storage keeps newer in-memory saves and removals', () => {
  const previous = Object.getOwnPropertyDescriptor(global, 'window');
  Object.defineProperty(global, 'window', { configurable: true, value: { localStorage: {
    getItem: () => JSON.stringify({ state: { completed: false }, version: 0 }),
    setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
    removeItem: () => { throw new DOMException('Read only', 'SecurityError'); },
  } } });
  try {
    const storage = loadTs(path.join(__dirname, '../game/storage.ts')).saveStorage();
    assert.equal(storage.getItem('readonly-test').state.completed, false);
    storage.setItem('readonly-test', { state: { completed: true }, version: 0 });
    assert.equal(storage.getItem('readonly-test').state.completed, true);
    storage.removeItem('readonly-test');
    assert.equal(storage.getItem('readonly-test'), null);
  } finally {
    if (previous) Object.defineProperty(global, 'window', previous);
    else delete global.window;
  }
});
