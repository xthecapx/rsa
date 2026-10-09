const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./loadTs.cjs");
const { placeLabOperation, moveLabOperation, editLabOperation, labEquipment } =
  loadTs("game/labEditor.ts");
const { validRecipe } = loadTs("game/labCircuit.ts");
const empty = (qubits = 1) => ({
  qubits,
  start: "0".repeat(qubits),
  operations: [],
  shots: 256,
});

test("an empty/cleared circuit accepts a rotation without a starter recipe", () => {
  const recipe = empty();
  const placed = placeLabOperation(recipe, "0:0", "ROTATION", () => true);
  assert.deepEqual(placed.recipe.operations, [
    { gate: "ROTATION", wire: 0, axis: "Y", angle: Math.PI / 2 },
  ]);
  assert.equal(recipe.operations.length, 0);
  assert.equal(placed.selected, 0);
  assert.equal(validRecipe(placed.recipe), true);
});
test("dragging preserves parameters and repairs CNOT control collisions", () => {
  const recipe = {
    ...empty(3),
    operations: [
      { gate: "CX", wire: 0, control: 1 },
      { gate: "ROTATION", wire: 2, angle: -Math.PI, axis: "Z" },
    ],
  };
  const moved = placeLabOperation(recipe, "1:2", "op-0-0", () => false);
  assert.deepEqual(moved.recipe.operations, [
    recipe.operations[1],
    { gate: "CX", wire: 1, control: 2 },
  ]);
  assert.equal(moved.selected, 1);
  assert.equal(recipe.operations[0].wire, 0);
  assert.deepEqual(moveLabOperation(moved.recipe, 1, -1).operations, [
    moved.recipe.operations[1],
    moved.recipe.operations[0],
  ]);
});
test("invalid drops and settings leave the recipe alone", () => {
  const recipe = empty();
  for (const target of ["-1:0", "1:0", "0:1", "NaN:0"])
    assert.equal(
      placeLabOperation(recipe, target, "H", () => true),
      null,
    );
  assert.equal(
    placeLabOperation(recipe, "0:0", "H", () => false),
    null,
  );
  assert.equal(
    placeLabOperation(recipe, "0:0", "CX", () => true),
    null,
  );
  assert.equal(
    placeLabOperation(recipe, "0:0", "op-4-0", () => true),
    null,
  );
  for (const source of ["unknown", "__proto__", "constructor"]) {
    assert.equal(
      placeLabOperation(recipe, "0:0", source, () => true),
      null,
    );
  }
  const full = {
    ...recipe,
    operations: Array.from({ length: 32 }, () => ({ gate: "H", wire: 0 })),
  };
  assert.equal(
    placeLabOperation(full, "0:32", "H", () => true),
    null,
  );
  assert.equal(moveLabOperation(full, 0, -1), null);
  const legacy = { ...recipe, operations: [{ gate: "RY", wire: 0, angle: 1 }] };
  assert.equal(editLabOperation(legacy, 0, { angle: Infinity }), null);
  assert.deepEqual(
    editLabOperation(legacy, 0, { gate: "ROTATION", axis: "X" }).operations,
    [{ gate: "ROTATION", wire: 0, angle: 1, axis: "X" }],
  );
});
test("equipment grants retain starter and legacy rotation access", () => {
  // Use the canonical medal IDs from the catalogue rather than inventing progress.
  const { MEDALS } = loadTs("content/medals.ts");
  const earned = Object.fromEntries(MEDALS.map((m) => [m.id, "earned"]));
  const bare = labEquipment([], earned);
  assert.equal(
    bare.canRun({ ...empty(), operations: [{ gate: "H", wire: 0 }] }),
    true,
  );
  assert.equal(bare.allowed("H"), false);
  const rotation = labEquipment(["RY"], earned);
  assert.equal(rotation.allowed("RY"), true);
  assert.equal(rotation.allowed("ROTATION"), true);
  assert.equal(rotation.multipleQubits, false);
  const algorithms = labEquipment(["grover", "kickback"], earned);
  assert.equal(algorithms.multipleQubits, true);
  for (const gate of ["H", "X", "CX", "ORACLE", "D", "PARITY"])
    assert.equal(algorithms.allowed(gate), true);
  assert.equal(labEquipment(["RY"], {}).allowed("ROTATION"), false);
});
