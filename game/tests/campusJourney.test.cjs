const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs, root } = require('./loadTs.cjs');
const load = name => loadTs(path.join(root, name));
const { useCampus, campusSession } = load('game/campus');
const { campusDefaults } = load('game/campusExperiment');
const { CAMPUS_STORIES } = load('content/campusStories');
const { investigationFor, investigationReady, rotationPair, applicationReady } = load('game/campusJourney');
const { useGame } = load('game/state');
const { useMedals } = load('game/medals');
const { useProgress } = load('game/progress');
const measured = { bits: 1, counts: { '0': 7, '1': 249 }, shots: 256, backend: 'noisy device', kind: 'noise', source: 'simulator', circuit_text: 'actual circuit', depth: 3 };
const reset = () => { useCampus.getState().reset(); useGame.getState().resetRun(1); useProgress.getState().reset(); useMedals.getState().reset(); };
const session = id => useCampus.getState().sessions[id] ?? campusSession();
const event = (id, action) => useCampus.getState().event(id, action);
function recordKey(id, key) {
  const s = campusDefaults();
  if (id === 'qubit') { s.order = ['Prepare', 'Control', 'Measure']; s.gate = key.endsWith('X') ? 'X' : 'H'; }
  if (id === 'delivery') s.sequence = key === 'delivery' ? ['X','H'] : ['H','X'];
  if (id === 'fountain') [s.minus, s.analyzer] = key.split(':').map(v => v === 'true');
  if (id === 'observatory') [s.pair,s.basis] = key.split(':');
  if (id === 'arcade') s.shots = key === 'single' ? 1 : 256;
  if (id === 'quiet') { const [d, a] = key.split(':'); s.disturbance = Number(d); s.analyzer = a === 'true'; }
  if (id === 'rotations') s.inverse = key.endsWith('true');
  if (id === 'festival') {
    if (key === 'repair0') s.sequence = ['H','H'];
    if (key === 'repair1') { s.pair = 'bell'; s.basis = 'X'; }
    if (key === 'repair2') { s.disturbance = 0; s.analyzer = true; }
  }
  const result = s.shots === 1 ? { ...measured, shots: 1, counts: { '1': 1 } } : measured;
  useCampus.getState().record(id, s, result, id === 'festival' ? key : undefined);
}
function begin(id) {
  assert.equal(event(id, { type: 'begin' }), true);
  assert.equal(event(id, { type: 'predict', id: 'unsure' }), true);
  assert.equal(session(id).journey.prediction, 'unsure');
}
function interpret(id) {
  const stage = investigationFor(id, session(id));
  for (const key of stage.keys) recordKey(id, key);
  assert.equal(investigationReady(id, session(id)), true);
  event(id, { type: 'return' });
  const right = stage.options.find(o => o.correct);
  if (stage.select.length) {
    assert.equal(event(id, { type: 'answer', id: right.id }), false);
    for (const key of stage.select) event(id, { type: 'select', key });
  }
  const wrong = stage.options.find(o => !o.correct);
  event(id, { type: 'answer', id: wrong.id });
  assert.equal(session(id).journey.phase, 'discuss');
  assert.equal(session(id).journey.answerId, wrong.id);
  assert.equal(useCampus.getState().completed.includes(id), false);
  event(id, { type: 'answer', id: right.id });
}
function apply(id) {
  for (const slot of CAMPUS_STORIES[id].application.slots) event(id, { type: 'application', key: slot.id, value: slot.correct });
  if (id === 'arcade') event(id, { type: 'application', key: 'frequency', value: '7' });
  if (id === 'rotations') {
    event(id, { type: 'application', key: 'axis', value: 'Y' });
    event(id, { type: 'application', key: 'angle', value: -Math.PI / 2 });
  }
  assert.equal(applicationReady(id, session(id)), true);
  assert.equal(event(id, { type: 'finish' }), true);
}

test('every discovery requires execution, explanation and an applied response, even with extreme noisy counts', () => {
  for (const id of Object.keys(CAMPUS_STORIES).filter(id => id !== 'festival')) {
    reset(); begin(id);
    assert.equal(event(id, { type: 'finish' }), false);
    assert.equal(event(id, { type: 'return' }), false);
    interpret(id);
    if (id === 'fountain') { assert.equal(session(id).journey.investigation, 1); interpret(id); }
    assert.equal(session(id).journey.phase, 'apply');
    assert.equal(event(id, { type: 'finish' }), false);
    apply(id);
    assert.deepEqual(useCampus.getState().completed, [id]);
    assert.equal(event(id, { type: 'finish' }), false);
    assert.equal(session(id).journey.phase, 'complete');
  }
});

test('festival remains directly available, with three guarded repairs and exactly one optional badge', async () => {
  reset(); await useMedals.persist.rehydrate(); begin('festival');
  for (let stage = 0; stage < 3; stage++) {
    interpret('festival'); apply('festival');
    assert.equal(session('festival').stage, stage + 1);
    assert.equal(useCampus.getState().completed.length, 0);
  }
  assert.deepEqual(useProgress.getState().completed, { campus: ['festival'] });
  const awarded = useMedals.getState().earned['quantum-explorer'];
  assert.ok(awarded);
  assert.equal(event('festival', { type: 'finish' }), false);
  assert.equal(useMedals.getState().earned['quantum-explorer'], awarded);
});

