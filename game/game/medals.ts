"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { medalFor, type MedalId } from "@/content/medals";
import type { ScenarioId } from "@/content/scenarios";

interface MedalCase {
  /** Medal id → ISO date it was earned. */
  earned: Partial<Record<MedalId, string>>;
  /** Most recently earned medal, shown once by the ceremony. Not persisted. */
  fresh: MedalId | null;
  award: (id: MedalId) => boolean;
  dismiss: () => void;
  reset: () => void;
}

export const useMedals = create<MedalCase>()(persist((set, get) => ({
  earned: {},
  fresh: null,
  award: (id) => {
    if (get().earned[id]) return false;
    set((state) => ({ earned: { ...state.earned, [id]: new Date().toISOString() }, fresh: id }));
    return true;
  },
  dismiss: () => set({ fresh: null }),
  reset: () => set({ earned: {}, fresh: null }),
}), {
  name: "quantum-town-medals-v1",
  skipHydration: true,
  partialize: (state) => ({ earned: state.earned }),
}));

/** Award the medal that a finished mission carries. Safe to call repeatedly. */
export async function awardMedalFor(scenario: ScenarioId, mission: string): Promise<boolean> {
  const medal = medalFor(scenario, mission);
  if (!medal) return false;
  if (!useMedals.persist.hasHydrated()) await useMedals.persist.rehydrate();
  return useMedals.getState().award(medal.id);
}
