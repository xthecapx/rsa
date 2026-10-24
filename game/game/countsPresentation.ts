/** Presentation only: analysis and saved results continue using the full counts. */
export function countsPresentation(
  counts: Record<string, number>,
  probabilities?: Record<string, number>,
  anonymous = false,
) {
  const compare = (a: string, b: string) =>
    anonymous ? Number(a) - Number(b) : a < b ? -1 : a > b ? 1 : 0;
  const keys = Array.from(
    new Set([...Object.keys(counts), ...Object.keys(probabilities ?? {})]),
  ).sort(compare);
  const observed = Object.keys(counts)
    .filter((key) => counts[key] > 0)
    .sort((a, b) => counts[b] - counts[a] || compare(a, b));
  const peaks = observed.slice(0, 8);
  return {
    keys,
    peaks,
    large: keys.length > 16,
    shots: Object.values(counts).reduce((sum, count) => sum + count, 0),
    distinct: observed.length,
    other: {
      outcomes: Math.max(0, observed.length - peaks.length),
      count: observed
        .slice(peaks.length)
        .reduce((sum, key) => sum + counts[key], 0),
    },
  };
}
