const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const catalog = require('../i18n/es.json');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'i18n/translate.ts'), 'utf8');
const moduleExports = {};
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(moduleExports);
const { translate } = moduleExports;
const tokens = (text) => [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();

test('Spanish preserves every runtime placeholder', () => {
  for (const [english, spanish] of Object.entries(catalog)) {
    assert.deepEqual(tokens(spanish), tokens(english), english);
    assert.ok(spanish.trim(), english);
  }
});
test('all scenario dialogue, choices, objectives and catalog entries have translations', () => {
  const fields = new Set(['text', 'label', 'title', 'subtitle', 'brief', 'feedback', 'objective', 'wrong', 'description', 'setting', 'difficulty', 'lessons', 'scheme']);
  const files = ['content/coin.ts', 'content/scenarios.ts', ...[1, 2, 3, 4].map((n) => `content/acts/act${n}.ts`)];
  let checked = 0;
  for (const file of files) {
    const ast = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isPropertyAssignment(node) && fields.has(node.name.getText(ast)) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
        assert.ok(catalog[node.initializer.text.trim()], `${file}: ${node.initializer.text}`);
        checked++;
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.ok(checked > 200);
});
test('translates results while preserving numbers and intercepted payloads byte-for-byte', () => {
  assert.equal(translate('12 heads, 8 tails', catalog), '12 caras, 8 sellos');
  assert.equal(translate('RSA · Act 4', catalog), 'RSA · Acto 4');
  const messages = { 'Intercepted: {payload}. Factor {n}.': 'Interceptado: {payload}. Factor {n}.' };
  assert.equal(translate('Intercepted: $&`HOLA {raw}`. Factor 15.', messages), 'Interceptado: $&`HOLA {raw}`. Factor 15.');
  assert.equal(translate('  Title  ', { Title: '$& título' }), '  $& título  ');
  assert.equal(translate('unknown backend text', catalog), 'unknown backend text');
});
test('every literal UI message has a translation or is an explicit technical symbol', () => {
  const technical = new Set(['', 'H', 'M', 'T', '— H —', 'k=', 'a =', 'y', 'r', '(CC0)', '(CC0).']);
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!file.endsWith('.tsx')) continue;
      const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node) {
        if (ts.isCallExpression(node) && ['t', 'tOptional', 'localize'].includes(node.expression.getText(ast)) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const text = node.arguments[0].text.trim();
          assert.ok(catalog[text] || technical.has(text) || !/[A-Za-z]/.test(text), `${file}: ${text}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  scan(path.join(root, 'components'));
  scan(path.join(root, 'app'));
});
