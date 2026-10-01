import { HOLLOW_KNOWLEDGE_IDS, type BenchStep, type HollowKnowledgeId, type KnowledgeCard, type Line, type PropSpec, type RegisterStep, type TownNpc } from "./knowledge";
import { product, type RegOp, type RegPiece, type RegTarget } from "@/game/register";
import type { BenchCase, Gate } from "@/game/qubit";
import type { AnimalSpec } from "./coinTown";

/**
 * Hollow Town: west of Coin Town, an old cemetery town where Doña Ofelia's
 * house knocks every night. Its challenge is Operation Ghost Key (the vault,
 * Bernstein–Vazirani). The neighbors teach what the vault adds to Grover: a
 * controlled flip, a helper that a flip cannot move, the phase that kicks back,
 * the parity the ghost really answers, and the one-question trick. As in the
 * other towns, no card is needed for the vault, but the Hollow Badge needs the
 * lesson and all five cards.
 */
export const KNOWLEDGE_IDS = HOLLOW_KNOWLEDGE_IDS;

export const KNOWLEDGE: Record<HollowKnowledgeId, KnowledgeCard> = {
  control: {
    id: "control", glyph: "●⊕", title: "Controlled flip",
    text: "A CNOT has a control and a target. It flips the target only when the control is |1⟩, and it never changes the control’s reading.",
    formula: "CNOT|1⟩|0⟩ = |1⟩|1⟩ · CNOT|0⟩|0⟩ = |0⟩|0⟩", hint: "The vault’s ghost is a controlled flip: it flips a helper qubit only when it should.",
  },
  flipproof: {
    id: "flipproof", glyph: "−", title: "The flip-proof candle",
    text: "A flip swaps |0⟩ and |1⟩, so |−⟩ = (|0⟩ − |1⟩)/√2 becomes (|1⟩ − |0⟩)/√2: the same state times −1. A flip can’t move |−⟩; it only hands out a minus sign.",
    formula: "X|−⟩ = −|−⟩ · HX|0⟩ = |−⟩", hint: "The vault’s helper qubit goes in |−⟩, so the ghost’s flip turns into a sign.",
  },
  kickback: {
    id: "kickback", glyph: "↩", title: "Phase kickback",
    text: "Aim a CNOT at a |−⟩ helper and the helper stays |−⟩. The minus sign lands on the control’s |1⟩ part instead: a control in |+⟩ comes out |−⟩.",
    formula: "CNOT|+⟩|−⟩ = |−⟩|−⟩", hint: "This is how the ghost’s knock becomes a phase on every tumbler at once.",
  },
  parity: {
    id: "parity", glyph: "⊕Σ", title: "The parity lock",
    text: "The vault never asks “is this the key?”. It counts the tumblers where both the secret s and your question x are 1: an odd count knocks, an even count stays silent.",
    formula: "answer = s·x mod 2", hint: "One question by hand gives one bit, so 25 tumblers take 25 questions.",
  },
  onequestion: {
    id: "onequestion", glyph: "1?", title: "One question",
    text: "Spread the tumblers with the H box, put the helper in |−⟩, ask the ghost once, then apply the H box again. Every tumbler whose secret digit is 1 got a minus sign, and H reads each sign as a 1.",
    formula: "H · Oracle · H |0…0⟩|−⟩ = |s⟩|−⟩", hint: "This is Bernstein–Vazirani: the whole secret in one question.",
  },
};

export type HollowNpcId = "keepercap" | "fausto" | "candela" | "rocio" | "ramiro" | "aurelio";
export type HollowNpc = TownNpc<HollowNpcId>;

const register = (title: string, text: string, qubits: number, start: string, slots: number, tray: RegPiece[], target: RegTarget, goal: string, feedback: string,
  options: { fill?: boolean; fixed?: RegOp[] } = {}): RegisterStep =>
  ({ kind: "register", title, text, qubits, start, slots, tray, target, goal, feedback, helper: true, ...options });
const bench = (title: string, text: string, cases: BenchCase[], slots: number, gates: Gate[], feedback: string, fill = false): BenchStep =>
  ({ kind: "bench", title, text, cases, slots, gates, feedback, fill });

