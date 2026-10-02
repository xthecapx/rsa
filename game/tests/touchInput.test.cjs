const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs, root } = require('./loadTs.cjs');
const input = loadTs(`${root}/engine/touchInput.ts`);

test('movement follows the latest finger and ignores unrelated releases', () => {
  input.clearTouchInput();
  input.holdTouchDirection(1, 'left');
  input.holdTouchDirection(2, 'up');
  assert.equal(input.touchDirection(), 'up');
  input.releaseTouchDirection(3);
  assert.equal(input.touchDirection(), 'up');
  input.releaseTouchDirection(2);
  assert.equal(input.touchDirection(), 'left');
  input.releaseTouchDirection(1);
  assert.equal(input.touchDirection(), null);
});

test('locking, hiding or leaving a scene clears movement and queued interaction', () => {
  input.holdTouchDirection(1, 'right');
  input.queueTouchInteract();
  input.clearTouchInput();
  assert.equal(input.touchDirection(), null);
  assert.equal(input.consumeTouchInteract(), false);
  input.queueTouchInteract();
  assert.equal(input.consumeTouchInteract(), true);
  assert.equal(input.consumeTouchInteract(), false);
});
