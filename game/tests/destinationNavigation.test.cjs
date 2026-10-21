const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs, root } = require("./loadTs.cjs");
const { DestinationNavigation } = loadTs(
  path.join(root, "engine/destinationNavigation.ts"),
);
const { findRoute } = loadTs(path.join(root, "engine/maps/grid.ts"));

function walker() {
  let finish;
  const player = {
    grid: { x: 0, y: 0 },
    isMoving: false,
    clearRoute() {
      this.isMoving = false;
      finish?.();
    },
    follow(route) {
      this.isMoving = !!route.length;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    arrive(at) {
      this.grid = at;
      this.isMoving = false;
      finish();
    },
  };
  return player;
}
test("destination walking uses the collision-aware path and announces arrival only after finishing", async () => {
  const events = [],
    player = walker(),
    navigation = new DestinationNavigation((event) => events.push(event));
  const goal = { x: 2, y: 0 };
  let route;
  const walking = navigation.walk(player, goal, "Coin house", (to) => {
    route = findRoute(
      [
        [false, true, false],
        [false, false, false],
      ],
      player.grid,
      to,
    );
    return route;
  });
  assert.deepEqual(route, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    goal,
  ]);
  assert.deepEqual(
    events.map((event) => event.state),
    ["walking"],
  );
  player.arrive(goal);
  await walking;
  assert.equal(events.at(-1).state, "arrived");
});
test("a locked or disconnected road has no route and cannot move the player", async () => {
  const events = [],
    player = walker(),
    navigation = new DestinationNavigation((event) => events.push(event));
  await navigation.walk(player, { x: 2, y: 0 }, "North road", (to) =>
    findRoute([[false, true, false]], player.grid, to),
  );
  assert.equal(player.isMoving, false);
  assert.deepEqual(
    events.map((event) => event.state),
    ["unreachable"],
  );
});
test("manual movement or an overlay cancels the pending arrival announcement", async () => {
  const events = [],
    player = walker(),
    navigation = new DestinationNavigation((event) => events.push(event));
  const goal = { x: 1, y: 0 };
  const walking = navigation.walk(player, goal, "Mayor Cap", () => [goal]);
  navigation.cancel();
  player.arrive(goal);
  await walking;
  assert.deepEqual(
    events.map((event) => event.state),
    ["walking", "stopped"],
  );
});
test("replacing a route cannot let its late completion overwrite the current destination", async () => {
  const events = [],
    player = walker(),
    navigation = new DestinationNavigation((event) => events.push(event));
  const first = navigation.walk(player, { x: 1, y: 0 }, "First", () => [
    { x: 1, y: 0 },
  ]);
  const next = { x: 0, y: 1 };
  const second = navigation.walk(player, next, "Second", () => [next]);
  await first;
  assert.equal(events.at(-1).label, "Second");
  assert.equal(events.at(-1).state, "walking");
  player.arrive(next);
  await second;
  assert.equal(events.at(-1).label, "Second");
  assert.equal(events.at(-1).state, "arrived");
});
