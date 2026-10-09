const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { PuzzleInteraction } = loadTs(path.join(__dirname, '../game/puzzleInteraction.ts'));

function harness() {
  let time = 10, frame = 0;
  const callbacks = new Map(), canceled = [];
  const input = new PuzzleInteraction({
    now: () => time,
    request: (callback) => { callbacks.set(++frame, callback); return frame; },
    cancel: (id) => canceled.push(id),
  });
  const stops = [];
  const manager = {
    actions: { stop(options) { stops.push(options); input.end(); } },
    dragOperation: { status: { idle: false } },
  };
  return { input, manager, callbacks, canceled, stops, advance: () => time += 300 };
}

test('clearing a picked-up component cancels its drag and immediately restores clicks', () => {
  const h = harness();
  for (let cycle = 0; cycle < 3; cycle++) {
    h.input.start(h.manager);
    assert.equal(h.input.canClick(), false);
    h.input.reset();
    assert.equal(h.input.canClick(), true);
    assert.deepEqual(h.stops.at(-1), { canceled: true });
  }
});

test('clear or single deletion invalidates a pending old drop instead of resurrecting a gate', () => {
  for (const action of ['clear', 'remove component', 'close laptop']) {
    const h = harness(), placed = [];
    h.input.start(h.manager);
    h.input.end();
    h.input.placeWhenIdle(h.manager, () => placed.push('old gate'));
    const oldCallback = [...h.callbacks.values()][0];
    h.input.reset();
    h.manager.dragOperation.status.idle = true;
    oldCallback(); // Even an already queued callback must be harmless.
    assert.deepEqual(placed, [], action);
    assert.equal(h.canceled.length, 1, action);
    h.input.placeWhenIdle(h.manager, () => placed.push('new gate'));
    assert.deepEqual(placed, ['new gate'], action);
  }
});

test('normal drops wait for idle and suppress only their synthetic click; unmount cancels pending work', () => {
  const h = harness(), placed = [];
  h.input.start(h.manager);
  h.input.end();
  h.input.placeWhenIdle(h.manager, () => placed.push('H'));
  assert.deepEqual(placed, []);
  assert.equal(h.input.canClick(), false);
  h.manager.dragOperation.status.idle = true;
  [...h.callbacks.values()][0]();
  assert.deepEqual(placed, ['H']);
  h.advance();
  assert.equal(h.input.canClick(), true);
  h.manager.dragOperation.status.idle = false;
  h.input.placeWhenIdle(h.manager, () => placed.push('stale'));
  const pending = [...h.callbacks.values()].at(-1);
  h.input.dispose();
  h.manager.dragOperation.status.idle = true;
  pending();
  assert.deepEqual(placed, ['H']);
});
