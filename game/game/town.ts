"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getAct } from "@/content";
import type { ActNumber } from "@/content/types";
import { TOWN_SPAWN, type WorldFacing } from "@/content/town";
import { isToyModulus } from "./secret";
import { useGame, type GameState } from "./state";
import { townMap } from "@/engine/maps/townMap";

const CHECKPOINT_KEYS = ["act", "phase", "suspicion", "nodeId", "lineIndex", "lines", "choicesVisible", "waitingFor", "feedback", "panel", "terminal", "flags", "vars", "tasks", "pendingTravel", "capture", "reportError", "completedActs", "labMemory"] as const;
export type RsaCheckpoint = Pick<GameState, (typeof CHECKPOINT_KEYS)[number]>;
export function captureRsa(): RsaCheckpoint {
  const state = useGame.getState();
  return Object.fromEntries(CHECKPOINT_KEYS.map((key) => [key, state[key]])) as RsaCheckpoint;
}
export function validCheckpoint(value: RsaCheckpoint | null): value is RsaCheckpoint {
  return !!value && [1, 2, 3, 4].includes(value.act) && ["exploring", "dialog", "won", "caught"].includes(value.phase)
    && typeof value.nodeId === "string" && Array.isArray(value.lines) && Array.isArray(value.tasks)
    && !!value.vars && !!value.flags && typeof value.suspicion === "number"
    && Number.isInteger(value.lineIndex) && value.lineIndex >= 0 && Array.isArray(value.terminal)
    && isToyModulus(value.vars.modulus) && !!getAct(value.act).nodes[value.nodeId]
    && (value.phase !== "exploring" || !!value.pendingTravel);
}
export function restoreRsa(checkpoint: RsaCheckpoint) {
  useGame.setState({ ...checkpoint, walking: false, near: null, laptopOpen: false, busyLabel: null, error: null, operations: 0, labMemory: checkpoint.labMemory ?? {} });
}

interface TownState {
  welcomed: boolean;
  location: "town" | "coin";
  position: { x: number; y: number };
  facing: WorldFacing;
  tracked: "coin" | "rsa" | null;
  discovered: string[];
  explored: number[];
  checkpoint: RsaCheckpoint | null;
  rsaPosition: { x: number; y: number } | null;
  requestedAct: ActNumber | null;
  interrupted: boolean;
  rsaRunning: boolean;
  patch: (values: Partial<Omit<TownState, "patch" | "discover" | "explore" | "reset">>) => void;
  discover: (id: string) => void;
  explore: (at: { x: number; y: number }) => void;
  reset: () => void;
}
export let townStorageUnavailable = false;
const storage = createJSONStorage<TownState>(() => ({
  getItem: (key: string) => { try { return localStorage.getItem(key); } catch { townStorageUnavailable = true; return null; } },
  setItem: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { townStorageUnavailable = true; } },
  removeItem: (key: string) => { try { localStorage.removeItem(key); } catch { townStorageUnavailable = true; } },
}));

export const useTown = create<TownState>()(persist((set) => ({
  welcomed: false, location: "town", position: { ...TOWN_SPAWN }, facing: "up", tracked: "coin",
  discovered: [], explored: [], checkpoint: null, rsaPosition: null, requestedAct: null, interrupted: false, rsaRunning: false,
  patch: (values) => set(values),
  discover: (id) => set((state) => ({ discovered: Array.from(new Set([...state.discovered, id])) })),
  explore: (at) => set((state) => {
    const cells = new Set(state.explored);
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const x = at.x + dx, y = at.y + dy;
      if (dx * dx + dy * dy <= 25 && x >= 0 && y >= 0 && x < townMap.width && y < townMap.height) cells.add(y * townMap.width + x);
    }
    return cells.size === state.explored.length ? state : { explored: [...cells] };
  }),
  reset: () => set({ welcomed: false, location: "town", position: { ...TOWN_SPAWN }, facing: "up", tracked: "coin",
    discovered: [], explored: [], checkpoint: null, rsaPosition: null, requestedAct: null, interrupted: false, rsaRunning: false }),
}), {
  name: "quantum-town-v1", version: 1, storage, skipHydration: true,
  merge: (saved, current) => {
    const data = saved as Partial<TownState> | undefined;
    if (!data || typeof data !== "object") return current;
    return {
      ...current, ...data, patch: current.patch, discover: current.discover, explore: current.explore, reset: current.reset,
      welcomed: data.welcomed === true,
      location: data.location === "coin" ? "coin" : "town",
      position: Number.isInteger(data.position?.x) && Number.isInteger(data.position?.y) ? data.position! : { ...TOWN_SPAWN },
      facing: ["up", "down", "left", "right"].includes(data.facing ?? "") ? data.facing! : "up",
      checkpoint: validCheckpoint(data.checkpoint ?? null) ? data.checkpoint! : null,
      discovered: Array.isArray(data.discovered) ? data.discovered.filter((id) => typeof id === "string") : [],
      explored: Array.isArray(data.explored) ? [...new Set(data.explored.filter((id) => Number.isInteger(id) && id >= 0 && id < townMap.width * townMap.height))] : [],
      tracked: data.tracked === "rsa" || data.tracked === "coin" ? data.tracked : null,
      rsaPosition: Number.isInteger(data.rsaPosition?.x) && Number.isInteger(data.rsaPosition?.y) ? data.rsaPosition! : null,
      rsaRunning: data.rsaRunning === true, interrupted: data.interrupted === true,
      requestedAct: [1, 2, 3, 4].includes(data.requestedAct ?? 0) ? data.requestedAct! : null,
    };
  },
}));
