"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ScenarioId } from "@/content/scenarios";

interface Progress {
  completed: Record<string, string[]>;
  complete: (scenario: ScenarioId, mission: string) => void;
}

export const useProgress = create<Progress>()(persist((set) => ({
  completed: {},
  complete: (scenario, mission) => set((state) => ({
    completed: {
      ...state.completed,
      [scenario]: Array.from(new Set([...(state.completed[scenario] ?? []), mission])),
    },
  })),
}), { name: "quantum-playground-progress-v1", skipHydration: true }));
