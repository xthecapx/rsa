import type { BenchCase, Gate } from "@/game/qubit";
import { COIN_KNOWLEDGE_IDS, type BenchStep, type CoinKnowledgeId, type KnowledgeCard, type Line, type TownNpc } from "./knowledge";

export type { ActivityStep, BenchStep, KnowledgeCard, Line, QuestionStep } from "./knowledge";

/**
 * Coin Town: the first town on the road. Its challenge is the coin house
 * (Who Goes First?); its neighbors each teach one idea about a single qubit
 * that the later lessons assume. A card is never required for the coin toss,
 * but the town badge needs the toss and all five cards.
 */
export type KnowledgeId = CoinKnowledgeId;
export const KNOWLEDGE_IDS = COIN_KNOWLEDGE_IDS;

export const KNOWLEDGE: Record<CoinKnowledgeId, KnowledgeCard> = {
  bits: {
    id: "bits", glyph: "01", title: "Bits of a qubit",
    text: "A qubit has two basis states, |0⟩ and |1⟩. Measuring |0⟩ always reads 0 and |1⟩ always reads 1. The X gate swaps them.",
    formula: "X|0⟩ = |1⟩ · X|1⟩ = |0⟩", hint: "Every circuit starts from |0⟩ and |1⟩.",
  },
  "four-states": {
    id: "four-states", glyph: "✣", title: "Four directions",
    text: "Besides |0⟩ and |1⟩, a qubit can point to |+⟩ or |−⟩. H turns |0⟩ into |+⟩ and |1⟩ into |−⟩.",
    formula: "|±⟩ = (|0⟩ ± |1⟩)/√2", hint: "Grover and the vault both begin by putting qubits in |+⟩.",
  },
  phase: {
    id: "phase", glyph: "±", title: "The hidden sign",
    text: "|+⟩ and |−⟩ differ only by the sign on |1⟩. Z flips that sign. A plain measurement gives 50/50 for both, so the sign is invisible.",
    formula: "Z|+⟩ = |−⟩ · P(0) = P(1) = ½", hint: "The Oracle, a sealed box you’ll meet in Foundry Town, marks answers by flipping exactly this sign.",
  },
  interference: {
    id: "interference", glyph: "≈", title: "Echoes cancel",
    text: "Amplitudes add and cancel like ripples. Apply H twice and the |1⟩ parts cancel: you get your start state back with certainty.",
    formula: "H·H = I · H|+⟩ = |0⟩", hint: "Grover’s diffuser grows the right answer with interference.",
  },
  basis: {
    id: "basis", glyph: "◇", title: "Sign-reading lens",
    text: "To tell |+⟩ from |−⟩, apply H and then measure: |+⟩ reads 0 and |−⟩ reads 1. This is how later lessons read a hidden phase.",
    formula: "H|+⟩ = |0⟩ · H|−⟩ = |1⟩", hint: "The vault’s secret is read exactly this way.",
  },
};

export type CoinTownNpcId = "mayor" | "luz" | "nico" | "tomas" | "marisol" | "oscar" | "warden";
export type CoinTownNpc = TownNpc<CoinTownNpcId>;

const bench = (title: string, text: string, cases: BenchCase[], slots: number, gates: Gate[], feedback: string, fill = false): BenchStep =>
  ({ kind: "bench", title, text, cases, slots, gates, feedback, fill });

