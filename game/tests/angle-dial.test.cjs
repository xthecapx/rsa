const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { pointerDegrees, advanceDialDegrees } = loadTs(path.join(__dirname, '../game/angleDial.ts'));

test('angle dial reads clockwise from the top of an offset viewport', () => {
  const bounds = { left: 50, top: 80, width: 200, height: 200 };
  assert.equal(pointerDegrees(150, 80, bounds), 0);
  assert.equal(pointerDegrees(250, 180, bounds), 90);
  assert.equal(pointerDegrees(150, 280, bounds), 180);
  assert.equal(pointerDegrees(50, 180, bounds), 270);
});

test('angle dial crosses zero smoothly in both directions', () => {
  assert.equal(advanceDialDegrees(-5, 355, 5), 5);
  assert.equal(advanceDialDegrees(5, 5, 355), -5);
  assert.equal(advanceDialDegrees(350, 350, 5), 360);
  assert.equal(advanceDialDegrees(-350, 10, 355), -360);
});

test('angle dial keeps signed full turns and lets players drag back from either limit', () => {
  assert.equal(advanceDialDegrees(360, 0, 90), 360);
  assert.equal(advanceDialDegrees(360, 0, 350), 350);
  assert.equal(advanceDialDegrees(-360, 0, 270), -360);
  assert.equal(advanceDialDegrees(-360, 0, 10), -350);
  assert.equal(advanceDialDegrees(-270, -270, 90), -270);
});
