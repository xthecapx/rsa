const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const catalog = require('../i18n/es.json');
const street = require('../engine/maps/street.json');
const crypto = loadTs(path.join(__dirname, '../game/crypto.ts'));
const { caesar, letterNumber, numberLetter, mod, modPow, gcd, modInverse, period, TOY_KEYS, BOUNTY_WORDS } = crypto;
const cipher = loadTs(path.join(__dirname, '../content/cipher.ts'));
const { CIPHER_NPCS, CIPHER_PROPS, CIPHER_ANIMALS, CIPHER_SPAWN, CIPHER_SOUTH_ROAD, CIPHER_NORTH_ROAD, CIPHER_NORTH_GATE_ROW, CIPHER_FROM_NORTH, CIPHER_BOARD,
  KNOWLEDGE, KNOWLEDGE_IDS, ROOT, CLIENT, CHISPA, CERO, GEAR, JOB_OBJECTIVES, CARD_COUNT, CLIENT_ADVANCE, ACT_PAYOUT, makeBounty } = cipher;
const { ALL_KNOWLEDGE_IDS, COIN_KNOWLEDGE_IDS, FOUNDRY_KNOWLEDGE_IDS, HOLLOW_KNOWLEDGE_IDS } = loadTs(path.join(__dirname, '../content/knowledge.ts'));
const { cipherMap } = loadTs(path.join(__dirname, '../engine/maps/cipherMap.ts'));
const { RSA_OFFSET } = loadTs(path.join(__dirname, '../engine/maps/townMap.ts'));
const { LANDMARKS, PARKING_BAYS } = loadTs(path.join(__dirname, '../engine/maps/street.ts'));
const { findRoute, tilesNear } = loadTs(path.join(__dirname, '../engine/maps/grid.ts'));
const { MEDALS } = loadTs(path.join(__dirname, '../content/medals.ts'));

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fromSup = (text) => Number([...text].map((ch) => SUP.indexOf(ch)).join(''));

/** Work out what a slot asks from its own math, so a typo in an answer can't hide. */
function evaluate(ask, aid) {
  let m;
  if (/^[A-Z]$/.test(ask)) return aid?.kind === 'wheel' ? caesar(ask, aid.key) : String(letterNumber(ask));
  if (/^\d+$/.test(ask) && aid?.kind === 'table') return numberLetter(Number(ask));
  if ((m = ask.match(/^(\d+) mod (\d+)$/))) return String(mod(Number(m[1]), Number(m[2])));
  if ((m = ask.match(/^(?:[cm] = )?(\d+)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) mod (\d+)$/))) return String(modPow(Number(m[1]), fromSup(m[2]), Number(m[3])));
  if ((m = ask.match(/^gcd\((\d+) ([−+]) 1, (\d+)\)$/))) return String(gcd(Number(m[1]) + (m[2] === '+' ? 1 : -1), Number(m[3])));
  return null;
}

test('the Cipher Town arithmetic does what the cards say', () => {
  assert.equal(caesar('CAT', 3), 'FDW');
  assert.equal(caesar('VWLU', -7), 'OPEN');
  assert.equal(caesar('ZEBRA', 26), 'ZEBRA');
  assert.equal(numberLetter(16), 'P');
  assert.equal(mod(17, 12), 5);
  assert.equal(modPow(4, 3, 33), 31);
  assert.equal(modPow(31, 7, 33), 4);
  assert.equal(modInverse(3, 20), 7);
  assert.equal(modInverse(4, 20), null);
  assert.equal(period(7, 15), 4);
  assert.equal(period(4, 7), 3);
  assert.deepEqual([gcd(48, 15), gcd(50, 15)], [3, 5]);
  for (const { p, q, e, d } of TOY_KEYS) {
    const phi = (p - 1) * (q - 1);
    assert.equal((e * d) % phi, 1, `${p}·${q}`);
    for (let m = 0; m < p * q; m++) assert.equal(modPow(modPow(m, e, p * q), d, p * q), m, `${p}·${q} m=${m}`);
  }
});

const TEACHERS = CIPHER_NPCS.filter((npc) => npc.knowledge);
function checkCrypto(step, where) {
  assert.ok(step.slots.length > 0, where);
  for (const slot of step.slots) assert.ok(step.tray.includes(slot.answer), `${where}: ${slot.ask} needs ${slot.answer} in the tray`);
  assert.ok(step.tray.length > new Set(step.slots.map((slot) => slot.answer)).size, `${where}: the tray needs a decoy`);
}

