const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const catalog = require('../i18n/es.json');
const { STATES, apply, trace, sameState, probabilities, ketName, expand, solves } = loadTs(path.join(__dirname, '../game/qubit.ts'));
const { COIN_TOWN_ANIMALS, COIN_TOWN_NPCS, KNOWLEDGE, KNOWLEDGE_IDS, MAYOR, WARDEN, SIGNS, CARD_COUNT, COIN_TOWN_SPAWN, COIN_TOWN_DOOR, COIN_TOWN_NORTH_ROAD, NORTH_GATE_ROW, COIN_TOWN_FROM_NORTH,
  COIN_TOWN_SIDE_ROAD, EAST_GATE_COL, WEST_GATE_COL, COIN_TOWN_EAST_SIGN, COIN_TOWN_WEST_SIGN, COIN_TOWN_FROM_EAST, COIN_TOWN_FROM_WEST, QUANTUM_SOUTH_GATE, QUANTUM_SOUTH_ROW } = loadTs(path.join(__dirname, '../content/coinTown.ts'));
const { coinTownMap } = loadTs(path.join(__dirname, '../engine/maps/coinTownMap.ts'));
const { townMap } = loadTs(path.join(__dirname, '../engine/maps/townMap.ts'));
const { findRoute, tilesNear } = loadTs(path.join(__dirname, '../engine/maps/grid.ts'));
const { MEDALS } = loadTs(path.join(__dirname, '../content/medals.ts'));

test('X, Z and H act on the four named states as the cards say', () => {
  assert.ok(sameState(apply(STATES['0'], 'X'), STATES['1']));
  assert.ok(sameState(apply(STATES['0'], 'H'), STATES['+']));
  assert.ok(sameState(apply(STATES['1'], 'H'), STATES['-']));
  assert.ok(sameState(apply(STATES['+'], 'Z'), STATES['-']));
  assert.ok(sameState(trace(STATES['0'], ['H', 'H']).at(-1), STATES['0']));
  assert.deepEqual(probabilities(STATES['-']).map((p) => Math.round(p * 100)), [50, 50]);
  assert.equal(ketName(apply(STATES['1'], 'Z')), '−|1⟩');
  assert.equal(expand(STATES['-']), '(|0⟩ − |1⟩)/√2');
  assert.equal(expand(apply(STATES['-'], 'X')), '−(|0⟩ − |1⟩)/√2');
  assert.ok(solves([{ start: '+', target: '0' }, { start: '-', target: '1' }], ['H']));
  assert.ok(!solves([{ start: '+', target: '0' }, { start: '-', target: '1' }], ['Z']));
});

function circuits(gates, slots) {
  if (slots === 0) return [[]];
  const shorter = circuits(gates, slots - 1);
  return [...shorter.map((c) => [...c]), ...shorter.flatMap((c) => gates.map((g) => [...c, g]))];
}
test('every bench can be solved with its own gates, and none is solved by doing nothing', () => {
  for (const npc of COIN_TOWN_NPCS) for (const step of npc.steps) {
    if (step.kind === 'question') {
      assert.equal(step.options.filter((option) => option.correct).length, 1, step.title);
      for (const option of step.options) if (!option.correct) assert.ok(option.wrong, `${step.title}: ${option.label}`);
      continue;
    }
    const allowed = circuits(step.gates, step.slots).filter((c) => !step.fill || c.length === step.slots);
    assert.ok(allowed.some((c) => solves(step.cases, c)), step.title);
    if (!step.fill) assert.ok(!solves(step.cases, []), `${step.title} is solved by an empty wire`);
  }
});

test('each knowledge card is taught by exactly one neighbor, and the badge is a medal', () => {
  for (const id of KNOWLEDGE_IDS) assert.equal(COIN_TOWN_NPCS.filter((npc) => npc.knowledge === id).length, 1, id);
  for (const npc of COIN_TOWN_NPCS.filter((person) => person.knowledge)) assert.ok(npc.steps.length >= 2 && npc.intro.length && npc.outro.length && npc.repeat.length, npc.id);
  assert.ok(MEDALS.some((medal) => medal.id === 'coin-town' && medal.scenario === 'coin' && medal.mission === 'town'));
});

