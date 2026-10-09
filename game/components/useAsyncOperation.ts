"use client";
import { useEffect, useRef, useState } from "react";

/** One user-triggered request at a time. Unmounted owners never receive results.
 * This does not abort or retry provider jobs; transport ownership stays separate.
 */
export function useAsyncOperation(onBusyChange?: (busy: boolean) => void) {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    const owner = generation.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current = owner + 1;
    };
  }, []);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  async function run<T>(
    work: () => Promise<T>,
    handlers: {
      success: (result: T) => void;
      error: (cause: unknown) => void;
      start?: () => void;
      settled?: () => void;
    },
  ): Promise<boolean> {
    if (running.current || !mounted.current) return false;
    const owner = generation.current;
    const current = () => mounted.current && owner === generation.current;
    running.current = true;
    setBusy(true);
    try {
      handlers.start?.();
      const result = await work();
      if (!current()) return false;
      handlers.success(result);
      return true;
    } catch (cause) {
      if (current()) handlers.error(cause);
      return false;
    } finally {
      running.current = false;
      handlers.settled?.();
      if (current()) setBusy(false);
    }
  }
  return { busy, running, run };
}
