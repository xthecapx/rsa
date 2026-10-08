const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { checkpoint, currentCheckpoint } = loadTs(path.join(__dirname, '../game/checkpoints.ts'));
const { restoreCheckpoint } = loadTs(path.join(__dirname, '../game/restoreCheckpoint.ts'));
const { useTown } = loadTs(path.join(__dirname, '../game/town.ts'));
const { useProgress } = loadTs(path.join(__dirname, '../game/progress.ts'));
const { useKnowledge } = loadTs(path.join(__dirname, '../game/knowledge.ts'));
const { useGame } = loadTs(path.join(__dirname, '../game/state.ts'));
const { useWallet } = loadTs(path.join(__dirname, '../game/wallet.ts'));
const { useMedals } = loadTs(path.join(__dirname, '../game/medals.ts'));
const { COIN_KNOWLEDGE_IDS } = loadTs(path.join(__dirname, '../content/knowledge.ts'));
const { roadBadges, openRoads } = loadTs(path.join(__dirname, '../game/roads.ts'));

test('lesson replays keep earned checkpoint milestones while a full reset clears them', async () => {
  await useMedals.persist.rehydrate();
  useProgress.getState().reset();
  useMedals.getState().reset();
  for (const [location, scenario, mission, code] of [
    ['coin', 'coin', 'coin', 'ct3'], ['grover', 'grover', 'grover', 'ft3'], ['vault', 'vault', 'vault', 'ht3'],
  ]) {
    useProgress.getState().complete(scenario, mission);
    useProgress.getState().reset(scenario);
    assert.equal(currentCheckpoint(location, [], useProgress.getState().completed, useMedals.getState().earned), code);
  }
  for (const act of ['1', '2', '3']) useProgress.getState().complete('rsa', act);
  assert.equal(currentCheckpoint('cipher', [], {}, useMedals.getState().earned), 'ci1');
  useProgress.getState().complete('rsa', '4');
  useProgress.getState().reset('rsa');
  assert.equal(currentCheckpoint('cipher', [], {}, useMedals.getState().earned), 'ci3');
  useProgress.getState().reset();
  useMedals.getState().reset();
  assert.equal(currentCheckpoint('coinTown', [], {}, useMedals.getState().earned), 'ct1');
  assert.equal(currentCheckpoint('cipher', [], {}, useMedals.getState().earned), 'ci1');
});

test('challenge-only codes restore open roads and merge without deleting earned progress', () => {
  for (const [location, completed, code, road] of [
    ['coinTown', { coin: ['coin'] }, 'ct3', 'coinEast'],
    ['foundry', { grover: ['grover'] }, 'ft3', 'coinWest'],
    ['hollow', { vault: ['vault'] }, 'ht3', 'coinNorth'],
    ['cipher', { rsa: ['1', '2', '3', '4'] }, 'ci3', 'cipherNorth'],
  ]) {
    assert.equal(currentCheckpoint(location, [], completed), code);
    useProgress.setState({ completed: { vault: ['vault'] } });
    useMedals.getState().reset();
    useKnowledge.setState({ cards: ['control'], fresh: null });
    useGame.getState().resetRun(1);
    assert.equal(restoreCheckpoint(code), true);
    assert.equal(useTown.getState().location, location);
    assert.ok(useKnowledge.getState().cards.includes('control'));
    assert.ok(useProgress.getState().completed.vault.includes('vault'));
    assert.equal(openRoads({ badges: roadBadges(useMedals.getState().earned), metThecap: false, rsaActs: 0 })[road], true);
    assert.equal(useGame.getState().operations, 0);
    const before = JSON.stringify({ progress: useProgress.getState().completed, medals: useMedals.getState().earned, cards: useKnowledge.getState().cards, wallet: useWallet.getState() });
    assert.equal(restoreCheckpoint(code), true);
    assert.equal(JSON.stringify({ progress: useProgress.getState().completed, medals: useMedals.getState().earned, cards: useKnowledge.getState().cards, wallet: useWallet.getState() }), before);
  }
});

