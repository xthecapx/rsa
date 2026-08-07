import type { ActNumber, ActScript, Choice, DialogNode } from "@/content/types";
import { getAct } from "@/content";
import { bus } from "@/engine/bus";
import type { Landmark } from "@/engine/maps/street";
import { runEffects } from "./effects";
import { fill } from "./interpolate";
import { DEFAULT_SUSPICION_HIT, clearSuspicionBubbles, raiseSuspicion } from "./suspicion";
import { pickSecret } from "./secret";
import { useGame } from "./state";
import type { DisplayLine } from "./state";

/** Suspicion added when the client is handed the wrong plaintext. */
const WRONG_REPORT_HIT = 20;

export { fill } from "./interpolate";

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
  after.setPendingTravel(null);

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

/**
 * Begin an act: reset the run, roll this run's secret, put the checklist up,
 * and play the opening scene. Nothing has to be walked to first -- the act
 * explains itself before it asks the player for anything.
 */
export async function startAct(act: ActNumber): Promise<void> {
  const current = script(act);
  const store = useGame.getState();
  store.resetRun(act);

  const { modulus } = useGame.getState().vars;
  const secret = pickSecret(current.secret, modulus);
  useGame.getState().setVars({
    message: secret.message,
    letter: secret.letter,
    value: secret.value,
    shift: 1 + Math.floor(Math.random() * 25),
  });
  useGame.getState().setTasks(
    current.tasks.map((task) => ({ ...task, status: "pending" as const })),
  );

  await bus.send({ type: "reset" });
  await clearSuspicionBubbles();
  await bus.send({ type: "lockInput", locked: true });
  await enter(act, current.entry);
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
  if (node.travelTo) {
    await handOverToPlayer(node.travelTo);
    return;
  }
  // A panel node also has a `next`, but only the panel is allowed to take it.
  if (node.waitsFor) return;
  if (node.next) await enter(state.act, node.next);
}

/** Give the street back so the player can walk to the next landmark. */
async function handOverToPlayer(travelTo: {
  at: Landmark;
  objective: string;
  next: string;
}): Promise<void> {
  const store = useGame.getState();
  store.setPendingTravel({
    ...travelTo,
    objective: fill(travelTo.objective, store.vars),
  });
  store.setPhase("exploring");
  await bus.send({ type: "lockInput", locked: false });
}

/**
 * The player pressed Space next to a landmark. Only the one the story is
 * waiting on does anything, so the rest of the street stays quiet.
 */
export async function interactAt(target: Landmark): Promise<void> {
  const state = useGame.getState();
  if (state.phase !== "exploring") return;
  const travel = state.pendingTravel;
  if (!travel || travel.at !== target) return;

  state.setPendingTravel(null);
  await bus.send({ type: "lockInput", locked: true });
  await enter(state.act, travel.next);
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

/**
 * A `waitsFor` panel reporting that the player is finished with it. The node
 * says where that leads, so panels never hard-code a node id.
 */
export async function resolvePanel(): Promise<void> {
  const { act, nodeId } = useGame.getState();
  if (!nodeId) return;
  const node = nodeOf(act, nodeId);
  if (!node.waitsFor || !node.next) return;
  await enter(act, node.next);
}

/**
 * Hand a plaintext to the client. A wrong answer costs suspicion and leaves
 * the player on the same node, so they go back to the workbench rather than
 * losing the act outright.
 */
export async function submitReport(answer: string): Promise<void> {
  const state = useGame.getState();
  const { act, nodeId } = state;
  if (!nodeId) return;

  const node = nodeOf(act, nodeId);
  if (node.waitsFor !== "report") return;

  const given = answer.trim().toUpperCase().replace(/\s+/g, "");
  if (!given) return;

  if (given === String(state.vars.message).toUpperCase()) {
    state.setReportError(null);
    if (node.next) await enter(act, node.next);
    return;
  }

  const blown = await raiseSuspicion(node.report?.suspicion ?? WRONG_REPORT_HIT);
  if (blown) {
    await enter(act, script(act).caught);
    return;
  }

  const after = useGame.getState();
  after.setReportError(
    fill(
      node.report?.wrong ??
        "That is not what crossed the wire. Read it again before you say it out loud.",
      after.vars,
    ),
  );
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