export const HOLLOW_NPCS: HollowNpc[] = [
  {
    id: "fausto", title: "Fausto", description: "Bell ringer · chapel tower", at: { x: 34, y: 9 }, knowledge: "control",
    intro: [
      { speaker: "fausto", text: "Shh, not so loud. I’m Fausto; I ring the chapel bell. The bell only rings when someone pulls the rope." },
      { speaker: "fausto", text: "Qubits have a bell like that. It’s called a CNOT: the rope is the control, the bell is the target. The target flips only when the control is |1⟩." },
    ],
    steps: [
      register("Pull the rope", "The rope is pulled: q₁ is |1⟩, and the bell, the helper wire, is |0⟩. Place a CNOT with its dot on the rope wire.", 2, "10", 1, ["CX"], { basis: "11" },
        "Reach |11⟩: rope pulled, bell rung.", "CNOT|1⟩|0⟩ = |1⟩|1⟩. The control was 1, so the bell flipped, and the rope still reads 1."),
      register("Rope at rest", "Now nobody is pulling: both wires start at |0⟩. Place the CNOT anyway and see what the bell does.", 2, "00", 1, ["CX"], { basis: "00" },
        "Stay at |00⟩: no pull, no ring.", "CNOT|0⟩|0⟩ = |0⟩|0⟩. With the control at 0, the CNOT does nothing at all.", { fill: true }),
      { kind: "question", title: "Ring it twice", text: "The bell is ringing: the wires read |11⟩. You apply a second CNOT. What do they read now?", options: [
        { label: "|10⟩: the bell stops", correct: true },
        { label: "|11⟩: it keeps ringing", wrong: "The rope is still pulled, so the CNOT flips the bell again, from 1 back to 0." },
        { label: "|01⟩: the rope drops", wrong: "A CNOT never changes its control’s reading. Only the bell flips." },
      ], feedback: "Right. Like X, a CNOT undoes itself: two in a row do nothing." },
    ],
    outro: [{ speaker: "fausto", text: "Rope and bell. Candela in the wax shop says she has a candle that no draft can blow out. Ask her about it." }],
    repeat: [{ speaker: "fausto", text: "No pull, no ring. The rope decides." }],
  },
  {
    id: "candela", title: "Candela", description: "Candle maker · wax shop", at: { x: 12, y: 19 }, knowledge: "flipproof",
    intro: [
      { speaker: "candela", text: "Welcome, welcome! Candela, candle maker. Every candle here is a qubit, and a draft through the door is an X: it flips |0⟩ and |1⟩." },
      { speaker: "candela", text: "Most flames jump when the draft comes. My |−⟩ candle only bows: it comes out exactly the same, times −1." },
    ],
    steps: [
      bench("Light the |−⟩ candle", "Every candle in the shop starts at |0⟩. Make the flip-proof one, |−⟩, with two gates.", [{ start: "0", target: "-" }], 2, ["X", "Z", "H"],
        "X then H: H|1⟩ = |−⟩. Or H then Z. Either way the candle is lit.", true),
      bench("Open the door", "The |−⟩ candle is lit. Let the draft in: place X, and check that the candle is still |−⟩.", [{ start: "-", target: "-" }], 1, ["X"],
        "X(|0⟩ − |1⟩)/√2 = (|1⟩ − |0⟩)/√2 = −|−⟩. The same candle times −1, and a sign on the whole state can’t be measured.", true),
      { kind: "question", title: "Where did the flip go?", text: "The draft flipped the |−⟩ candle, but the candle didn’t change. What did the flip leave behind?", options: [
        { label: "A minus sign, −1, on the whole state", correct: true },
        { label: "Nothing at all", wrong: "Look at the math: (|1⟩ − |0⟩) is −(|0⟩ − |1⟩). The flip turned into a −1." },
        { label: "A |+⟩ candle", wrong: "X swaps the parts; it doesn’t change the sign between them. |−⟩ stays |−⟩, times −1." },
      ], feedback: "Right. On |−⟩, a flip is just a −1. Alone that −1 is invisible, but Rocío knows where it can end up." },
    ],
    outro: [{ speaker: "candela", text: "A flame that only bows. Rocío, the fortune teller by the crypt, says the spirits push back. She means that minus sign." }],
    repeat: [{ speaker: "candela", text: "Drafts come and go. The |−⟩ candle just bows." }],
  },
  {
    id: "rocio", title: "Rocío", description: "Fortune teller · by the crypt", at: { x: 24, y: 21 }, knowledge: "kickback",
    intro: [
      { speaker: "rocio", text: "Come in, come in. I’m Rocío. People think the spirits answer. They don’t. The spirit you push, pushes back." },
      { speaker: "rocio", text: "Aim Fausto’s CNOT at Candela’s |−⟩ candle. The candle only bows, so where does the minus go? Back up the rope, onto the control. We call it phase kickback." },
    ],
    steps: [
      register("Push the spirit", "q₁ starts at |0⟩ and the helper at |1⟩. Put an H on each wire, then a CNOT from q₁. Watch the state of each wire at the end.", 2, "01", 2, ["h", "CX"],
        { amplitudes: product("-", "-") }, "End with q₁ in |−⟩ and the helper in |−⟩.",
        "H makes |+⟩ and |−⟩. The CNOT aimed at the helper, yet the helper is still |−⟩ and q₁ went from |+⟩ to |−⟩. The minus kicked back.", { fill: true }),
      { kind: "question", title: "Who moved?", text: "Before the CNOT the wires were |+⟩ and |−⟩ (left). After it they are |−⟩ and |−⟩. The CNOT pointed at the helper. Which wire changed?",
        bars: { qubits: 2, start: "01", ops: ["h1", "h2"], after: ["CX1"], titles: ["Before the CNOT", "After the CNOT"] }, options: [
          { label: "q₁, the control", correct: true },
          { label: "The helper, as the CNOT says", wrong: "The helper was |−⟩ and is still |−⟩: a flip only gives it a −1, as Candela showed. That −1 lands on q₁’s |1⟩ part." },
          { label: "Neither wire", wrong: "Look at the bars: |10⟩ and |11⟩ swapped signs. That is q₁ turning from |+⟩ into |−⟩." },
        ], feedback: "Right. The target stayed put and the control changed: the phase kicked back." },
      register("Read the push", "Kickback leaves q₁ in |−⟩. Don Óscar’s lens reads a sign: H turns |−⟩ into |1⟩. Build the push, then read it so q₁ reads 1.", 2, "01", 3, ["h", "CX"],
        { reads: "1" }, "q₁ reads 1 every time.",
        "H, H, CNOT, then H on q₁: |−⟩ becomes |1⟩. The helper was never measured, and still q₁ carries the answer.", { fill: true }),
    ],
    outro: [{ speaker: "rocio", text: "The spirit you push, pushes back. Ramiro, the gravedigger, can tell you what Anselmo’s ghost really answers. It isn’t what Ofelia thinks." }],
    repeat: [{ speaker: "rocio", text: "Push on |−⟩ and the minus comes back up the rope." }],
  },
  {
    id: "ramiro", title: "Ramiro", description: "Gravedigger · the old graves", at: { x: 19, y: 9 }, knowledge: "parity",
    intro: [
      { speaker: "ramiro", text: "Ramiro. I dig, I count, I don’t scare. Anselmo built locks, and I buried him with his manual, so I know how his vault thinks." },
      { speaker: "ramiro", text: "The vault never asks “is this the key?”. It looks at the tumblers you mark and the secret ones, counts where both are 1, and knocks only if the count is odd." },
    ],
    steps: [
      { kind: "question", title: "Count the lanterns", text: "The secret is s = 101. You mark x = 111. Tumblers where both are 1: the first and the third. Does the ghost knock?", options: [
        { label: "Silence: two matches is even", correct: true },
        { label: "A knock: you marked the right ones", wrong: "The ghost knocks only for an odd count. Two matches is even, so it stays silent." },
        { label: "Three knocks, one per tumbler", wrong: "The ghost answers a single bit: odd or even, knock or silence." },
      ], feedback: "Right. 1·1 + 0·1 + 1·1 = 2, and 2 mod 2 = 0: silence." },
      register("Ask one tumbler", "Here the ghost guards two tumblers, q₁ and q₂, and knocks by flipping the helper. Mark only tumbler 2 with an X; the ghost answers after your line.", 3, "000", 1, ["X"],
        { basis: "011" }, "Ask x = 01 and hear the knock: end at |011⟩.",
        "x = 01 asks about tumbler 2 alone. The helper flipped, so the secret’s second digit is 1. One question, one digit.", { fixed: ["ghost:01"] }),
      { kind: "question", title: "Twenty-five graves", text: "Asking one tumbler at a time like that, how many questions does Doña Ofelia’s 25-tumbler vault take?", options: [
        { label: "25", correct: true },
        { label: "1", wrong: "One question by hand gives one bit: knock or silence. There are 25 unknown bits." },
        { label: "5", wrong: "√25 would be Grover’s kind of saving, and this lock doesn’t play Grover’s game. By hand, it’s one bit per question." },
      ], feedback: "Right: 25 candles for 25 digits. Ofelia has three a night. Aurelio on the lantern row says one is enough." },
    ],
    outro: [{ speaker: "ramiro", text: "Odd knocks, even is silent. Remember that when the Colonel’s manual turns up in Casa Ofelia." }],
    repeat: [{ speaker: "ramiro", text: "Count where both are 1. Odd knocks. Even sleeps." }],
  },
  {
    id: "aurelio", title: "Aurelio", description: "Night watchman · the lantern row", at: { x: 32, y: 23 }, knowledge: "onequestion",
    intro: [
      { speaker: "aurelio", text: "Evening. Aurelio, night watch. I don’t check every grave one by one. One swing of my lantern and I see them all." },
      { speaker: "aurelio", text: "Put everything together: the H box spreads the tumblers, the helper sits in |−⟩, the ghost pushes, and the minus kicks back onto every tumbler whose secret digit is 1. One more H box reads them all." },
    ],
    steps: [
      register("One swing", "Two tumblers and a helper starting at |001⟩. The ghost here is sealed: you don’t know its secret. Use the H box, the Oracle and the H box again, then read the tumblers.", 3, "001", 3, ["H", "ghost:10"],
        { reads: "10" }, "The tumblers read the ghost’s secret, 10, for certain.",
        "H turned the helper’s |1⟩ into |−⟩ and spread both tumblers. The ghost kicked a minus onto q₁, and the last H read it: 10. One question, both digits.", { fill: true }),
      { kind: "question", title: "Twenty-five lanterns", text: "The same trick on Doña Ofelia’s 25 tumblers: H box, Oracle with a |−⟩ helper, H box, measure. How many questions to the ghost?", options: [
        { label: "1", correct: true },
        { label: "25", wrong: "That’s Ramiro’s way, one tumbler per question. Here every tumbler hears the ghost at once." },
        { label: "About 4,549", wrong: "That’s Grover’s count, and Grover assumes a lock that only knocks for the whole key. This one answers parity." },
      ], feedback: "Right. One question for all 25 digits: that’s Bernstein–Vazirani." },
    ],
    outro: [{ speaker: "aurelio", text: "One swing. If you haven’t opened Anselmo’s vault yet, now you know why one candle is enough." }],
    repeat: [{ speaker: "aurelio", text: "One lantern, every grave. H, the Oracle, H." }],
  },
  {
    id: "keepercap", title: "Keeper Cap", description: "Cemetery keeper · east gate", at: { x: 35, y: 13 },
    intro: [], steps: [], outro: [], repeat: [],
  },
];

