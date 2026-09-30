import { FOUNDRY_KNOWLEDGE_IDS, type FoundryKnowledgeId, type KnowledgeCard, type Line, type RegisterStep, type TownNpc } from "./knowledge";
import type { RegPiece, RegTarget } from "@/game/register";
import type { AnimalSpec } from "./coinTown";

/**
 * Foundry Town: east of Coin Town, where Professor Thecap keeps a workshop.
 * Its challenge is the Echo Chamber (Grover's search); the factory hands each
 * teach one piece the search is built from. As in Coin Town, no card is needed
 * for the workshop, but the Foundry Badge needs the lesson and all five cards.
 */
export const KNOWLEDGE_IDS = FOUNDRY_KNOWLEDGE_IDS;

export const KNOWLEDGE: Record<FoundryKnowledgeId, KnowledgeCard> = {
  register: {
    id: "register", glyph: "▦", title: "Registers",
    text: "Two qubits have four basis states, |00⟩, |01⟩, |10⟩ and |11⟩. Every extra qubit doubles the count: n qubits hold 2ⁿ states.",
    formula: "2 qubits → 4 states · 4 qubits → 16", hint: "The drone core’s four switches are a four-qubit register.",
  },
  spread: {
    id: "spread", glyph: "≡", title: "Even spread",
    text: "One H box on every qubit spreads the register evenly: each of the N states gets amplitude 1/√N, so each reads with probability 1/N.",
    formula: "H⊗H|00⟩ = ½(|00⟩ + |01⟩ + |10⟩ + |11⟩)", hint: "Grover starts by asking every PIN at once.",
  },
  stamp: {
    id: "stamp", glyph: "O", title: "The Oracle",
    text: "The Oracle is a sealed box that knows the answer. It marks that one state with a minus sign and leaves the rest alone. Squares hide the minus, so measuring right after still gives every state the same odds.",
    formula: "Oracle: O|x⟩ = −|x⟩ only for the answer x", hint: "The drone core’s Oracle knows the PIN but only flips a sign.",
  },
  mirror: {
    id: "mirror", glyph: "⇅", title: "Mirror at the average",
    text: "The Diffuser reflects every amplitude about the average: a becomes 2·mean − a. The state the Oracle marked was below the average, so it lands far above it.",
    formula: "a → 2·ā − a", hint: "Oracle, then Diffuser: one Grover round.",
  },
  rounds: {
    id: "rounds", glyph: "↻", title: "Don’t over-turn",
    text: "Each round turns the register a little closer to the answer. About π/4·√N rounds reach the top; more rounds turn past it and the answer shrinks again.",
    formula: "rounds ≈ π/4 · √N", hint: "Sixteen PINs need three rounds.",
  },
};

export type FoundryNpcId = "vpcap" | "rosa" | "paco" | "ines" | "joaquin" | "vera";
export type FoundryNpc = TownNpc<FoundryNpcId>;

const register = (title: string, text: string, qubits: number, start: string, slots: number, tray: RegPiece[], target: RegTarget, goal: string, feedback: string, fill = false): RegisterStep =>
  ({ kind: "register", title, text, qubits, start, slots, tray, target, goal, feedback, fill });
const HALF = 0.5;

