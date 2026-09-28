/**
 * Act 4 as a software engineer sees it: five black boxes on a rail and the
 * wires between them. The player never opens the Shor circuit; the lesson is
 * that a quantum processor is one stage in a classical program, and that the
 * order of the stages is what makes the program work.
 *
 * `Pipeline` is the serialisable result. The battle system will read the same
 * shape later, so nothing in here depends on React or on the game store.
 */

export type BoxId = "classical-in" | "qpu-setup" | "shor" | "measure" | "classical-out";
export type Backend = "aer" | "ibm";

export interface Box {
  id: BoxId;
  title: string;
  /** One line about what the box does, shown under its title. */
  role: string;
  /** The chip this box emits, to be wired into the next box. */
  emits?: { label: string; caption: string };
}

/** Left to right (top to bottom on a phone). Fixed order, fixed boxes. */
export const RAIL: readonly Box[] = [
  { id: "classical-in", title: "Classical PC", role: "Reads the capture, picks a, checks gcd(a, N).", emits: { label: "N, a", caption: "the problem" } },
  { id: "qpu-setup", title: "QPU setup", role: "Which machine, how many counting qubits, how many shots.", emits: { label: "job", caption: "N, a, m, shots" } },
  { id: "shor", title: "Shor circuit", role: "Black box. Puts every power of a mod N into superposition.", emits: { label: "quantum state", caption: "the period hidden in phases" } },
  { id: "measure", title: "Measure", role: "Reads the counting register once per shot.", emits: { label: "counts", caption: "bitstring → shots" } },
  { id: "classical-out", title: "Classical PC", role: "counts → phase → r → p, q → d → message." },
];

export const WIRES = RAIL.length - 1;

export function boxIndex(id: BoxId): number {
  return RAIL.findIndex((box) => box.id === id);
}

export function boxOf(id: BoxId): Box {
  return RAIL[boxIndex(id)];
}

/** The box a chip belongs in: always the next one down the rail. */
export function expectedTarget(source: BoxId): BoxId | null {
  return RAIL[boxIndex(source) + 1]?.id ?? null;
}

/**
 * Why a wire is wrong. Each message is a fact about the data, not about the
 * game, so a wrong drop still teaches something.
 */
export function wireFeedback(source: BoxId, target: BoxId): string {
  if (boxIndex(target) <= boxIndex(source)) {
    return "Data flows one way down the rail. An output can only feed a box further along.";
  }
  const key = `${source}>${target}`;
  switch (key) {
    case "classical-in>shor":
      return "The circuit is not fed raw numbers. The QPU setup turns N and a into a job the machine can run.";
    case "classical-in>measure":
      return "Nothing has run yet, so there is nothing to measure.";
    case "classical-in>classical-out":
      return "Handing the problem straight to another classical PC is trial division. The QPU has to sit in between.";
    case "qpu-setup>measure":
      return "A job is a request. The circuit has to run before a register exists to measure.";
    case "qpu-setup>classical-out":
      return "A classical PC cannot read a job. It needs measurement counts.";
    case "shor>classical-out":
      return "A classical PC cannot read a quantum state. It has to be measured first, and measuring collapses it.";
    default:
      return "That output does not fit here. Follow the data one box at a time.";
  }
}

export interface PipelineNode {
  id: BoxId;
  params: Record<string, string | number | boolean | null>;
}

export interface PipelineEdge {
  from: BoxId;
  to: BoxId;
  carries: string;
}

/** What the player built, in a shape the battle system can replay. */
export interface Pipeline {
  version: 1;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export function buildPipeline(params: Partial<Record<BoxId, PipelineNode["params"]>>): Pipeline {
  return {
    version: 1,
    nodes: RAIL.map((box) => ({ id: box.id, params: params[box.id] ?? {} })),
    edges: RAIL.slice(0, -1).map((box, i) => ({ from: box.id, to: RAIL[i + 1].id, carries: box.emits?.label ?? "" })),
  };
}
