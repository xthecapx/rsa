/** Generated data URLs avoid Qollab's unavailable public directory and XHR. */
export function assetUrl(path: string): string {
  const assets = (globalThis as typeof globalThis & { quantumPlaygroundAssets?: Record<string, string> }).quantumPlaygroundAssets;
  const url = assets?.[path];
  if (!url) throw new Error(`Missing packaged asset: ${path}`);
  return url;
}
