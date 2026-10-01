import type { BenchCase, Gate } from "@/game/qubit";
import type { RegOp, RegPiece, RegTarget } from "@/game/register";
import type { CryptoSlot } from "@/game/crypto";
import type { Speaker } from "./types";

/**
 * Knowledge cards and the neighbor activities that teach them, shared by every
 * town. Each town owns its own cards; the ids live here so one store can keep
 * them all and old saves stay valid as towns are added.
 */
export type CoinKnowledgeId = "bits" | "four-states" | "phase" | "interference" | "basis";
export type FoundryKnowledgeId = "register" | "spread" | "stamp" | "mirror" | "rounds";
export type HollowKnowledgeId = "control" | "flipproof" | "kickback" | "parity" | "onequestion";
export type CipherKnowledgeId = "encoding" | "keyspace" | "clock" | "padlock" | "rhythm";
export type KnowledgeId = CoinKnowledgeId | FoundryKnowledgeId | HollowKnowledgeId | CipherKnowledgeId;
export const COIN_KNOWLEDGE_IDS: CoinKnowledgeId[] = ["bits", "four-states", "phase", "interference", "basis"];
export const FOUNDRY_KNOWLEDGE_IDS: FoundryKnowledgeId[] = ["register", "spread", "stamp", "mirror", "rounds"];
export const HOLLOW_KNOWLEDGE_IDS: HollowKnowledgeId[] = ["control", "flipproof", "kickback", "parity", "onequestion"];
export const CIPHER_KNOWLEDGE_IDS: CipherKnowledgeId[] = ["encoding", "keyspace", "clock", "padlock", "rhythm"];
export const ALL_KNOWLEDGE_IDS: KnowledgeId[] = [...COIN_KNOWLEDGE_IDS, ...FOUNDRY_KNOWLEDGE_IDS, ...HOLLOW_KNOWLEDGE_IDS, ...CIPHER_KNOWLEDGE_IDS];

export interface KnowledgeCard {
  id: KnowledgeId;
  glyph: string;
  title: string;
  text: string;
  /** Written with kets only, shown as-is in every language. */
  formula: string;
  /** Where the card pays off later. */
  hint: string;
}

export interface Line { speaker: Speaker; text: string }

/** One-qubit bench: drag X, Z and H onto a wire. */
export interface BenchStep {
  kind: "bench"; title: string; text: string;
  cases: BenchCase[]; slots: number; gates: Gate[];
  /** Every slot must hold a gate. */
  fill?: boolean;
  /** Draw the last H as interfering ripples. */
  waves?: boolean;
  feedback: string;
}
/** A register picture drawn beside a question: amplitudes over the basis states. */
export interface QuestionBars {
  qubits: number; start: string; ops: RegOp[];
  /** Draw the average as a dashed line. */
  mean?: boolean;
  /** Once answered correctly, also draw the register after these pieces. */
  after?: RegOp[];
  /** Captions for the before and after pictures. */
  titles?: [string, string];
}
export interface QuestionStep {
  kind: "question"; title: string; text: string;
  options: { label: string; correct?: boolean; wrong?: string }[];
  /** After any answer, show H acting on |+⟩ as ripples. */
  waves?: boolean;
  bars?: QuestionBars;
  feedback: string;
}
/** Several-qubit bench: drag register pieces onto a line and watch the amplitude bars. */
export interface RegisterStep {
  kind: "register"; title: string; text: string;
  qubits: number;
  /** A basis state such as "00", or "even" for the spread one H box makes. */
  start: string;
  /** Columns of the circuit, and the pieces the tray offers. */
  slots: number; tray: RegPiece[];
  target: RegTarget;
  /** The last wire is the helper: CNOT pieces flip it, and each wire's state is shown at the output. */
  helper?: boolean;
  /** Boxes already bolted to the bench after the player's slots, e.g. the ghost answering. */
  fixed?: RegOp[];
  /** Plain words for the goal, shown under the bars. */
  goal: string;
  fill?: boolean;
  feedback: string;
}
/** Pick how many Oracle + Diffuser rounds to run; solved at the tallest peak. */
export interface RoundsStep {
  kind: "rounds"; title: string; text: string;
  qubits: number; marked: string;
  /** The round count with the tallest marked bar (checked by the tests). */
  answer: number;
  feedback: string;
}
/** The picture beside a crypto bench: the A1Z26 table, a Caesar wheel, a clock face, or the powers of a number. */
export type CryptoAid =
  | { kind: "table" }
  | { kind: "wheel"; key: number }
  | { kind: "clock"; n: number }
  | { kind: "powers"; base: number; n: number; upTo: number };
/** Drag number and letter tiles into labelled slots; tiles never run out. */
export interface CryptoStep {
  kind: "crypto"; title: string; text: string;
  aid?: CryptoAid;
  slots: CryptoSlot[];
  tray: string[];
  feedback: string;
  /** Values for `{placeholders}` in the text and feedback, filled in after translation. */
  vars?: Record<string, string | number>;
}
/** Turn a Caesar wheel until the ciphertext reads as a word. */
export interface DialStep {
  kind: "dial"; title: string; text: string;
  cipher: string;
  /** The shift that decodes it (checked by the tests). */
  key: number;
  feedback: string;
  vars?: Record<string, string | number>;
}
export type ActivityStep = BenchStep | QuestionStep | RegisterStep | RoundsStep | CryptoStep | DialStep;

/** A neighbor who teaches one card. Towns without a card (greeters, wardens) leave `knowledge` out. */
export interface TownNpc<Id extends string = string> {
  id: Id;
  title: string;
  /** Short role under the name on the job sheet. */
  description: string;
  at: { x: number; y: number };
  knowledge?: KnowledgeId;
  intro: Line[];
  steps: ActivityStep[];
  outro: Line[];
  repeat: Line[];
}

/** Decor sprites drawn by tools/gen_npc_sprites.cjs; tall props are two tiles, top over base. */
export type PropSprite = "stack-top" | "stack-base" | "silo-top" | "silo-base" | "belt" | "press-top" | "press-base" | "crane-top" | "crane-base" | "sign"
  | "grave" | "cross" | "deadtree-top" | "deadtree-base" | "pumpkin" | "lantern" | "crypt-top" | "crypt-base" | "bell-top" | "bell-base" | "candles"
  | "rack" | "antenna-top" | "antenna-base" | "dish" | "neon" | "reel" | "crt" | "arcade" | "djbooth" | "vending" | "phonebooth" | "stall" | "board" | "lockers" | "keykiosk" | "mural" | "gate-bar" | "gate-lock";
export interface PropSpec { sprite: PropSprite; at: { x: number; y: number } }
