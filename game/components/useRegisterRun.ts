"use client";
import { useEffect, useRef, useState } from "react";
import { runRegister, type RegisterResult } from "@/lib/register";
import type { RegOp } from "@/game/register";

export function useRegisterRun(onBusyChange?: (busy: boolean) => void) {
  const [reading, setReading] = useState<RegisterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  function clear() { if (!running.current) { setReading(null); setError(null); } }
  async function run(qubits: number, start: string, operations: RegOp[]) {
    if (running.current) return false;
    running.current = true; setBusy(true); setError(null); setReading(null);
    try {
      const result = await runRegister(qubits, start, operations);
      if (!alive.current) return false;
      setReading(result); return true;
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "The experiment could not finish. Check the backend and try again.");
      return false;
    } finally { running.current = false; if (alive.current) setBusy(false); }
  }
  return { reading, busy, error, clear, run, running };
}