export const COIN_TOWN_NPCS: CoinTownNpc[] = [
  {
    id: "luz", title: "Luz", description: "Lamplighter · the street lamps", at: { x: 14, y: 13 }, knowledge: "bits",
    intro: [
      { speaker: "luz", text: "Evening! I’m Luz. I light the lamps on this street, and each lamp is a little qubit: off is |0⟩, on is |1⟩." },
      { speaker: "luz", text: "The lamp switch is a gate called X. It swaps |0⟩ and |1⟩. Want to try?" },
    ],
    steps: [
      bench("Light the lamp", "The lamp starts off, in |0⟩. Place a gate so it ends on, in |1⟩.", [{ start: "0", target: "1" }], 1, ["X", "Z", "H"],
        "X|0⟩ = |1⟩. The lamp is on, and measuring it will read 1 every time."),
      bench("Two switches", "This lamp starts on, in |1⟩. Fill both slots and leave it on.", [{ start: "1", target: "1" }], 2, ["X"],
        "X·X|1⟩ = |1⟩. Flipping twice puts the lamp back: X undoes itself.", true),
      { kind: "question", title: "Read the lamp", text: "A lamp is in |0⟩. You measure it ten times. What do you read?", options: [
        { label: "0 every time", correct: true },
        { label: "About half 0 and half 1", wrong: "That’s what a coin in superposition does. |0⟩ is not a superposition: it always reads 0." },
        { label: "1 every time", wrong: "Only |1⟩ reads 1 every time. Apply X first to get there." },
      ], feedback: "Right. |0⟩ and |1⟩ behave like ordinary bits when you measure them." },
    ],
    outro: [{ speaker: "luz", text: "That’s all a classical bit can do: 0, 1 and flip. The rest of this town is about what else a qubit can do." }],
    repeat: [{ speaker: "luz", text: "The lamps are all lit. Nico at the weathervane says a qubit can point sideways. Go and see." }],
  },
  {
    id: "nico", title: "Nico", description: "Kid with a weathervane · the plaza", at: { x: 27, y: 21 }, knowledge: "four-states",
    intro: [
      { speaker: "nico", text: "I’m Nico! My weathervane points four ways. North is |0⟩, south is |1⟩, east is |+⟩ and west is |−⟩." },
      { speaker: "nico", text: "Grandpa says the H gate turns north into east. I want to see it!" },
    ],
    steps: [
      bench("Point east", "Start at north, |0⟩. Make |+⟩.", [{ start: "0", target: "+" }], 1, ["X", "Z", "H"],
        "H|0⟩ = (|0⟩ + |1⟩)/√2 = |+⟩. Half north, half south: that’s superposition."),
      bench("Point west", "Start at north again. Make |−⟩ with two gates.", [{ start: "0", target: "-" }], 2, ["X", "Z", "H"],
        "Two roads lead west: X then H gives H|1⟩ = |−⟩, and H then Z flips the sign of |+⟩. Same state either way.", true),
      { kind: "question", title: "Measure the vane", text: "The vane points east, |+⟩. You measure it. What do you read?", options: [
        { label: "0 or 1, each about half the time", correct: true },
        { label: "Always 0", wrong: "|+⟩ has equal amplitude on |0⟩ and |1⟩, so each outcome has probability ½." },
        { label: "Always “east”", wrong: "An ordinary measurement only answers 0 or 1. It can’t answer “east”." },
      ], feedback: "Right: P(0) = P(1) = ½. That’s the quantum coin from the house up north." },
    ],
    outro: [{ speaker: "nico", text: "Four directions! Tomás paints signs with a plus and a minus. Ask him what the minus does." }],
    repeat: [{ speaker: "nico", text: "North, south, east, west: |0⟩, |1⟩, |+⟩, |−⟩. The vane never forgets." }],
  },
  {
    id: "tomas", title: "Tomás", description: "Sign painter · east house", at: { x: 34, y: 12 }, knowledge: "phase",
    intro: [
      { speaker: "tomas", text: "Tomás, sign painter. Look at these two signs: same letters, same colors. One has a plus, one has a minus." },
      { speaker: "tomas", text: "In a qubit, that minus sits on the |1⟩ part. Z is the brush that paints it." },
    ],
    steps: [
      bench("Paint the minus", "Start with |+⟩. Turn it into |−⟩ with one gate.", [{ start: "+", target: "-" }], 1, ["X", "Z", "H"],
        "Z(|0⟩ + |1⟩)/√2 = (|0⟩ − |1⟩)/√2 = |−⟩. Only the sign changed."),
      bench("Wash it off", "Start with |−⟩. Get |+⟩ back with one gate.", [{ start: "-", target: "+" }], 1, ["X", "Z", "H"],
        "Z again removes the minus: Z undoes itself, just like X."),
      { kind: "question", title: "Count the signs", text: "You measure |+⟩ a hundred times, then |−⟩ a hundred times. What do the counts look like?", options: [
        { label: "About 50/50 for both", correct: true },
        { label: "|+⟩ gives 0s and |−⟩ gives 1s", wrong: "Tempting! But both states give each outcome with probability ½. A plain measurement can’t see the sign." },
        { label: "|−⟩ gives no results", wrong: "A minus sign never removes outcomes: (−1/√2)² is still ½." },
      ], feedback: "Right. The sign is real, but a plain measurement can’t see it. Don Óscar has a lens for that." },
    ],
    outro: [{ speaker: "tomas", text: "A sign you can’t see is still a sign. They say a whole vault hides its secret in signs like these." }],
    repeat: [{ speaker: "tomas", text: "Plus or minus, the paint looks the same from the street." }],
  },
  {
    id: "marisol", title: "Marisol", description: "Fountain keeper · south-west square", at: { x: 13, y: 23 }, knowledge: "interference",
    intro: [
      { speaker: "marisol", text: "Hola, I’m Marisol. Drop two pebbles in the fountain and watch: where a crest meets a trough, the water goes flat." },
      { speaker: "marisol", text: "Qubit amplitudes do the same. Two H gates in a row make ripples that cancel." },
    ],
    steps: [
      { kind: "question", title: "Predict the ripples", text: "H turns |0⟩ into a fair 50/50 coin. Apply H a second time, then measure. What do you get?", options: [
        { label: "Always 0", correct: true },
        { label: "Still 50/50", wrong: "Two coin tosses would stay random, but amplitudes can cancel. Try it on the bench next." },
        { label: "Always 1", wrong: "The |1⟩ parts cancel, not the |0⟩ parts. Try it on the bench next." },
      ], waves: true, feedback: "Right. Let’s watch the amplitudes do it." },
      { ...bench("Ripples that cancel", "Start at |0⟩. Place H twice and watch the math.", [{ start: "0", target: "0" }], 2, ["H"],
        "H|+⟩ = ½(|0⟩ + |1⟩) + ½(|0⟩ − |1⟩) = |0⟩. The |1⟩ parts cancel: that’s interference.", true), waves: true },
      { ...bench("Back from the west", "Start at |−⟩. Get back to |1⟩ with one gate.", [{ start: "-", target: "1" }], 1, ["X", "Z", "H"],
        "H|−⟩ = |1⟩. H undoes itself, so it undoes whatever it made."), waves: true },
    ],
    outro: [{ speaker: "marisol", text: "Grover’s search uses this trick. It makes the wrong answers cancel and the right one grow." }],
    repeat: [{ speaker: "marisol", text: "The fountain is calm again. Calm is just ripples cancelling." }],
  },
  {
    id: "oscar", title: "Don Óscar", description: "Optician · west house", at: { x: 10, y: 12 }, knowledge: "basis",
    intro: [
      { speaker: "oscar", text: "Don Óscar, optician. Tomás says you can’t see his minus signs. Of course not: you’re wearing the wrong lenses." },
      { speaker: "oscar", text: "An H lens turns |+⟩ into |0⟩ and |−⟩ into |1⟩. Put it before the measurement and the sign becomes a reading." },
    ],
    steps: [
      bench("Sign-reading lens", "One circuit must work for both qubits: |+⟩ must read 0 and |−⟩ must read 1.", [{ start: "+", target: "0" }, { start: "-", target: "1" }], 1, ["X", "Z", "H"],
        "H|+⟩ = |0⟩ and H|−⟩ = |1⟩. The hidden sign is now a 0 or a 1 you can measure."),
      bench("Reversed lens", "Now swap the readings: |+⟩ must read 1 and |−⟩ must read 0. Use two gates.", [{ start: "+", target: "1" }, { start: "-", target: "0" }], 2, ["X", "Z", "H"],
        "H then X works, and so does Z then H. There’s more than one lens for the same job.", true),
      { kind: "question", title: "The mystery qubit", text: "Someone hands you a qubit that is either |+⟩ or |−⟩. How do you find out which?", options: [
        { label: "Apply H, then measure once", correct: true },
        { label: "Measure it many times", wrong: "Both give 50/50, so the counts look the same. Turn the sign into a bit first." },
        { label: "Apply Z, then measure", wrong: "Z swaps |+⟩ and |−⟩, but both still read 50/50." },
      ], feedback: "Exactly. H before measuring reads the ± basis. Remember that when a ghost starts knocking." },
    ],
    outro: [{ speaker: "oscar", text: "Now you can see phase. Most people in town never learn that." }],
    repeat: [{ speaker: "oscar", text: "Lenses polished. H, then measure. Always." }],
  },
  {
    id: "mayor", title: "Mayor Cap", description: "Town hall · by the entrance", at: { x: 23, y: 25 },
    intro: [], steps: [], outro: [], repeat: [],
  },
  {
    id: "warden", title: "Beto", description: "Road warden · north road", at: { x: 27, y: 3 },
    intro: [], steps: [], outro: [], repeat: [],
  },
];

