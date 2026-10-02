/**
 * Shared touch control state. React writes; CityScene reads each frame. Kept
 * outside the bus so a press can be polled from the game loop instead of
 * inventing a command round trip for it.
 */

let interactQueued = false;
export type TouchDirection = "up" | "down" | "left" | "right";
const directions = new Map<number, TouchDirection>();

/** Latest held finger wins; releasing another finger cannot stop it. */
export function holdTouchDirection(pointer: number, direction: TouchDirection): void {
  directions.delete(pointer);
  directions.set(pointer, direction);
}

export function releaseTouchDirection(pointer: number): void {
  directions.delete(pointer);
}

export function touchDirection(): TouchDirection | null {
  return [...directions.values()].at(-1) ?? null;
}

export function queueTouchInteract(): void {
  interactQueued = true;
}

/** Returns true once per queued Talk press. */
export function consumeTouchInteract(): boolean {
  if (!interactQueued) return false;
  interactQueued = false;
  return true;
}

export function clearTouchInput(): void {
  interactQueued = false;
  directions.clear();
}
