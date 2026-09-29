// Transpile a game TypeScript module (and its `@/` or relative imports) for node:test.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const cache = new Map();
function loadTs(file) {
  const full = path.resolve(file.endsWith('.ts') ? file : `${file}.ts`);
  if (cache.has(full)) return cache.get(full);
  const exports = {};
  cache.set(full, exports);
  const { outputText } = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const localRequire = (name) => {
    if (name.startsWith('@/')) return loadTs(path.join(root, name.slice(2)));
    if (name.startsWith('.')) return loadTs(path.join(path.dirname(full), name));
    return require(name);
  };
  new Function('exports', 'require', outputText)(exports, localRequire);
  return exports;
}
module.exports = { loadTs, root };
