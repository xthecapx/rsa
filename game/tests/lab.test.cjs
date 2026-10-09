const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs } = require("./loadTs.cjs");
const { labTrace, algorithmRecipe, validRecipe } = loadTs(
  path.join(__dirname, "../game/labCircuit.ts"),
);
const { validLayout, defaultLayout } = loadTs(
  path.join(__dirname, "../game/labLayout.ts"),
);
const { useLab, parseLab, exportLab } = loadTs(
  path.join(__dirname, "../game/lab.ts"),
);
const { useMedals } = loadTs(path.join(__dirname, "../game/medals.ts"));
const { useKnowledge } = loadTs(path.join(__dirname, "../game/knowledge.ts"));
const { useProgress } = loadTs(path.join(__dirname, "../game/progress.ts"));
const { currentCheckpoint } = loadTs(
  path.join(__dirname, "../game/checkpoints.ts"),
);

test("Ry ideal references preserve normalization, signs and the Bloch Y rotation", () => {
  for (const angle of [
    0,
    Math.PI / 4,
    Math.PI / 2,
    Math.PI,
    2 * Math.PI,
    -Math.PI / 2,
  ]) {
    const recipe = {
      qubits: 1,
      start: "0",
      operations: [{ gate: "RY", wire: 0, angle }],
      shots: 256,
    };
    const [a, b] = labTrace(recipe).at(-1);
    assert.ok(Math.abs(a - Math.cos(angle / 2)) < 1e-12);
    assert.ok(Math.abs(b - Math.sin(angle / 2)) < 1e-12);
    assert.ok(Math.abs(2 * a * b - Math.sin(angle)) < 1e-12);
    assert.ok(Math.abs(a * a - b * b - Math.cos(angle)) < 1e-12);
    assert.ok(validRecipe(recipe));
  }
  assert.equal(
    validRecipe({
      qubits: 1,
      start: "0",
      operations: [{ gate: "RY", wire: 0, angle: NaN }],
      shots: 256,
    }),
    false,
  );
});
test("free-play algorithm recipes expose real components and expected ideal outputs", () => {
  const g = algorithmRecipe("grover", "10", 1),
    p = labTrace(g)
      .at(-1)
      .map((a) => a * a);
  assert.deepEqual(
    g.operations.slice(-2).map((o) => o.gate),
    ["ORACLE", "D"],
  );
  assert.ok(Math.abs(p[2] - 1) < 1e-12);
  const k = algorithmRecipe("kickback", "10"),
    a = labTrace(k).at(-1);
  assert.ok(validRecipe(k));
  assert.ok(Math.abs(a[4] * a[4] + a[5] * a[5] - 1) < 1e-12);
  assert.ok(a[4] > 0 && a[5] < 0);
});
test("cave placement prevents overlaps, blocked exits and inaccessible equipment", () => {
  assert.ok(validLayout(defaultLayout(), 0));
  assert.equal(
    validLayout([{ id: "laptop", x: 3, y: 7, rotated: false }], 0),
    false,
  );
  assert.equal(
    validLayout([{ id: "desk", x: 7, y: 2, rotated: false }], 0),
    false,
  );
  assert.equal(
    validLayout(
      [
        { id: "desk", x: 2, y: 6, rotated: false },
        { id: "storage", x: 2, y: 7, rotated: false },
        { id: "laptop", x: 4, y: 7, rotated: false },
      ],
      0,
    ),
    false,
  );
  assert.equal(
    validLayout(
      [
        { id: "lamp", x: 1, y: 1, rotated: false },
        { id: "storage", x: 1, y: 1, rotated: false },
      ],
      0,
    ),
    false,
  );
  assert.ok(validLayout([{ id: "desk", x: 7, y: 2, rotated: true }], 0));
});
test("equipment is acquired and installed from challenge medals without knowledge cards", () => {
  useLab.getState().reset();
  useMedals.getState().reset();
  useKnowledge.setState({ cards: [] });
  assert.equal(useLab.getState().acquire("RY"), false);
  useMedals.getState().award("quantum-coin");
  assert.equal(useLab.getState().acquire("RY"), true);
  assert.equal(useLab.getState().acquire("RY"), false);
  useLab.getState().install("RY");
  assert.ok(useLab.getState().installed.includes("RY"));
  useLab.getState().install("RY");
  assert.ok(!useLab.getState().installed.includes("RY"));
  assert.ok(useLab.getState().owned.includes("RY"));
  assert.deepEqual(useKnowledge.getState().cards, []);
});
test("lab plan round-trips layouts, installed items and angles without progress or jobs", () => {
  useLab.getState().reset();
  useMedals.getState().reset();
  useMedals.getState().award("quantum-coin");
  useLab.getState().acquire("RY");
  useLab.getState().install("RY");
  const recipe = {
    qubits: 1,
    start: "0",
    operations: [{ gate: "RY", wire: 0, angle: Math.PI / 4 }],
    shots: 1000,
  };
  useLab.setState({ recipe, recipes: [{ name: "Rotation", recipe }] });
  const text = exportLab();
  assert.ok(parseLab(text));
  useLab.getState().reset();
  useMedals.getState().reset();
  assert.ok(useLab.getState().importPlan(text));
  assert.deepEqual(useLab.getState().recipe, recipe);
  assert.deepEqual(useMedals.getState().earned, {});
  assert.ok(!text.includes("counts") && !text.includes("jobId"));
  const before = exportLab();
  assert.equal(useLab.getState().importPlan('{"version":99}'), false);
  assert.equal(exportLab(), before);
  assert.equal(parseLab(text.replace('"RY"', '"UNKNOWN"')), null);
});
test("save progress in the lab keeps the furthest milestone and lesson reset keeps equipment", () => {
  useMedals.getState().reset();
  useProgress.getState().reset();
  useMedals.getState().award("ghost-key");
  assert.equal(
    currentCheckpoint("lab", [], {}, useMedals.getState().earned),
    "ht3",
  );
  const owned = [...useLab.getState().owned];
  useProgress.getState().reset("vault");
  assert.deepEqual(useLab.getState().owned, owned);
  useLab.getState().reset();
  assert.deepEqual(useLab.getState().layout, defaultLayout());
});

test("import and hydration discard runtime fields and cannot replace store methods", () => {
  useLab.getState().reset();
  const data = JSON.parse(exportLab());
  data.lab.reset = "invalid method";
  data.lab.discovered = true;
  data.lab.counts = { 0: 99 };
  data.lab.recipe.jobId = "untrusted job";
  assert.ok(useLab.getState().importPlan(JSON.stringify(data)));
  assert.equal(typeof useLab.getState().reset, "function");
  assert.equal(useLab.getState().discovered, false);
  assert.ok(!exportLab().includes("jobId"));
  const merged = useLab.persist.getOptions().merge(data.lab, useLab.getState());
  assert.equal(typeof merged.reset, "function");
  assert.equal(merged.counts, undefined);
});
