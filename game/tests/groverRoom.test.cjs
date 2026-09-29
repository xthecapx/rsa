const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const exportsObject = loadTs(path.join(__dirname, '../game/groverRoom.ts'));
const { GROVER_ROOM, canStand, nearbyStation, moveInRoom, roomRoute } = exportsObject;
const ROOM_START = GROVER_ROOM.start, ROOM_STATIONS = GROVER_ROOM.stations;

test('start requires walking; each destination is reachable without crossing furniture', () => {
  assert.equal(nearbyStation(ROOM_START), null);
  for (const from of [ROOM_START, ...Object.values(ROOM_STATIONS)]) {
    for (const [name, to] of Object.entries(ROOM_STATIONS)) {
      const route = roomRoute(from, to);
      assert.ok(route.length, name);
      let previous = from;
      for (const point of route) {
        assert.ok(canStand(point));
        assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) <= 4.1);
        previous = point;
      }
      assert.equal(nearbyStation(route.at(-1)), name);
    }
  }
});
test('keyboard movement stops at walls, the workbench and Thecap', () => {
  assert.ok(moveInRoom(ROOM_START, 1000, 0).x <= 376);
  const bench = moveInRoom(ROOM_STATIONS.core, 0, -150);
  assert.ok(bench.y > 166);
  assert.ok(canStand(bench));
  const thecap = moveInRoom({ x: 310, y: 144 }, -100, 0);
  assert.ok(thecap.x > 290);
});
test('tapping the workbench finds a safe reachable floor tile', () => {
  const route = roomRoute(ROOM_START, { x: 200, y: 140 });
  assert.ok(route.length);
  assert.ok(route.every(canStand));
});
