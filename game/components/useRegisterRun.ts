"use client";
import { useState } from "react";
import { runRegister, type RegisterResult } from "@/lib/register";
import type { RegOp } from "@/game/register";
import { EXPERIMENT_ERROR } from "@/lib/request";
import { useAsyncOperation } from "./useAsyncOperation";

export function useRegisterRun(onBusyChange?: (busy: boolean) => void) {
  const [reading, setReading] = useState<RegisterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operation = useAsyncOperation(onBusyChange);
  function clear() {
    if (!operation.running.current) {
      setReading(null);
      setError(null);
    }
  }
  function run(qubits: number, start: string, operations: RegOp[]) {
    return operation.run(() => runRegister(qubits, start, operations), {
      start: () => {
        setError(null);
        setReading(null);
      },
      success: setReading,
      error: (cause) =>
        setError(cause instanceof Error ? cause.message : EXPERIMENT_ERROR),
    });
  }
  return {
    reading,
    busy: operation.busy,
    error,
    clear,
    run,
    running: operation.running,
  };
}
