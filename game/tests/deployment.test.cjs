const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('the game lockfile matches the manifest and uses only public npm tarballs', () => {
  const pkg = require('../package.json');
  const lock = require('../package-lock.json');
  for (const group of ['dependencies', 'devDependencies']) {
    assert.deepEqual(lock.packages[''][group], pkg[group]);
  }
  for (const [name, pkg] of Object.entries(lock.packages)) {
    if (pkg.resolved) assert.equal(new URL(pkg.resolved).origin, 'https://registry.npmjs.org', name);
  }
});

test('a failed clean install stops deployment before any push or cloud mutation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-deploy-test-'));
  const log = path.join(dir, 'calls');
  try {
    for (const name of ['docker', 'gcloud']) {
      fs.writeFileSync(path.join(dir, name), `#!/bin/sh\nprintf '${name} %s\\n' "$*" >> "$CALL_LOG"\nexit 31\n`, { mode: 0o755 });
    }
    for (const target of ['all', 'game']) {
      fs.writeFileSync(log, '');
      const run = spawnSync('bash', [path.resolve(__dirname, '../../deploy-cloudrun.sh'), target], {
        encoding: 'utf8',
        env: { ...process.env, PROJECT_ID: 'test-project', REGION: 'us-east1', KEEP_IMAGES: '2', PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log },
      });
      assert.equal(run.status, 31, run.stderr);
      const calls = fs.readFileSync(log, 'utf8').trim().split('\n');
      assert.equal(calls.length, 1, calls.join('\n'));
      assert.match(calls[0], /^docker buildx build .*--target dependencies --output=type=cacheonly /);
      assert.doesNotMatch(run.stdout, /Deploying/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