test('every Cipher bench can be solved from its own tray, and its answers follow from the math', () => {
  for (const npc of TEACHERS) for (const step of npc.steps) {
    const where = `${npc.id}: ${step.title}`;
    if (step.kind === 'crypto') {
      checkCrypto(step, where);
      for (const slot of step.slots) {
        const value = evaluate(slot.ask, step.aid);
        if (value !== null) assert.equal(value, slot.answer, `${where}: ${slot.ask}`);
      }
    } else if (step.kind === 'dial') {
      assert.ok(step.key >= 1 && step.key <= 25, where);
      assert.equal(caesar(step.cipher, -step.key), 'OPEN', where);
    } else {
      assert.equal(step.kind, 'question', where);
      assert.equal(step.options.filter((option) => option.correct).length, 1, where);
      for (const option of step.options) assert.ok(option.correct || option.wrong, `${where}: ${option.label}`);
    }
  }
  // The slots the evaluator can't read are Paloma's key and Dante's beat.
  const paloma = CIPHER_NPCS.find((npc) => npc.id === 'paloma').steps[0].slots.map((slot) => slot.answer);
  assert.deepEqual(paloma, [String(3 * 11), String(2 * 10), String(modInverse(3, 20))]);
  assert.equal(CIPHER_NPCS.find((npc) => npc.id === 'dante').steps[1].slots[0].answer, String(period(7, 15)));
});

test('every bounty on Cero’s board is solvable, and all four kinds come up', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 400; seed++) {
    const step = makeBounty(seed);
    assert.deepEqual(makeBounty(seed), step, `seed ${seed} is stable`);
    kinds.add(step.kind === 'dial' ? 'dial' : step.title);
    if (step.kind === 'dial') {
      assert.ok(BOUNTY_WORDS.includes(caesar(step.cipher, -step.key)), `seed ${seed}`);
      continue;
    }
    checkCrypto(step, `seed ${seed}`);
    if (step.title === 'Split a padlock') assert.equal(Number(step.slots[0].answer) * Number(step.slots[1].answer), step.vars.n, `seed ${seed}`);
    else for (const slot of step.slots) assert.equal(evaluate(slot.ask, step.aid), slot.answer, `seed ${seed}: ${slot.ask}`);
  }
  assert.equal(kinds.size, 4);
});

test('each Cipher card is taught by exactly one neighbor, cards never clash with other towns, and the badge is a medal', () => {
  assert.deepEqual(TEACHERS.map((npc) => npc.knowledge).sort(), [...KNOWLEDGE_IDS].sort());
  for (const id of KNOWLEDGE_IDS) {
    assert.equal(KNOWLEDGE[id].id, id);
    assert.ok(ALL_KNOWLEDGE_IDS.includes(id));
    assert.ok(![...COIN_KNOWLEDGE_IDS, ...FOUNDRY_KNOWLEDGE_IDS, ...HOLLOW_KNOWLEDGE_IDS].includes(id));
  }
  const badge = MEDALS.find((medal) => medal.id === 'cipher-town');
  assert.equal(badge.scenario, 'rsa');
  assert.equal(badge.mission, 'town');
});

test('the client’s money buys every job’s gear without any neighbor or bounty', () => {
  let credits = CLIENT_ADVANCE;
  for (const act of [1, 2, 3, 4]) {
    const gear = GEAR.filter((item) => item.act === act);
    assert.equal(gear.length, 1, `act ${act}`);
    assert.ok(credits >= gear[0].price, `act ${act}: ${credits} credits for ${gear[0].price}`);
    credits += ACT_PAYOUT[act] - gear[0].price;
  }
});

test('every Cipher line, step, card and piece of gear has a Spanish translation', () => {
  const strings = [CARD_COUNT, ...Object.values(ROOT).map((l) => l.text), ...CLIENT.advance.map((l) => l.text),
    ...Object.values(CHISPA).map((l) => l.text), ...Object.values(CERO).map((l) => l.text), ...Object.values(JOB_OBJECTIVES)];
  for (const item of GEAR) strings.push(item.title, item.text, item.objective, item.need);
  for (const card of Object.values(KNOWLEDGE)) strings.push(card.title, card.text, card.hint);
  const steps = [];
  for (const npc of CIPHER_NPCS) {
    strings.push(npc.title, npc.description, ...[...npc.intro, ...npc.outro, ...npc.repeat].map((l) => l.text));
    steps.push(...npc.steps);
  }
  for (let seed = 0; seed < 8; seed++) steps.push(makeBounty(seed));
  for (const step of steps) {
    strings.push(step.title, step.text, step.feedback);
    if (step.kind === 'question') for (const option of step.options) strings.push(option.label, ...(option.wrong ? [option.wrong] : []));
  }
  for (const text of strings) assert.ok(catalog[text], text);
});

