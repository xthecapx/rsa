import type { Keys } from "excalibur";

/** Only the focused play area owns shortcuts. Native controls keep their keys. */
export function bindExplorationKeyboard(
  host: HTMLElement,
  keyboard: {
    clear: () => void;
    isHeld: (code: Keys) => boolean;
  },
) {
  const movement = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ]);
  function down(event: KeyboardEvent) {
    if (
      event.target !== host ||
      document.activeElement !== host ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      keyboard.clear();
      event.stopImmediatePropagation();
      return;
    }
    if (event.repeat && !keyboard.isHeld(event.code as Keys)) {
      event.stopImmediatePropagation();
      return;
    }
    if (movement.has(event.code)) event.preventDefault();
  }
  function up(event: KeyboardEvent) {
    // Excalibur removes the last held key when an unknown key is released.
    // A release that began in another control must not cancel a new movement.
    if (event.target !== host || !keyboard.isHeld(event.code as Keys))
      event.stopImmediatePropagation();
  }
  function clear() {
    keyboard.clear();
  }
  function pointer(event: PointerEvent) {
    if (
      event.isPrimary &&
      event.button === 0 &&
      event.target instanceof HTMLCanvasElement
    )
      host.focus({ preventScroll: true });
  }
  host.addEventListener("keydown", down, true);
  host.addEventListener("keyup", up, true);
  host.addEventListener("blur", clear);
  host.addEventListener("pointerdown", pointer, true);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", clear);
  return () => {
    host.removeEventListener("keydown", down, true);
    host.removeEventListener("keyup", up, true);
    host.removeEventListener("blur", clear);
    host.removeEventListener("pointerdown", pointer, true);
    window.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", clear);
    clear();
  };
}

export function focusExploration() {
  document
    .querySelector<HTMLElement>(
      '[data-exploration-area="true"]:not([aria-disabled="true"])',
    )
    ?.focus({ preventScroll: true });
}
