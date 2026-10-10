const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs, root } = require('./loadTs.cjs');
const load = file => loadTs(path.join(root, file));
const { CAMPUS_EXHIBITS, CAMPUS_SPAWN, CAMPUS_FACING, CAMPUS_GUIDE, CAMPUS_NPCS, CAMPUS_PROPS, CAMPUS_FESTIVAL, CAMPUS_NOTEBOOK } = load('content/campus');
const { campusDefaults, campusRequest, campusReady, CAMPUS_EVIDENCE, cleanCampusSettings } = load('game/campusExperiment');
const { labTrace, labProbability } = load('game/labCircuit');
const { useCampus } = load('game/campus');
const { useTown } = load('game/town');
const { useProgress } = load('game/progress');
const { useMedals } = load('game/medals');
const { useGame } = load('game/state');
const { useKnowledge } = load('game/knowledge');
const { useWallet } = load('game/wallet');
const { useLab } = load('game/lab');
const { checkpoint, currentCheckpoint } = load('game/checkpoints');
const { restoreCheckpoint } = load('game/restoreCheckpoint');
const { roadBadges, openRoads } = load('game/roads');
const measured = { bits: 1, counts: { '0': 120, '1': 136 }, probabilities: { '0': .5, '1': .5 }, shots: 256, backend: 'kept backend', kind: 'noise', source: 'simulator', circuit_text: 'H → M', depth: 2 };
function reset() { useCampus.getState().reset(); useProgress.getState().reset(); useMedals.getState().reset(); useTown.getState().reset(); useGame.getState().resetRun(1); }

test('eight campus experiments preserve unitary math and use explicit channel requests', () => {
  const s = campusDefaults();
  for (const exhibit of CAMPUS_EXHIBITS) assert.ok(campusRequest(exhibit.id, s));
  for (const axis of ['X', 'Y', 'Z']) {
    const recipe = campusRequest('rotations', { ...s, axis, angle: 1.23, inverse: true }).recipe;
    assert.ok(Math.abs(labProbability(labTrace(recipe).at(-1)[0]) - 1) < 1e-9);
  }
  for (const minus of [false, true]) for (const analyzer of [false, true]) {
    const recipe = campusRequest('fountain', { ...s, minus, analyzer }).recipe;
    const state = labTrace(recipe).at(-1);
    assert.ok(Math.abs(labProbability(state[0]) - (analyzer ? minus ? 0 : 1 : .5)) < 1e-9);
  }
  assert.deepEqual(campusRequest('quiet', { ...s, disturbance: 1, analyzer: true }), { mode: 'dephasing', disturbance: 1, basis: 'X', shots: 256 });
  assert.deepEqual(campusRequest('observatory', { ...s, pair: 'envelopes', basis: 'X' }), { mode: 'correlation', pair: 'envelopes', basis: 'X', shots: 256 });
  assert.equal(campusRequest('delivery', { ...s, sequence: [] }).recipe.operations.length, 0);
  assert.equal(campusRequest('delivery', { ...s, sequence: ['X', 'H'] }).recipe.operations.length, 2);
});

test('design evidence requires successful comparisons and explanation, independently of noisy counts', () => {
  reset();
  const s = campusDefaults();
  assert.equal(campusReady('fountain', [], true), false);
  for (const minus of [false, true]) for (const analyzer of [false, true]) useCampus.getState().record('fountain', { ...s, minus, analyzer }, measured);
  const session = useCampus.getState().sessions.fountain;
  assert.equal(campusReady('fountain', session.evidence, false), false);
  assert.equal(campusReady('fountain', session.evidence, true), true);
  assert.equal(campusReady('arcade', ['single'], true), false);
  assert.equal(campusReady('festival', CAMPUS_EVIDENCE.festival, true), true);
  assert.equal(campusReady('quiet', ['0:true', '1:true'], true), false);
});

