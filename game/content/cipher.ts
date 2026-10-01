import { CIPHER_KNOWLEDGE_IDS, type CipherKnowledgeId, type CryptoAid, type CryptoStep, type DialStep, type KnowledgeCard, type Line, type PropSpec, type QuestionStep, type TownNpc } from "./knowledge";
import { BOUNTY_WORDS, TOY_KEYS, caesar, letterNumber, modPow, pick, seeded, trayFor, type CryptoSlot } from "@/game/crypto";
import type { ActNumber } from "./types";
import type { AnimalSpec } from "./coinTown";

/**
 * Cipher Town: north of Coin Town, a neon hacker district built around Ale
 * and Brayan's street. Its challenge is Breaking RSA, the client's four jobs.
 * The neighbors teach the defender's side: an encoding is not a lock, a lock
 * needs a huge key space, locks live on clocks, a public padlock with a private
 * key, and the rhythm that splits N. The client pays for each job and Chispa
 * sells the gear each job needs, so the acts never need a card, but the Cipher
 * Badge needs all four jobs and all five cards.
 */
export const KNOWLEDGE_IDS = CIPHER_KNOWLEDGE_IDS;

export const KNOWLEDGE: Record<CipherKnowledgeId, KnowledgeCard> = {
  encoding: {
    id: "encoding", glyph: "A1", title: "Encoding isn’t a lock",
    text: "Turning letters into numbers (A=1, B=2 …) changes how a message looks, not who can read it. The table is public, so anyone who sees the numbers can read the words.",
    formula: "HI → 8 9 · 3 1 16 → CAP", hint: "The client’s first job: Ale and Brayan send numbers. That’s an encoding, not a secret.",
  },
  keyspace: {
    id: "keyspace", glyph: "⚿", title: "Key and key space",
    text: "A cipher mixes the message with a key. Caesar shifts every letter by the key, so key 3 turns CAT into FDW. A lock is only as strong as its number of keys, and Caesar has just 25.",
    formula: "CAT +3 → FDW · 25 keys", hint: "The client’s second job is a Caesar shift. Sweep the wheel.",
  },
  clock: {
    id: "clock", glyph: "⟳", title: "Clock math",
    text: "On a clock with N marks, counting past N wraps back to 0. That’s mod N: 17 mod 12 = 5. Powers wrap too, and they always fall into a loop.",
    formula: "17 mod 12 = 5 · 4¹ 4² 4³ mod 7 = 4 2 1", hint: "RSA locks and unlocks with powers on a clock, and Shor listens for the loop.",
  },
  padlock: {
    id: "padlock", glyph: "🔒", title: "Padlock and key",
    text: "RSA hands out an open padlock, the public key (N, e): anyone can lock with mᵉ mod N. Only the private key d opens it, with cᵈ mod N. d is built from N’s two primes, so N must be hard to split.",
    formula: "N = 3·11 = 33 · φ = 20 · 3·7 mod 20 = 1 · 4³ ≡ 31 · 31⁷ ≡ 4", hint: "The client’s third job: Brayan’s padlock has a tiny N. Split it and d falls out.",
  },
  rhythm: {
    id: "rhythm", glyph: "♫", title: "Hidden rhythm",
    text: "The powers aˣ mod N loop with a period r. When r is even, N’s primes hide in gcd(a^(r/2) ± 1, N). Finding r is the hard part, and it’s the part a quantum computer does.",
    formula: "7ˣ mod 15: 1 7 4 13 1 → r = 4 · gcd(48, 15) = 3 · gcd(50, 15) = 5", hint: "The client’s last job: Shor’s algorithm finds r on a QPU, and your laptop does the rest.",
  },
};

export type CipherNpcId = "rootcap" | "lupe" | "tadeo" | "nina" | "paloma" | "dante" | "chispa" | "cero";
export type CipherNpc = TownNpc<CipherNpcId>;

const slots = (pairs: [string, string][]): CryptoSlot[] => pairs.map(([ask, answer]) => ({ ask, answer }));
const crypto = (title: string, text: string, pairs: [string, string][], tray: string[], feedback: string, aid?: CryptoAid): CryptoStep =>
  ({ kind: "crypto", title, text, slots: slots(pairs), tray, feedback, ...(aid ? { aid } : {}) });
const dial = (title: string, text: string, cipher: string, key: number, feedback: string): DialStep => ({ kind: "dial", title, text, cipher, key, feedback });
const question = (title: string, text: string, options: QuestionStep["options"], feedback: string): QuestionStep => ({ kind: "question", title, text, options, feedback });

