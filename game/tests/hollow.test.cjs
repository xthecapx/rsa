const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const catalog = require('../i18n/es.json');
const { applyReg, startRegister, traceReg, formatReg, solvesReg, readsOdds, product, wireStates, basisStates } = loadTs(path.join(__dirname, '../game/register.ts'));
const { solves } = loadTs(path.join(__dirname, '../game/qubit.ts'));
const { HOLLOW_NPCS, HOLLOW_ANIMALS, HOLLOW_PROPS, HOLLOW_DOOR, HOLLOW_SPAWN, HOLLOW_EAST_ROAD, HOLLOW_FOG, KNOWLEDGE, KNOWLEDGE_IDS, KEEPER, CARD_COUNT } = loadTs(path.join(__dirname, '../content/hollow.ts'));
const { ALL_KNOWLEDGE_IDS, COIN_KNOWLEDGE_IDS, FOUNDRY_KNOWLEDGE_IDS } = loadTs(path.join(__dirname, '../content/knowledge.ts'));
const { hollowMap } = loadTs(path.join(__dirname, '../engine/maps/hollowMap.ts'));
const { findRoute, tilesNear } = loadTs(path.join(__dirname, '../engine/maps/grid.ts'));
const { MEDALS } = loadTs(path.join(__dirname, '../content/medals.ts'));

const same = (p, q) => p.every((a, i) => Math.abs(a - q[i]) < 1e-9);

test('the Hollow pieces act as the cards say', () => {
  // A CNOT flips the helper (the last wire) only when its control is 1, and never changes the control.
  for (const [from, to] of [['00', '00'], ['01', '01'], ['10', '11'], ['11', '10']]) assert.ok(same(applyReg(startRegister(2, from), 'CX1'), startRegister(2, to)), from);
  // A flip only hands |−⟩ a minus sign.
  assert.ok(same(applyReg(product('0', '-'), 'X2'), product('0', '-').map((a) => -a)));
  assert.deepEqual(wireStates(applyReg(product('0', '-'), 'X2')), ['0', '-']);
  // Phase kickback: the CNOT aims at the helper, and the control turns from |+⟩ to |−⟩.
  const kicked = traceReg(startRegister(2, '01'), ['h1', 'h2', 'CX1']);
  assert.deepEqual(wireStates(kicked[2]), ['+', '-']);
  assert.deepEqual(wireStates(kicked[3]), ['-', '-']);
  assert.equal(formatReg(kicked[3]), '½(|00⟩ − |01⟩ − |10⟩ + |11⟩)');
  // The ghost answers s·x mod 2 on the helper.
  for (const secret of ['00', '01', '10', '11']) for (const x of ['00', '01', '10', '11']) {
    const parity = [...secret].filter((bit, i) => bit === '1' && x[i] === '1').length % 2;
    assert.ok(same(applyReg(startRegister(3, `${x}0`), `ghost:${secret}`), startRegister(3, `${x}${parity}`)), `${secret}·${x}`);
    // One question reads the whole secret: H box, the ghost with a |−⟩ helper, H box.
    assert.ok(readsOdds(traceReg(startRegister(3, '001'), ['H', `ghost:${secret}`, 'H']).at(-1), secret) > 0.999, secret);
  }
  assert.equal(wireStates([0.5, 0.5, 0.5, -0.5]), null);
});

/** Every circuit a bench allows: each column holds one box across all wires, or one wire piece per wire (CNOTs keep the helper cell for their ⊕). */
function circuits(step) {
  const wire = step.tray.filter((piece) => ['X', 'Z', 'h', 'CX'].includes(piece));
  const spans = step.tray.filter((piece) => !wire.includes(piece));
  const helper = step.qubits - 1;
  let cells = [[]];
  for (let q = 0; q < step.qubits; q++) cells = cells.flatMap((col) => [null, ...wire.filter((piece) => piece !== 'CX' || q !== helper)].map((piece) => [...col, piece]));
  const columns = [[], ...spans.map((piece) => [piece]), ...cells
    .filter((col) => col.some(Boolean) && !(col.includes('CX') && col[helper]))
    .map((col) => col.flatMap((piece, q) => (piece ? [`${piece}${q + 1}`] : [])))];
  let all = [[]];
  for (let c = 0; c < step.slots; c++) all = all.flatMap((ops) => columns.map((col) => [...ops, col]));
  return all.filter((cols) => !step.fill || cols.every((col) => col.length)).map((cols) => [...cols.flat(), ...(step.fixed ?? [])]);
}
test('every Hollow bench can be solved with its own tray, and none by doing nothing', () => {
  for (const npc of HOLLOW_NPCS) for (const step of npc.steps) {
    if (step.kind === 'question') {
      assert.equal(step.options.filter((option) => option.correct).length, 1, step.title);
      for (const option of step.options) if (!option.correct) assert.ok(option.wrong, `${step.title}: ${option.label}`);
      continue;
    }
    if (step.kind === 'bench') {
      let lines = [[]];
      for (let i = 0; i < step.slots; i++) lines = lines.flatMap((gates) => [...(step.fill ? [] : [gates]), ...step.gates.map((gate) => [...gates, gate])]);
      assert.ok(lines.some((gates) => solves(step.cases, gates)), step.title);
      if (!step.fill) assert.ok(!solves(step.cases, []), `${step.title} is solved by an empty wire`);
      continue;
    }
    assert.equal(step.kind, 'register', step.title);
    const allowed = circuits(step);
    assert.ok(allowed.some((ops) => solvesReg(step, ops)), step.title);
    if (!step.fill) assert.ok(!solvesReg(step, step.fixed ?? []), `${step.title} is solved by an empty line`);
  }
});

