import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useAsyncOperation } from "@/components/useAsyncOperation";
const deferred = () => {
  let resolve!: (value: number) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<number>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
afterEach(cleanup);
it("rejects duplicate runs synchronously, and unlocks after failure for an explicit retry", async () => {
  const job = deferred(),
    success = vi.fn(),
    error = vi.fn(),
    start = vi.fn(),
    settled = vi.fn(),
    work = vi.fn(() => job.promise);
  const { result } = renderHook(() => useAsyncOperation(), {
    wrapper: StrictMode,
  });
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.run(work, { success, error, start, settled });
  });
  expect(result.current.busy).toBe(true);
  expect(await result.current.run(work, { success, error })).toBe(false);
  expect(work).toHaveBeenCalledTimes(1);
  await act(async () => {
    job.reject(new Error("refused"));
    await pending;
  });
  expect(success).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledTimes(1);
  expect(settled).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(false);
  await act(async () => {
    await result.current.run(async () => 7, { success, error });
  });
  expect(success).toHaveBeenCalledWith(7);
});
it("unmount clears parent busy state but never aborts/resubmits or applies late results", async () => {
  const job = deferred(),
    success = vi.fn(),
    error = vi.fn(),
    settled = vi.fn(),
    busy = vi.fn();
  const { result, unmount } = renderHook(() => useAsyncOperation(busy));
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.run(() => job.promise, {
      success,
      error,
      settled,
    });
  });
  unmount();
  expect(busy).toHaveBeenLastCalledWith(false);
  await act(async () => {
    job.resolve(9);
    await pending;
  });
  expect(success).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(settled).toHaveBeenCalledTimes(1);
});
