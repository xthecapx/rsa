import type { TouchDirection } from "./touchInput";

/** Tile movement stays cardinal; the knob follows the finger within its ring. */
export function thumbstick(x: number, y: number, radius = 34, deadZone = 12): {
  x: number; y: number; direction: TouchDirection | null;
} {
  const distance = Math.hypot(x, y);
  const scale = distance > radius ? radius / distance : 1;
  return {
    x: x * scale,
    y: y * scale,
    direction: distance <= deadZone ? null : Math.abs(x) > Math.abs(y)
      ? x < 0 ? "left" : "right"
      : y < 0 ? "up" : "down",
  };
}
