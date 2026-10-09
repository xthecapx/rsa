const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs, root } = require('./loadTs.cjs');
const { clampCameraFocus } = loadTs(`${root}/engine/camera.ts`);
const { roomCamera } = loadTs(`${root}/game/roomCamera.ts`);
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

test('lab camera follows the sprite center and clamps at all cave edges', () => {
  const bounds = { x: -16, y: -16, width: 480, height: 272 };
  const size = { width: 400, height: 240 };
  const camera = roomCamera(bounds, size, { x: 240, y: 136 });
  assert.equal(camera.x + camera.width / 2, 240);
  assert.equal(camera.y + camera.height / 2, 124);
  assert.equal(camera.cropped, true);
  for (const player of [{ x: 14, y: 14 }, { x: 434, y: 210 }]) {
    const c = roomCamera(bounds, size, player);
    assert.ok(c.x >= bounds.x && c.x + c.width <= bounds.x + bounds.width);
    assert.ok(c.y >= bounds.y && c.y + c.height <= bounds.y + bounds.height);
    assert.ok(player.x >= c.x && player.x <= c.x + c.width);
    assert.ok(player.y - 12 >= c.y && player.y - 12 <= c.y + c.height);
  }
});

test('room resize preserves scale, centers a fitting base, and flags a phone crop', () => {
  const bounds = { x: -16, y: -16, width: 256, height: 272 };
  const player = { x: 98, y: 210 };
  const desktop = roomCamera(bounds, { width: 1200, height: 600 }, player);
  assert.equal(desktop.cropped, false);
  assert.equal(desktop.x + desktop.width / 2, 112);
  assert.equal(desktop.y + desktop.height / 2, 120);
  const phone = roomCamera(bounds, { width: 320, height: 360 }, player);
  assert.equal(phone.cropped, true);
  assert.equal(phone.width, 160);
  assert.equal(phone.height, 180);
  assert.ok(player.y <= phone.y + phone.height);
});
