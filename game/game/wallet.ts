"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CIPHER_KNOWLEDGE_IDS, type CipherKnowledgeId } from "@/content/knowledge";
import { ACT_PAYOUT, CLIENT_ADVANCE, GEAR, type GearId } from "@/content/cipher";
import type { ActNumber } from "@/content/types";

/**
 * Cipher Town's credits and the gear bought with them. The client pays an
 * advance and a fee for each act, once; neighbors pay for a hand; bounties
 * pay every time. Replaying an act never pays again, so credits can't be farmed
 * from the story.
 */
interface Wallet {
  credits: number;
  gear: GearId[];
  advanced: boolean;
  paidActs: ActNumber[];
  paidCards: CipherKnowledgeId[];
  bounties: number;
  advance: () => boolean;
  payAct: (act: ActNumber) => boolean;
  payCard: (id: CipherKnowledgeId, amount: number) => boolean;
  payBounty: (amount: number) => void;
  buy: (id: GearId) => boolean;
  /** Saves that finished acts before the store opened own the gear those acts used. */
  grantFor: (acts: ActNumber[]) => void;
  reset: () => void;
}

const EMPTY = { credits: 0, gear: [] as GearId[], advanced: false, paidActs: [] as ActNumber[], paidCards: [] as CipherKnowledgeId[], bounties: 0 };
const GEAR_IDS = GEAR.map((item) => item.id);

export const useWallet = create<Wallet>()(persist((set, get) => ({
  ...EMPTY,
  advance: () => {
    if (get().advanced) return false;
    set((state) => ({ advanced: true, credits: state.credits + CLIENT_ADVANCE }));
    return true;
  },
  payAct: (act) => {
    if (get().paidActs.includes(act)) return false;
    set((state) => ({ paidActs: [...state.paidActs, act], credits: state.credits + (ACT_PAYOUT[act] ?? 0) }));
    return true;
  },
  payCard: (id, amount) => {
    if (get().paidCards.includes(id)) return false;
    set((state) => ({ paidCards: [...state.paidCards, id], credits: state.credits + amount }));
    return true;
  },
  payBounty: (amount) => set((state) => ({ credits: state.credits + amount, bounties: state.bounties + 1 })),
  buy: (id) => {
    const item = GEAR.find((gear) => gear.id === id)!;
    if (get().gear.includes(id) || get().credits < item.price) return false;
    set((state) => ({ gear: [...state.gear, id], credits: state.credits - item.price }));
    return true;
  },
  grantFor: (acts) => {
    const owed = GEAR.filter((item) => acts.includes(item.act) && !get().gear.includes(item.id)).map((item) => item.id);
    if (owed.length) set((state) => ({ gear: [...state.gear, ...owed], advanced: true, paidActs: [...new Set([...state.paidActs, ...acts])] }));
  },
  reset: () => set({ ...EMPTY }),
}), {
  name: "quantum-town-wallet-v1",
  skipHydration: true,
  partialize: ({ credits, gear, advanced, paidActs, paidCards, bounties }) => ({ credits, gear, advanced, paidActs, paidCards, bounties }),
  merge: (saved, current) => {
    const data = (saved ?? {}) as Partial<typeof EMPTY>;
    const list = <T,>(value: unknown, allowed: readonly T[]) => (Array.isArray(value) ? allowed.filter((id) => value.includes(id)) : []);
    return {
      ...current,
      credits: Number.isInteger(data.credits) && data.credits! >= 0 ? data.credits! : 0,
      gear: list(data.gear, GEAR_IDS),
      advanced: data.advanced === true,
      paidActs: list(data.paidActs, [1, 2, 3, 4] as ActNumber[]),
      paidCards: list(data.paidCards, CIPHER_KNOWLEDGE_IDS),
      bounties: Number.isInteger(data.bounties) && data.bounties! >= 0 ? data.bounties! : 0,
    };
  },
}));