test('short checkpoint codes validate and distinguish practice from town completion', () => {
  for (const code of ['ct0', 'ct4', 'ft9', 'qt2', 'ct1extra', '', '../ct2']) assert.equal(checkpoint(code), null);
  assert.equal(checkpoint(' CT2 ').code, 'ct2');
  assert.deepEqual(checkpoint('ct1').cards, []);
  assert.deepEqual(checkpoint('ct2').cards, COIN_KNOWLEDGE_IDS);
  assert.deepEqual(checkpoint('ct2').completed, {});
  assert.deepEqual(checkpoint('ct3').completed.coin, ['coin', 'town']);
  assert.equal(currentCheckpoint('coinTown', [], {}), 'ct1');
  assert.equal(currentCheckpoint('coin', COIN_KNOWLEDGE_IDS, {}), 'ct2');
  assert.equal(currentCheckpoint('coinTown', COIN_KNOWLEDGE_IDS, { coin: ['coin'] }), 'ct3');
  assert.equal(currentCheckpoint('coinTown', [], { coin: ['coin'] }), 'ct3');
  assert.equal(currentCheckpoint('foundry', [], { grover: ['grover'] }), 'ft3');
  assert.equal(currentCheckpoint('hollow', [], { vault: ['vault'] }), 'ht3');
  assert.equal(currentCheckpoint('cipher', [], { rsa: ['1', '2', '3'] }), 'ci1');
  assert.equal(currentCheckpoint('cipher', [], { rsa: ['1', '2', '3', '4'] }), 'ci3');
});

test('later checkpoints restore predecessor badges and keep the current challenge uncompleted', () => {
  const foundry = checkpoint('ft1');
  assert.deepEqual(foundry.completed, { coin: ['coin', 'town'] });
  assert.deepEqual(foundry.cards, COIN_KNOWLEDGE_IDS);
  const cipher = checkpoint('ci2');
  assert.equal(cipher.cards.length, 20);
  assert.equal(cipher.completed.rsa, undefined);
  assert.deepEqual(checkpoint('qt1').completed.rsa, ['1', '2', '3', '4', 'town']);
});

test('restore works without browser storage, keeps earned progress and never starts a mission', () => {
  useProgress.setState({ completed: { vault: ['vault'] } });
  useKnowledge.setState({ cards: ['control'] });
  useGame.getState().resetRun(1);
  assert.equal(restoreCheckpoint('ft2'), true);
  assert.equal(useTown.getState().location, 'foundry');
  assert.equal(useTown.getState().foundry.welcomed, true);
  assert.deepEqual(useProgress.getState().completed.vault, ['vault']);
  assert.deepEqual(useProgress.getState().completed.coin, ['coin', 'town']);
  assert.equal(useProgress.getState().completed.grover, undefined);
  assert.equal(useKnowledge.getState().cards.length, 11);
  assert.equal(useKnowledge.getState().fresh, null);
  assert.ok(useMedals.getState().earned['coin-town']);
  assert.equal(useMedals.getState().fresh, null);
  assert.equal(useTown.getState().rsaRunning, false);
  assert.equal(useTown.getState().checkpoint, null);
  assert.equal(useGame.getState().operations, 0);
  assert.equal(useGame.getState().phase, 'exploring');
  assert.equal(restoreCheckpoint('ci3'), true);
  assert.deepEqual(useWallet.getState().paidActs, [1, 2, 3, 4]);
  assert.equal(useWallet.getState().gear.length, 4);
  assert.ok(useMedals.getState().earned['cipher-town']);
  const earned = { ...useMedals.getState().earned };
  assert.equal(restoreCheckpoint('ci3'), true);
  assert.deepEqual(useMedals.getState().earned, earned);
});

test('restoring rejects busy runs and bad codes without changing progress', () => {
  const before = useProgress.getState().completed;
  useGame.setState({ operations: 1 });
  assert.equal(restoreCheckpoint('ct3'), false);
  useGame.setState({ operations: 0, phase: 'busy' });
  assert.equal(restoreCheckpoint('ct3'), false);
  useGame.setState({ phase: 'exploring' });
  assert.equal(restoreCheckpoint('bad'), false);
  assert.equal(useProgress.getState().completed, before);
});