export const FOUNDRY_NPCS: FoundryNpc[] = [
  {
    id: "rosa", title: "Rosa", description: "Switchboard operator · control room", at: { x: 9, y: 10 }, knowledge: "register",
    intro: [
      { speaker: "rosa", text: "Control room, Rosa speaking. Every line on my board is a qubit, and two lines together make a register." },
      { speaker: "rosa", text: "One qubit has two states. Two qubits have four: |00⟩, |01⟩, |10⟩ and |11⟩. The first digit is line 1, the second is line 2." },
    ],
    steps: [
      register("Patch line 1", "Both wires start at |00⟩. Patch the board so it reads |10⟩.", 2, "00", 1, ["X"], { basis: "10" },
        "Reach |10⟩: line 1 on, line 2 off.", "X on line 1 turns |00⟩ into |10⟩. The bar moved to the state whose first digit is 1."),
      register("Both lines", "Start at |00⟩ again. Put an X on each wire and end on |11⟩.", 2, "00", 1, ["X"], { basis: "11" },
        "Reach |11⟩: both lines on.", "X on each line: |00⟩ → |10⟩ → |11⟩. Each line flips on its own."),
      { kind: "question", title: "Count the states", text: "The drone core in Thecap’s workshop has four switches, one qubit each. How many basis states does its register have?", options: [
        { label: "16", correct: true },
        { label: "8", wrong: "8 is 2³: three qubits. Every extra qubit doubles the count once more." },
        { label: "4", wrong: "4 is the number of qubits. The states double with each qubit: 2 · 2 · 2 · 2." },
      ], feedback: "Right: 2⁴ = 16. That’s sixteen PINs." },
    ],
    outro: [{ speaker: "rosa", text: "Sixteen states on four lines. Paco in the silo yard says you can light them all at once." }],
    repeat: [{ speaker: "rosa", text: "Every line is a qubit, and every pattern of lines is a state. The board never lies." }],
  },
  {
    id: "paco", title: "Paco", description: "Paint mixer · silo yard", at: { x: 8, y: 23 }, knowledge: "spread",
    intro: [
      { speaker: "paco", text: "Paco, paint mixer. One H on one qubit gave you a fair coin, right? Put an H on every qubit and you get a fair die with 2ⁿ sides." },
      { speaker: "paco", text: "Same amount of paint in every pot: each state gets amplitude 1/√N. Watch the bars come out level." },
    ],
    steps: [
      register("Level every pot", "Start at |00⟩. Place the H box so all four bars come out level.", 2, "00", 1, ["H", "X"], { amplitudes: [HALF, HALF, HALF, HALF] },
        "Four level bars, every amplitude ½.", "H on both qubits: ½(|00⟩ + |01⟩ + |10⟩ + |11⟩). Each state reads with probability ¼."),
      register("A messy start", "This register starts at |10⟩. Fill both slots and still get four level bars, all positive.", 2, "10", 2, ["H", "X"], { amplitudes: [HALF, HALF, HALF, HALF] },
        "Four level bars, every amplitude +½.", "Clean the start first: X on line 1 takes |10⟩ back to |00⟩, then H spreads it evenly. H straight on |10⟩ leaves two minus signs.", true),
      { kind: "question", title: "Sixteen pots", text: "The H box goes on all four qubits of the drone core. What is the chance of reading any one PIN?", options: [
        { label: "1 in 16", correct: true },
        { label: "1 in 4", wrong: "That’s for two qubits. Four qubits have sixteen states sharing the paint." },
        { label: "1 in 2", wrong: "Each single qubit is 50/50, but a PIN needs all four digits right: ½ · ½ · ½ · ½." },
      ], feedback: "Right: amplitude ¼, probability 1/16. Every PIN is equally likely, so far." },
    ],
    outro: [{ speaker: "paco", text: "Level pots, every time. Inés on the line runs the Oracle, the box that marks the one that matters." }],
    repeat: [{ speaker: "paco", text: "An H on every qubit: every state, the same amount of paint." }],
  },
  {
    id: "ines", title: "Inés", description: "Quality inspector · the Oracle, conveyor line", at: { x: 21, y: 20 }, knowledge: "stamp",
    intro: [
      { speaker: "ines", text: "Inés, quality control. I run this line’s Oracle. Every crate looks the same, but the Oracle knows which one we’re looking for and marks it with a minus sign." },
      { speaker: "ines", text: "In quantum terms, an Oracle is a sealed box: it knows the answer and marks it by flipping the sign of that one state. Nothing else. On the bench it’s the O box." },
    ],
    steps: [
      register("Pick the right Oracle", "The register comes down the line evenly spread. Use the Oracle that marks only |10⟩.", 2, "even", 1, ["oracle:01", "oracle:10", "oracle:11"], { amplitudes: [HALF, HALF, -HALF, HALF] },
        "Only the |10⟩ bar points down.", "The |10⟩ Oracle: ½(|00⟩ + |01⟩ − |10⟩ + |11⟩). One bar flipped below the line; the others didn’t move."),
      { kind: "question", title: "Measure after the Oracle", text: "You measure the register right after the Oracle. What are the odds for |10⟩?", bars: { qubits: 2, start: "00", ops: ["H", "oracle:10"] }, options: [
        { label: "Still 25%, like every other state", correct: true },
        { label: "0%: the minus removes it", wrong: "A minus never removes a state: (−½)² is still ¼." },
        { label: "100%: it is marked", wrong: "If only! The Oracle’s mark is invisible to a measurement. Joaquín’s press, the Diffuser, turns it into something you can see." },
      ], feedback: "Right. The Oracle’s mark is real, but squares hide it. The Diffuser makes it count." },
    ],
    outro: [{ speaker: "ines", text: "A mark you can’t measure. Joaquín’s press, the Diffuser, turns my Oracle’s mark into the tallest crate on the line." }],
    repeat: [{ speaker: "ines", text: "One Oracle, one minus, one state. Everything else passes untouched." }],
  },
  {
    id: "joaquin", title: "Joaquín", description: "Press operator · stamping press", at: { x: 31, y: 19 }, knowledge: "mirror",
    intro: [
      { speaker: "joaquin", text: "Joaquín. My press is the Diffuser: it flips every bar about the average height." },
      { speaker: "joaquin", text: "A bar above the average ends up just as far below it, and a bar below ends up just as far above. The formula is 2·mean − a." },
    ],
    steps: [
      { kind: "question", title: "Work the press", text: "After Inés’s Oracle the bars are amplitudes, not chances: +½, +½, +½ and −½. The dashed line is their average, +¼. The press mirrors each bar across that line: new = 2 · ¼ − old. What does the marked −½ become?", bars: { qubits: 2, start: "00", ops: ["H", "oracle:11"], mean: true, after: ["D"] }, options: [
        { label: "1", correct: true },
        { label: "½", wrong: "2 · ¼ − (−½) = ½ + ½ = 1. Remember to subtract a negative." },
        { label: "0", wrong: "0 is what the unmarked bars become: 2 · ¼ − ½ = 0." },
      ], feedback: "Right. The marked bar sat ¾ below the average, so the press puts it ¾ above: ¼ + ¾ = 1. Each unmarked bar sat ¼ above, so it lands ¼ below… at 0. Now |11⟩ reads 100% of the time." },
      register("One full round", "Start at |00⟩. Build one Grover round, H, then the Oracle, then the Diffuser, that makes |11⟩ certain.", 2, "00", 3, ["H", "oracle:11", "D", "X"], { marked: "11", atLeast: 0.999 },
        "Read |11⟩ with probability 100%.", "H spreads, the Oracle marks |11⟩, and the Diffuser lifts it to 1. With four states, one round is exactly enough.", true),
    ],
    outro: [{ speaker: "joaquin", text: "Oracle, then Diffuser. That’s one round of Grover. Thecap’s drone core needs more rounds than that; Vera at the dock knows how many." }],
    repeat: [{ speaker: "joaquin", text: "Everything flips about the average. Bars the Oracle marked come out on top." }],
  },
  {
    id: "vera", title: "Vera", description: "Crane operator · loading dock", at: { x: 33, y: 26 }, knowledge: "rounds",
    intro: [
      { speaker: "vera", text: "Vera, crane. Every Grover round swings the load a little closer to the answer. Swing too far and it goes right past." },
      { speaker: "vera", text: "Eight crates on three lines this time. Try different round counts and stop where the crate the Oracle marked is tallest." },
    ],
    steps: [
      { kind: "rounds", title: "Stop at the top", text: "Three qubits, eight states, and the Oracle marks |101⟩. Choose how many Oracle + Diffuser rounds to run and find the tallest |101⟩ bar.", qubits: 3, marked: "101", answer: 2,
        feedback: "Two rounds: about 94.5%. A third round swings past, down to about 33%. Grover is a rotation, not a ladder." },
      { kind: "question", title: "Sixteen PINs", text: "The formula says about π/4 · √N rounds. How many rounds for the sixteen PINs of the drone core?", options: [
        { label: "3", correct: true },
        { label: "4", wrong: "√16 = 4, then π/4 · 4 ≈ 3.14. Round to three, or the load swings past." },
        { label: "16", wrong: "That’s checking every PIN by hand. Grover needs only about √N rounds." },
      ], feedback: "Right: π/4 · 4 ≈ 3. Three rounds, about 96%." },
    ],
    outro: [{ speaker: "vera", text: "Three rounds for sixteen crates. When the whiteboard asks, you already know." }],
    repeat: [{ speaker: "vera", text: "Swing, swing, stop. Past the top it only comes back down." }],
  },
  {
    id: "vpcap", title: "VP Cap", description: "VP of engineering · west gate", at: { x: 4, y: 13 },
    intro: [], steps: [], outro: [], repeat: [],
  },
];

