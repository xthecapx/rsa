const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const os = require('node:os');

const helpers = import('../tools/qollab-package.mjs');
const verifier = import('../tools/verify-qollab.mjs');

test('asset matching preserves dynamic sprites and drops unused static assets', async () => {
  const { assetPattern, referencedAssets } = await helpers;
  const inventory = {
    '/assets/characters/luz.svg': 'luz', '/assets/characters/animal-cat.svg': 'cat',
    '/assets/kenney/city_tiles.png': 'tiles', '/icons/icon-512.png': 'unused',
  };
  const filtered = referencedAssets(inventory, [assetPattern(['/assets/characters/', '.svg']), assetPattern(['/assets/kenney/city_tiles.png'])]);
  assert.deepEqual(Object.keys(filtered), Object.keys(inventory).slice(0, 3));
  assert.equal(assetPattern(['/assets/example.png']).test('/assets/exampleXpng'), false);
});

test('upload verifier rejects unnecessary files and escaping runtime imports', async () => {
  const { QOLLAB_FILES, verifyQollab } = await verifier;
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'qollab-package-'));
  const fixture = path.join(temporary, 'upload');
  try {
    // Test upload validation without requiring ignored build artifacts.
    for (const name of QOLLAB_FILES) {
      const file = path.join(fixture, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, name === 'THIRD-PARTY-NOTICES.txt'
        ? 'Kenney react excalibur QWARD dm-sans press-start-2p' : '');
    }
    await verifyQollab(fixture);
    await rm(path.join(fixture, 'requirements.txt'));
    await assert.rejects(verifyQollab(fixture), /Missing Qollab file: requirements.txt/);
    await writeFile(path.join(fixture, 'requirements.txt'), 'qiskit>=2.5.2,<3.0.0\n');
    await writeFile(path.join(fixture, 'build-info.json'), '{}');
    await assert.rejects(verifyQollab(fixture), /Unnecessary file/);
    await rm(path.join(fixture, 'build-info.json'));
    await writeFile(path.join(temporary, 'outside.js'), 'export const value = 1;');
    await writeFile(path.join(fixture, 'main.js'), 'import "../outside.js";');
    await assert.rejects(verifyQollab(fixture), /Unresolved import/);
    await writeFile(path.join(fixture, 'main.js'), 'import "./missing.js";');
    await assert.rejects(verifyQollab(fixture), /Unresolved import/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
