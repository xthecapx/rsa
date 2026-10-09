import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { useLessonSession } from "@/components/useLessonSession";
const initial = { step: "welcome", winner: null as number | null, counts: {} };
const config = {
  key: "test-lesson",
  initial,
  restore: (saved: unknown) => (saved ? { ...initial, ...saved } : initial),
  unreadable: () => initial,
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
it("hydrates an earned outcome before writing, and reopen preserves its data", () => {
  const saved = { step: "done", winner: 1, counts: { 0: 0, 1: 1 } };
  localStorage.setItem(config.key, JSON.stringify(saved));
  const write = vi.spyOn(Storage.prototype, "setItem");
  const view = renderHook(() => useLessonSession(config), {
    wrapper: StrictMode,
  });
  expect(view.result.current.session).toEqual(saved);
  expect(view.result.current.hydrated).toBe(true);
  expect(
    write.mock.calls.every(([, json]) => JSON.parse(json).winner === 1),
  ).toBe(true);
  view.unmount();
  const reopened = renderHook(() => useLessonSession(config));
  expect(reopened.result.current.session).toEqual(saved);
});
it("unreadable and blocked storage keep the lesson usable in memory", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const view = renderHook(() => useLessonSession(config));
  expect(view.result.current.storageNote).toBe(true);
  act(() => view.result.current.setSession({ ...initial, winner: 0 }));
  expect(view.result.current.session.winner).toBe(0);
});
