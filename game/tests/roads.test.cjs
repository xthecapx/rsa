const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { openRoads, roadBadges } = loadTs(path.join(__dirname, '../game/roads.ts'));
const { useProgress } = loadTs(path.join(__dirname, '../game/progress.ts'));
const { useMedals } = loadTs(path.join(__dirname, '../game/medals.ts'));
const { useKnowledge } = loadTs(path.join(__dirname, '../game/knowledge.ts'));
const { ALL_KNOWLEDGE_IDS } = loadTs(path.join(__dirname, '../content/knowledge.ts'));
const roads = () => {
  const result = openRoads({ badges: roadBadges(useMedals.getState().earned), metThecap: false, rsaActs: 0 });
  return [result.coinEast, result.coinWest, result.coinNorth, result.cipherNorth];
};

test('earned challenge medals open every next road with zero knowledge cards and no town ceremony', async () => {
  await useMedals.persist.rehydrate();
  useProgress.getState().reset();
  useMedals.getState().reset();
  useKnowledge.setState({ cards: [] });
  assert.deepEqual(roads(), [false, false, false, false]);
  useProgress.getState().complete('coin', 'coin');
  assert.deepEqual(roads(), [true, false, false, false]);
  useProgress.getState().complete('grover', 'grover');
  assert.deepEqual(roads(), [true, true, false, false]);
  useProgress.getState().complete('vault', 'vault');
  assert.deepEqual(roads(), [true, true, true, false]);
  for (const act of ['1', '2', '3']) useProgress.getState().complete('rsa', act);
  assert.deepEqual(roads(), [true, true, true, false]);
  useProgress.getState().complete('rsa', '4');
  assert.deepEqual(roads(), [true, true, true, true]);
  assert.deepEqual(useKnowledge.getState().cards, []);
  for (const id of ['coin-town', 'foundry-town', 'hollow-town', 'cipher-town']) assert.equal(useMedals.getState().earned[id], undefined);
});

test('knowledge cards alone and the final RSA medal alone do not open the next road', () => {
  useMedals.getState().reset();
  useKnowledge.setState({ cards: [...ALL_KNOWLEDGE_IDS] });
  assert.deepEqual(roads(), [false, false, false, false]);
  useMedals.getState().award('period-lens');
  assert.deepEqual(roads(), [false, false, false, false]);
});

test('older town badges still open roads independently of optional cards', () => {
  useMedals.getState().reset();
  useKnowledge.setState({ cards: [] });
  useMedals.getState().award('coin-town');
  assert.deepEqual(roads(), [true, false, false, false]);
  useMedals.getState().award('foundry-town');
  assert.deepEqual(roads(), [true, true, false, false]);
  useMedals.getState().award('hollow-town');
  assert.deepEqual(roads(), [true, true, true, false]);
  useMedals.getState().award('cipher-town');
  assert.deepEqual(roads(), [true, true, true, true]);
});
