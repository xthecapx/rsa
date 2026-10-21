import { afterEach, expect, it, vi } from "vitest";
import { bindExplorationKeyboard } from "@/engine/explorationKeyboard";

let release = () => {};
afterEach(() => {
  release();
  document.body.replaceChildren();
});
function setup() {
  const host = document.createElement("div");
  host.tabIndex = 0;
  const input = document.createElement("input");
  const button = document.createElement("button");
  const editable = document.createElement("div");
  editable.contentEditable = "true";
  editable.tabIndex = 0;
  host.append(input, button, editable);
  document.body.append(host);
  const held = new Set<string>();
  const keyboard = {
    clear: vi.fn(() => held.clear()),
    isHeld: (key: string) => held.has(key),
  };
  release = bindExplorationKeyboard(host, keyboard);
  // Excalibur's listener runs on the host after our capture guard.
  const receive = vi.fn((event: KeyboardEvent) => held.add(event.code));
  host.addEventListener("keydown", receive);
  const key = (
    target: HTMLElement,
    code: string,
    options: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code,
      ...options,
    });
    target.dispatchEvent(event);
    return event;
  };
  host.focus();
  return { host, input, button, editable, held, keyboard, receive, key };
}
it("owns movement only while the play area itself is focused and leaves Tab usable", () => {
  const { host, key, receive } = setup();
  expect(key(host, "KeyW").defaultPrevented).toBe(true);
  expect(receive).toHaveBeenCalledTimes(1);
  expect(key(host, "Tab").defaultPrevented).toBe(false);
});
it("protects inputs, buttons, and editable descendants even inside the engine host", () => {
  const { input, button, editable, key, receive } = setup();
  for (const control of [input, button, editable]) {
    control.focus();
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowDown"]) {
      expect(key(control, code).defaultPrevented).toBe(false);
    }
  }
  expect(receive).not.toHaveBeenCalled();
});
it("clears held keys on blur and refuses an old repeat after focus returns", () => {
  const { host, button, held, key, receive } = setup();
  key(host, "Space");
  expect(held.has("Space")).toBe(true);
  button.focus();
  expect(held.size).toBe(0);
  host.focus();
  key(host, "Space", { repeat: true });
  expect(receive).toHaveBeenCalledTimes(1);
  key(host, "Space");
  expect(receive).toHaveBeenCalledTimes(2);
});
it("preserves browser and assistive technology modifier shortcuts and clears on window blur", () => {
  const { host, key, held, receive } = setup();
  for (const modifier of ["ctrlKey", "metaKey", "altKey"])
    key(host, "KeyW", { [modifier]: true });
  expect(receive).not.toHaveBeenCalled();
  key(host, "KeyD");
  window.dispatchEvent(new Event("blur"));
  expect(held.size).toBe(0);
});

it("ignores releases that started outside the play area without cancelling a new held key", () => {
  const { host, key, held } = setup();
  const up = vi.fn((event: KeyboardEvent) => held.delete(event.code));
  host.addEventListener("keyup", up);
  key(host, "KeyD");
  key(host, "Space", { repeat: true });
  expect(held.has("KeyD")).toBe(true);
  host.dispatchEvent(
    new KeyboardEvent("keyup", { bubbles: true, code: "Space" }),
  );
  expect(up).not.toHaveBeenCalled();
  expect(held.has("KeyD")).toBe(true);
  host.dispatchEvent(
    new KeyboardEvent("keyup", { bubbles: true, code: "KeyD" }),
  );
  expect(up).toHaveBeenCalledTimes(1);
  expect(held.size).toBe(0);
});
