// Evaluate engine/maps/townMap.ts without a bundler and print the composed map as JSON.
// Usage: node tools/dump-town.cjs > /tmp/town.json ; then /opt/homebrew/bin/python3.13 tools/preview_town.py
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const root = path.join(__dirname, "..");
function load(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  const req = (name) => {
    if (name === "./street.json") return require(path.join(root, "engine/maps/street.json"));
    if (name === "@/content/town") return load("content/town.ts");
    throw new Error(`unexpected import ${name}`);
  };
  new Function("exports", "require", js)(exports, req);
  return exports;
}
process.stdout.write(JSON.stringify(load("engine/maps/townMap.ts").townMap));
