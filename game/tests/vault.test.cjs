const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const vault = loadTs(path.join(__dirname, '../lib/vault.ts'));
const { Synth } = loadTs(path.join(__dirname, '../game/synth.ts'));

test('the level’s numbers come from the formulas, not a table', () => {
  assert.equal(vault.KEYSPACE, 33554432);
  assert.equal(vault.optimalRounds(vault.KEYSPACE), 4549);
  assert.equal(vault.optimalRounds(16), 3);
  assert.equal(vault.formatPercent(vault.bruteForce(3)), '0.0000089%');
  const p3 = vault.groverProbability(vault.KEYSPACE, 3);
  assert.ok(p3 < 0.000002);
  assert.equal(vault.formatPercent(p3, 3), '0.000146%');
  assert.ok(vault.groverProbability(vault.KEYSPACE, 4549) > 0.999999);
  assert.equal(vault.formatCount(2 ** 22), '4,194,304');
});
test('one-candle questions pin a bit; several candles only give an equation', () => {
  const one = vault.vectorOf([6]), many = vault.vectorOf([1, 8, 13]);
  assert.equal(one.length, 25);
  const known = vault.knownBits([{ x: one, knock: 1 }, { x: many, knock: 1 }]);
  assert.deepEqual([...known], [[6, 1]]);
  assert.deepEqual(vault.litCandles(many), [1, 8, 13]);
});
test('answers are spelled out, and several tumblers never pin a digit', () => {
  assert.equal(vault.answerLine({ x: vault.vectorOf([6]), knock: 1 }), '👻 Knock! Tumbler 7 is 1.');
  assert.equal(vault.answerLine({ x: vault.vectorOf([0]), knock: 0 }), '… Silence. Tumbler 1 is 0.');
  const clue = { x: vault.vectorOf([1, 8, 13]), knock: 1 };
  assert.match(vault.answerLine(clue), /tumblers 2, 9, 14 together\. No single digit/);
  assert.equal(vault.knownBits([clue]).size, 0);
});
test('Spanish templates translate the spelled-out answers', () => {
  const { translate } = loadTs(path.join(__dirname, '../i18n/translate.ts'));
  const es = require('../i18n/es.json');
  assert.equal(translate(vault.answerLine({ x: vault.vectorOf([6]), knock: 1 }), es), '👻 ¡Golpe! El cilindro 7 es 1.');
  assert.equal(translate(`Ask about tumblers ${vault.tumblerList([1, 8])} together?`, es), '¿Preguntar por los cilindros 2, 9 juntos?');
});
test('every new haunting cue is silent, not a crash, without Web Audio', () => {
  const synth = new Synth();
  for (const id of ['knock', 'snuff', 'toll', 'cold', 'glow']) assert.doesNotThrow(() => synth.play(id));
});
