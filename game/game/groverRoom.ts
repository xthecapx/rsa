import type { GroverPlace } from "@/content/grover";
import { createRoom } from "@/game/room";

// Collision bounds describe the player's feet, with a margin around furniture.
export const GROVER_ROOM = createRoom<GroverPlace>({
  start: { x: 200, y: 224 },
  stations: { core: { x: 200, y: 182 }, desk: { x: 80, y: 112 }, board: { x: 320, y: 108 } },
  blocks: [
    [28, 80, 134, 106], [146, 118, 254, 166], [258, 128, 290, 160],
    [26, 160, 100, 212], [330, 180, 370, 224],
  ],
  floor: [24, 92, 376, 228],
});
export const { canStand, nearbyStation, moveInRoom, roomRoute } = GROVER_ROOM;
