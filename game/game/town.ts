"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getAct } from "@/content";
import type { ActNumber } from "@/content/types";
import { TOWN_SPAWN, type WorldFacing } from "@/content/town";
import { isToyModulus } from "./secret";
import { useGame, type GameState } from "./state";
import { townMap } from "@/engine/maps/townMap";
import { COIN_TOWN_SPAWN } from "@/content/coinTown";
import { FOUNDRY_SPAWN } from "@/content/foundry";
import { HOLLOW_SPAWN } from "@/content/hollow";

/** Where the player stands in a small town, and whether its greeter has met them. */
interface TownPlace { position: { x: number; y: number }; facing: WorldFacing; welcomed: boolean }
export type TownSlot = "coinTown" | "foundry" | "hollow";
const COIN_TOWN_START = (): TownPlace => ({ position: { ...COIN_TOWN_SPAWN }, facing: "up", welcomed: false });
const FOUNDRY_START = (): TownPlace => ({ position: { ...FOUNDRY_SPAWN }, facing: "right", welcomed: false });
const HOLLOW_START = (): TownPlace => ({ position: { ...HOLLOW_SPAWN }, facing: "left", welcomed: false });
const FACINGS: WorldFacing[] = ["up", "down", "left", "right"];
function townPlace(value: Partial<TownPlace> | undefined, fallback: () => TownPlace): TownPlace {
  return Number.isInteger(value?.position?.x) && Number.isInteger(value?.position?.y)
    ? { position: value!.position!, facing: FACINGS.includes(value!.facing!) ? value!.facing! : fallback().facing, welcomed: value!.welcomed === true }
    : fallback();
}
const LOCATIONS = ["town", "coinTown", "foundry", "hollow", "coin", "grover", "vault"] as const;

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
  /** A new game starts in Coin Town; Foundry Town is east of it, Hollow Town west, and Quantum Town ("town") is the final town, up its north road. */
  location: (typeof LOCATIONS)[number];
  position: { x: number; y: number };
  facing: WorldFacing;
  /** Where the player stands in each small town; `position` stays Quantum Town's. */
  coinTown: TownPlace;
  foundry: TownPlace;
  hollow: TownPlace;
  /** The workshop has a door in Foundry Town and a replay door in Quantum Town; leaving goes back out the one you came in. */
  groverFrom: "town" | "foundry";
  /** Casa Ofelia works the same way: a door in Hollow Town and a replay door in Quantum Town. */
  vaultFrom: "town" | "hollow";
  tracked: "coin" | "rsa" | "grover" | "vault" | null;
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
  welcomed: false, location: "coinTown", position: { ...TOWN_SPAWN }, facing: "up", tracked: "coin", coinTown: COIN_TOWN_START(), foundry: FOUNDRY_START(), hollow: HOLLOW_START(), groverFrom: "foundry", vaultFrom: "hollow",
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
  reset: () => set({ welcomed: false, location: "coinTown", position: { ...TOWN_SPAWN }, facing: "up", tracked: "coin", coinTown: COIN_TOWN_START(), foundry: FOUNDRY_START(), hollow: HOLLOW_START(), groverFrom: "foundry", vaultFrom: "hollow",
    discovered: [], explored: [], checkpoint: null, rsaPosition: null, requestedAct: null, interrupted: false, rsaRunning: false }),
}), {
  name: "quantum-town-v1", version: 1, storage, skipHydration: true,
  merge: (saved, current) => {
    const data = saved as Partial<TownState> | undefined;
    if (!data || typeof data !== "object") return current;
    return {
      ...current, ...data, patch: current.patch, discover: current.discover, explore: current.explore, reset: current.reset,
      welcomed: data.welcomed === true,
      location: LOCATIONS.includes(data.location!) ? data.location! : "town",
      coinTown: townPlace(data.coinTown, COIN_TOWN_START),
      foundry: townPlace(data.foundry, FOUNDRY_START),
      hollow: townPlace(data.hollow, HOLLOW_START),
      // Saves from before Foundry Town only had the Quantum Town door.
      groverFrom: data.groverFrom === "foundry" || data.groverFrom === "town" ? data.groverFrom : "town",
      // Saves from before Hollow Town only had the Quantum Town door.
      vaultFrom: data.vaultFrom === "hollow" || data.vaultFrom === "town" ? data.vaultFrom : "town",
      position: Number.isInteger(data.position?.x) && Number.isInteger(data.position?.y) ? data.position! : { ...TOWN_SPAWN },
      facing: ["up", "down", "left", "right"].includes(data.facing ?? "") ? data.facing! : "up",
      checkpoint: validCheckpoint(data.checkpoint ?? null) ? data.checkpoint! : null,
      discovered: Array.isArray(data.discovered) ? data.discovered.filter((id) => typeof id === "string") : [],
      explored: Array.isArray(data.explored) ? [...new Set(data.explored.filter((id) => Number.isInteger(id) && id >= 0 && id < townMap.width * townMap.height))] : [],
      tracked: data.tracked === "rsa" || data.tracked === "coin" || data.tracked === "grover" || data.tracked === "vault" ? data.tracked : null,
      rsaPosition: Number.isInteger(data.rsaPosition?.x) && Number.isInteger(data.rsaPosition?.y) ? data.rsaPosition! : null,
      rsaRunning: data.rsaRunning === true, interrupted: data.interrupted === true,
      requestedAct: [1, 2, 3, 4].includes(data.requestedAct ?? 0) ? data.requestedAct! : null,
    };
  },
}));
