/**
 * Let React paint before a long await. Without this, setPhase("busy") and
 * setBusy() stay invisible until the work finishes, so the street looks stuck.
 */
export function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
