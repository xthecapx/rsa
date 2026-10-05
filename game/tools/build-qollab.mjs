import { build } from 'esbuild';
import ts from 'typescript';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesIn, outputDir, verifyQollab } from './verify-qollab.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(root);
const qollab = path.join(root, 'qollab');
const mime = { '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const assets = {};
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const file of await filesIn(path.join(root, 'public'))) {
  const relative = path.relative(path.join(root, 'public'), file);
  const type = mime[path.extname(file)];
  if (type) assets[`/${relative}`] = `data:${type};base64,${(await readFile(file)).toString('base64')}`;
  else if (/LICENSE[^/]*\.txt$/.test(relative)) {
    const target = path.join(outputDir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(file, target);
  }
}
await writeFile(path.join(outputDir, 'assets.js'), `globalThis.quantumPlaygroundAssets = ${JSON.stringify(assets)};\n`);

// Rewrite asset expressions in the Qollab build only, including dynamic sprite
// filenames and CSS portraits. Ordinary Next.js sources keep their public URLs.
const assetPlugin = {
  name: 'qollab-browser-platform',
  setup(builder) {
    const replacements = { 'next/dynamic': 'next-dynamic.tsx', 'next/navigation': 'next-navigation.ts', 'next/link': 'next-link.tsx' };
    builder.onResolve({ filter: /^next\/(dynamic|navigation|link)$/ }, ({ path: name }) => ({ path: path.join(qollab, replacements[name]) }));
    builder.onLoad({ filter: /excalibur\/build\/esm\/excalibur\.js$/ }, async ({ path: file }) => {
      let contents = await readFile(file, 'utf8');
      const probe = /arrayBufferSupport: function\(\) \{[\s\S]*?return xhr\.responseType === "arraybuffer";\s*\}/;
      if (!probe.test(contents)) throw new Error('Excalibur browser probe changed; review Qollab compatibility');
      contents = contents.replace(probe, 'arrayBufferSupport: function() { return typeof ArrayBuffer === "function"; }');
      return { contents, loader: 'js' };
    });
    builder.onLoad({ filter: /\.(ts|tsx)$/ }, async ({ path: file }) => {
      if (file.includes('/node_modules/')) return;
      const source = await readFile(file, 'utf8');
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const edits = [];
      function visit(node) {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && /^\/(assets|icons)\//.test(ts.isTemplateExpression(node) ? node.head.text : node.text)) {
          edits.push({ start: node.getStart(ast), end: node.end, text: `qollabAssetUrl(${node.getText(ast)})` });
          return;
        }
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && /url\(\/assets\//.test(ts.isTemplateExpression(node) ? node.head.text : node.text)) {
          const original = node.getText(ast);
          // Portrait background-image strings are quoted or template literals.
          const expression = original.slice(1, -1).replace(/^url\(/, '').replace(/\)$/, '');
          edits.push({ start: node.getStart(ast), end: node.end, text: '`url("${qollabAssetUrl(`' + expression + '`)}")`' });
          return;
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
      let contents = source;
      for (const edit of edits.sort((a, b) => b.start - a.start)) contents = contents.slice(0, edit.start) + edit.text + contents.slice(edit.end);
      if (edits.length) contents = `import { assetUrl as qollabAssetUrl } from ${JSON.stringify(path.join(qollab, 'assets.ts'))};\n${contents}`;
      // JSX attributes require braces when a string is replaced by a call.
      contents = contents.replace(/(\b(?:src|href)=)(qollabAssetUrl\([^\n]+?\))(?=\s|\/?>)/g, '$1{$2}');
      return { contents, loader: file.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(file) };
    });
  },
};

await build({
  absWorkingDir: root, entryPoints: { game: path.join(qollab, 'entry.tsx') }, outdir: outputDir,
  bundle: true, format: 'esm', splitting: false, minify: true, target: 'es2022', jsx: 'automatic',
  conditions: ['production'], plugins: [assetPlugin], tsconfig: path.join(root, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"', 'setTimeout': 'window.setTimeout', 'clearTimeout': 'window.clearTimeout', 'setInterval': 'window.setInterval', 'clearInterval': 'window.clearInterval' },
  chunkNames: 'chunks/[name]-[hash]', legalComments: 'linked', metafile: true,
});
let css = await readFile(path.join(root, 'app/globals.css'), 'utf8');
css = css.replace(/url\(\/?(assets\/[^)]+)\)/g, (_match, asset) => {
  const url = assets[`/${asset}`];
  if (!url) throw new Error(`Missing CSS asset: ${asset}`);
  return `url("${url}")`;
});
// Qollab's font-src * policy permits HTTPS but rejects data: fonts. Keep the
// pinned Fontsource files on its public CDN, with CSS system fallbacks offline.
for (const [name, family, weights] of [['press-start-2p', 'Press Start 2P', [400]], ['dm-sans', 'DM Sans', [400, 500, 600, 700]]]) {
  const directory = path.join(root, 'node_modules/@fontsource', name);
  const { version } = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  for (const weight of weights) {
    const url = `https://cdn.jsdelivr.net/npm/@fontsource/${name}@${version}/files/${name}-latin-${weight}-normal.woff2`;
    css += `\n@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${url}") format("woff2")}\n`;
  }
  await cp(path.join(directory, 'LICENSE'), path.join(outputDir, `${name}-LICENSE.txt`));
}
css += '\n:root{--font-press-start:"Press Start 2P",ui-monospace,monospace;--font-dm-sans:"DM Sans",system-ui,sans-serif}#quantum-runtime-status{position:fixed;z-index:100;top:0;left:0;max-width:100%;padding:2px 6px;background:#0b1f26;color:#a5c4cc;font:10px system-ui;pointer-events:none}\n';
const styled = await postcss([tailwind({ config: path.join(root, 'tailwind.config.ts') }), autoprefixer()]).process(css, { from: path.join(root, 'app/globals.css'), to: path.join(outputDir, 'main.css') });
await writeFile(path.join(outputDir, 'main.css'), styled.css);
for (const name of ['main.js', 'index.html']) await cp(path.join(qollab, name), path.join(outputDir, name));
await cp(path.join(qollab, 'python'), outputDir, { recursive: true, filter: (file) => !file.includes('__pycache__') && !file.endsWith('.pyc') });
await cp(path.join(repo, 'backend/app/core'), path.join(outputDir, 'core'), { recursive: true, filter: (file) => !file.includes('__pycache__') && !file.endsWith('.pyc') });
await writeFile(path.join(outputDir, 'requirements.txt'), 'qiskit>=2.5.2,<3.0.0\n');

const dataDir = path.join(repo, 'backend/app/data/recorded_batches');
const index = JSON.parse(await readFile(path.join(dataDir, 'index.json'), 'utf8'));
const recorded = {};
for (const row of index.batches) {
  const data = JSON.parse(await readFile(path.join(dataDir, `${row.label}.json`), 'utf8'));
  data.recorded = true;
  recorded[row.label] = data;
  recorded[row.batch_id] = data;
}
// Avoid duplicating large batch JSON for both aliases.
const labels = index.batches.map((row) => row.label);
let recordedJs = `export const recorded = ${JSON.stringify(Object.fromEntries(labels.map((label) => [label, recorded[label]])))};\n`;
for (const row of index.batches) recordedJs += `recorded[${JSON.stringify(row.batch_id)}] = recorded[${JSON.stringify(row.label)}];\n`;
recordedJs += `export const batches = ${JSON.stringify(index.batches.map((row) => ({ ...row, recorded: true })))};\n`;
await writeFile(path.join(outputDir, 'recorded.js'), recordedJs);
await writeFile(path.join(outputDir, 'build-info.json'), JSON.stringify({ target: 'qollab', builtAt: new Date().toISOString(), vaultBits: 25, assets: Object.keys(assets).length, shor: 'qiskit-qward 0.28.1 (portable module)', hardwareSubmissions: false }, null, 2) + '\n');
await verifyQollab();
const archive = path.join(root, 'dist/quantum-playground-qollab.zip');
await rm(archive, { force: true });
execFileSync('zip', ['-q', '-r', archive, '.'], { cwd: outputDir });
console.log(`Upload ${archive} to Qollab and choose Unpack. Use an IBM noise-model simulator for Ghost Key.`);