/** Each neighbor pays for the hand, once. */
export const CARD_PAY = 10;

export const CIPHER_NPCS: CipherNpc[] = [
  {
    id: "lupe", title: "Lupe", description: "Graffiti artist · mural wall", at: { x: 6, y: 23 }, knowledge: "encoding",
    intro: [
      { speaker: "lupe", text: "Careful, wet paint! I’m Lupe. I hide words in my murals as numbers: A is 1, B is 2, all the way to Z, 26." },
      { speaker: "lupe", text: "People think the numbers are a code. They’re not. Help me stencil a couple and you’ll see why." },
    ],
    steps: [
      crypto("Paint HI", "Use the table: turn each letter into its number.", [["H", "8"], ["I", "9"]], ["7", "8", "9", "10", "18"],
        "H is the 8th letter and I the 9th: HI → 8 9.", { kind: "table" }),
      crypto("Read the wall", "Someone sprayed 3 1 16 under the bridge. Turn each number back into its letter.", [["3", "C"], ["1", "A"], ["16", "P"]], ["A", "B", "C", "O", "P", "Q"],
        "3 1 16 → CAP. You just read it without any key.", { kind: "table" }),
      question("Who can read it?", "Ale sends Brayan 8 9 over the wire, and a stranger copies it on the way. Who can read the message?", [
        { label: "Only Brayan: he has the secret", wrong: "There’s no secret: the table is the same for everyone." },
        { label: "Anyone who knows the A1Z26 table", correct: true },
        { label: "Nobody: it’s only numbers", wrong: "Numbers are just letters in another costume. You read 3 1 16 a moment ago." },
      ], "Right: an encoding is public by definition. To hide a message you need a key, and keys are Tadeo’s trade."),
    ],
    outro: [
      { speaker: "lupe", text: "See? Numbers are just letters in a costume. Ale and Brayan think their numbers are secret. They aren’t." },
      { speaker: "lupe", text: "Here are 10 credits for the stencils. Tadeo at the key kiosk says a real lock needs a key; go ask him." },
    ],
    repeat: [{ speaker: "lupe", text: "Still painting. A=1, B=2 … the table is on every wall in town." }],
  },
  {
    id: "tadeo", title: "Tadeo", description: "Locksmith · key kiosk", at: { x: 42, y: 23 }, knowledge: "keyspace",
    intro: [
      { speaker: "tadeo", text: "Name’s Tadeo. I cut keys. A lock is nothing without a key, and a key is nothing if there are only a few of them." },
      { speaker: "tadeo", text: "This brass wheel is Caesar’s lock: shift every letter forward by the key. Let’s lock a word, then pick one." },
    ],
    steps: [
      crypto("Lock CAT", "Key 3: every letter moves three places forward. Read the wheel: top letter in, bottom letter out.", [["C", "F"], ["A", "D"], ["T", "W"]], ["D", "E", "F", "G", "V", "W", "Z"],
        "CAT → FDW. Without the key it looks like noise.", { kind: "wheel", key: 3 }),
      dial("Pick the lock", "A customer locked themselves out of their own note: VWLU. Turn the wheel back one key at a time until it reads as a word.", "VWLU", 7,
        "Key 7: VWLU → OPEN. You didn’t need the key; you only needed patience."),
      question("How many keys?", "How many different Caesar keys actually change a message?", [
        { label: "26, one per letter", wrong: "Shifting by 26 lands every letter on itself: that key does nothing." },
        { label: "25", correct: true },
        { label: "Millions", wrong: "Count the wheel: only 25 shifts move any letter." },
      ], "25 keys: a laptop tries them all in a blink. A strong lock needs so many keys that trying them all takes longer than the age of the universe."),
    ],
    outro: [
      { speaker: "tadeo", text: "That’s the whole trade: a lock is as strong as its key space, and Caesar’s is tiny." },
      { speaker: "tadeo", text: "10 credits for the hand. Nina at the arcade has a counter that wraps around; she says big keys live on a clock." },
    ],
    repeat: [{ speaker: "tadeo", text: "Twenty-five keys on the Caesar wheel. That’s the whole problem." }],
  },
  {
    id: "nina", title: "Nina", description: "Arcade owner · the cabinets", at: { x: 10, y: 29 }, knowledge: "clock",
    intro: [
      { speaker: "nina", text: "Hey! I’m Nina, I run the arcade. My old score counter only goes up to 11, so after 11 it rolls back to 0." },
      { speaker: "nina", text: "Mathematicians call that mod. RSA is built on it. Play a round?" },
    ],
    steps: [
      crypto("The rolling counter", "The counter wraps at 12. Where does it land?", [["17 mod 12", "5"], ["25 mod 12", "1"], ["12 mod 12", "0"]], ["0", "1", "5", "7", "12", "13"],
        "Every 12 steps the counter is back where it started: 17 mod 12 = 5.", { kind: "clock", n: 12 }),
      crypto("Powers on the clock", "Now a clock with 7 marks. Multiply by 4 each round and wrap.", [["4¹ mod 7", "4"], ["4² mod 7", "2"], ["4³ mod 7", "1"], ["4⁴ mod 7", "4"]], ["1", "2", "3", "4", "5", "6"],
        "4, 2, 1, 4, 2, 1 … The powers fall into a loop three steps long.", { kind: "powers", base: 4, n: 7, upTo: 4 }),
      question("Why the loop?", "Why must the powers of 4 on a 7-mark clock repeat?", [
        { label: "Because 4 is even", wrong: "Try 3 on the same clock: it loops too, just longer." },
        { label: "The clock has only 7 marks, so the values must come back", correct: true },
        { label: "It’s a bug in the counter", wrong: "No bug: any power on a clock has to come back around." },
      ], "Only so many marks, so the values come back around. That loop has a length, and its length is the secret Shor’s algorithm hunts."),
    ],
    outro: [
      { speaker: "nina", text: "Every RSA lock lives on a clock like mine, only with hundreds of digits." },
      { speaker: "nina", text: "10 credits, and a free game later. Paloma, the courier by the lockers, uses this clock to make padlocks anyone can close." },
    ],
    repeat: [{ speaker: "nina", text: "17 mod 12 is still 5. The counter never lies." }],
  },
  {
    id: "paloma", title: "Paloma", description: "Courier · padlock lockers", at: { x: 48, y: 23 }, knowledge: "padlock",
    intro: [
      { speaker: "paloma", text: "Parcel for … oh, you’re new. I’m Paloma. Strangers send me secrets all day, and I’ve never met most of them." },
      { speaker: "paloma", text: "My trick: I hand out open padlocks. Anyone can snap one shut on a box; only my key opens it. Let’s make a padlock from two primes." },
    ],
    steps: [
      crypto("Forge the padlock", "Take the primes p = 3 and q = 11, and the public exponent e = 3. Work out the rest: d is the number with e·d mod φ = 1.",
        [["N = p·q", "33"], ["φ = (p−1)(q−1)", "20"], ["d: 3·d mod 20 = 1", "7"]], ["7", "9", "14", "20", "33", "36"],
        "N = 33, φ = 20 and d = 7, because 3·7 = 21 = 20 + 1. Hand out (33, 3); keep 7."),
      crypto("Lock and unlock", "A customer locks the message m = 4 with your public key. Then you open it with d = 7.",
        [["c = 4³ mod 33", "31"], ["m = 31⁷ mod 33", "4"]], ["4", "7", "12", "31", "64"],
        "64 wraps to 31 on the 33-mark clock, and 31⁷ wraps back to 4. Only d undoes e."),
      question("What stays secret?", "You publish the padlock (N = 33, e = 3). What must you never hand out?", [
        { label: "N", wrong: "N is printed on the padlock; everyone needs it to lock." },
        { label: "d, and the primes p and q that rebuild it", correct: true },
        { label: "e", wrong: "e is public too: it’s how strangers close the lock." },
      ], "Keep d, and p and q, which rebuild it. A 600-digit N is too big to split, so that padlock is safe. A small N isn’t."),
    ],
    outro: [
      { speaker: "paloma", text: "Now you can make a padlock and know exactly where it’s weak: whoever splits N rebuilds d." },
      { speaker: "paloma", text: "10 credits for the help with deliveries. Dante in the plaza says even a big N has a rhythm. Go listen." },
    ],
    repeat: [{ speaker: "paloma", text: "Public padlock, private key. And never a small N." }],
  },
  {
    id: "dante", title: "Dante", description: "Street DJ · the plaza", at: { x: 51, y: 29 }, knowledge: "rhythm",
    intro: [
      { speaker: "dante", text: "Yo! Dante. I spin loops. Every track has a beat that comes back around, and once you hear it you know the whole song." },
      { speaker: "dante", text: "Numbers have beats too. Count 7, 49, 343 … on a 15-mark clock and listen." },
    ],
    steps: [
      crypto("Find the beat", "Multiply by 7 each step, on a clock with 15 marks.", [["7⁰ mod 15", "1"], ["7¹ mod 15", "7"], ["7² mod 15", "4"], ["7³ mod 15", "13"], ["7⁴ mod 15", "1"]], ["1", "4", "7", "8", "13", "14"],
        "1, 7, 4, 13, then 1 again. The beat is 4 steps long: r = 4.", { kind: "powers", base: 7, n: 15, upTo: 4 }),
      crypto("Drop the primes", "The beat r = 4 is even, so 7^(r/2) = 49 holds the primes. Take the greatest common divisor with 15.",
        [["r", "4"], ["gcd(49 − 1, 15)", "3"], ["gcd(49 + 1, 15)", "5"]], ["2", "3", "4", "5", "15"],
        "gcd(48, 15) = 3 and gcd(50, 15) = 5. Its own rhythm splits 15 into 3 · 5."),
      question("Who hears the beat?", "For a 600-digit N, the loop is far too long to count by hand. What does a quantum computer do?", [
        { label: "Tries every key, very fast", wrong: "That’s brute force. A quantum computer isn’t a faster laptop." },
        { label: "Spreads over every x with H, then lets interference pick out r", correct: true },
        { label: "Reads the primes straight out of N", wrong: "No machine reads primes off N; it finds the period, and gcd does the rest." },
      ], "Right: superposition to play every x at once, interference to make the beat r stand out. That’s Shor’s algorithm, and it’s why RSA needs a post-quantum replacement."),
    ],
    outro: [
      { speaker: "dante", text: "You heard it: the beat splits the number. That’s everything the client’s last job needs." },
      { speaker: "dante", text: "10 credits, and keep the headphones. Root Cap will want to hear you’ve learned all five." },
    ],
    repeat: [{ speaker: "dante", text: "1, 7, 4, 13 … and back to 1. Can you hear it?" }],
  },
  { id: "rootcap", title: "Root Cap", description: "Network admin · south gate", at: { x: 32, y: 31 }, intro: [], steps: [], outro: [], repeat: [] },
  { id: "chispa", title: "Chispa", description: "Gear stall", at: { x: 36, y: 23 }, intro: [], steps: [], outro: [], repeat: [] },
  { id: "cero", title: "Cero", description: "Bounty board", at: { x: 23, y: 23 }, intro: [], steps: [], outro: [], repeat: [] },
];