export function coinTownNpc(id: CoinTownNpcId): CoinTownNpc {
  return COIN_TOWN_NPCS.find((npc) => npc.id === id)!;
}

/** Mayor Cap's lines, picked from the player's progress. Every town is welcomed by a Cap; Professor Thecap in Quantum Town is her cousin. */
export const MAYOR = {
  welcome: { speaker: "mayor", text: "Welcome to Coin Town! I’m Cap, the mayor. Everyone here knows one small piece of how a qubit works. Learn from five neighbors, settle Ale and Brayan’s coin toss in the house up north, and the town badge is yours. The badge also opens the east road to Foundry Town." },
  guide: { speaker: "mayor", text: "Luz is by the lamps, Don Óscar at his lens shop, Tomás at the east house, Nico at the weathervane and Marisol at the fountain. You don’t need them for the coin toss, but the badge needs everything." },
  coinWaiting: { speaker: "mayor", text: "The coin toss is still waiting in the house up north." },
  coinDone: { speaker: "mayor", text: "Ale and Brayan’s coin toss is settled." },
  ready: { speaker: "mayor", text: "Five cards and a fair coin. You know what a qubit can be, how H mixes it, how a sign hides inside it and how to read that sign. That’s the Coin Town badge, and the east gate will open for you." },
  done: { speaker: "mayor", text: "The badge suits you. Foundry Town is down the east road; my cousin VP Cap runs it, and our cousin Professor Thecap keeps a workshop there. After that, the west road leads to Hollow Town and our cousin Keeper Cap, and the north road to Cipher Town and our cousin Root Cap. Tell them Cap sent you. Replay anything here you like; cards and medals stay." },
} satisfies Record<string, Line>;
/** "{count} of 5 knowledge cards." is composed at runtime. */
export const CARD_COUNT = "You have {count} of 5 knowledge cards.";

