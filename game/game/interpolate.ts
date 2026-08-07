/**
 * Replaces `{name}` in a line with the run variable of the same name. Unknown
 * names are left alone so a typo in the script is visible rather than silent.
 *
 * This lives apart from the dialog runner because effects need it too, and
 * effects are imported by the runner.
 */
export function fill(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}
