"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScenarioId } from "@/content/scenarios";
import { awardMedalFor } from "./medals";

interface Progress {
  completed: Record<string, string[]>;
  complete: (scenario: ScenarioId, mission: string) => void;
  reset: (scenario?: ScenarioId, mission?: string) => void;
}

export const useProgress = create<Progress>()(persist((set) => ({
  completed: {},
  reset: (scenario, mission) => set((state) => ({ completed: scenario ? {
    ...state.completed, [scenario]: mission ? (state.completed[scenario] ?? []).filter((id) => id !== mission) : [],
  } : {} })),
  complete: (scenario, mission) => {
    set((state) => ({
      completed: {
        ...state.completed,
        [scenario]: Array.from(new Set([...(state.completed[scenario] ?? []), mission])),
      },
    }));
    // Lessons stay complete once finished; the medal is the knowledge you keep even after a replay.
    void awardMedalFor(scenario, mission);
  },
}), { name: "quantum-playground-progress-v1", skipHydration: true }));
