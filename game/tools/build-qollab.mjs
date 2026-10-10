import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { assetPattern, referencedAssets, dependencyNotices } from './qollab-package.mjs';
import ts from 'typescript';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filesIn, outputDir, verifyQollab } from './verify-qollab.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(root);
const qollab = path.join(root, 'qollab');
const mime = { '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const inventory = {};
const assetPatterns = [];
const notices = [];
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const file of await filesIn(path.join(root, 'public'))) {
  const relative = path.relative(path.join(root, 'public'), file);
  const type = mime[path.extname(file)];
  if (type) inventory[`/${relative}`] = `data:${type};base64,${(await readFile(file)).toString('base64')}`;
  else if (/LICENSE[^/]*\.txt$/.test(relative)) {
    notices.push(`Kenney assets — ${relative}\n\n${await readFile(file, 'utf8')}`);
  }
}


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
          assetPatterns.push(assetPattern(ts.isTemplateExpression(node) ? [node.head.text, ...node.templateSpans.map((span) => span.literal.text)] : [node.text]));
          edits.push({ start: node.getStart(ast), end: node.end, text: `qollabAssetUrl(${node.getText(ast)})` });
          return;
        }
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && /url\(\/assets\//.test(ts.isTemplateExpression(node) ? node.head.text : node.text)) {
          const parts = ts.isTemplateExpression(node) ? [node.head.text, ...node.templateSpans.map((span) => span.literal.text)] : [node.text];
          parts[0] = parts[0].replace(/^url\(/, '');
          parts[parts.length - 1] = parts.at(-1).replace(/\)$/, '');
          assetPatterns.push(assetPattern(parts));
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

const gameBuild = await build({
  absWorkingDir: root, entryPoints: { game: path.join(qollab, 'entry.tsx') }, outdir: outputDir,
  bundle: true, platform: 'browser', treeShaking: true, format: 'esm', splitting: false, minify: true, target: 'es2022', jsx: 'automatic',
  conditions: ['production', 'module'], plugins: [assetPlugin], tsconfig: path.join(root, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"', 'setTimeout': 'window.setTimeout', 'clearTimeout': 'window.clearTimeout', 'setInterval': 'window.setInterval', 'clearInterval': 'window.clearInterval' },
  chunkNames: 'chunks/[name]-[hash]', legalComments: 'linked', metafile: true,
});
notices.push(...await dependencyNotices(root, gameBuild.metafile.inputs));
notices.push(await readFile(path.join(outputDir, 'game.js.LEGAL.txt'), 'utf8'));
await rm(path.join(outputDir, 'game.js.LEGAL.txt'));
const gameFile = path.join(outputDir, 'game.js');
await writeFile(gameFile, (await readFile(gameFile, 'utf8')).replace('game.js.LEGAL.txt', 'THIRD-PARTY-NOTICES.txt'));
let css = await readFile(path.join(root, 'app/globals.css'), 'utf8');
css = css.replace(/url\(\/?(assets\/[^)]+)\)/g, (_match, asset) => {
  const url = inventory[`/${asset}`];
  assetPatterns.push(assetPattern([`/${asset}`]));
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
  notices.push(`${name} ${version} — font license\n\n${await readFile(path.join(directory, 'LICENSE'), 'utf8')}`);
}
css += '\n:root{--font-press-start:"Press Start 2P",ui-monospace,monospace;--font-dm-sans:"DM Sans",system-ui,sans-serif}#quantum-runtime-status{position:fixed;z-index:100;top:0;left:0;max-width:100%;padding:2px 6px;background:#0b1f26;color:#a5c4cc;font:10px system-ui;pointer-events:none}\n';
const styled = await postcss([tailwind({ config: path.join(root, 'tailwind.config.ts') }), autoprefixer()]).process(css, { from: path.join(root, 'app/globals.css'), to: path.join(outputDir, 'main.css') });
await writeFile(path.join(outputDir, 'main.css'), (await transform(styled.css, { loader: 'css', minify: true, target: 'es2022' })).code);
const assets = referencedAssets(inventory, assetPatterns);
await writeFile(path.join(outputDir, 'assets.js'), `globalThis.quantumPlaygroundAssets = ${JSON.stringify(assets)};\n`);
for (const name of ['index.html', 'requirements.txt']) await cp(path.join(qollab, name), path.join(outputDir, name));
await cp(path.join(repo, 'LICENSE'), path.join(outputDir, 'LICENSE'));
await cp(path.join(qollab, 'python'), outputDir, { recursive: true, filter: (file) => !file.includes('__pycache__') && !file.endsWith('.pyc') && !file.endsWith('.txt') });
for (const name of ['QWARD-LICENSE.txt', 'QWARD-NOTICE.txt']) notices.push(`QWARD — ${name}\n\n${await readFile(path.join(qollab, 'python/vendor', name), 'utf8')}`);
await cp(path.join(repo, 'backend/app/core'), path.join(outputDir, 'core'), { recursive: true, filter: (file) => !file.includes('__pycache__') && !file.endsWith('.pyc') });

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
// Keep the Python bridge and large game/assets modules external. They must be
// separate to respect Qollab's 2 MB per-file cap; recorded data can join main.js.
await build({
  absWorkingDir: root, entryPoints: [path.join(qollab, 'main.js')], outfile: path.join(outputDir, 'main.js'),
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', minify: true,
  external: ['quantum.services', './game.js', './assets.js'],
  plugins: [{ name: 'recorded-data', setup(builder) {
    builder.onResolve({ filter: /^\.\/recorded\.js$/ }, () => ({ path: 'recorded', namespace: 'recorded-data' }));
    builder.onLoad({ filter: /.*/, namespace: 'recorded-data' }, () => ({ contents: recordedJs, loader: 'js' }));
  } }],
});
await writeFile(path.join(outputDir, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n\n' + '='.repeat(72) + '\n\n') + '\n');
const verified = await verifyQollab();
const report = {
  target: 'qollab', vaultBits: 25, bundler: 'esbuild', hardwareSubmissions: true,
  remoteExecutionPolicy: 'one-final-or-lab-job-per-code-run; local-ideal-practice',
  fileCount: verified.files.length, bytes: verified.bytes,
  assets: { included: Object.keys(assets).sort(), omitted: Object.keys(inventory).filter((name) => !(name in assets)).sort() },
  files: await Promise.all(verified.files.map(async (file) => { const data = await readFile(file); return { path: path.relative(outputDir, file), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }; })),
  largestModules: Object.entries(gameBuild.metafile.outputs).flatMap(([, output]) => Object.entries(output.inputs ?? {}).map(([name, input]) => ({ path: name, bytes: input.bytesInOutput }))).sort((a, b) => b.bytes - a.bytes).slice(0, 15),
};
await writeFile(path.join(root, 'dist/build-report.json'), JSON.stringify(report, null, 2) + '\n');
// Clean up the obsolete archive from older builds; delivery uses the folder.
await rm(path.join(root, 'dist/quantum-playground-qollab.zip'), { force: true });
console.log(`Upload the contents of ${outputDir} to Qollab, preserving subdirectories. Use an IBM noise-model simulator for the full game; IonQ runs final challenges or an explicit lab experiment, sharing one remote job per session.`);
