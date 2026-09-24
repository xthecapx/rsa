const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const exportsObject = {};
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../game/coinRoom.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(exportsObject);
const { ROOM_START, ROOM_STATIONS, canStand, nearbyStation, moveInRoom, roomRoute } = exportsObject;

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
test('keyboard movement stops at walls, table and couch, even for a long step', () => {
  assert.ok(moveInRoom(ROOM_START, 1000, 0).x <= 376);
  const table = moveInRoom(ROOM_STATIONS.table, 0, -150);
  assert.ok(table.y > 177);
  assert.ok(canStand(table));
  const couch = moveInRoom({ x: 120, y: 190 }, -100, 0);
  assert.ok(couch.x > 110);
});
test('tapping furniture finds a safe reachable floor tile', () => {
  const route = roomRoute(ROOM_START, { x: 190, y: 145 });
  assert.ok(route.length);
  assert.ok(route.every(canStand));
});
