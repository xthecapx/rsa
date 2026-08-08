/**
 * Shared touch control state. React writes; CityScene reads each frame. Kept
 * outside the bus so a press can be polled from the game loop instead of
 * inventing a command round trip for it.
 */

let interactQueued = false;

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
}