export function foundryNpc(id: FoundryNpcId): FoundryNpc {
  return FOUNDRY_NPCS.find((npc) => npc.id === id)!;
}

/** VP Cap's lines, picked from the player's progress. Cousin of Mayor Cap and of Professor Thecap. */
export const VP = {
  welcome: { speaker: "vpcap", text: "Welcome to Foundry Town! I’m Cap, VP of engineering. My cousin the mayor said a sharp one was coming up the east road. Here we don’t build one qubit, we build registers." },
  thecap: { speaker: "vpcap", text: "My other cousin, Professor Thecap, rents the big workshop up the lane. An old drone core armed itself in there. Sixteen PINs, three tries. Learn from the crew, then help him disarm it." },
  guide: { speaker: "vpcap", text: "Rosa runs the control room, Paco the silo yard, Inés the Oracle on the conveyor line, Joaquín the Diffuser press and Vera the crane at the dock. You don’t need them for the drone, but the Foundry Badge needs everything." },
  workshopWaiting: { speaker: "vpcap", text: "The drone core in Thecap’s workshop is still armed." },
  workshopDone: { speaker: "vpcap", text: "Thecap says the drone core is disarmed. Nice work." },
  ready: { speaker: "vpcap", text: "Five cards and a disarmed core. You can spread a register, mark the answer with the Oracle, lift it with the Diffuser and stop at the top. That’s Grover’s search, and that’s the Foundry Badge." },
  done: { speaker: "vpcap", text: "The badge is yours. The west road runs back to Coin Town, and the north road there now opens for you. Replay anything here; cards and medals stay." },
} satisfies Record<string, Line>;
export const CARD_COUNT = "You have {count} of 5 Foundry cards.";