export function cipherNpc(id: CipherNpcId): CipherNpc {
  return CIPHER_NPCS.find((npc) => npc.id === id)!;
}

export const ROOT = {
  welcome: { speaker: "rootcap", text: "Hey, watch the cables! I’m Cap, root admin of Cipher Town: I keep the network up and the lights blinking. My cousin Keeper Cap said someone who talks to ghosts was coming north." },
  client: { speaker: "rootcap", text: "There’s a client parked on the street up north, hiring someone to read Ale and Brayan’s messages. Learn how the locks are built before you sell yourself as someone who picks them." },
  guide: { speaker: "rootcap", text: "Lupe paints the mural, Tadeo cuts keys, Nina runs the arcade, Paloma delivers parcels and Dante spins records in the plaza. Chispa sells gear and Cero posts bounties. You don’t need the neighbors for the client’s jobs, but the Cipher Badge needs everything." },
  actsWaiting: { speaker: "rootcap", text: "The client’s jobs aren’t finished: four messages, four locks." },
  actsDone: { speaker: "rootcap", text: "All four messages, from plain numbers to RSA. Ale and Brayan are already shopping for a better lock." },
  ready: { speaker: "rootcap", text: "Five cards and four jobs. Encoding isn’t secrecy, a key needs a huge key space, locks live on clocks, a public padlock hides a private key, and a quantum computer hears the rhythm that splits N. That’s public-key crypto, and that’s the Cipher Badge." },
  done: { speaker: "rootcap", text: "The badge is yours, and the north road is open: Quantum Town is up there, where Professor Thecap keeps a replay door for everything. The south road goes back to Coin Town." },
} satisfies Record<string, Line>;
export const CARD_COUNT = "You have {count} of 5 Cipher cards.";

