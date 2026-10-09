export const clampDegrees = (value: number) =>
  Math.max(-360, Math.min(360, value));

/** Clockwise angle from twelve o'clock, in [0, 360). */
export function pointerDegrees(
  x: number,
  y: number,
  bounds: { left: number; top: number; width: number; height: number },
) {
  return (
    ((Math.atan2(
      x - bounds.left - bounds.width / 2,
      bounds.top + bounds.height / 2 - y,
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}

/** Unwrap one pointer movement so crossing zero never jumps a full turn. */
export function advanceDialDegrees(value: number, from: number, to: number) {
  const raw = to - from;
  let delta = ((((raw + 180) % 360) + 360) % 360) - 180;
  if (delta === -180 && raw > 0) delta = 180;
  return clampDegrees(value + delta);
}
