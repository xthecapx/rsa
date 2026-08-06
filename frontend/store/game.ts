import { create } from "zustand";
import type {
  IbmBatchDetail,
  RsaKeygenResponse,
  ShorPlanResponse,
  ShorSimulateResponse,
} from "@/lib/api";

export type ActNumber = 1 | 2 | 3 | 4;
export type Tier = 1 | 2 | 3;
export type Modulus = 15 | 21;
export type PacketState =
  | "idle"
  | "sending"
  | "intercepted"
  | "delivered"
  | "cracked";

/** Public-key publish on the cable (Brayan → Hacker → Ale). */
export type RsaShareState =
  | "idle"
  | "sending"
  | "intercepted"
  | "delivered";

export interface MessagePayload {
  char: string;
  value: number;
  encrypted: boolean;
  ciphertext?: string;
  readableByHacker: boolean;
  equation?: string;
}

interface GameState {
  act: ActNumber;
  tier: Tier;
  selectedChar: string | null;
  modulus: Modulus;
  shift: number;
  shorA: number;
  packetState: PacketState;
  messagePayload: MessagePayload | null;
  rsaKeys: RsaKeygenResponse | null;
  rsaCipher: number | null;
  /** Who already holds a copy of the public key after publish. */
  rsaPubOnAle: boolean;
  rsaPubOnHacker: boolean;
  /** Cable animation for publishing PK (null = not publishing). */
  rsaShareState: RsaShareState | null;
  shorPlan: ShorPlanResponse | null;
  shorResult: ShorSimulateResponse | Record<string, unknown> | null;
  ibmBatch: IbmBatchDetail | null;
  presenterMode: boolean;
  error: string | null;

  setAct: (act: ActNumber) => void;
  setTier: (tier: Tier) => void;
  setSelectedChar: (char: string | null) => void;
  setModulus: (modulus: Modulus) => void;
  setShift: (shift: number) => void;
  setShorA: (a: number) => void;
  setPacketState: (state: PacketState) => void;
  setMessagePayload: (payload: MessagePayload | null) => void;
  setRsaKeys: (keys: RsaKeygenResponse | null) => void;
  setRsaCipher: (c: number | null) => void;
  setRsaPubOnAle: (v: boolean) => void;
  setRsaPubOnHacker: (v: boolean) => void;
  setRsaShareState: (state: RsaShareState | null) => void;
  resetRsaShare: () => void;
  setShorPlan: (plan: ShorPlanResponse | null) => void;
  setShorResult: (
    result: ShorSimulateResponse | Record<string, unknown> | null,
  ) => void;
  setIbmBatch: (batch: IbmBatchDetail | null) => void;
  togglePresenterMode: () => void;
  setError: (error: string | null) => void;
  resetPacket: () => void;
  resetAct: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  act: 1,
  tier: 1,
  selectedChar: null,
  modulus: 15,
  shift: 1,
  shorA: 7,
  packetState: "idle",
  messagePayload: null,
  rsaKeys: null,
  rsaCipher: null,
  rsaPubOnAle: false,
  rsaPubOnHacker: false,
  rsaShareState: null,
  shorPlan: null,
  shorResult: null,
  ibmBatch: null,
  presenterMode: false,
  error: null,

  setAct: (act) => {
    set({ act, error: null });
    get().resetAct();
  },

  setTier: (tier) => set({ tier }),

  setSelectedChar: (selectedChar) => set({ selectedChar }),

  setModulus: (modulus) => {
    set({
      modulus,
      rsaKeys: null,
      rsaCipher: null,
      rsaPubOnAle: false,
      rsaPubOnHacker: false,
      rsaShareState: null,
    });
  },

  setShift: (shift) => set({ shift }),

  setShorA: (shorA) => set({ shorA }),

  setPacketState: (packetState) => set({ packetState }),

  setMessagePayload: (messagePayload) => set({ messagePayload }),

  setRsaKeys: (rsaKeys) => set({ rsaKeys }),

  setRsaCipher: (rsaCipher) => set({ rsaCipher }),

  setRsaPubOnAle: (rsaPubOnAle) => set({ rsaPubOnAle }),

  setRsaPubOnHacker: (rsaPubOnHacker) => set({ rsaPubOnHacker }),

  setRsaShareState: (rsaShareState) => set({ rsaShareState }),

  resetRsaShare: () =>
    set({
      rsaPubOnAle: false,
      rsaPubOnHacker: false,
      rsaShareState: null,
    }),

  setShorPlan: (shorPlan) => set({ shorPlan }),

  setShorResult: (shorResult) => set({ shorResult }),

  setIbmBatch: (ibmBatch) => set({ ibmBatch }),

  togglePresenterMode: () =>
    set((s) => ({ presenterMode: !s.presenterMode })),

  setError: (error) => set({ error }),

  resetPacket: () =>
    set({
      packetState: "idle",
      messagePayload: null,
      selectedChar: null,
    }),

  resetAct: () =>
    set({
      packetState: "idle",
      messagePayload: null,
      selectedChar: null,
      rsaKeys: null,
      rsaCipher: null,
      rsaPubOnAle: false,
      rsaPubOnHacker: false,
      rsaShareState: null,
      shorPlan: null,
      shorResult: null,
      ibmBatch: null,
      error: null,
    }),
}));
