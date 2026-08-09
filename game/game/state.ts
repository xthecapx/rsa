import { create } from "zustand";

import type {
  ActNumber,
  PanelKind,
  Speaker,
  TaskSpec,
  TaskStatus,
} from "@/content/types";
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

export interface Task extends TaskSpec {
  status: TaskStatus;
}

/** What the listener pulled off the wire, waiting to be decoded. */
export interface Capture {
  payload: string;
  scheme: string;
}

/** Where the player has been told to walk next, and what happens there. */
export interface PendingTravel {
  at: Landmark;
  objective: string;
  next: string;
}

/** Values the story can interpolate into lines with `{name}`. */
export interface RunVars {
  /** The plaintext Ale actually sent. This is what the player has to report. */
  message: string;
  /** The numbers that crossed the wire, joined for display. */
  values: string;
  /** The encoded form on the wire, joined for display. */
  cipherText: string;
  /** First character of the message; acts 3 and 4 only ever send this much. */
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
  message: "",
  values: "",
  cipherText: "",
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
  /**
   * What the current node is blocked on, if anything. `workbench` means use
   * the laptop; `report` means answer the boss in the dialog.
   */
  waitingFor: PanelKind | null;
  feedback: string | null;
  busyLabel: string | null;
  panel: PanelKind | null;
  terminal: TerminalLine[];
  flags: Record<string, boolean>;
  vars: RunVars;
  near: Landmark | null;
  /** True while the player sprite is between tiles. */
  walking: boolean;
  error: string | null;
  completedActs: ActNumber[];
  tasks: Task[];
  pendingTravel: PendingTravel | null;
  capture: Capture | null;
  /** Why the last report to the client was rejected. */
  reportError: string | null;
  /** Full-screen laptop overlay; independent of street dialog phase. */
  laptopOpen: boolean;

  setAct: (act: ActNumber) => void;
  setPhase: (phase: Phase) => void;
  setNode: (nodeId: string, lines: DisplayLine[], waitingFor: PanelKind | null) => void;
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
  setWalking: (walking: boolean) => void;
  setError: (error: string | null) => void;
  addSuspicion: (amount: number) => number;
  markComplete: (act: ActNumber) => void;
  resetRun: (act: ActNumber) => void;
  setTasks: (tasks: Task[]) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  setPendingTravel: (travel: PendingTravel | null) => void;
  setCapture: (capture: Capture | null) => void;
  setReportError: (message: string | null) => void;
  setLaptopOpen: (open: boolean) => void;
}

export const useGame = create<GameState>((set, get) => ({
  act: 1,
  phase: "exploring",
  suspicion: 0,
  nodeId: null,
  lineIndex: 0,
  lines: [],
  choicesVisible: false,
  waitingFor: null,
  feedback: null,
  busyLabel: null,
  panel: null,
  terminal: [],
  flags: {},
  vars: { ...DEFAULT_VARS },
  near: null,
  walking: false,
  error: null,
  completedActs: [],
  tasks: [],
  pendingTravel: null,
  capture: null,
  reportError: null,
  laptopOpen: false,

  setAct: (act) => set({ act }),
  setPhase: (phase) => set({ phase }),
  setNode: (nodeId, lines, waitingFor) =>
    set({
      nodeId,
      lines,
      lineIndex: 0,
      choicesVisible: false,
      feedback: null,
      reportError: null,
      waitingFor,
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
  setWalking: (walking) => set({ walking }),
  setError: (error) => set({ error }),
  setTasks: (tasks) => set({ tasks }),
  setTaskStatus: (id, status) =>
    set((s) => ({
      tasks: s.tasks.map((task) => (task.id === id ? { ...task, status } : task)),
    })),
  setPendingTravel: (pendingTravel) => set({ pendingTravel }),
  setCapture: (capture) => set({ capture }),
  setReportError: (reportError) => set({ reportError }),
  setLaptopOpen: (laptopOpen) => set({ laptopOpen }),

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
      waitingFor: null,
      feedback: null,
      busyLabel: null,
      panel: null,
      terminal: [],
      flags: {},
      vars: { ...DEFAULT_VARS },
      walking: false,
      error: null,
      tasks: [],
      pendingTravel: null,
      capture: null,
      reportError: null,
      laptopOpen: false,
    }),
}));

// Handy from the browser console, and the only way an end-to-end test can see
// where the story actually is.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { useGame: typeof useGame }).useGame = useGame;
}
