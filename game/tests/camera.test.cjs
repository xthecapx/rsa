const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs, root } = require('./loadTs.cjs');
const { clampCameraFocus } = loadTs(`${root}/engine/camera.ts`);
const map = { width: 640, height: 480 };

test('portrait crop keeps both map edges visible instead of clamping to the wide canvas', () => {
  const portrait = { width: 160, height: 256 };
  assert.deepEqual(clampCameraFocus({ x: 24, y: 240 }, map, portrait), { x: 80, y: 240 });
  assert.deepEqual(clampCameraFocus({ x: 616, y: 240 }, map, portrait), { x: 560, y: 240 });
});

test('short landscape crop follows the top and bottom edges', () => {
  const landscape = { width: 480, height: 120 };
  assert.deepEqual(clampCameraFocus({ x: 320, y: 24 }, map, landscape), { x: 320, y: 60 });
  assert.deepEqual(clampCameraFocus({ x: 320, y: 456 }, map, landscape), { x: 320, y: 420 });
});

test('desktop view preserves the map bounds and oversized views center the map', () => {
  assert.deepEqual(clampCameraFocus({ x: 24, y: 456 }, map, { width: 480, height: 256 }), { x: 240, y: 352 });
  assert.deepEqual(clampCameraFocus({ x: 24, y: 456 }, map, { width: 800, height: 600 }), { x: 320, y: 240 });
});
