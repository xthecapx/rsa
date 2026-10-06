import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exact runtime closure plus one consolidated attribution file. Build reports
// belong beside this directory, never inside the platform upload.
export const QOLLAB_FILES = Object.freeze([
  'index.html', 'main.js', 'main.css', 'game.js', 'assets.js', 'requirements.txt', 'THIRD-PARTY-NOTICES.txt',
  'quantum/__init__.py', 'quantum/services.py', 'vendor/__init__.py', 'vendor/shor.py',
  'core/__init__.py', 'core/alphabet.py', 'core/caesar.py', 'core/rsa.py',
  'core/coin_circuit.py', 'core/register_circuit.py', 'core/game_services.py', 'core/shor_service.py',
]);
export const outputDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/qollab');
export async function filesIn(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...await filesIn(file));
    else files.push(file);
  }
  return files.sort();
}

export async function verifyQollab(dir = outputDir) {
  const files = await filesIn(dir);
  if (files.length > 100) throw new Error(`Qollab permits 100 files; found ${files.length}`);
  const names = files.map((file) => path.relative(dir, file));
  for (const required of QOLLAB_FILES) {
    if (!names.includes(required)) throw new Error(`Missing Qollab file: ${required}`);
  }
  for (const name of names) {
    if (!QOLLAB_FILES.includes(name)) throw new Error(`Unnecessary file in Qollab upload: ${name}`);
  }
  let bytes = 0;
  for (const file of files) {
    const size = (await stat(file)).size;
    bytes += size;
    if (size > 2_000_000) throw new Error(`${path.relative(dir, file)} exceeds Qollab's 2 MB cap: ${size} bytes`);
    if (/(^|\/)(\.env[^/]*|node_modules|\.next|\.venv|__pycache__|sw\.js)(\/|$)|\.(map|pyc)$/.test(path.relative(dir, file))) {
      throw new Error(`Server, secret, PWA, or source-map file in export: ${file}`);
    }
    if (/\.m?js$/.test(file)) {
      const source = await readFile(file, 'utf8');
      // esbuild emits static and dynamic relative imports, both of which must
      // resolve inside the upload folder. The bootstrap's Python import is intentional.
      for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.\.?\/[^"']+)["']/g)) {
        const resolved = path.resolve(path.dirname(file), match[1]);
        if (!files.includes(resolved)) throw new Error(`Unresolved import in ${file}: ${match[1]}`);
      }
    }
  }
  const html = await readFile(path.join(dir, 'index.html'), 'utf8');
  const css = await readFile(path.join(dir, 'main.css'), 'utf8');
  if (/data:(?:font|application\/(?:font|x-font))/i.test(css)) throw new Error('Qollab CSP blocks data: fonts; use HTTPS font URLs with system fallbacks');
  if (/<(?:script|html|head|body)\b/i.test(html)) throw new Error('Qollab index.html must contain body markup without script tags');
  const notices = await readFile(path.join(dir, 'THIRD-PARTY-NOTICES.txt'), 'utf8');
  for (const attribution of ['Kenney', 'react', 'excalibur', 'QWARD', 'dm-sans', 'press-start-2p']) {
    if (!notices.includes(attribution)) throw new Error(`Missing attribution: ${attribution}`);
  }
  console.log(`Qollab package verified: ${files.length} files, ${bytes.toLocaleString()} bytes; every file <= 2 MB.`);
  return { files, bytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await verifyQollab();
