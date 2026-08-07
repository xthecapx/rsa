import { bus } from "@/engine/bus";
import { useGame } from "./state";

export const SUSPICION_MAX = 100;
export const DEFAULT_SUSPICION_HIT = 25;

/** Bubble thresholds: Ale and Brayan start noticing something is off. */
const QUESTION_AT = 40;
const ALERT_AT = 70;

export type SuspicionBand = "calm" | "uneasy" | "alarmed";

export function bandFor(value: number): SuspicionBand {
  if (value >= ALERT_AT) return "alarmed";
  if (value >= QUESTION_AT) return "uneasy";
  return "calm";
}

export function labelFor(value: number): string {
  switch (bandFor(value)) {
    case "alarmed":
      return "They are looking straight at the junction box";
    case "uneasy":
      return "Someone on the line is asking questions";
    default:
      return "Nobody has noticed you";
  }
}

/**
 * Raise the meter and mirror it into the world. Returns true when the run is
 * blown, which the dialog runner turns into a jump to the act's `caught` node.
 */
export async function raiseSuspicion(amount: number): Promise<boolean> {
  const state = useGame.getState();
  const before = bandFor(state.suspicion);
  const value = state.addSuspicion(amount);
  const after = bandFor(value);

  if (after !== before) {
    const face = after === "alarmed" ? "alert" : after === "uneasy" ? "question" : "none";
    await bus.send({ type: "bubble", actor: "ale", face });
    await bus.send({ type: "bubble", actor: "brayan", face });
  }

  return value >= SUSPICION_MAX;
}

export async function clearSuspicionBubbles(): Promise<void> {
  await bus.send({ type: "bubble", actor: "ale", face: "none" });
  await bus.send({ type: "bubble", actor: "brayan", face: "none" });
}
