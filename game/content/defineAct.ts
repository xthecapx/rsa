import type { Landmark } from "@/engine/maps/street";
import type { ActNumber, ActScript, DialogNode } from "./types";

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
  opensAt: Landmark;
  objective: string;
  nodes: Nodes;
}): ActScript<Extract<keyof Nodes, string>> {
  assertReachable(script.act, script.nodes as Record<string, DialogNode<string>>);
  return script as ActScript<Extract<keyof Nodes, string>>;
}

/**
 * Belt and braces for the cases the type system cannot see, such as a node
 * that no longer has a way out.
 */
function assertReachable(
  act: ActNumber,
  nodes: Record<string, DialogNode<string>>,
): void {
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
    if (!node.choices?.length && !node.next && !node.ending && !node.waitsFor) {
      throw new Error(
        `${where}: is a dead end (needs next, choices, waitsFor, or ending)`,
      );
    }
  }
}
