const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const catalog = require('../i18n/es.json');
const { applyReg, startRegister, traceReg, probsReg, formatReg, solvesReg, groverOdds, peakRounds } = loadTs(path.join(__dirname, '../game/register.ts'));
const { FOUNDRY_NPCS, FOUNDRY_ANIMALS, FOUNDRY_PROPS, FOUNDRY_BELT, FOUNDRY_DOOR, FOUNDRY_SPAWN, FOUNDRY_WEST_ROAD, KNOWLEDGE, KNOWLEDGE_IDS, VP, CARD_COUNT } = loadTs(path.join(__dirname, '../content/foundry.ts'));
const { ALL_KNOWLEDGE_IDS, COIN_KNOWLEDGE_IDS } = loadTs(path.join(__dirname, '../content/knowledge.ts'));
const { foundryMap } = loadTs(path.join(__dirname, '../engine/maps/foundryMap.ts'));
const { findRoute, tilesNear } = loadTs(path.join(__dirname, '../engine/maps/grid.ts'));
const { MEDALS } = loadTs(path.join(__dirname, '../content/medals.ts'));

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('register pieces act as the Foundry cards say', () => {
  const zeros = startRegister(2, '00');
  assert.deepEqual(applyReg(zeros, 'X1'), startRegister(2, '10'));
  assert.deepEqual(applyReg(zeros, 'X2'), startRegister(2, '01'));
  const even = applyReg(zeros, 'H');
  assert.ok(even.every((a) => close(a, 0.5)));
  assert.equal(formatReg(even), '½(|00⟩ + |01⟩ + |10⟩ + |11⟩)');
  const stamped = applyReg(even, 'oracle:10');
  assert.deepEqual(probsReg(stamped).map((p) => Math.round(p * 100)), [25, 25, 25, 25]);
  assert.equal(formatReg(stamped), '½(|00⟩ + |01⟩ − |10⟩ + |11⟩)');
  // One round on four states finds the answer with certainty.
  const round = traceReg(zeros, ['H', 'oracle:11', 'D']).at(-1);
  assert.ok(close(probsReg(round)[3], 1));
  // Three qubits climb to a peak at two rounds, then over-turn.
  assert.equal(peakRounds(3, '101'), 2);
  assert.ok(groverOdds(3, '101', 2) > 0.94 && groverOdds(3, '101', 3) < 0.34);
  // Sixteen PINs peak at three rounds, as the workshop whiteboard says.
  assert.equal(peakRounds(4, '1011'), 3);
});

/** Every circuit a bench allows: each column holds one box across all wires, or X on any set of wires. */
function circuits(step) {
  const column = [[]];
  for (const piece of step.tray) {
    if (piece !== 'X') { column.push([piece]); continue; }
    for (let mask = 1; mask < 2 ** step.qubits; mask++) column.push(Array.from({ length: step.qubits }, (_, q) => q).filter((q) => mask & (1 << q)).map((q) => `X${q + 1}`));
  }
  let all = [[]];
  for (let c = 0; c < step.slots; c++) all = all.flatMap((ops) => column.map((col) => [...ops, col]));
  return all.filter((cols) => !step.fill || cols.every((col) => col.length)).map((cols) => cols.flat());
}
test('every Foundry bench can be solved with its own tray, and none by doing nothing', () => {
  for (const npc of FOUNDRY_NPCS) for (const step of npc.steps) {
    if (step.kind === 'question') {
      assert.equal(step.options.filter((option) => option.correct).length, 1, step.title);
      for (const option of step.options) if (!option.correct) assert.ok(option.wrong, `${step.title}: ${option.label}`);
      continue;
    }
    if (step.kind === 'rounds') { assert.equal(step.answer, peakRounds(step.qubits, step.marked), step.title); continue; }
    assert.equal(step.kind, 'register', step.title);
    const allowed = circuits(step);
    assert.ok(allowed.some((ops) => solvesReg(step, ops)), step.title);
    assert.ok(!solvesReg(step, []), `${step.title} is solved by an empty line`);
  }
});