test('pinned comparisons survive free experimentation and hydration with their recipes and original backends', async () => {
  reset(); begin('fountain'); interpret('fountain'); interpret('fountain');
  for (let i = 0; i < 12; i++) useCampus.getState().record('fountain', { ...campusDefaults(), angle: .2 }, { ...measured, backend: `later-${i}` });
  await useCampus.persist.rehydrate();
  const saved = session('fountain');
  assert.equal(saved.runs.length, 6);
  assert.equal(saved.journey.phase, 'apply');
  assert.equal(saved.proofs['true:true'].result.backend, 'noisy device');
  assert.equal(saved.proofs['true:true'].settings.analyzer, true);
  assert.equal(saved.proofs['true:true'].settings.minus, true);
  assert.equal(investigationReady('fountain', saved), true);
  assert.equal(useGame.getState().operations, 0);
});

test('rotation comparisons require matching axis and angle; a proven pair survives unrelated later runs', () => {
  reset();
  const s = campusDefaults();
  useCampus.getState().record('rotations', { ...s, axis: 'X', angle: .7 }, measured);
  useCampus.getState().record('rotations', { ...s, axis: 'Y', angle: .7, inverse: true }, measured);
  assert.equal(rotationPair(session('rotations')), null);
  useCampus.getState().record('rotations', { ...s, axis: 'X', angle: .8, inverse: true }, measured);
  assert.equal(rotationPair(session('rotations')), null);
  useCampus.getState().record('rotations', { ...s, axis: 'X', angle: .7, inverse: true }, measured);
  assert.equal(rotationPair(session('rotations')).first.settings.angle, .7);
  for (let i = 0; i < 12; i++) useCampus.getState().record('rotations', { ...s, axis: 'Z', angle: i / 10 }, measured);
  assert.equal(rotationPair(session('rotations')).first.settings.axis, 'X');
});

test('saved phases and evidence arrays alone cannot complete a discovery; legacy completion is preserved', () => {
  reset();
  const merge = useCampus.persist.getOptions().merge;
  const raw = { sessions: { fountain: { ...campusSession(), journey: { ...campusSession().journey, phase: 'complete' }, evidence: ['false:false','true:false','false:true','true:true'] } } };
  const migrated = merge(raw, useCampus.getState());
  assert.equal(migrated.sessions.fountain.journey.phase, 'investigate');
  assert.equal(investigationReady('fountain', migrated.sessions.fountain), false);
  const old = merge({ completed: ['passports'], sessions: { passports: { answer: 1, settings: campusDefaults(), runs: [{ key: 'passport', result: measured }], evidence: ['passport'] } } }, useCampus.getState());
  assert.deepEqual(old.completed, ['passports']);
  assert.equal(old.sessions.passports.journey.answerId, null);
  assert.equal(old.sessions.passports.answer, 1);
  assert.equal(old.sessions.passports.runs[0].settings, null);
  assert.equal(old.sessions.passports.runs[0].result.backend, 'noisy device');
});

test('unknown conversation IDs are rejected and execution busy guards block progression and rewards', () => {
  reset(); begin('arcade');
  assert.equal(event('arcade', { type: 'predict', id: '__proto__' }), false);
  assert.equal(event('arcade', { type: 'answer', id: 'sampling' }), false);
  useGame.getState().changeOperations(1);
  assert.equal(event('arcade', { type: 'hint' }), false);
  assert.equal(event('arcade', { type: 'finish' }), false);
  useGame.getState().changeOperations(-1);
  const old = useCampus.getState().generation;
  useCampus.getState().reset();
  assert.equal(useCampus.getState().generation, old + 1);
});

test('all authored campus dialogue, choices and hints have Spanish translations and stable distinct IDs', () => {
  const es = require('../i18n/es.json');
  const fields = new Set(['intro','prediction','question','prompt','label','feedback','payoff']);
  function visit(value, key) {
    if (typeof value === 'string' && (fields.has(key) || key === 'clues')) assert.ok(es[value], `Missing Spanish: ${value}`);
    else if (Array.isArray(value)) value.forEach(v => visit(v, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k,v]) => visit(v,k));
  }
  visit(CAMPUS_STORIES);
  for (const story of Object.values(CAMPUS_STORIES)) {
    assert.equal(new Set(story.investigations.map(s => s.id)).size, story.investigations.length);
    for (const stage of story.investigations) {
      assert.equal(stage.options.filter(o => o.correct).length, 1);
      assert.equal(new Set(stage.options.map(o => o.id)).size, stage.options.length);
    }
  }
});


test('corrupt stages and recipe snapshots resume safely rather than manufacturing measurements or trapping dialogue', () => {
  reset();
  const merge = useCampus.persist.getOptions().merge;
  for (const stage of ['bad', {}, Infinity, -99, 999]) {
    const restored = merge({ sessions: { festival: { stage, journey: { phase: 'discuss', investigation: stage } } } }, useCampus.getState());
    assert.equal(restored.sessions.festival.journey.phase, 'investigate');
    assert.equal(restored.sessions.festival.journey.investigation, 0);
    assert.equal(restored.sessions.festival.stage, 0);
  }
  for (const revision of [1, 20]) {
    const restored = merge({ sessions: { passports: { runs: [{ key: 'passport', result: measured, revision, settings: { angle: NaN } }], journey: { phase: 'apply', investigation: 0, answerId: 'amplitudes' } } } }, useCampus.getState());
    assert.equal(investigationReady('passports', restored.sessions.passports), false);
    assert.equal(restored.sessions.passports.journey.phase, 'investigate');
    assert.deepEqual(restored.sessions.passports.proofs, {});
  }
  const restored = merge({ sessions: { festival: { stage: 0, journey: { ...campusSession().journey, investigation: 2 } } } }, useCampus.getState());
  assert.equal(restored.sessions.festival.stage, 2);
});