export function hollowNpc(id: HollowNpcId): HollowNpc {
  return HOLLOW_NPCS.find((npc) => npc.id === id)!;
}

/** Keeper Cap's lines, picked from the player's progress. Cousin of Mayor Cap, VP Cap and Professor Thecap. */
export const KEEPER = {
  welcome: { speaker: "keepercap", text: "Mind the mist! I’m Cap, keeper of this cemetery. My cousin VP Cap sent word that the one who disarmed the drone was coming west. Here nobody searches for answers: we listen for them." },
  ofelia: { speaker: "keepercap", text: "Up the hill is Casa Ofelia. Every night since her husband Anselmo passed, the house knocks. Doña Ofelia thinks it’s his ghost; my cousin Thecap thinks it’s his vault. Either way she needs you." },
  guide: { speaker: "keepercap", text: "Fausto rings the chapel bell, Candela makes candles, Rocío reads fortunes by the crypt, Ramiro keeps the graves and Aurelio walks the lantern row. You don’t need them for the vault, but the Hollow Badge needs everything." },
  vaultWaiting: { speaker: "keepercap", text: "Casa Ofelia is still knocking." },
  vaultDone: { speaker: "keepercap", text: "Casa Ofelia is quiet at last. Doña Ofelia sleeps with the candles lit." },
  ready: { speaker: "keepercap", text: "Five cards and a quiet house. You can build a controlled flip, park a helper in |−⟩, catch the kickback, count the parity and ask the one question. That’s Bernstein–Vazirani, and that’s the Hollow Badge." },
  done: { speaker: "keepercap", text: "The badge is yours. The east road runs back to Coin Town, and Beto opens the north road there for Hollow Badge holders. Replay anything here; cards and medals stay." },
} satisfies Record<string, Line>;
export const CARD_COUNT = "You have {count} of 5 Hollow cards.";