test('the kickback benches need a CNOT, and the one-question bench needs the ghost', () => {
  for (const npc of HOLLOW_NPCS) for (const step of npc.steps) {
    if (step.kind !== 'register') continue;
    const solutions = circuits(step).filter((ops) => solvesReg(step, ops));
    if (step.tray.includes('CX') && step.tray.length > 1) assert.ok(solutions.every((ops) => ops.some((op) => op.startsWith('CX'))), step.title);
    if (step.tray.some((piece) => piece.startsWith('ghost:'))) assert.ok(solutions.every((ops) => ops.some((op) => op.startsWith('ghost:'))), step.title);
  }
});

test('each Hollow card is taught by exactly one neighbor, cards never clash with other towns, and the badge is a medal', () => {
  for (const id of KNOWLEDGE_IDS) {
    assert.equal(HOLLOW_NPCS.filter((npc) => npc.knowledge === id).length, 1, id);
    assert.equal(KNOWLEDGE[id].id, id);
    assert.ok(!COIN_KNOWLEDGE_IDS.includes(id) && !FOUNDRY_KNOWLEDGE_IDS.includes(id), id);
  }
  assert.equal(new Set(ALL_KNOWLEDGE_IDS).size, ALL_KNOWLEDGE_IDS.length);
  for (const npc of HOLLOW_NPCS.filter((person) => person.knowledge)) assert.ok(npc.steps.length >= 2 && npc.intro.length && npc.outro.length && npc.repeat.length, npc.id);
  assert.ok(MEDALS.some((medal) => medal.id === 'hollow-town' && medal.scenario === 'vault' && medal.mission === 'town'));
});

test('every Hollow line, step and card has a Spanish translation', () => {
  const strings = [CARD_COUNT, ...Object.values(KEEPER).map((l) => l.text)];
  for (const card of Object.values(KNOWLEDGE)) strings.push(card.title, card.text, card.hint);
  for (const npc of HOLLOW_NPCS) {
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
const blockers = () => [...HOLLOW_NPCS.map((npc) => npc.at), ...HOLLOW_PROPS.map((prop) => prop.at)];

test('Hollow Town: every neighbor and Casa Ofelia are reachable from the east gate, which is the only way out', () => {
  const grid = solidGrid(hollowMap, blockers());
  const beside = (at) => [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }].map((d) => ({ x: at.x + d.x, y: at.y + d.y }));
  assert.ok(!grid[HOLLOW_SPAWN.y][HOLLOW_SPAWN.x]);
  for (const npc of HOLLOW_NPCS) assert.ok(beside(npc.at).some((pos) => findRoute(grid, HOLLOW_SPAWN, pos)), npc.id);
  assert.ok(findRoute(grid, HOLLOW_SPAWN, HOLLOW_DOOR.stand));
  const right = hollowMap.width - 1, bottom = hollowMap.height - 1;
  grid.forEach((row, y) => {
    assert.equal(!row[right], HOLLOW_EAST_ROAD.includes(y), `right edge ${y}`);
    assert.ok(row[0], `left edge ${y}`);
  });
  assert.ok(grid[0].every((solid) => solid) && grid[bottom].every((solid) => solid));
  for (const y of HOLLOW_EAST_ROAD) assert.ok(findRoute(grid, HOLLOW_SPAWN, { x: right, y }));
});

test('Hollow props and mist sit on open ground, and animals have room to wander', () => {
  const open = solidGrid(hollowMap);
  for (const prop of HOLLOW_PROPS) assert.ok(!open[prop.at.y][prop.at.x], `${prop.sprite} at ${prop.at.x},${prop.at.y}`);
  assert.equal(new Set(HOLLOW_PROPS.map((prop) => `${prop.at.x},${prop.at.y}`)).size, HOLLOW_PROPS.length);
  for (const at of HOLLOW_FOG) assert.ok(!open[at.y][at.x], `fog ${at.x},${at.y}`);
  const grid = solidGrid(hollowMap, blockers());
  for (const animal of HOLLOW_ANIMALS) {
    assert.ok(!grid[animal.home.y][animal.home.x], `${animal.kind} at ${animal.home.x},${animal.home.y}`);
    assert.ok(tilesNear(grid, animal.home, animal.radius).length >= 4, animal.kind);
  }
});
