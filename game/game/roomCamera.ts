import { clampCameraFocus } from "@/engine/camera";
import type { RoomPoint } from "./room";

/** A fixed pixel scale keeps furniture readable without stretching a small base. */
export function roomCamera(
  bounds: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  player: RoomPoint,
) {
  const width = viewport.width > 0 ? viewport.width / 2 : bounds.width;
  const height = viewport.height > 0 ? viewport.height / 2 : bounds.height;
  const center = clampCameraFocus(
    { x: player.x - bounds.x, y: player.y - 12 - bounds.y },
    bounds,
    { width, height },
  );
  return {
    x: bounds.x + center.x - width / 2,
    y: bounds.y + center.y - height / 2,
    width,
    height,
    cropped: width < bounds.width || height < bounds.height,
  };
}
