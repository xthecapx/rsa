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
  const fields = new Set(['text', 'brief', 'explain', 'math', 'question', 'goal', 'discovery', 'label', 'title', 'subtitle', 'brief', 'feedback', 'objective', 'wrong', 'description', 'setting', 'difficulty', 'lessons', 'scheme', 'skill', 'ability', 'hint']);
  const files = ['content/campus.ts', 'content/labEntrances.ts', 'content/lab.ts', 'content/coin.ts', 'content/coinTown.ts', 'content/foundry.ts', 'content/hollow.ts', 'content/cipher.ts', 'content/grover.ts', 'content/vault.ts', 'content/town.ts', 'content/scenarios.ts', 'content/medals.ts', ...[1, 2, 3, 4].map((n) => `content/acts/act${n}.ts`)];
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

test('every campus exhibit option and notebook explanation has Spanish copy', () => {
  const { loadTs } = require('./loadTs.cjs');
  const { CAMPUS_EXHIBITS, CAMPUS_NOTEBOOK_ENTRIES, CAMPUS_WELCOME } = loadTs(path.join(root, 'content/campus.ts'));
  for (const exhibit of CAMPUS_EXHIBITS) for (const text of [exhibit.title, exhibit.brief, exhibit.explain, exhibit.math, exhibit.question, exhibit.goal, exhibit.discovery, ...exhibit.options]) assert.ok(catalog[text], text);
  for (const entry of CAMPUS_NOTEBOOK_ENTRIES) for (const text of [entry.title, entry.text]) assert.ok(catalog[text], text);
  assert.ok(catalog[CAMPUS_WELCOME]);
});

test("RSA confirmations and Shor wire logs translate without changing equations or saved source text", () => {
  for (const equation of ["m = 11^5 mod 21 = 2", "m = $&`{raw}`"]) {
    assert.equal(
      translate(`Backend agrees: ${equation}`, catalog),
      `El backend confirma: ${equation}`,
    );
    assert.equal(
      translate(`Backend disagrees: ${equation}`, catalog),
      `El backend no coincide: ${equation}`,
    );
  }
  const { loadTs } = require("./loadTs.cjs");
  const { RAIL } = loadTs(path.join(root, "game/pipeline.ts"));
  const spanish = [
    "PC clásico -> Configuración de la QPU: N, a",
    "Configuración de la QPU -> Circuito de Shor: trabajo",
    "Circuito de Shor -> Medir: estado cuántico",
    "Medir -> PC clásico: conteos",
  ];
  RAIL.slice(0, -1).forEach((box, i) => {
    const log = `${box.title} -> ${RAIL[i + 1].title}: ${box.emits.label}`;
    assert.equal(translate(log, catalog), spanish[i]);
  });
  // Older saves and the current backend enum must outrank the generic method template.
  for (const method of ["hand", "trial_division", "trial division"]) {
    assert.equal(
      translate(`N = 3 x 7 by ${method}.`, catalog),
      method === "hand"
        ? "N = 3 x 7, factorizado a mano."
        : "N = 3 x 7 mediante división por tanteo.",
    );
  }
});

test("count templates handle zero, one and many in either language without ambiguous matching", () => {
  const { translateCount } = moduleExports;
  for (const n of [0, 1, 2, 1024]) {
    for (const [unit, esOne, esMany] of [
      ["shot", "ejecución", "ejecuciones"],
      ["qubit", "cúbit", "cúbits"],
      ["distinct bitstring", "cadena de bits distinta", "cadenas de bits distintas"],
    ]) {
      const one = `{count} ${unit}`,
        many = `{count} ${unit}s`;
      assert.equal(
        translateCount(n, one, many, {}),
        `${n} ${unit}${n === 1 ? "" : "s"}`,
      );
      assert.equal(
        translateCount(n, one, many, catalog),
        `${n} ${n === 1 ? esOne : esMany}`,
      );
    }
  }
});

test("Shor execution logs translate provider details, reference results and legacy summaries", () => {
  const backend = "provider-$&`{device}`";
  const examples = [
    [
      `No live credentials, replaying a recorded batch from ${backend}. These counts came off real hardware.`,
      `Sin credenciales activas: reproduciendo un lote registrado de ${backend}. Estos conteos proceden de hardware real.`,
    ],
    [
      `Connected to ${backend}. Batch m4, 1 completed job(s).`,
      `Conectado a ${backend}. Lote m4, trabajos completados: 1.`,
    ],
    [
      `${backend}: 1 distinct outcomes over 1 shots.`,
      `${backend}: resultados observados = 1; ejecuciones = 1.`,
    ],
    [
      `${backend}: the most measured outcome was 0000 (r = 1), which is not the period. 0100 (r = 4) is the one that splits N. Never trust the tallest bar without checking it.`,
      `${backend}: el resultado más frecuente fue 0000 (r = 1), que no es el período. 0100 (r = 4) sí factoriza N. Comprueba siempre la barra más alta.`,
    ],
    [
      "Hardware noise smeared the peaks. The reference distribution for this circuit peaks at r = 4.",
      "El ruido del hardware desdibujó los picos. La distribución de referencia tiene un pico en r = 4.",
    ],
    [
      `${backend}: period r = 4, so N = 3 x 5.`,
      `${backend}: período r = 4, así que N = 3 x 5.`,
    ],
  ];
  for (const [source, expected] of examples) {
    assert.equal(translate(source, catalog), expected);
  }
});