/** What each act needs from Chispa's stall; the client won't start a job without it. */
export type GearId = "sniffer" | "wheel" | "factorkit" | "voucher";
export interface Gear {
  id: GearId; act: ActNumber; price: number; glyph: string; title: string; text: string;
  /** The objective while it's missing, and what the client says without it. */
  objective: string; need: string;
}
export const GEAR: Gear[] = [
  { id: "sniffer", act: 1, price: 20, glyph: "⌁", title: "Sniffer", text: "A passive clip-on tap. It copies the line without touching it.",
    objective: "Buy a sniffer at Chispa’s stall", need: "Not without a sniffer. Chispa sells one for 20 credits. Come back when you have it." },
  { id: "wheel", act: 2, price: 30, glyph: "◎", title: "Shift wheel", text: "A laptop plug-in that sweeps every Caesar shift.",
    objective: "Buy a shift wheel at Chispa’s stall", need: "This one is shifted. Get a shift wheel from Chispa first: 30 credits." },
  { id: "factorkit", act: 3, price: 40, glyph: "÷", title: "Factor kit", text: "Clock-math tools for splitting a small N and rebuilding d.",
    objective: "Buy a factor kit at Chispa’s stall", need: "They’ve moved to a padlock. You’ll want Chispa’s factor kit: 40 credits." },
  { id: "voucher", act: 4, price: 60, glyph: "⚛", title: "QPU voucher", text: "Prepaid time on a hosted quantum computer.",
    objective: "Buy a QPU voucher at Chispa’s stall", need: "Nobody factors this by hand. Buy a QPU voucher from Chispa, 60 credits, and we’ll talk." },
];
/** The objective once the gear is in hand. */
export const JOB_OBJECTIVES: Record<ActNumber, string> = {
  1: "Take the client’s first job at the parked car",
  2: "Take the client’s second job at the parked car",
  3: "Take the client’s third job at the parked car",
  4: "Take the client’s last job at the parked car",
};
export function gearFor(act: ActNumber): Gear { return GEAR.find((item) => item.act === act)!; }
/** The client's advance buys the sniffer, and each fee buys the next job's gear. */
export const CLIENT_ADVANCE = 20;
export const ACT_PAYOUT: Record<ActNumber, number> = { 1: 30, 2: 40, 3: 60, 4: 80 };
export const BOUNTY_PAY = 5;