test('refresh preserves settings, answers, latest measurement and comparisons without executing', async () => {
  reset();
  const settings = { ...campusDefaults(), phase: .4 };
  useCampus.getState().update('passports', { settings, answer: 1 });
  for (let i = 0; i < 8; i++) useCampus.getState().record('passports', settings, { ...measured, backend: `device-${i}` });
  await useCampus.persist.rehydrate();
  const saved = useCampus.getState().sessions.passports;
  assert.equal(saved.settings.phase, .4);
  assert.equal(saved.answer, 1);
  assert.equal(saved.result.backend, 'device-7');
  assert.equal(saved.runs.length, 6);
  assert.equal(saved.runs[0].result.backend, 'device-2');
  assert.deepEqual(saved.runs.at(-1).result.counts, measured.counts);
  assert.equal(useGame.getState().operations, 0);
});

test('malformed saves discard invalid counts, duplicate milestones and unsafe settings', () => {
  reset();
  const merge = useCampus.persist.getOptions().merge;
  for (const result of [{ ...measured, counts: { '01': 256 } }, { ...measured, counts: { '0': 255 } }, { ...measured, probabilities: { '0': NaN } }, { ...measured, source: 'unknown' }]) {
    const saved = merge({ sessions: { quiet: { result, runs: [{ key: 'bad', result }] } }, completed: ['quiet', 'quiet', '__proto__'] }, useCampus.getState());
    assert.equal(saved.sessions.quiet.result, null);
    assert.deepEqual(saved.sessions.quiet.runs, []);
    assert.deepEqual(saved.completed, ['quiet']);
  }
  assert.deepEqual(cleanCampusSettings({ angle: Infinity, sequence: ['H', 'bad'], order: ['Prepare', 'Prepare', 'Measure'], shots: 999 }), { ...campusDefaults(), sequence: ['H'] });
});

test('fresh games and full resets start in Coin Town; old choice flags never move a saved visit', () => {
  reset();
  const { COIN_TOWN_SPAWN } = load('content/coinTown');
  assert.equal(useTown.getState().location, 'coinTown');
  assert.deepEqual(useTown.getState().coinTown.position, COIN_TOWN_SPAWN);
  assert.equal(useTown.getState().coinTown.welcomed, false);
  assert.deepEqual(useTown.getState().campus.position, CAMPUS_SPAWN);
  assert.equal(useTown.getState().campus.facing, CAMPUS_FACING);
  const merge = useTown.persist.getOptions().merge;
  assert.equal(merge(null, useTown.getState()).location, 'coinTown');
  const old = merge({ location: 'hollow', hollow: { position: { x: 10, y: 9 }, welcomed: true } }, useTown.getState());
  assert.equal(old.location, 'hollow');
  assert.deepEqual(old.hollow.position, { x: 10, y: 9 });
  const visiting = { position: { x: 18, y: 31 }, facing: 'left', welcomed: true, explored: [3118] };
  for (const entryChosen of [false, true]) {
    const saved = merge({ entryChosen, location: 'campus', campus: visiting }, useTown.getState());
    assert.equal(saved.location, 'campus');
    assert.deepEqual(saved.campus, visiting);
    assert.equal('entryChosen' in saved, false);
  }
  useTown.getState().patch({ location: 'campus', campus: visiting });
  useTown.getState().reset();
  assert.equal(useTown.getState().location, 'coinTown');
  assert.deepEqual(useTown.getState().coinTown.position, COIN_TOWN_SPAWN);
  assert.equal(useTown.getState().coinTown.welcomed, false);
});

test('campus milestones merge without granting cards, town medals, money or equipment', async () => {
  reset();
  await useMedals.persist.rehydrate();
  useKnowledge.setState({ cards: ['control'] });
  useProgress.getState().complete('coin', 'coin');
  const existing = { wallet: JSON.stringify(useWallet.getState()), owned: useLab.getState().owned, cards: useKnowledge.getState().cards, roads: roadBadges(useMedals.getState().earned) };
  assert.equal(restoreCheckpoint('qc1'), true);
  assert.deepEqual(useTown.getState().campus.position, CAMPUS_SPAWN);
  assert.equal(useTown.getState().campus.facing, CAMPUS_FACING);
  assert.deepEqual(useCampus.getState().completed, []);
  assert.equal(restoreCheckpoint('qc2'), true);
  assert.equal(useCampus.getState().completed.length, 8);
  assert.equal(currentCheckpoint('campus', [], useProgress.getState().completed), 'qc2');
  assert.equal(restoreCheckpoint('qc3'), true);
  assert.equal(currentCheckpoint('lab', [], {}, useMedals.getState().earned, 'campus'), 'qc3');
  assert.deepEqual(roadBadges(useMedals.getState().earned), existing.roads);
  assert.equal(JSON.stringify(useWallet.getState()), existing.wallet);
  assert.equal(useLab.getState().owned, existing.owned);
  assert.equal(useKnowledge.getState().cards, existing.cards);
  assert.ok(useProgress.getState().completed.coin.includes('coin'));
  assert.deepEqual(checkpoint('qc3').completed, {});
  useGame.setState({ operations: 1 });
  const town = useTown.getState();
  assert.equal(restoreCheckpoint('qc1'), false);
  assert.equal(useTown.getState(), town);
  useGame.setState({ operations: 0 });
});

