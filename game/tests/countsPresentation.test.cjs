const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs, root } = require("./loadTs.cjs");
const { countsPresentation } = loadTs(
  path.join(root, "game/countsPresentation.ts"),
);

test("all 256 counts reconcile with the eight peaks and remaining shots, without changing source data", () => {
  const counts = Object.freeze(
    Object.fromEntries(
      Array.from({ length: 256 }, (_, i) => [
        i.toString(2).padStart(8, "0"),
        (i % 5) + 1,
      ]),
    ),
  );
  const before = JSON.stringify(counts);
  const summary = countsPresentation(counts);
  assert.equal(summary.shots, 766);
  assert.equal(summary.distinct, 256);
  assert.equal(summary.peaks.length, 8);
  assert.equal(summary.other.outcomes, 248);
  assert.equal(
    summary.peaks.reduce((sum, key) => sum + counts[key], 0) +
      summary.other.count,
    766,
  );
  assert.equal(summary.keys.length, 256);
  assert.equal(summary.keys[0], "00000000");
  assert.equal(JSON.stringify(counts), before);
});
test("equal peaks use bitstring order regardless of insertion order or ideal probability", () => {
  const counts = { "0010": 5, "0001": 5, "0000": 5 };
  const reference = { "0010": 1, 1111: 0 };
  assert.deepEqual(countsPresentation(counts, reference).peaks, [
    "0000",
    "0001",
    "0010",
  ]);
  const summary = countsPresentation({ "00": 0 }, { "00": 0.5, "01": 0.5 });
  assert.equal(summary.distinct, 0);
  assert.deepEqual(summary.peaks, []);
  assert.equal(summary.other.count, 0);
  assert.deepEqual(summary.keys, ["00", "01"]);
});
test("small and anonymous lesson distributions retain complete labels and original numeric bar order", () => {
  const counts = Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [String(15 - i), i]),
  );
  const summary = countsPresentation(counts, undefined, true);
  assert.equal(summary.large, false);
  assert.deepEqual(
    summary.keys,
    Array.from({ length: 16 }, (_, i) => String(i)),
  );
});