export const CLIENT = {
  advance: [
    { speaker: "boss", text: "So you’re the one Root Cap keeps talking about. I pay for words, not excuses. Twenty credits up front." },
    { speaker: "boss", text: "Ale and Brayan talk over the line between those buildings. Before you go near it, buy a sniffer at Chispa’s stall. I don’t hire people who cut wires." },
  ],
} satisfies Record<string, Line[]>;

export const CHISPA = {
  hello: { speaker: "chispa", text: "Chispa’s gear stall. The sparks are free; the gear isn’t." },
  bought: { speaker: "chispa", text: "Pleasure doing business. Bring it back in one piece." },
  short: { speaker: "chispa", text: "You’re short. The client pays for every job, and Cero’s bounties pay too." },
} satisfies Record<string, Line>;

export const CIPHER_SIGNS = {
  northClosed: { speaker: "system", text: "North road · Quantum Town. The gate opens for holders of the Cipher Badge. Root Cap hands it out, by the south gate." },
} satisfies Record<string, Line>;

export const CERO = {
  hello: { speaker: "cero", text: "Cero. I post bounties: small locks people want opened. Solve one, five credits. Every time." },
  paid: { speaker: "cero", text: "Clean work. Five credits. There’s always another." },
} satisfies Record<string, Line>;

/** Coin Town's north road arrives up these columns; walking off the bottom row goes back. */
export const CIPHER_SOUTH_ROAD = [29, 30, 31];
export const CIPHER_SPAWN = { x: 30, y: 33 };
/** The road north to Quantum Town, behind a gate on CIPHER_NORTH_GATE_ROW. */
export const CIPHER_NORTH_ROAD = [8, 9];
export const CIPHER_NORTH_GATE_ROW = 1;
export const CIPHER_FROM_NORTH = { x: 8, y: 2 };
export const CIPHER_BOARD = { at: { x: 20, y: 22 }, stand: { x: 20, y: 23 } };

export const CIPHER_ANIMALS: AnimalSpec[] = [
  { kind: "pigeon", home: { x: 34, y: 28 }, radius: 4, shy: true },
  { kind: "pigeon", home: { x: 14, y: 16 }, radius: 3, shy: true },
  { kind: "cat", home: { x: 19, y: 18 }, radius: 5 },
  { kind: "drone", home: { x: 40, y: 19 }, radius: 4 },
];

