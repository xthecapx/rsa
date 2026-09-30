"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ALL_KNOWLEDGE_IDS, type KnowledgeId } from "@/content/knowledge";

/** Knowledge cards learned from town neighbors. Like medals, replaying a lesson never removes one. */
interface KnowledgeCase {
  cards: KnowledgeId[];
  /** Most recently learned card, shown once. Not persisted. */
  fresh: KnowledgeId | null;
  learn: (id: KnowledgeId) => boolean;
  dismiss: () => void;
  /** Forget one town's cards; the other towns keep theirs. */
  resetTown: (ids: readonly KnowledgeId[]) => void;
  reset: () => void;
}

export const useKnowledge = create<KnowledgeCase>()(persist((set, get) => ({
  cards: [],
  fresh: null,
  learn: (id) => {
    if (get().cards.includes(id)) return false;
    set((state) => ({ cards: [...state.cards, id], fresh: id }));
    return true;
  },
  dismiss: () => set({ fresh: null }),
  resetTown: (ids) => set((state) => ({ cards: state.cards.filter((id) => !ids.includes(id)), fresh: null })),
  reset: () => set({ cards: [], fresh: null }),
}), {
  name: "quantum-town-knowledge-v1",
  skipHydration: true,
  partialize: (state) => ({ cards: state.cards }),
  merge: (saved, current) => {
    const cards = (saved as { cards?: unknown } | undefined)?.cards;
    return { ...current, cards: Array.isArray(cards) ? ALL_KNOWLEDGE_IDS.filter((id) => cards.includes(id)) : [] };
  },
}));
