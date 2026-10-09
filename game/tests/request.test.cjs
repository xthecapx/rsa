const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./loadTs.cjs");
const { setServiceTransport, runtimeInfo } = loadTs("lib/transport.ts");
const { useSimulator } = loadTs("game/simulator.ts");
const { coinApi } = loadTs("lib/coin.ts");
const { runLab } = loadTs("lib/lab.ts");
const { groverApi, GroverRefusal } = loadTs("lib/grover.ts");
const { vaultApi, VaultRefusal } = loadTs("lib/vault.ts");
const { EXPERIMENT_ERROR } = loadTs("lib/request.ts");
test.afterEach(() => {
  setServiceTransport(null);
  runtimeInfo.target = "web";
  useSimulator.setState({ choice: "ideal" });
});
test("native requests preserve JSON, timeout and per-player simulator headers", async () => {
  useSimulator.setState({ choice: "noise" });
  let call;
  setServiceTransport(async (path, init) => {
    call = { path, init };
    return Response.json({ counts: { 0: 12, 1: 244 } });
  });
  await coinApi.simulate(true, 256, true);
  assert.equal(call.path, "/api/coin/simulate");
  assert.deepEqual(JSON.parse(call.init.body), {
    hadamard: true,
    shots: 256,
    finalChallenge: true,
  });
  assert.equal(call.init.headers.get("X-Quantum-Simulator"), "noise");
  assert.ok(call.init.signal instanceof AbortSignal);
});
test("Qollab lab jobs receive no HTTP timeout or native simulator preference", async () => {
  runtimeInfo.target = "qollab";
  setServiceTransport(async (_, init) => {
    assert.equal(init.signal, undefined);
    assert.equal(new Headers(init.headers).has("X-Quantum-Simulator"), false);
    return Response.json({ backend: "selected QPU", counts: { 0: 1 } });
  });
  const result = await runLab({
    qubits: 1,
    start: "0",
    operations: [],
    shots: 1,
  });
  assert.equal(result.backend, "selected QPU");
});
test("practice and lab error policies remain distinct on HTTP and Qollab", async () => {
  setServiceTransport(async () =>
    Response.json({ detail: "provider detail" }, { status: 503 }),
  );
  await assert.rejects(coinApi.simulate(true, 1), {
    message: EXPERIMENT_ERROR,
  });
  await assert.rejects(runLab({}), { message: "provider detail" });
  runtimeInfo.target = "qollab";
  await assert.rejects(coinApi.simulate(true, 1), {
    message: "provider detail",
  });
});
test("lesson refusals remain typed and are never retried", async () => {
  let calls = 0;
  setServiceTransport(async () => {
    calls++;
    return Response.json({ detail: { reason: "rounds" } }, { status: 409 });
  });
  await assert.rejects(
    groverApi.run("token", {}),
    (e) => e instanceof GroverRefusal && e.reason === "rounds",
  );
  setServiceTransport(async () => {
    calls++;
    return Response.json({ detail: { reason: "helper" } }, { status: 409 });
  });
  await assert.rejects(
    vaultApi.run("token", {}),
    (e) => e instanceof VaultRefusal && e.reason === "helper",
  );
  assert.equal(calls, 2);
});
