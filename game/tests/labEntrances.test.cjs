const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs, root } = require("./loadTs.cjs");
const load = (file) => loadTs(path.join(root, file));
const { LAB_ENTRANCES, cleanLabDiscoveries } = load("content/labEntrances");
const { discoverLab, inspectLab, enterLab, leaveLab, migrateLabEntrance } =
  load("game/labTravel");
const { useTown } = load("game/town");
const { useLab } = load("game/lab");
const { useGame } = load("game/state");
const { currentCheckpoint } = load("game/checkpoints");
const { restoreCheckpoint } = load("game/restoreCheckpoint");
const reset = () => {
  useTown.getState().reset();
  useLab.getState().reset();
  useGame.getState().resetRun(1);
};

test("inspection reveals only its town, saves before entry, and repeat inspection enters directly", () => {
  reset();
  let entries = 0;
  const reveal = inspectLab(
    "foundry",
    () => entries++,
    () => {},
  );
  assert.equal(entries, 0);
  assert.equal(useTown.getState().location, "coinTown");
  assert.deepEqual(useTown.getState().labEntrances, { foundry: true });
  reveal.choices[1].action();
  assert.equal(entries, 0);
  assert.equal(
    inspectLab(
      "foundry",
      () => entries++,
      () => {},
    ),
    null,
  );
  assert.equal(entries, 1);
  assert.equal(discoverLab("foundry"), false);
});

test("all five passages share lab contents and return to safe origin tiles after rehydration", async () => {
  reset();
  const inventory = useLab.getState().owned,
    recipe = useLab.getState().recipe;
  for (const [where, door] of Object.entries(LAB_ENTRANCES)) {
    const checkpoint = useTown.getState().checkpoint;
    assert.equal(
      enterLab(where, () => true),
      true,
    );
    await useTown.persist.rehydrate();
    assert.equal(useTown.getState().labFrom, where);
    assert.equal(useTown.getState().location, "lab");
    assert.equal(leaveLab(), true);
    const town = useTown.getState(),
      place = where === "town" ? town : town[where];
    assert.equal(town.location, where);
    assert.deepEqual(place.position, door.stand);
    assert.equal(place.facing, door.facing);
    assert.deepEqual(town.checkpoint, checkpoint);
    assert.equal(useLab.getState().owned, inventory);
    assert.equal(useLab.getState().recipe, recipe);
  }
});

test("busy work or a refused mission pause never changes origin, discovery or location", () => {
  reset();
  const before = useTown.getState();
  let pauses = 0;
  for (const busy of [
    { operations: 1 },
    { phase: "busy" },
    { busyLabel: "Setting up the QPU" },
  ]) {
    useGame.setState({
      operations: 0,
      phase: "exploring",
      busyLabel: null,
      ...busy,
    });
    assert.equal(
      enterLab("cipher", () => {
        pauses++;
        return true;
      }),
      false,
    );
    assert.equal(
      inspectLab(
        "cipher",
        () => {},
        () => {},
      ),
      null,
    );
    assert.equal(leaveLab(), false);
    assert.equal(useTown.getState(), before);
  }
  useGame.setState({ operations: 0, phase: "exploring", busyLabel: null });
  assert.equal(
    enterLab("cipher", () => false),
    false,
  );
  assert.equal(useTown.getState(), before);
  assert.equal(pauses, 0);
});

test("legacy discovery migrates only Coin Town; invalid saved origins and flags are discarded", () => {
  reset();
  useLab.setState({ discovered: true });
  migrateLabEntrance();
  migrateLabEntrance();
  assert.deepEqual(useTown.getState().labEntrances, { coinTown: true });
  const merge = useTown.persist.getOptions().merge;
  const saved = merge(
    {
      location: "lab",
      labFrom: "__proto__",
      labEntrances: { cipher: true, town: "true", unknown: true },
    },
    useTown.getState(),
  );
  assert.equal(saved.labFrom, "coinTown");
  assert.deepEqual(saved.labEntrances, { cipher: true });
  assert.equal(
    merge({ location: "lab" }, useTown.getState()).labFrom,
    "coinTown",
  );
  assert.deepEqual(cleanLabDiscoveries(null), {});
  assert.deepEqual(cleanLabDiscoveries(["town"]), {});
});

