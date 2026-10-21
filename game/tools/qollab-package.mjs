import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/** Template substitutions are conservatively matched against the asset inventory. */
export function assetPattern(parts) {
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${parts.map(escape).join('.*')}$`);
}

export function referencedAssets(inventory, patterns) {
  return Object.fromEntries(Object.entries(inventory).filter(([name]) => patterns.some((pattern) => pattern.test(name))));
}

/** Include full dependency licenses, not just esbuild's abbreviated comment headers. */
export async function dependencyNotices(root, inputs) {
  const packages = new Map();
  for (const input of Object.keys(inputs)) {
    if (!input.includes('node_modules/')) continue;
    let directory = path.dirname(path.resolve(root, input));
    while (directory !== path.dirname(directory)) {
      try {
        const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
        packages.set(directory, pkg);
        break;
      } catch { directory = path.dirname(directory); }
    }
  }
  const notices = [];
  for (const [directory, pkg] of [...packages].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    const names = (await readdir(directory)).filter((name) => /^(?:licen[cs]e|copying|notice)(?:\.(?:txt|md))?$/i.test(name)).sort();
    if (!names.some((name) => /^(?:licen[cs]e|copying)/i.test(name))) throw new Error(`Missing bundled dependency license: ${pkg.name}`);
    for (const name of names) notices.push(`${pkg.name} ${pkg.version} — ${name}\n\n${await readFile(path.join(directory, name), 'utf8')}`);
  }
  return notices;
}

/** Static browser data shares one ESM file, outside the game's size budget. */
export function assetModule(assets, spanish) {
  return `globalThis.quantumPlaygroundAssets = ${JSON.stringify(assets)};\nexport const spanish = ${JSON.stringify(spanish)};\n`;
}
