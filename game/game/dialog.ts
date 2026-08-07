import type { ActNumber, ActScript, Choice, DialogNode } from "@/content/types";
import { getAct } from "@/content";
import { bus } from "@/engine/bus";
import { runEffects } from "./effects";
import { DEFAULT_SUSPICION_HIT, clearSuspicionBubbles, raiseSuspicion } from "./suspicion";
import { useGame } from "./state";
import type { DisplayLine } from "./state";

/**
 * Replaces `{name}` in a line with the run variable of the same name. Unknown
 * names are left alone so a typo in the script is visible rather than silent.
 */
export function fill(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

function script(act: ActNumber): ActScript {
  return getAct(act);
}

function nodeOf(act: ActNumber, id: string): DialogNode<string> {
  const node = script(act).nodes[id];
  if (!node) throw new Error(`Act ${act} has no node "${id}"`);
  return node;
}

function render(node: DialogNode<string>): DisplayLine[] {
  const { vars } = useGame.getState();
  return node.lines.map((line) => ({
    speaker: line.speaker,
    text: fill(line.text, vars),
  }));
}

async function enter(act: ActNumber, id: string): Promise<void> {
  const store = useGame.getState();
  const node = nodeOf(act, id);

  store.setPhase("busy");
  try {
    await runEffects(node.onEnter);
  } catch (error) {
    useGame.getState().setError(errorText(error));
  }

  const after = useGame.getState();
  after.setNode(id, render(node), Boolean(node.waitsFor));

  if (node.ending === "win") {
    after.setPhase("won");
    after.markComplete(act);
    void bus.send({ type: "lockInput", locked: false });
    return;
  }
  if (node.ending === "caught") {
    after.setPhase("caught");
    return;
  }
  after.setPhase("dialog");
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Pick the letter Ale sends this run. Acts 3 and 4 do modular arithmetic on
 * it, so the value has to be smaller than the modulus and coprime to it;
 * everywhere else any letter of the alphabet will do.
 */
function pickLetter(act: ActNumber, modulus: number): { letter: string; value: number } {
  const all = Array.from({ length: 26 }, (_, i) => i + 1);
  const usable =
    act >= 3 ? all.filter((v) => v < modulus && gcd(v, modulus) === 1) : all;
  const value = usable[Math.floor(Math.random() * usable.length)];
  return { letter: String.fromCharCode(64 + value), value };
}

/** Begin an act from its entry node. */
export async function startAct(act: ActNumber): Promise<void> {
  const store = useGame.getState();
  store.resetRun(act);
  const { modulus } = useGame.getState().vars;
  const { letter, value } = pickLetter(act, modulus);
  useGame.getState().setVars({
    letter,
    value,
    shift: 1 + Math.floor(Math.random() * 25),
  });
  await bus.send({ type: "reset" });
  await clearSuspicionBubbles();
  useGame.getState().setPhase("exploring");
}

/** Kick off the act's opening dialog (called once the world is ready). */
export async function openScene(act: ActNumber): Promise<void> {
  await bus.send({ type: "lockInput", locked: true });
  await enter(act, script(act).entry);
}

/** Space / click: reveal the next line, then the choices. */
export async function advance(): Promise<void> {
  const state = useGame.getState();
  if (state.phase !== "dialog") return;

  if (state.feedback) {
    state.setFeedback(null);
    state.setChoicesVisible(true);
    return;
  }

  if (state.lineIndex < state.lines.length - 1) {
    state.setLineIndex(state.lineIndex + 1);
    return;
  }

  const node = nodeOf(state.act, state.nodeId as string);
  if (node.choices?.length) {
    state.setChoicesVisible(true);
    return;
  }
  if (node.next) await enter(state.act, node.next);
}

/** Choices the player can currently see, after `requires` filtering. */
export function visibleChoices(): Choice<string>[] {
  const { act, nodeId, flags } = useGame.getState();
  if (!nodeId) return [];
  const node = nodeOf(act, nodeId);
  return (node.choices ?? []).filter(
    (choice) => !choice.requires || flags[choice.requires],
  );
}

export async function choose(index: number): Promise<void> {
  const state = useGame.getState();
  if (state.phase !== "dialog" || !state.choicesVisible) return;

  const choice = visibleChoices()[index];
  if (!choice) return;

  state.setChoicesVisible(false);
  state.setPhase("busy");

  try {
    await runEffects(choice.effects);
  } catch (error) {
    useGame.getState().setError(errorText(error));
  }

  if (choice.outcome === "advance") {
    await enter(state.act, choice.next as string);
    return;
  }

  if (choice.outcome === "suspicion") {
    const blown = await raiseSuspicion(choice.suspicion ?? DEFAULT_SUSPICION_HIT);
    if (blown) {
      await enter(state.act, script(state.act).caught);
      return;
    }
  }

  const after = useGame.getState();
  after.setFeedback(
    fill(choice.feedback ?? "That is not it. Look at the wire again.", after.vars),
  );
  after.setPhase("dialog");
}

/** Used by the uplink panel, which drives its own node transition. */
export async function goTo(id: string): Promise<void> {
  await enter(useGame.getState().act, id);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