test('each Foundry card is taught by exactly one neighbor, cards never clash with Coin Town, and the badge is a medal', () => {
  for (const id of KNOWLEDGE_IDS) {
    assert.equal(FOUNDRY_NPCS.filter((npc) => npc.knowledge === id).length, 1, id);
    assert.equal(KNOWLEDGE[id].id, id);
    assert.ok(!COIN_KNOWLEDGE_IDS.includes(id), id);
  }
  assert.equal(new Set(ALL_KNOWLEDGE_IDS).size, ALL_KNOWLEDGE_IDS.length);
  for (const npc of FOUNDRY_NPCS.filter((person) => person.knowledge)) assert.ok(npc.steps.length >= 2 && npc.intro.length && npc.outro.length && npc.repeat.length, npc.id);
  assert.ok(MEDALS.some((medal) => medal.id === 'foundry-town' && medal.scenario === 'grover' && medal.mission === 'town'));
});

test('every Foundry line, step and card has a Spanish translation', () => {
  const strings = [CARD_COUNT, ...Object.values(VP).map((l) => l.text)];
  for (const card of Object.values(KNOWLEDGE)) strings.push(card.title, card.text, card.hint);
  for (const npc of FOUNDRY_NPCS) {
    strings.push(npc.title, npc.description, ...[...npc.intro, ...npc.outro, ...npc.repeat].map((l) => l.text));
    for (const step of npc.steps) {
      strings.push(step.title, step.text, step.feedback);
      if (step.kind === 'register') strings.push(step.goal);
      if (step.kind === 'question') for (const option of step.options) strings.push(option.label, ...(option.wrong ? [option.wrong] : []));
    }
  }
  for (const text of strings) assert.ok(catalog[text], text);
});

function solidGrid(map, extra = []) {
  const grid = map.rows.map((row, y) => [...row].map((tile, x) => !!map.legend[tile]?.solid || !!map.overlayLegend[map.overlay[y][x]]?.solid));
  for (const at of extra) grid[at.y][at.x] = true;
  return grid;
}
const blockers = () => [...FOUNDRY_NPCS.map((npc) => npc.at), ...FOUNDRY_PROPS.map((prop) => prop.at)];

test('Foundry Town: every neighbor and the workshop are reachable from the west gate, which is the only way out', () => {
  const grid = solidGrid(foundryMap, blockers());
  const beside = (at) => [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }].map((d) => ({ x: at.x + d.x, y: at.y + d.y }));
  assert.ok(!grid[FOUNDRY_SPAWN.y][FOUNDRY_SPAWN.x]);
  for (const npc of FOUNDRY_NPCS) assert.ok(beside(npc.at).some((pos) => findRoute(grid, FOUNDRY_SPAWN, pos)), npc.id);
  assert.ok(findRoute(grid, FOUNDRY_SPAWN, FOUNDRY_DOOR.stand));
  const right = foundryMap.width - 1, bottom = foundryMap.height - 1;
  grid.forEach((row, y) => {
    assert.equal(!row[0], FOUNDRY_WEST_ROAD.includes(y), `left edge ${y}`);
    assert.ok(row[right], `right edge ${y}`);
  });
  assert.ok(grid[0].every((solid) => solid) && grid[bottom].every((solid) => solid));
  for (const y of FOUNDRY_WEST_ROAD) assert.ok(findRoute(grid, FOUNDRY_SPAWN, { x: 0, y }));
});

test('Foundry props sit on open ground, the belt is covered, and animals have room to wander', () => {
  const open = solidGrid(foundryMap);
  for (const prop of FOUNDRY_PROPS) assert.ok(!open[prop.at.y][prop.at.x], `${prop.sprite} at ${prop.at.x},${prop.at.y}`);
  for (let x = FOUNDRY_BELT.from; x <= FOUNDRY_BELT.to; x++) assert.ok(FOUNDRY_PROPS.some((prop) => prop.sprite === 'belt' && prop.at.x === x && prop.at.y === FOUNDRY_BELT.y), `belt ${x}`);
  const grid = solidGrid(foundryMap, blockers());
  for (const animal of FOUNDRY_ANIMALS) {
    const allowed = (pos) => !animal.ground || foundryMap.rows[pos.y][pos.x] === animal.ground;
    assert.ok(!grid[animal.home.y][animal.home.x] && allowed(animal.home), `${animal.kind} at ${animal.home.x},${animal.home.y}`);
    assert.ok(tilesNear(grid, animal.home, animal.radius, allowed).length >= 4, animal.kind);
  }
});
