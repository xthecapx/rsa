const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { canFindQward, findQward, QWARD_DISCOVERY } = loadTs(path.join(__dirname, '../game/qward.ts'));
const { CompanionTrail } = loadTs(path.join(__dirname, '../engine/companionTrail.ts'));
const { useTown } = loadTs(path.join(__dirname, '../game/town.ts'));
const { useProgress } = loadTs(path.join(__dirname, '../game/progress.ts'));
const { useMedals } = loadTs(path.join(__dirname, '../game/medals.ts'));
const { useGame } = loadTs(path.join(__dirname, '../game/state.ts'));
const { restoreCheckpoint } = loadTs(path.join(__dirname, '../game/restoreCheckpoint.ts'));
const complete = { coin: ['coin'], grover: ['grover'], vault: ['vault'], rsa: ['1', '2', '3', '4'] };
const medals = Object.fromEntries(['quantum-coin', 'amplifier', 'ghost-key', 'codebook', 'key-ring', 'prime-cutter', 'period-lens'].map(id => [id, 'earned']));

test('qWard needs every main challenge, with no optional cards, badges or campus requirement', () => {
  assert.equal(canFindQward(complete, {}), true);
  assert.equal(canFindQward({}, medals), true);
  assert.equal(canFindQward({ ...complete, rsa: ['1', '2', '3'] }, {}), false);
  assert.equal(canFindQward({ ...complete, grover: [] }, { 'quantum-explorer': 'earned', 'foundry-town': 'earned' }), false);
  assert.equal(canFindQward({ ...complete, grover: [] }, { amplifier: 'earned' }), true);
  const es = require('../i18n/es.json');
  assert.ok(es[QWARD_DISCOVERY]);
  assert.ok(es['Come along, qWard!']);
});

test('claiming qWard is explicit, guarded, idempotent and survives replays and checkpoint travel', () => {
  useTown.getState().reset();
  useGame.getState().resetRun(1);
  useProgress.setState({ completed: complete });
  useMedals.setState({ earned: medals });
  assert.equal(findQward(), false, 'cannot claim outside Quantum Town');
  useTown.getState().patch({ location: 'town' });
  useGame.setState({ operations: 1 });
  assert.equal(findQward(), false);
  useGame.setState({ operations: 0 });
  assert.equal(useTown.getState().qwardFound, false);
  assert.equal(findQward(), true);
  assert.equal(findQward(), true);
  assert.equal(useTown.getState().qwardFound, true);
  useProgress.getState().reset('coin');
  assert.equal(useTown.getState().qwardFound, true);
  assert.equal(restoreCheckpoint('ct1'), true);
  assert.equal(useTown.getState().qwardFound, true);
  assert.equal(useGame.getState().operations, 0);
  useTown.getState().reset();
  assert.equal(useTown.getState().qwardFound, false);
});

test('old saves default to no companion, and only a boolean true restores the discovery', () => {
  const merge = useTown.persist.getOptions().merge;
  const current = useTown.getState();
  assert.equal(merge({}, current).qwardFound, false);
  assert.equal(merge({ qwardFound: 'true' }, current).qwardFound, false);
  assert.equal(merge({ qwardFound: true }, current).qwardFound, true);
});

test('the companion keeps a gap and follows corners instead of crossing scenery', () => {
  const trail = new CompanionTrail({ x: 0, y: 0 }, 16);
  assert.deepEqual(trail.follow({ x: 16, y: 0 }, 16), { x: 0, y: 0 });
  assert.deepEqual(trail.follow({ x: 16, y: 16 }, 8), { x: 8, y: 0 });
  assert.deepEqual(trail.follow({ x: 16, y: 16 }, 8), { x: 16, y: 0 });
  assert.deepEqual(trail.follow({ x: 16, y: 16 }, 100), { x: 16, y: 0 });
  assert.deepEqual(trail.follow({ x: 0, y: 16 }, 16), { x: 16, y: 16 });
  trail.reset({ x: 200, y: 200 });
  assert.deepEqual(trail.follow({ x: 216, y: 200 }, 100), { x: 200, y: 200 });
  assert.deepEqual(trail.follow({ x: 232, y: 200 }, 100), { x: 216, y: 200 });
});

test('engine vector getters are copied as coordinates, including after scene placement', () => {
  const vector = (x, y) => Object.create({ get x() { return x; }, get y() { return y; } });
  const trail = new CompanionTrail(vector(0, 0), 16);
  assert.deepEqual(trail.follow(vector(32, 0), 16), { x: 16, y: 0 });
  trail.reset(vector(100, 200));
  assert.deepEqual(trail.follow(vector(132, 200), 16), { x: 116, y: 200 });
});
