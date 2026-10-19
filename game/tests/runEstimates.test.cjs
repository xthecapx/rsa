const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./loadTs.cjs");
const {
  estimateKey,
  estimateRun,
  estimateSeconds,
  runLabel,
  SAFETY_MULTIPLIER,
} = loadTs("lib/runEstimates.ts");
const table = require("../lib/runEstimates.json");

const body = (value) => JSON.stringify(value);

test("every key the game can ask for exists in the measured table", () => {
  const requests = [
    ["/api/lab/run", { qubits: 1, shots: 16 }],
    ["/api/lab/run", { qubits: 4, shots: 1024 }],
    ["/api/campus/run", { recipe: { qubits: 1, shots: 256 } }],
    ["/api/coin/circuit", {}],
    ["/api/coin/simulate", {}],
    ["/api/register/circuit", { qubits: 2 }],
    ["/api/register/circuit", { qubits: 4 }],
    ["/api/grover/run", { circuit: { repeat: 0 } }],
    ["/api/grover/run", { circuit: { repeat: 2 } }],
    ["/api/grover/run", { circuit: { repeat: 5 } }],
    ["/api/vault/run", {}],
    ["/api/shor/simulate", { num_control: 3 }],
    ["/api/shor/simulate", { num_control: 8 }],
    ["/api/shor/simulate", { num_control: 12 }],
  ];
  for (const choice of ["ideal", "noise"])
    for (const [path, request] of requests) {
      const key = estimateKey(path, body(request), choice);
      const entry = table.cases[key];
      assert.ok(entry?.median_ms && entry?.p95_ms, `${key} must be measured`);
      assert.ok(estimateRun(path, body(request), choice));
    }
});

test("larger circuits round up to the next measured size, never down", () => {
  assert.equal(estimateKey("/api/grover/run", body({ circuit: { repeat: 2 } }), "ideal"), "grover:r3:ideal");
  assert.equal(estimateKey("/api/shor/simulate", body({ num_control: 5 }), "noise"), "shor:m6:noise");
  assert.equal(estimateKey("/api/shor/simulate", body({ num_control: 12 }), "noise"), "shor:m10:noise");
  assert.equal(estimateKey("/api/register/circuit", body({ qubits: 3 }), "ideal"), "register:q3:ideal");
});

test("noisy Shor is the slow case and its estimate stretches with the safety multiplier", () => {
  const fast = estimateRun("/api/shor/simulate", body({ num_control: 4 }), "ideal");
  const slow = estimateRun("/api/shor/simulate", body({ num_control: 10 }), "noise");
  assert.ok(slow.lowMs > 10 * fast.lowMs);
  assert.equal(slow.highMs, table.cases["shor:m10:noise"].p95_ms * SAFETY_MULTIPLIER);
  const seconds = estimateSeconds(slow);
  assert.ok(seconds.low >= 1 && seconds.high > seconds.low);
});

test("unknown requests and malformed bodies produce no invented estimate", () => {
  assert.equal(estimateRun("/api/classical/caesar", "{}", "ideal"), null);
  assert.ok(estimateRun("/api/vault/run", "not json", "ideal"));
  assert.equal(estimateRun("/api/vault/run", undefined, "ideal") !== null, true);
});

test("each circuit gets its own label so waits are never mixed up", () => {
  assert.equal(runLabel("/api/grover/run", body({ circuit: { repeat: 3 } })), "Grover search ×3");
  assert.equal(runLabel("/api/shor/simulate", body({ num_control: 8 })), "Shor period finding · 8 counting qubits");
  assert.equal(runLabel("/api/lab/run", "{}"), "Lab circuit");
  assert.notEqual(runLabel("/api/vault/run", "{}"), runLabel("/api/lab/run", "{}"));
});
