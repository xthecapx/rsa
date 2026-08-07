import type { ActNumber, ActScript, DialogNode, Effect, TaskSpec } from "./types";

/**
 * Wraps an act script so that every `next` has to name a node that actually
 * exists. The node ids are inferred from the keys of `nodes`, so a typo is a
 * TypeScript error at the call site rather than a dead end at runtime.
 */
export function defineAct<
  Nodes extends Record<string, DialogNode<Extract<keyof Nodes, string>>>,
>(script: {
  act: ActNumber;
  title: string;
  subtitle: string;
  brief: string;
  entry: Extract<keyof Nodes, string>;
  caught: Extract<keyof Nodes, string>;
  tasks: TaskSpec[];
  secret: "word" | "letter";
  nodes: Nodes;
}): ActScript<Extract<keyof Nodes, string>> {
  assertPlayable(
    script.act,
    script.nodes as Record<string, DialogNode<string>>,
    script.tasks,
  );
  return script as ActScript<Extract<keyof Nodes, string>>;
}

/**
 * Belt and braces for the cases the type system cannot see, such as a node
 * that no longer has a way out or a checklist item nothing ever ticks.
 */
function assertPlayable(
  act: ActNumber,
  nodes: Record<string, DialogNode<string>>,
  tasks: TaskSpec[],
): void {
  const taskIds = new Set(tasks.map((task) => task.id));
  const ticked = new Set<string>();

  for (const [id, node] of Object.entries(nodes)) {
    const where = `act ${act}, node "${id}"`;
    if (!node.lines.length) {
      throw new Error(`${where}: has no lines`);
    }

    const advancing = (node.choices ?? []).filter(
      (choice) => choice.outcome === "advance",
    );
    if (node.choices?.length && !advancing.length) {
      throw new Error(`${where}: every choice loops, the player cannot progress`);
    }
    for (const choice of advancing) {
      if (!choice.next) {
        throw new Error(`${where}: choice "${choice.label}" advances but has no next`);
      }
    }

    // A panel or a walk only makes sense if there is somewhere to come back to.
    if (node.waitsFor && !node.next) {
      throw new Error(`${where}: waitsFor "${node.waitsFor}" but has no next to return to`);
    }
    if (node.travelTo && node.next) {
      throw new Error(`${where}: has both travelTo and next, which is ambiguous`);
    }

    const hasExit =
      node.choices?.length || node.next || node.travelTo || node.ending;
    if (!hasExit) {
      throw new Error(
        `${where}: is a dead end (needs next, travelTo, choices, waitsFor, or ending)`,
      );
    }

    for (const effect of effectsOf(node)) {
      if (effect.kind !== "task") continue;
      if (!taskIds.has(effect.id)) {
        throw new Error(`${where}: ticks unknown task "${effect.id}"`);
      }
      ticked.add(effect.id);
    }
  }

  for (const task of tasks) {
    if (!ticked.has(task.id)) {
      throw new Error(`act ${act}: task "${task.id}" is never updated by any node`);
    }
  }
}

function effectsOf(node: DialogNode<string>): Effect[] {
  return [
    ...(node.onEnter ?? []),
    ...(node.choices ?? []).flatMap((choice) => choice.effects ?? []),
  ];
}