export const HOLLOW_DOOR = { at: { x: 10, y: 6 }, stand: { x: 10, y: 7 } };
/** The east road from Coin Town arrives on these rows; walking off the last column goes back. */
export const HOLLOW_EAST_ROAD = [14, 15, 16];
export const HOLLOW_SPAWN = { x: 38, y: 15 };

export const HOLLOW_ANIMALS: AnimalSpec[] = [
  { kind: "cat", home: { x: 28, y: 15 }, radius: 5 },
  { kind: "crow", home: { x: 18, y: 6 }, radius: 3, shy: true },
  { kind: "crow", home: { x: 6, y: 25 }, radius: 3, shy: true },
  { kind: "bat", home: { x: 28, y: 9 }, radius: 4 },
];

export const HOLLOW_PROPS: PropSpec[] = [
  // The fenced cemetery: rows of graves and a cross in the middle.
  ...[[15, 5], [17, 5], [22, 5], [24, 5], [15, 8], [17, 8], [22, 8], [24, 8], [15, 11], [24, 11]].map(([x, y]) => ({ sprite: "grave" as const, at: { x, y } })),
  { sprite: "cross", at: { x: 19, y: 4 } }, { sprite: "cross", at: { x: 20, y: 4 } },
  // The chapel bell tower beside Fausto.
  { sprite: "bell-top", at: { x: 36, y: 8 } }, { sprite: "bell-base", at: { x: 36, y: 9 } },
  // Rocío's crypt.
  { sprite: "crypt-top", at: { x: 22, y: 20 } }, { sprite: "crypt-base", at: { x: 22, y: 21 } },
  // Candela's candle tables.
  { sprite: "candles", at: { x: 11, y: 19 } }, { sprite: "candles", at: { x: 13, y: 19 } },
  // The pumpkin patch.
  ...[[3, 24], [5, 25], [7, 24], [4, 27], [7, 27]].map(([x, y]) => ({ sprite: "pumpkin" as const, at: { x, y } })),
  // The lantern row.
  ...[[28, 21], [30, 21], [34, 21], [36, 21], [29, 26], [33, 26]].map(([x, y]) => ({ sprite: "lantern" as const, at: { x, y } })),
  // Dead trees.
  ...[[2, 11], [38, 5], [15, 25], [37, 27], [27, 11]].flatMap(([x, y]) => [{ sprite: "deadtree-top" as const, at: { x, y: y - 1 } }, { sprite: "deadtree-base" as const, at: { x, y } }]),
];
/** Low mist drifts over these tiles. */
export const HOLLOW_FOG = [{ x: 16, y: 6 }, { x: 21, y: 7 }, { x: 18, y: 11 }, { x: 23, y: 10 }, { x: 5, y: 26 }, { x: 30, y: 24 }];
