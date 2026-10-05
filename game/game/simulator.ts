"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { saveStorage } from "./storage";

export type SimulatorChoice = "ideal" | "noise";
interface Preference { choice: SimulatorChoice; select: (choice: SimulatorChoice) => void }
/** A player preference, independent of story checkpoints and game resets. */
export const useSimulator = create<Preference>()(persist((set) => ({
  choice: "ideal", select: (choice) => set({ choice }),
}), {
  name: "quantum-simulator-v1", storage: saveStorage<Pick<Preference, "choice">>(),
  skipHydration: true, partialize: ({ choice }) => ({ choice }),
  merge: (saved, current) => ({ ...current, choice: (saved as Partial<Preference> | undefined)?.choice === "noise" ? "noise" : "ideal" }),
}));