test('the festival badge can be earned directly and opens no progression road', async () => {
  reset();
  await useMedals.persist.rehydrate();
  useProgress.getState().complete('campus', 'festival');
  assert.ok(useMedals.getState().earned['quantum-explorer']);
  assert.equal(useCampus.getState().completed.length, 0);
  assert.deepEqual(openRoads({ badges: roadBadges(useMedals.getState().earned), metThecap: false, rsaActs: 0 }), { coinEast: false, coinWest: false, coinNorth: false, cipherNorth: false });
  useProgress.getState().reset('coin');
  assert.ok(useProgress.getState().completed.campus.includes('festival'));
});

test('the north entrance welcomes players before the first exhibit and paved aisles reach every activity', () => {
  const { campusMap } = load('engine/maps/campusMap');
  const { CAMPUS_FURNITURE } = load('content/campusStands');
  const { findRoute } = load('engine/maps/grid');
  assert.equal(CAMPUS_FACING, 'down');
  assert.ok(CAMPUS_SPAWN.y > 0 && CAMPUS_SPAWN.y < CAMPUS_GUIDE.at.y);
  assert.equal(CAMPUS_GUIDE.at.y, CAMPUS_NOTEBOOK.at.y);
  assert.ok(CAMPUS_GUIDE.at.y < CAMPUS_EXHIBITS[0].at.y);
  assert.ok(CAMPUS_EXHIBITS[0].at.x < CAMPUS_SPAWN.x);
  const grid = campusMap.rows.map((row, y) => [...row].map((tile, x) => !['p', 'q'].includes(tile) || !!campusMap.legend[tile]?.solid || !!campusMap.overlayLegend[campusMap.overlay[y][x]]?.solid));
  for (const item of [...CAMPUS_NPCS, ...CAMPUS_PROPS]) grid[item.at.y][item.at.x] = true;
  for (const at of CAMPUS_FURNITURE) grid[at.y][at.x] = true;
  for (const exhibit of CAMPUS_EXHIBITS) assert.ok(findRoute(grid, CAMPUS_SPAWN, { x: exhibit.at.x, y: exhibit.at.y + 1 }), exhibit.id);
  for (const at of [CAMPUS_FESTIVAL.stand, CAMPUS_NOTEBOOK.stand, { x: CAMPUS_GUIDE.at.x - 1, y: CAMPUS_GUIDE.at.y }, { x: 18, y: 0 }, load('content/labEntrances').LAB_ENTRANCES.campus.stand]) assert.ok(findRoute(grid, CAMPUS_SPAWN, at));
  // Open lawns replace every old facade. New furniture occupies only tiles that
  // were already walls, so a saved player position cannot end up inside a table.
  for (const exhibit of CAMPUS_EXHIBITS) {
    assert.ok(!campusMap.legend[campusMap.rows[exhibit.at.y - 3][exhibit.at.x]].solid);
    for (const at of CAMPUS_FURNITURE.filter(at => Math.abs(at.x - exhibit.at.x) <= 3 && Math.abs(at.y - exhibit.at.y) <= 3)) {
      assert.ok(at.y < exhibit.at.y && at.y >= exhibit.at.y - 2);
      assert.ok(Math.abs(at.x - exhibit.at.x) <= 2);
    }
  }
});
