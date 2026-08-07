import type { BubbleKind, PacketStyle } from "@/engine/bus";
import type { Landmark } from "@/engine/maps/street";

export type ActNumber = 1 | 2 | 3 | 4;
export type Speaker = "ale" | "brayan" | "hacker" | "system";
export type CastMember = "ale" | "brayan" | "hacker";

/**
 * One line in the textbox. `text` may contain `{placeholders}` which are
 * filled in from the run's variables at display time -- see VARIABLES.md
 * style notes in content/index.ts for the list.
 */
export interface Line {
  speaker: Speaker;
  text: string;
}

/**
 * Backend calls the story can trigger. Arguments come from the run state
 * (chosen letter, modulus, base) rather than from the script, so writers never
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

/** Side panels the HUD can raise while a node is on screen. */
export type PanelKind = "terminal" | "uplink" | "letter";

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
  | { kind: "wait"; ms: number };

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
   * Hand control to a side panel. The node stays on screen until the panel
   * decides the player is done, which is how the quantum uplink works.
   */
  waitsFor?: PanelKind;
  /** Marks the node as the end of the act. */
  ending?: "win" | "caught";
}

export interface ActScript<Id extends string = string> {
  act: ActNumber;
  title: string;
  subtitle: string;
  /** One or two sentences shown on the act-select card. */
  brief: string;
  entry: Id;
  /** Jumped to when the suspicion meter fills. */
  caught: Id;
  /** Where the player has to walk before the act's opening dialog fires. */
  opensAt: Landmark;
  /** Prompt shown while the player is looking for that spot. */
  objective: string;
  nodes: Record<Id, DialogNode<Id>>;
}