function solidGrid(map, extra = []) {
  const grid = map.rows.map((row, y) => [...row].map((tile, x) => !!map.legend[tile]?.solid || !!map.overlayLegend[map.overlay[y][x]]?.solid));
  for (const at of extra) grid[at.y][at.x] = true;
  return grid;
}
/** People, props, the parked cars and Ale and Brayan at their windows, as the scene blocks them. */
function blockers() {
  const cars = PARKING_BAYS.flatMap((bay) => [0, 1].flatMap((dy) => [0, 1].map((dx) => ({ x: bay.at.x + dx, y: bay.at.y + dy }))));
  return [...CIPHER_NPCS.map((npc) => npc.at), ...CIPHER_PROPS.map((prop) => prop.at), ...cars, LANDMARKS.ale.at, LANDMARKS.brayan.at];
}

test('Cipher Town carries Ale and Brayan’s street on the same tiles as Quantum Town', () => {
  // Houses, both sidewalks and the road; the grass verge below is the town's own ground.
  const STREET_ROWS = 12;
  for (let y = 0; y < STREET_ROWS; y++) for (let x = 0; x < street.width; x++) {
    assert.equal(cipherMap.rows[y + RSA_OFFSET.y][x + RSA_OFFSET.x].replace('q', 'p'), street.rows[y][x].replace('q', 'p'), `ground ${x},${y}`);
    assert.equal(cipherMap.overlay[y + RSA_OFFSET.y][x + RSA_OFFSET.x], street.overlay[y][x], `overlay ${x},${y}`);
  }
});

test('Cipher Town: every neighbor, the board, the street and both roads are reachable from the south gate', () => {
  const grid = solidGrid(cipherMap, blockers());
  const beside = (at) => [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }].map((d) => ({ x: at.x + d.x, y: at.y + d.y }));
  assert.ok(!grid[CIPHER_SPAWN.y][CIPHER_SPAWN.x]);
  for (const npc of CIPHER_NPCS) assert.ok(beside(npc.at).some((pos) => findRoute(grid, CIPHER_SPAWN, pos)), npc.id);
  assert.ok(findRoute(grid, CIPHER_SPAWN, CIPHER_BOARD.stand));
  for (const key of ['car', 'tap', 'ale', 'brayan']) assert.ok(findRoute(grid, CIPHER_SPAWN, LANDMARKS[key].stand), key);
  const bottom = cipherMap.height - 1;
  grid[bottom].forEach((solid, x) => assert.equal(!solid, CIPHER_SOUTH_ROAD.includes(x), `bottom edge ${x}`));
  grid[0].forEach((solid, x) => assert.equal(!solid, CIPHER_NORTH_ROAD.includes(x), `top edge ${x}`));
  for (const x of CIPHER_SOUTH_ROAD) assert.ok(findRoute(grid, CIPHER_SPAWN, { x, y: bottom }));
  // The north gate closes the road to Quantum Town until it opens.
  for (const x of CIPHER_NORTH_ROAD) assert.ok(findRoute(grid, CIPHER_SPAWN, { x, y: 0 }));
  const gated = grid.map((row) => [...row]);
  for (const x of CIPHER_NORTH_ROAD) gated[CIPHER_NORTH_GATE_ROW][x] = true;
  for (const x of CIPHER_NORTH_ROAD) assert.equal(findRoute(gated, CIPHER_SPAWN, { x, y: 0 }), null);
  assert.ok(!grid[CIPHER_FROM_NORTH.y][CIPHER_FROM_NORTH.x] && CIPHER_FROM_NORTH.y > CIPHER_NORTH_GATE_ROW);
});

test('Cipher props sit on open ground, and animals have room to wander', () => {
  const open = solidGrid(cipherMap);
  for (const prop of CIPHER_PROPS) assert.ok(!open[prop.at.y][prop.at.x], `${prop.sprite} at ${prop.at.x},${prop.at.y}`);
  assert.equal(new Set(CIPHER_PROPS.map((prop) => `${prop.at.x},${prop.at.y}`)).size, CIPHER_PROPS.length);
  const grid = solidGrid(cipherMap, blockers());
  for (const animal of CIPHER_ANIMALS) {
    assert.ok(!grid[animal.home.y][animal.home.x], `${animal.kind} at ${animal.home.x},${animal.home.y}`);
    assert.ok(tilesNear(grid, animal.home, animal.radius).length >= 4, animal.kind);
  }
});
