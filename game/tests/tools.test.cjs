const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { calculate, calcInput } = loadTs(path.join(__dirname, '../game/calc.ts'));
const { summarize, groupBits } = loadTs(path.join(__dirname, '../game/histogram.ts'));
const { CIPHER_NPCS, makeBounty } = loadTs(path.join(__dirname, '../content/cipher.ts'));
const catalog = require('../i18n/es.json');

const value = (input) => { const result = calculate(input); assert.ok('value' in result, `${input}: ${result.error}`); return result.value.toString(); };

test('the calculator works the bench sums exactly, with mod and ^ binding like the board', () => {
  assert.equal(value('4^3 mod 7'), '1');
  assert.equal(value('31^7 mod 33'), '4');
  assert.equal(value('2 + 3 mod 4'), '5');
  assert.equal(value('3 × 7 mod 20'), '1');
  assert.equal(value('2^3^2'), '512');
  assert.equal(value('gcd(49 - 1, 15)'), '3');
  assert.equal(value('(17 - 5) ÷ 4'), '3');
  assert.equal(value('-3 mod 7'), '4');
  assert.equal(value('7^100'), (7n ** 100n).toString());
  for (const bad of ['4 mod 0', '1 ÷ 0', '2 ^ 99999', '(3 + 4', '3 4', 'gcd(3)', 'x + 1', '']) {
    const result = calculate(bad);
    assert.ok('error' in result, bad);
    assert.ok(catalog[result.error], result.error);
  }
});

test('every bench sum loads into the calculator and gives the slot’s answer', () => {
  assert.equal(calcInput('4³ mod 7'), '4^3 mod 7');
  assert.equal(calcInput('c = 4³ mod 33'), '4^3 mod 33');
  assert.equal(calcInput('gcd(49 − 1, 15)'), 'gcd(49 - 1, 15)');
  for (const ask of ['N = p·q', 'd: 3·d mod 20 = 1', 'r', 'H', '16', 'φ = (p−1)(q−1)']) assert.equal(calcInput(ask), null, ask);
  const steps = [...CIPHER_NPCS.flatMap((npc) => npc.steps), ...Array.from({ length: 40 }, (_, seed) => makeBounty(seed))];
  let loaded = 0;
  for (const step of steps) for (const slot of step.slots ?? []) {
    const input = calcInput(slot.ask);
    if (input === null) continue;
    loaded++;
    assert.equal(value(input), slot.answer, slot.ask);
  }
  assert.ok(loaded >= 15);
});

test('a 25-qubit result stays readable: top strings, one bucket for the rest, and a qubit vote', () => {
  const answer = '0001000000111001010100111';
  const flip = (bits, i) => bits.slice(0, i) + (bits[i] === '1' ? '0' : '1') + bits.slice(i + 1);
  // A noisy backend: most shots on the answer, the rest one bit off.
  const counts = { [answer]: 600 };
  for (let i = 0; i < 25; i++) counts[flip(answer, i)] = 16;
  const summary = summarize({ bits: 25, counts, source: 'hardware', highlight: answer });
  assert.equal(summary.shots, 1000);
  assert.equal(summary.distinct, 26);
  assert.equal(summary.possible, 2n ** 25n);
  assert.equal(summary.rows.length, 8);
  assert.equal(summary.rows[0].bitstring, answer);
  assert.ok(summary.rows[0].highlight);
  assert.equal(summary.other.outcomes, 18);
  assert.ok(Math.abs(summary.rows.reduce((sum, row) => sum + row.share, 0) + summary.other.share - 1) < 1e-9);
  assert.equal(summary.vote, answer);
  // Hardware so noisy the answer never repeats: the vote still finds it.
  const smeared = {};
  for (let i = 0; i < 25; i++) smeared[flip(answer, i)] = 1;
  assert.equal(summarize({ bits: 25, counts: smeared, source: 'hardware' }).vote, answer);
  // The ideal simulator's odds stand in until a shot lands, and the highlight is kept even outside the top.
  const ideal = summarize({ bits: 2, counts: {}, probabilities: { '00': 0.7, '01': 0.2, '10': 0.1 }, source: 'simulator', highlight: '10' }, 1);
  assert.deepEqual(ideal.rows.map((row) => row.bitstring), ['00', '10']);
  assert.equal(groupBits(answer), '00010 00000 11100 10101 00111');
  assert.equal(groupBits('0101'), '0101');
});
