const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs, root } = require('./loadTs.cjs');
const { thumbstick } = loadTs(`${root}/engine/thumbstick.ts`);

test('the stick center and small finger jitter do not move the character', () => {
  for (const [x, y] of [[0, 0], [6, -6], [12, 0]]) assert.equal(thumbstick(x, y).direction, null);
});

test('dragging around the ring changes the held cardinal direction', () => {
  for (const [x, y, direction] of [[0, -25, 'up'], [25, 0, 'right'], [0, 25, 'down'], [-25, 0, 'left']]) {
    assert.equal(thumbstick(x, y).direction, direction);
  }
  assert.equal(thumbstick(25, -15).direction, 'right');
  assert.equal(thumbstick(-15, -25).direction, 'up');
  assert.equal(thumbstick(0, 0).direction, null);
});

test('a finger outside the pad keeps walking while the knob stays within the ring', () => {
  const result = thumbstick(300, -400);
  assert.equal(result.direction, 'up');
  assert.ok(Math.abs(Math.hypot(result.x, result.y) - 34) < 1e-9);
  assert.ok(Math.abs(result.x / result.y - 300 / -400) < 1e-9);
});
