import type { Actor, Camera } from "excalibur";

interface Size { width: number; height: number }
interface Point { x: number; y: number }

/** Clamp against the visible crop, rather than the off-screen canvas edges. */
export function clampCameraFocus(focus: Point, map: Size, visible: Size): Point {
  const axis = (value: number, extent: number, view: number) =>
    view >= extent ? extent / 2 : Math.max(view / 2, Math.min(extent - view / 2, value));
  return { x: axis(focus.x, map.width, visible.width), y: axis(focus.y, map.height, visible.height) };
}

export function followPlayer(camera: Camera, player: Actor, map: Size): void {
  camera.addStrategy({
    target: player,
    action: (target, cam, engine) => {
      const area = engine.screen.contentArea;
      const center = target.center.clone();
      const focus = clampCameraFocus(center, map, {
        width: Math.min(area.width, engine.screen.resolution.width) / cam.zoom,
        height: Math.min(area.height, engine.screen.resolution.height) / cam.zoom,
      });
      center.x = focus.x; center.y = focus.y;
      return center;
    },
  });
}
