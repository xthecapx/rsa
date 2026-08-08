import type { BubbleKind, PacketStyle } from "@/engine/bus";
import type { Landmark } from "@/engine/maps/street";

export type ActNumber = 1 | 2 | 3 | 4;
export type Speaker = "ale" | "brayan" | "hacker" | "boss" | "system";
export type CastMember = "ale" | "brayan" | "hacker";

/**
 * One line in the textbox. `text` may contain `{placeholders}` which are
 * filled in from the run's variables at display time -- see the list in
 * content/index.ts.
 */
export interface Line {
  speaker: Speaker;
  text: string;
}

/**
 * Backend calls the story can trigger. Arguments come from the run state
 * (chosen message, modulus, base) rather than from the script, so writers never
 * have to think about payloads.
 */
export type ApiCallName =
  | "plaintext"
  | "caesarEncrypt"
  | "caesarCrack"
  | "rsaKeygen"
  | "rsaEncrypt"
  | "rsaDecrypt"
  | "rsaCrack"
  | "shorPlan"
  | "shorSimulate"
  /** Turn recovered factors into the private exponent and read the message. */
  | "deriveKey";

/**
 * What the middle of the sidebar shows while a node is on screen. The
 * objectives list and the log are always visible either side of it.
 */
export type PanelKind = "workbench" | "report";

export type TaskStatus = "pending" | "active" | "done";

/** One line of the act's checklist, as written in the script. */
export interface TaskSpec {
  id: string;
  label: string;
}

export type Effect =
  | { kind: "api"; call: ApiCallName; label?: string }
  | { kind: "walkTo"; target: Landmark }
  | { kind: "face"; target: Landmark }
  | {
      kind: "packet";
      style: PacketStyle;
      from: Landmark;
      to: Landmark;
      intercept?: boolean;
    }
  | { kind: "bubble"; actor: CastMember; face: BubbleKind }
  | { kind: "tapGlow"; on: boolean }
  | { kind: "flag"; set: string }
  | { kind: "panel"; open: PanelKind | null }
  | { kind: "terminal"; text: string }
  | { kind: "wait"; ms: number }
  /** Tick the act checklist along. `id` must be one of the act's tasks. */
  | { kind: "task"; id: string; status: TaskStatus }
  /**
   * Hand the intercepted payload to the workbench. Both strings are
   * interpolated, so a script writes e.g. `payload: "{cipherText}"`.
   */
  | { kind: "capture"; payload: string; scheme: string };

/**
 * What picking a choice does.
 * - `advance`  the player read the situation correctly; move to `next`
 * - `retry`    a harmless misconception; show `feedback` and re-offer the choices
 * - `suspicion` reckless; raises the meter, shows `feedback`, re-offers the choices
 */
export type ChoiceOutcome = "advance" | "retry" | "suspicion";

export interface Choice<Id extends string> {
  label: string;
  outcome: ChoiceOutcome;
  /** Only for `suspicion` choices. Defaults to 25 of 100. */
  suspicion?: number;
  /** Shown after a retry or a suspicion hit so the player learns why. */
  feedback?: string;
  effects?: Effect[];
  next?: Id;
  /** Hide this choice until the flag has been set. */
  requires?: string;
}

export interface DialogNode<Id extends string> {
  lines: Line[];
  /** Run before the first line is shown. */
  onEnter?: Effect[];
  choices?: Choice<Id>[];
  /** Where to go once the lines are read out, when there are no choices. */
  next?: Id;
  /**
   * Give the street back to the player. The node's lines play, then control
   * returns until the player walks to `at` and presses Space, which enters
   * `next`. This is what turns an act into a route rather than a cutscene.
   */
  travelTo?: { at: Landmark; objective: string; next: Id };
  /**
   * Hand control to something outside the line-advance loop. The node stays
   * on screen until that thing finishes, which enters `next`.
   * - `workbench` — decode tools in the laptop panel
   * - `report` — type the plaintext to the boss in the dialog
   */
  waitsFor?: PanelKind;
  /** Tuning for a `waitsFor: "report"` node. */
  report?: {
    /** Suspicion added per wrong answer. Defaults to 20 of 100. */
    suspicion?: number;
    /** Shown under the dialog field when the answer is wrong. */
    wrong?: string;
  };
  /** Marks the node as the end of the act. */
  ending?: "win" | "caught";
}

export interface ActScript<Id extends string = string> {
  act: ActNumber;
  title: string;
  subtitle: string;
  /** One or two sentences shown on the act-select card. */
  brief: string;
  /** Plays as soon as the act loads; no walking required. */
  entry: Id;
  /** Jumped to when the suspicion meter fills. */
  caught: Id;
  /** The checklist down the right-hand side. */
  tasks: TaskSpec[];
  /**
   * How long the secret is. Acts doing modular arithmetic have to stay on a
   * single letter, because the toy modulus cannot carry a value above itself.
   */
  secret: "word" | "letter";
  nodes: Record<Id, DialogNode<Id>>;
}