export const WARDEN = {
  closed: { speaker: "warden", text: "This road goes north to Cipher Town, where a client is hiring hackers, and on to Quantum Town. I only open it for travellers with the Hollow Badge. Keeper Cap hands it out, down the west road." },
  open: { speaker: "warden", text: "Badge checked. The road north to Cipher Town is open. Say hi to Root Cap for me." },
} satisfies Record<string, Line>;

/** Signposts at the ends of the crossing street. */
export const SIGNS = {
  eastClosed: { speaker: "system", text: "East road · Foundry Town. The gate opens for holders of the Coin Town badge. Mayor Cap hands it out, by the entrance." },
  eastOpen: { speaker: "system", text: "East road · Foundry Town. VP Cap’s factories and Professor Thecap’s workshop. The gate is open." },
  westClosed: { speaker: "system", text: "West road · Hollow Town. The gate opens for holders of the Foundry Badge. VP Cap hands it out, down the east road." },
  westOpen: { speaker: "system", text: "West road · Hollow Town. Keeper Cap’s old cemetery and Doña Ofelia’s knocking house. The gate is open." },
} satisfies Record<string, Line>;

export const COIN_TOWN_DOOR = { at: { x: 20, y: 5 }, stand: { x: 20, y: 6 } };
/** A new game starts here, by Mayor Cap at the south end of town. */
export const COIN_TOWN_SPAWN = { x: 20, y: 28 };
/** The north road to Cipher Town runs up these columns to the top edge; the barrier sits on NORTH_GATE_ROW. */
export const COIN_TOWN_NORTH_ROAD = [25, 26];
export const NORTH_GATE_ROW = 1;
/** The crossing street runs out to both side edges on these rows: east to Foundry Town, west to Hollow Town (still closed). */
export const COIN_TOWN_SIDE_ROAD = [14, 15, 16];
export const EAST_GATE_COL = 38;
export const WEST_GATE_COL = 1;
export const COIN_TOWN_EAST_SIGN = { at: { x: 36, y: 13 }, stand: { x: 36, y: 14 } };
export const COIN_TOWN_WEST_SIGN = { at: { x: 3, y: 13 }, stand: { x: 3, y: 14 } };
/** Walking back from Foundry Town arrives just inside the east gate, and from Hollow Town just inside the west gate. */
export const COIN_TOWN_FROM_EAST = { x: 37, y: 15 };
export const COIN_TOWN_FROM_WEST = { x: 2, y: 15 };
/** Walking back from Cipher Town arrives just inside the gate. */
export const COIN_TOWN_FROM_NORTH = { x: 25, y: 2 };
/** Quantum Town's southern entrance, where the road from Coin Town arrives; its bottom row leads back. */
export const QUANTUM_SOUTH_GATE = { x: 24, y: 33 };
export const QUANTUM_SOUTH_ROW = 35;

/** Town life: animals wander near a home tile and never block the player. */
export type AnimalKind = "cat" | "dog" | "pigeon" | "duck" | "bot" | "crow" | "bat" | "drone";
export interface AnimalSpec {
  kind: AnimalKind;
  home: { x: number; y: number };
  radius: number;
  /** Only step on this ground tile (ducks keep to the fountain basin). */
  ground?: string;
  /** Flutters away when the player comes close. */
  shy?: boolean;
}
export const COIN_TOWN_ANIMALS: AnimalSpec[] = [
  { kind: "cat", home: { x: 22, y: 8 }, radius: 4 },
  { kind: "dog", home: { x: 30, y: 15 }, radius: 6 },
  { kind: "pigeon", home: { x: 25, y: 20 }, radius: 3, shy: true },
  { kind: "pigeon", home: { x: 30, y: 22 }, radius: 3, shy: true },
  { kind: "pigeon", home: { x: 29, y: 23 }, radius: 3, shy: true },
  { kind: "duck", home: { x: 9, y: 23 }, radius: 3, ground: "v" },
  { kind: "duck", home: { x: 11, y: 22 }, radius: 3, ground: "v" },
];
