const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs, root } = require('./loadTs.cjs');
const { canPet, nearestPet } = loadTs(`${root}/engine/petting.ts`);
const { TILE_SIZE } = loadTs(`${root}/engine/tiles.ts`);

test('dogs and cats are pets; birds, bats and machines keep their usual behavior', () => {
  for (const kind of ['cat', 'dog']) assert.equal(canPet(kind), true);
  for (const kind of ['pigeon', 'duck', 'bot', 'crow', 'bat', 'drone']) assert.equal(canPet(kind), false);
});

test('petting selects the closest dog or cat within reach of its drawn position', () => {
  const player = { x: 10 * TILE_SIZE, y: 10 * TILE_SIZE };
  const cat = { kind: 'cat', pos: { x: player.x + TILE_SIZE, y: player.y }, grid: { x: 30, y: 30 } };
  const dog = { kind: 'dog', pos: { x: player.x, y: player.y + TILE_SIZE * 0.5 } };
  const pigeon = { kind: 'pigeon', pos: player };
  assert.equal(nearestPet([cat, dog, pigeon], player), dog);
  assert.equal(nearestPet([cat, pigeon], player), cat);
  assert.equal(nearestPet([pigeon], player), null);
  assert.equal(nearestPet([], player), null);
});

test('distant pets cannot be petted from their destination tile or diagonally across two tiles', () => {
  const dog = { kind: 'dog', pos: { x: TILE_SIZE * 3, y: 0 }, grid: { x: 0, y: 0 } };
  assert.equal(nearestPet([dog], { x: 0, y: 0 }), null);
  dog.pos = { x: TILE_SIZE, y: TILE_SIZE };
  assert.equal(nearestPet([dog], { x: 0, y: 0 }), null);
});
