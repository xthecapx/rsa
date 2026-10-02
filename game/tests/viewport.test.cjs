const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs, root } = require('./loadTs.cjs');
const { viewport, trackViewport } = loadTs(`${root}/game/viewport.ts`);

function browser(t, visual = true) {
  const properties = new Map();
  const frames = new Map();
  let nextFrame = 0;
  const win = new EventTarget();
  Object.assign(win, {
    innerWidth: 844, innerHeight: 390,
    visualViewport: visual ? Object.assign(new EventTarget(), { width: 844, height: 300, offsetTop: 0, offsetLeft: 0 }) : null,
    requestAnimationFrame: (callback) => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const element = {
    clientWidth: 800, clientHeight: 360, dataset: {},
    style: { setProperty: (key, value) => properties.set(key, value), removeProperty: (key) => properties.delete(key) },
  };
  global.window = win;
  global.document = { documentElement: element, body: element };
  t.after(() => { delete global.window; delete global.document; });
  return { win, element, properties, frames, flush: () => {
    const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback());
  } };
}

test('viewport is safe during server rendering', () => {
  assert.deepEqual(viewport(), { width: 0, height: 0, top: 0, left: 0 });
});

test('browser bars and keyboard use the visible height and panned offset', (t) => {
  const { win } = browser(t);
  Object.assign(win.visualViewport, { height: 180, offsetTop: 92, offsetLeft: 4 });
  assert.deepEqual(viewport(), { width: 844, height: 180, top: 92, left: 4 });
});

test('older browsers fall back to inner dimensions, then document dimensions', (t) => {
  const { win } = browser(t, false);
  assert.deepEqual(viewport(), { width: 844, height: 390, top: 0, left: 0 });
  delete win.innerWidth; delete win.innerHeight;
  assert.deepEqual(viewport(), { width: 800, height: 360, top: 0, left: 0 });
});

test('viewport updates coalesce, follow rotation and keyboard pan, and unsubscribe', (t) => {
  const { win, element, properties, frames, flush } = browser(t);
  const stop = trackViewport();
  assert.equal(properties.get('--game-viewport-height'), '300px');
  assert.equal(element.dataset.compactViewport, 'true');
  Object.assign(win.visualViewport, { width: 390, height: 720 });
  win.dispatchEvent(new Event('orientationchange'));
  win.visualViewport.dispatchEvent(new Event('resize'));
  assert.equal(frames.size, 1);
  flush();
  assert.equal(properties.get('--game-viewport-width'), '390px');
  assert.equal(properties.get('--game-viewport-height'), '720px');
  assert.equal(element.dataset.compactViewport, 'false');
  Object.assign(win.visualViewport, { height: 170, offsetTop: 120 });
  win.visualViewport.dispatchEvent(new Event('scroll'));
  flush();
  assert.equal(properties.get('--game-viewport-top'), '120px');
  assert.equal(properties.get('--game-viewport-height'), '170px');
  win.dispatchEvent(new Event('pageshow'));
  assert.equal(frames.size, 1);
  stop();
  assert.equal(frames.size, 0);
  assert.equal(properties.size, 0);
  assert.equal(element.dataset.compactViewport, undefined);
  win.dispatchEvent(new Event('resize'));
  win.visualViewport.dispatchEvent(new Event('resize'));
  assert.equal(frames.size, 0);
});
