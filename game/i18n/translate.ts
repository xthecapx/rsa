/** Exact messages plus named placeholders for story variables and result logs.
 * Source strings are retained in game state so language switches never reset a run.
 */
const compiled = new WeakMap<object, { pattern: RegExp; value: string; names: string[] }[]>();
export function translate(text: string, catalog: Record<string, string>): string {
  const trimmed = text.trim();
  const direct = Object.prototype.hasOwnProperty.call(catalog, trimmed) ? catalog[trimmed] : undefined;
  if (direct !== undefined) return text.replace(trimmed, () => direct);
  let templates = compiled.get(catalog);
  if (!templates) {
    templates = Object.entries(catalog).filter(([key]) => /\{\w+\}/.test(key)).map(([key, value]) => {
      const names: string[] = [];
      let source = "", cursor = 0;
      for (const match of key.matchAll(/\{(\w+)\}/g)) {
        source += key.slice(cursor, match.index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([\\s\\S]+?)";
        names.push(match[1]); cursor = match.index! + match[0].length;
      }
      source += key.slice(cursor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return { pattern: new RegExp(`^${source}$`), value, names };
    });
    compiled.set(catalog, templates);
  }
  for (const { pattern, value, names } of templates) {
    const match = pattern.exec(trimmed);
    if (match) return text.replace(trimmed, () => value.replace(/\{(\w+)\}/g, (token, name) => {
      const index = names.indexOf(name); return index < 0 ? token : match[index + 1];
    }));
  }
  return text;
}
