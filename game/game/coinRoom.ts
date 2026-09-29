import type { RoomPlace } from "@/content/coin";
import { createRoom, type RoomPoint } from "@/game/room";

export type { RoomPoint };
// Collision bounds describe the player's feet, with a margin around furniture.
export const COIN_ROOM = createRoom<RoomPlace>({
  start: { x: 200, y: 224 },
  stations: { table: { x: 200, y: 192 }, desk: { x: 80, y: 112 }, board: { x: 320, y: 108 } },
  blocks: [
    [28, 80, 134, 106], [152, 127, 251, 177], [26, 154, 110, 212],
    [325, 176, 369, 224], [126, 136, 158, 162], [242, 136, 279, 162],
  ],
  floor: [24, 92, 376, 228],
});
export const ROOM_START = COIN_ROOM.start;
export const ROOM_STATIONS = COIN_ROOM.stations;
export const { canStand, nearbyStation, moveInRoom, roomRoute } = COIN_ROOM;