export const FOUNDRY_DOOR = { at: { x: 20, y: 6 }, stand: { x: 20, y: 7 } };
/** The west road from Coin Town arrives on these rows; walking off column 0 goes back. */
export const FOUNDRY_WEST_ROAD = [14, 15, 16];
export const FOUNDRY_SPAWN = { x: 1, y: 15 };

export const FOUNDRY_ANIMALS: AnimalSpec[] = [
  { kind: "bot", home: { x: 24, y: 15 }, radius: 7, ground: "p" },
  { kind: "cat", home: { x: 13, y: 11 }, radius: 3 },
  { kind: "pigeon", home: { x: 18, y: 23 }, radius: 3, shy: true },
  { kind: "pigeon", home: { x: 24, y: 23 }, radius: 3, shy: true },
];

/** Decor: tall props are two tiles, top over base. Every prop blocks its tile. */
export type PropSprite = "stack-top" | "stack-base" | "silo-top" | "silo-base" | "belt" | "press-top" | "press-base" | "crane-top" | "crane-base" | "sign";
export const FOUNDRY_PROPS: { sprite: PropSprite; at: { x: number; y: number } }[] = [
  { sprite: "stack-top", at: { x: 26, y: 3 } }, { sprite: "stack-base", at: { x: 26, y: 4 } },
  { sprite: "stack-top", at: { x: 38, y: 3 } }, { sprite: "stack-base", at: { x: 38, y: 4 } },
  ...[3, 5, 7].flatMap((x) => [{ sprite: "silo-top" as const, at: { x, y: 19 } }, { sprite: "silo-base" as const, at: { x, y: 20 } }]),
  ...Array.from({ length: 10 }, (_, i) => ({ sprite: "belt" as const, at: { x: 16 + i, y: 21 } })),
  { sprite: "press-top", at: { x: 33, y: 18 } }, { sprite: "press-base", at: { x: 33, y: 19 } },
  { sprite: "crane-top", at: { x: 36, y: 24 } }, { sprite: "crane-base", at: { x: 36, y: 25 } },
];
/** Crates ride the belt from its first tile to its last, then start again. */
export const FOUNDRY_BELT = { y: 21, from: 16, to: 25 };
/** Smoke rises from the stack tops. */
export const FOUNDRY_SMOKE = [{ x: 26, y: 3 }, { x: 38, y: 3 }];