test('every Coin Town line, step and card has a Spanish translation', () => {
  const strings = [CARD_COUNT, ...[MAYOR, WARDEN, SIGNS].flatMap((lines) => Object.values(lines).map((l) => l.text))];
  for (const card of Object.values(KNOWLEDGE)) strings.push(card.title, card.text, card.hint);
  for (const npc of COIN_TOWN_NPCS) {
    strings.push(npc.title, npc.description, ...[...npc.intro, ...npc.outro, ...npc.repeat].map((l) => l.text));
    for (const step of npc.steps) {
      strings.push(step.title, step.text, step.feedback);
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
test('Coin Town: every neighbor, the coin house and all three roads are reachable from the start', () => {
  const signs = [COIN_TOWN_EAST_SIGN.at, COIN_TOWN_WEST_SIGN.at];
  const grid = solidGrid(coinTownMap, [...COIN_TOWN_NPCS.map((npc) => npc.at), ...signs]);
  const beside = (at) => [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }].map((d) => ({ x: at.x + d.x, y: at.y + d.y }));
  for (const npc of COIN_TOWN_NPCS) assert.ok(beside(npc.at).some((pos) => findRoute(grid, COIN_TOWN_SPAWN, pos)), npc.id);
  assert.ok(findRoute(grid, COIN_TOWN_SPAWN, COIN_TOWN_DOOR.stand));
  for (const sign of [COIN_TOWN_EAST_SIGN, COIN_TOWN_WEST_SIGN]) assert.ok(findRoute(grid, COIN_TOWN_SPAWN, sign.stand));
  for (const x of COIN_TOWN_NORTH_ROAD) assert.ok(findRoute(grid, COIN_TOWN_SPAWN, { x, y: 0 }), `north road column ${x}`);
  const right = coinTownMap.width - 1;
  for (const y of COIN_TOWN_SIDE_ROAD) {
    assert.ok(findRoute(grid, COIN_TOWN_SPAWN, { x: right, y }), `east road row ${y}`);
    assert.ok(findRoute(grid, COIN_TOWN_SPAWN, { x: 0, y }), `west road row ${y}`);
  }
  // The roads are the only ways out, and each gate closes its road completely.
  assert.ok(grid[coinTownMap.height - 1].every((solid) => solid), 'south wall is closed');
  grid[0].forEach((solid, x) => assert.equal(!solid, COIN_TOWN_NORTH_ROAD.includes(x), `top edge ${x}`));
  grid.forEach((row, y) => {
    assert.equal(!row[0], COIN_TOWN_SIDE_ROAD.includes(y), `left edge ${y}`);
    assert.equal(!row[right], COIN_TOWN_SIDE_ROAD.includes(y), `right edge ${y}`);
  });
  const gated = grid.map((row) => [...row]);
  for (const x of COIN_TOWN_NORTH_ROAD) gated[NORTH_GATE_ROW][x] = true;
  for (const y of COIN_TOWN_SIDE_ROAD) { gated[y][EAST_GATE_COL] = true; gated[y][WEST_GATE_COL] = true; }
  assert.equal(findRoute(gated, COIN_TOWN_SPAWN, { x: COIN_TOWN_NORTH_ROAD[0], y: 0 }), null);
  assert.equal(findRoute(gated, COIN_TOWN_SPAWN, { x: right, y: COIN_TOWN_SIDE_ROAD[1] }), null);
  assert.equal(findRoute(gated, COIN_TOWN_SPAWN, { x: 0, y: COIN_TOWN_SIDE_ROAD[1] }), null);
  assert.ok(findRoute(grid, COIN_TOWN_FROM_NORTH, COIN_TOWN_SPAWN));
  assert.ok(findRoute(grid, COIN_TOWN_FROM_EAST, COIN_TOWN_SPAWN));
  assert.ok(findRoute(grid, COIN_TOWN_FROM_WEST, COIN_TOWN_SPAWN));
});

test('Quantum Town: the south road from Coin Town arrives inside the wall, and its bottom row leads back', () => {
  const grid = solidGrid(townMap);
  assert.ok(!grid[QUANTUM_SOUTH_GATE.y][QUANTUM_SOUTH_GATE.x]);
  assert.ok(findRoute(grid, QUANTUM_SOUTH_GATE, { x: QUANTUM_SOUTH_GATE.x, y: QUANTUM_SOUTH_ROW }));
  // The temporary north path is gone: the top row is wall again.
  assert.ok(grid[0].every((solid) => solid));
});

test('Coin Town animals start on open ground and have somewhere to wander', () => {
  const grid = solidGrid(coinTownMap, [...COIN_TOWN_NPCS.map((npc) => npc.at), COIN_TOWN_EAST_SIGN.at, COIN_TOWN_WEST_SIGN.at]);
  for (const animal of COIN_TOWN_ANIMALS) {
    const allowed = (pos) => !animal.ground || coinTownMap.rows[pos.y][pos.x] === animal.ground;
    assert.ok(!grid[animal.home.y][animal.home.x] && allowed(animal.home), `${animal.kind} at ${animal.home.x},${animal.home.y}`);
    assert.ok(tilesNear(grid, animal.home, animal.radius, allowed).length >= 4, animal.kind);
  }
});
