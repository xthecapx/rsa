const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./loadTs.cjs');
const { VAULT_ROOM, canStand, nearbyStation, moveInRoom, roomRoute } = loadTs(path.join(__dirname, '../game/vaultRoom.ts'));
const ROOM_START = VAULT_ROOM.start, ROOM_STATIONS = VAULT_ROOM.stations;

test('start requires walking; every station is reachable without crossing furniture', () => {
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
test('keyboard movement stops at walls, the séance table and Ofelia', () => {
  assert.ok(moveInRoom(ROOM_START, 1000, 0).x <= 376);
  const table = moveInRoom(ROOM_STATIONS.table, 0, -150);
  assert.ok(table.y > 166);
  assert.ok(canStand(table));
  const ofelia = moveInRoom({ x: 280, y: 116 }, -100, 0);
  assert.ok(ofelia.x > 262);
});