export const CIPHER_PROPS: PropSpec[] = [
  // Lupe's mural.
  ...[3, 4, 5, 6, 7, 8].map((x) => ({ sprite: "mural" as const, at: { x, y: 21 } })),
  // Cero's bounty board and a phone booth.
  { sprite: "board", at: CIPHER_BOARD.at }, { sprite: "phonebooth", at: { x: 26, y: 21 } },
  // The kiosk row: Chispa's stall, Tadeo's keys, Paloma's lockers.
  { sprite: "crt", at: { x: 34, y: 22 } }, { sprite: "stall", at: { x: 36, y: 22 } }, { sprite: "vending", at: { x: 38, y: 22 } },
  { sprite: "keykiosk", at: { x: 42, y: 22 } },
  ...[47, 48, 49].map((x) => ({ sprite: "lockers" as const, at: { x, y: 22 } })),
  // Nina's arcade.
  ...[7, 8, 12, 13].map((x) => ({ sprite: "arcade" as const, at: { x, y: 28 } })),
  { sprite: "crt", at: { x: 17, y: 29 } }, { sprite: "crt", at: { x: 18, y: 30 } },
  // Dante's plaza.
  { sprite: "djbooth", at: { x: 51, y: 28 } }, { sprite: "neon", at: { x: 47, y: 28 } }, { sprite: "neon", at: { x: 55, y: 28 } },
  // The server racks behind the plaza and the antennas on the north-west block.
  ...[55, 56, 57, 58].map((x) => ({ sprite: "rack" as const, at: { x, y: 20 } })),
  { sprite: "antenna-top", at: { x: 24, y: 5 } }, { sprite: "antenna-base", at: { x: 24, y: 6 } },
  { sprite: "dish", at: { x: 11, y: 5 } }, { sprite: "neon", at: { x: 2, y: 15 } },
  { sprite: "reel", at: { x: 25, y: 30 } }, { sprite: "reel", at: { x: 3, y: 32 } }, { sprite: "vending", at: { x: 60, y: 31 } },
];

/** Superscript digits for exponents written on a bench. */
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (value: number) => [...String(value)].map((digit) => SUP[Number(digit)]).join("");
const LETTERS = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

/** Cero's board: a small lock rebuilt from its seed, so the same bounty survives a reload. */
export function makeBounty(seed: number): CryptoStep | DialStep {
  const random = seeded(seed);
  const kind = seed % 4;
  if (kind === 0) {
    const word = pick(random, BOUNTY_WORDS);
    const letters = [...word];
    return { ...crypto("Numbers on a wall", "Someone left numbers on the wall. Decode them with the table.",
      letters.map((letter) => [String(letterNumber(letter)), letter]),
      trayFor(letters, [0, 1, 2].map(() => pick(random, LETTERS.filter((letter) => !letters.includes(letter)))), random),
      "{word}: the table was the only “key”.", { kind: "table" }), vars: { word } };
  }
  if (kind === 1) {
    const word = pick(random, BOUNTY_WORDS);
    const key = 1 + Math.floor(random() * 25);
    return dial("A shifted note", "A note locked with a Caesar shift. Turn the wheel until it reads as a word.", caesar(word, key), key, "Opened by sweeping the keys.");
  }
  const toy = pick(random, TOY_KEYS);
  const n = toy.p * toy.q;
  if (kind === 2) {
    return { ...crypto("Split a padlock", "A padlock with N = {n}. Find its two primes, smaller one first.",
      [["p", String(toy.p)], ["q", String(toy.q)]], trayFor([String(toy.p), String(toy.q)], ["2", "3", "5", "7", "11", "13"], random),
      "Split. Now its private key is easy to rebuild."), vars: { n } };
  }
  const m = 2 + Math.floor(random() * (n - 3));
  const c = modPow(m, toy.e, n);
  return { ...crypto("Open a padlock", "The padlock is (N = {n}, e = {e}) and its private key is d = {d}. Open the box.",
    [[`m = ${c}${sup(toy.d)} mod ${n}`, String(m)]], trayFor([String(m)], [String(c), String(n - m), String((m + 1) % n), String(toy.d)], random),
    "Opened. Only d undoes e."), vars: { n, e: toy.e, d: toy.d } };
}