test("checkpoint shortcuts reveal only their destination; lab codes follow origin and resets retain the right state", () => {
  reset();
  discoverLab("hollow");
  assert.equal(restoreCheckpoint("ft1"), true);
  assert.deepEqual(useTown.getState().labEntrances, {
    hollow: true,
    foundry: true,
  });
  for (const [where, code] of [
    ["coinTown", "ct1"],
    ["foundry", "ft3"],
    ["hollow", "ht1"],
    ["cipher", "ci1"],
    ["town", "qt1"],
  ]) {
    assert.equal(
      currentCheckpoint("lab", [], { grover: ["grover"] }, {}, where),
      code,
    );
  }
  useLab.setState({ layout: load("game/labLayout").defaultLayout() });
  assert.deepEqual(useTown.getState().labEntrances, {
    hollow: true,
    foundry: true,
  });
  useTown.getState().reset();
  useLab.getState().reset();
  migrateLabEntrance();
  assert.deepEqual(useTown.getState().labEntrances, {});
  assert.equal(useTown.getState().labFrom, "coinTown");
});

test("every passage approach is reachable from its town spawn with roads closed and actors blocked", () => {
  const { findRoute, walkable } = load("engine/maps/grid");
  for (const [where, door] of Object.entries(LAB_ENTRANCES)) {
    const name = where === "town" ? "town" : where;
    const map = load(`engine/maps/${name}Map`)[`${name}Map`];
    let spawn, grid;
    if (where === "town") {
      grid = load("engine/maps/street").buildSolidGrid();
      spawn = load("content/town").TOWN_SPAWN;
    } else {
      const content = load(
        `content/${where === "coinTown" ? "coinTown" : where}`,
      );
      const prefix = where === "coinTown" ? "COIN_TOWN" : where.toUpperCase();
      spawn = content[`${prefix}_SPAWN`];
      grid = map.rows.map((row, y) =>
        [...row].map(
          (key, x) =>
            !!map.legend[key]?.solid ||
            !!map.overlayLegend[map.overlay[y][x]]?.solid,
        ),
      );
      for (const item of [
        ...content[`${prefix}_NPCS`],
        ...(content[`${prefix}_PROPS`] ?? []),
      ])
        grid[item.at.y][item.at.x] = true;
      if (where === "coinTown") {
        for (const x of content.COIN_TOWN_NORTH_ROAD)
          grid[content.NORTH_GATE_ROW][x] = true;
        for (const y of content.COIN_TOWN_SIDE_ROAD)
          for (const x of [content.EAST_GATE_COL, content.WEST_GATE_COL])
            grid[y][x] = true;
      }
      if (where === "cipher") {
        const street = load("engine/maps/street");
        for (const bay of street.PARKING_BAYS)
          for (let y = 0; y < 2; y++)
            for (let x = 0; x < 2; x++) grid[bay.at.y + y][bay.at.x + x] = true;
        for (const x of content.CIPHER_NORTH_ROAD)
          grid[content.CIPHER_NORTH_GATE_ROW][x] = true;
      }
      assert.ok(
        walkable(grid, door.at),
        `${where} entrance cannot cover existing solids`,
      );
      grid[door.at.y][door.at.x] = true;
    }
    assert.ok(walkable(grid, door.stand), `${where} safe standing tile`);
    assert.ok(findRoute(grid, spawn, door.stand), `${where} approach route`);
    assert.ok(
      walkable(grid, { x: door.stand.x, y: door.stand.y + 1 }),
      `${where} walk away from exit`,
    );
  }
});
