import { create } from "zustand";

import type { ActNumber, PanelKind, Speaker } from "@/content/types";
import type { Landmark } from "@/engine/maps/street";

export type Phase =
  | "exploring"
  | "dialog"
  | "busy"
  | "won"
  | "caught";

export interface TerminalLine {
  tone: "info" | "good" | "bad" | "note";
  text: string;
}

/** Values the story can interpolate into lines with `{name}`. */
export interface RunVars {
  letter: string;
  value: number | null;
  shift: number;
  cipherChar: string | null;
  modulus: 15 | 21;
  base: number;
  numControl: number;
  e: number | null;
  d: number | null;
  p: number | null;
  q: number | null;
  cipherNumber: number | null;
  factors: string | null;
  order: number | null;
  /** Pre-formatted for display, e.g. "0.42". */
  crackMs: string | null;
  projectedYears: string | null;
  qpuName: string | null;
  /** Acts may stash extra numbers or strings without widening this file. */
  [key: string]: string | number | null | undefined;
}

export const DEFAULT_VARS: RunVars = {
  letter: "H",
  value: null,
  shift: 3,
  cipherChar: null,
  modulus: 15,
  base: 7,
  numControl: 4,
  e: null,
  d: null,
  p: null,
  q: null,
  cipherNumber: null,
  factors: null,
  order: null,
  crackMs: null,
  projectedYears: null,
  qpuName: null,
};

export interface DisplayLine {
  speaker: Speaker;
  text: string;
}

interface GameState {
  act: ActNumber;
  phase: Phase;
  suspicion: number;
  nodeId: string | null;
  lineIndex: number;
  lines: DisplayLine[];
  choicesVisible: boolean;
  /** True while the current node is handing control to a side panel. */
  awaitingPanel: boolean;
  feedback: string | null;
  busyLabel: string | null;
  panel: PanelKind | null;
  terminal: TerminalLine[];
  flags: Record<string, boolean>;
  vars: RunVars;
  near: Landmark | null;
  error: string | null;
  completedActs: ActNumber[];

  setAct: (act: ActNumber) => void;
  setPhase: (phase: Phase) => void;
  setNode: (nodeId: string, lines: DisplayLine[], awaitingPanel: boolean) => void;
  setLineIndex: (index: number) => void;
  setChoicesVisible: (visible: boolean) => void;
  setFeedback: (feedback: string | null) => void;
  setBusy: (label: string | null) => void;
  setPanel: (panel: PanelKind | null) => void;
  pushTerminal: (line: TerminalLine) => void;
  clearTerminal: () => void;
  setFlag: (name: string) => void;
  setVars: (patch: Partial<RunVars>) => void;
  setNear: (near: Landmark | null) => void;
  setError: (error: string | null) => void;
  addSuspicion: (amount: number) => number;
  markComplete: (act: ActNumber) => void;
  resetRun: (act: ActNumber) => void;
}

export const useGame = create<GameState>((set, get) => ({
  act: 1,
  phase: "exploring",
  suspicion: 0,
  nodeId: null,
  lineIndex: 0,
  lines: [],
  choicesVisible: false,
  awaitingPanel: false,
  feedback: null,
  busyLabel: null,
  panel: null,
  terminal: [],
  flags: {},
  vars: { ...DEFAULT_VARS },
  near: null,
  error: null,
  completedActs: [],

  setAct: (act) => set({ act }),
  setPhase: (phase) => set({ phase }),
  setNode: (nodeId, lines, awaitingPanel) =>
    set({
      nodeId,
      lines,
      lineIndex: 0,
      choicesVisible: false,
      feedback: null,
      awaitingPanel,
    }),
  setLineIndex: (lineIndex) => set({ lineIndex }),
  setChoicesVisible: (choicesVisible) => set({ choicesVisible }),
  setFeedback: (feedback) => set({ feedback }),
  setBusy: (busyLabel) => set({ busyLabel }),
  setPanel: (panel) => set({ panel }),
  pushTerminal: (line) => set((s) => ({ terminal: [...s.terminal, line] })),
  clearTerminal: () => set({ terminal: [] }),
  setFlag: (name) => set((s) => ({ flags: { ...s.flags, [name]: true } })),
  setVars: (patch) => set((s) => ({ vars: { ...s.vars, ...patch } })),
  setNear: (near) => set({ near }),
  setError: (error) => set({ error }),

  addSuspicion: (amount) => {
    const next = Math.min(100, Math.max(0, get().suspicion + amount));
    set({ suspicion: next });
    return next;
  },

  markComplete: (act) =>
    set((s) =>
      s.completedActs.includes(act)
        ? s
        : { completedActs: [...s.completedActs, act] },
    ),

  resetRun: (act) =>
    set({
      act,
      phase: "exploring",
      suspicion: 0,
      nodeId: null,
      lineIndex: 0,
      lines: [],
      choicesVisible: false,
      awaitingPanel: false,
      feedback: null,
      busyLabel: null,
      panel: null,
      terminal: [],
      flags: {},
      vars: { ...DEFAULT_VARS },
      error: null,
    }),
}));
