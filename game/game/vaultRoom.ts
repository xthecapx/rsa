import type { VaultPlace } from "@/content/vault";
import { createRoom } from "@/game/room";

// Collision bounds describe the player's feet, with a margin around furniture.
export const VAULT_ROOM = createRoom<VaultPlace>({
  start: { x: 200, y: 224 },
  stations: { vault: { x: 316, y: 108 }, desk: { x: 80, y: 112 }, table: { x: 200, y: 182 } },
  blocks: [
    // Colonel's desk, séance table, Ofelia, armchair, grandfather clock.
    [28, 80, 134, 106], [146, 118, 254, 166], [230, 104, 262, 130],
    [26, 160, 100, 212], [336, 176, 372, 224],
  ],
  floor: [24, 92, 376, 228],
});
export const { canStand, nearbyStation, moveInRoom, roomRoute } = VAULT_ROOM;
