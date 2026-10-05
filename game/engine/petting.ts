import type { AnimalKind } from "@/content/coinTown";
import { TILE_SIZE } from "./tiles";

export type PetKind = "cat" | "dog";
export function canPet(kind: AnimalKind): kind is PetKind {
  return kind === "cat" || kind === "dog";
}

/** Use drawn positions: a wanderer's destination tile can be ahead of its sprite. */
export function nearestPet<T extends { kind: AnimalKind; pos: { x: number; y: number } }>(
  animals: readonly T[], player: { x: number; y: number },
): T | null {
  let nearest: T | null = null;
  let distance = TILE_SIZE * 1.25;
  for (const animal of animals) {
    if (!canPet(animal.kind)) continue;
    const next = Math.abs(animal.pos.x - player.x) + Math.abs(animal.pos.y - player.y);
    if (next <= distance) { nearest = animal; distance = next; }
  }
  return nearest;
}
