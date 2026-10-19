const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTs, root } = require("./loadTs.cjs");
const { rsaNotesForAct } = loadTs(path.join(root, "game/rsaNotes.ts"));
const { DEFAULT_VARS } = loadTs(path.join(root, "game/state.ts"));
const catalog = require("../i18n/es.json");
const { translate } = loadTs(path.join(root, "i18n/translate.ts"));
const publicNotes = { "Modulus N": "21", "Public exponent e": "5" };
const facts = {
  "Prime factors p, q": "3 × 7",
  "Totient φ(N)": "12",
  "Private exponent d": "5",
};
function evidence(act, vars = {}, labMemory = {}, capture) {
  return {
    act,
    vars: {
      ...DEFAULT_VARS,
      modulus: 21,
      e: 5,
      cipherNumber: 11,
      shift: 12,
      ...vars,
    },
    labMemory,
    capture:
      capture === undefined
        ? { scheme: "RSA, e=5 N=21", payload: "c = 11" }
        : capture,
  };
}
const notes = (state, act = state.act) =>
  Object.fromEntries(
    rsaNotesForAct(act, state).map(({ label, value }) => [label, value]),
  );

test("plaintext and RSA never expose the unrelated random Caesar shift, even after recovery", () => {
  const vars = {
    recovered: "B",
    shift: 20,
    p: 3,
    q: 7,
    d: 5,
    factors: "3 x 7",
  };
  assert.deepEqual(notes(evidence(1, vars)), {});
  for (const act of [3, 4])
    assert.deepEqual(notes(evidence(act, vars)), publicNotes);
  assert.deepEqual(notes(evidence(2, vars), 3), {});
});

test("Act 1 shows only the alphabet reference the player fetched", () => {
  const alphabet = Array.from({ length: 26 }, (_, i) => ({
    char: String.fromCharCode(65 + i),
    value: i + 1,
  }));
  assert.deepEqual(notes(evidence(1, {}, { alphabet })), {
    "Alphabet encoding": "A = 1 … Z = 26",
  });
  for (const bad of [
    [],
    alphabet.slice(1),
    [...alphabet.slice(1), { char: "Z", value: 26 }],
    [null],
  ])
    assert.deepEqual(notes(evidence(1, {}, { alphabet: bad })), {});
});

test("Caesar notes require a selected candidate that actually decodes this capture", () => {
  const capture = { scheme: "Caesar, shift unknown", payload: "OMRQ" };
  const vars = { shift: 12, cipherText: "OMRQ" };
  assert.deepEqual(notes(evidence(2, vars, {}, capture)), {});
  assert.deepEqual(
    notes(evidence(2, { ...vars, recovered: "CAFE" }, {}, capture)),
    { "Caesar shift k": "12" },
  );
  for (const wrong of [
    { recovered: "ROOF" },
    { recovered: "CAFE", shift: 3 },
    { recovered: "CAFE", cipherText: "XXXX" },
  ])
    assert.deepEqual(
      notes(evidence(2, { ...vars, ...wrong }, {}, capture)),
      {},
    );
});

test("public RSA notes require this capture's key, not default variables or an unrelated restored capture", () => {
  for (const act of [3, 4]) {
    assert.deepEqual(notes(evidence(act)), publicNotes);
    for (const capture of [
      null,
      {},
      { scheme: "Caesar", payload: "c = 11" },
      { scheme: "RSA, e=3 N=15", payload: "c = 8" },
      { scheme: "RSA, e=5 N=21", payload: "c = 2" },
    ])
      assert.deepEqual(notes(evidence(act, {}, {}, capture)), {});
  }
});

test("Act 3 reveals factors, totient and private exponent only as their saved workshop steps are completed", () => {
  const state = evidence(3, { p: 3, q: 7, d: 5 });
  assert.deepEqual(notes(state), publicNotes);
  state.labMemory.rsa3 = { found: [3, 7] };
  assert.deepEqual(notes(state), {
    ...publicNotes,
    "Prime factors p, q": "3 × 7",
  });
  state.labMemory.rsa3.phi = 12;
  assert.deepEqual(notes(state), {
    ...publicNotes,
    "Prime factors p, q": "3 × 7",
    "Totient φ(N)": "12",
  });
  state.labMemory.rsa3.d = 5;
  assert.deepEqual(notes(state), { ...publicNotes, ...facts });
  state.labMemory.rsa3.d = 7;
  assert.equal(notes(state)["Private exponent d"], undefined);
  state.labMemory.rsa3.phi = 20;
  assert.equal(notes(state)["Totient φ(N)"], undefined);
  state.labMemory.rsa3 = { found: [3, 5], phi: 8, d: 3 };
  assert.deepEqual(notes(state), publicNotes);
});

const shorVars = { base: 2, order: 6, p: 3, q: 7, d: 5 };
const run = {
  N: 21,
  a: 2,
  picked: "011",
  counts: { "011": 100 },
  fromReference: false,
};
test("Act 4 requires a matching returned run and checked factors before showing private RSA evidence", () => {
  const state = evidence(4, shorVars, { shor4: { run } });
  assert.deepEqual(notes(state), { ...publicNotes, "Period r": "6", ...facts });
  for (const badRun of [
    null,
    { ...run, N: 15 },
    { ...run, a: 5 },
    { ...run, picked: null },
    { ...run, counts: {} },
  ])
    assert.deepEqual(
      notes(evidence(4, shorVars, { shor4: { run: badRun } })),
      publicNotes,
    );
  for (const badVars of [{ order: 3 }, { p: 3, q: 5 }, { base: 7 }])
    assert.deepEqual(
      notes(evidence(4, { ...shorVars, ...badVars }, { shor4: { run } })),
      publicNotes,
    );
  state.labMemory.shor4.run = null;
  assert.deepEqual(notes(state), publicNotes);
});

test("the recorded reference fallback keeps its provenance and never fabricates a measured period", () => {
  const state = evidence(4, shorVars, {
    shor4: { run: { ...run, picked: null, fromReference: true } },
  });
  assert.deepEqual(notes(state), {
    ...publicNotes,
    "Reference period r": "6",
    ...facts,
  });
});

test("notes leave legacy checkpoint data unchanged, and every note and revised shift message translates", () => {
  const state = evidence(3, { p: 3, q: 7, d: 5, recovered: "B" });
  const saved = JSON.stringify(state);
  assert.deepEqual(notes(state), publicNotes);
  assert.equal(JSON.stringify(state), saved);
  for (const example of [
    evidence(3, {}, { rsa3: { found: [3, 7], phi: 12, d: 5 } }),
    evidence(4, shorVars, { shor4: { run } }),
  ])
    for (const { label } of rsaNotesForAct(example.act, example))
      assert.ok(catalog[label], label);
  assert.equal(
    translate('Caesar shift k = 12 gives "CAFE".', catalog),
    'El desplazamiento César k = 12 da "CAFE".',
  );
  assert.equal(
    translate("Shift k = 12  ->  CAFE   <-- plaintext", catalog),
    "Desplazamiento k = 12  ->  CAFE   <-- texto claro",
  );
});
