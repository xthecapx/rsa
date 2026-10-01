import type { Speaker } from "./types";

export type VaultStep = "welcome" | "classical" | "freeze" | "lucky" | "groverWire" | "groverBoard" | "groverRun"
  | "diagnostics" | "ledger" | "bvWire" | "execute" | "unlock" | "done";
export type VaultPlace = "vault" | "desk" | "table";
interface Scene {
  title: string;
  objective: string;
  place: VaultPlace;
  lines: { speaker: Speaker; text: string }[];
}

export const VAULT_STEPS: VaultStep[] = ["welcome", "classical", "freeze", "lucky", "groverWire", "groverBoard", "groverRun",
  "diagnostics", "ledger", "bvWire", "execute", "unlock", "done"];

export const VAULT_SCENES: Record<VaultStep, Scene> = {
  welcome: {
    title: "A house that knocks", place: "vault", objective: "Talk to Doña Ofelia by the vault.",
    lines: [
      { speaker: "ofelia", text: "You’re the one who quieted Anselmo’s drone? Good. Then you can quiet his vault." },
      { speaker: "ofelia", text: "Keeper Cap says you’ve been asking the neighbors questions. Keep asking. The vault only answers questions too." },
      { speaker: "ofelia", text: "Every night it knocks. Anselmo’s vault answers questions, but only three a night. Then the candles die and the house goes cold." },
      { speaker: "ofelia", text: "Twenty-five tumblers. His last letter is in there. Help me open it." },
    ],
  },
  classical: {
    title: "The séance", place: "vault", objective: "Mark tumblers for the ghost and ask. Three candles tonight.",
    lines: [
      { speaker: "ofelia", text: "The vault hides a code: 25 digits, each 0 or 1. The ghost knows it." },
      { speaker: "ofelia", text: "Mark a tumbler for the ghost and ask. A knock means its digit is 1. Silence means 0." },
      { speaker: "system", text: "In quantum terms the ghost is the vault’s Oracle: a sealed box that knows the code and only answers questions." },
      { speaker: "ofelia", text: "Three candles, three questions. At midnight the code changes. We can’t open it tonight — let’s find out why." },
    ],
  },
  freeze: {
    title: "The house goes cold", place: "vault", objective: "Answer the midnight question.",
    lines: [
      { speaker: "system", text: "The house has gone cold. At midnight the lock forgets." },
      { speaker: "ofelia", text: "Every morning he changed the combination. Even now, apparently." },
      { speaker: "ofelia", text: "Tell me, then: asking like that, how long would it take to open?" },
    ],
  },
  lucky: {
    title: "A lucky guess", place: "vault", objective: "The lock re-keyed. Solve it properly, with the laptop.",
    lines: [
      { speaker: "ofelia", text: "You’re lucky! But luck isn’t a method." },
      { speaker: "system", text: "The door slams before it opens. The lock re-keys." },
      { speaker: "ofelia", text: "Let’s do it properly, with the laptop." },
    ],
  },
  groverWire: {
    title: "The trick that beat the drone", place: "desk", objective: "At the laptop, rebuild the Grover search on the 25-qubit register.",
    lines: [
      { speaker: "ofelia", text: "Anselmo’s drone lost to your Grover trick? Then it will work on his vault." },
      { speaker: "system", text: "Grover: spread a guess over every key, then grow the right one round by round. It found one PIN in sixteen." },
    ],
  },
  groverBoard: {
    title: "How many rounds?", place: "table", objective: "At the table, work out how many Grover rounds 25 bits need.",
    lines: [
      { speaker: "system", text: "Same formula as in the workshop: about π/4 · √N rounds. Only N is bigger." },
    ],
  },
  groverRun: {
    title: "Grover against the vault", place: "desk", objective: "Run the Grover search on tonight’s three candles.",
    lines: [
      { speaker: "ofelia", text: "Four thousand five hundred and forty-nine questions. I have three candles." },
      { speaker: "ofelia", text: "Run it anyway. I want to see it fail with my own eyes." },
    ],
  },
  diagnostics: {
    title: "The Colonel’s manual", place: "desk", objective: "Scan the Colonel’s manual with the laptop.",
    lines: [
      { speaker: "system", text: "The house has gone cold again. At midnight the lock forgets." },
      { speaker: "ofelia", text: "Wait. Anselmo kept the vault’s manual in this drawer. He always said a lock should have a rule, not a secret list." },
    ],
  },
  ledger: {
    title: "One tumbler, one sign", place: "table", objective: "At the table, follow one qubit through the ghost.",
    lines: [
      { speaker: "ofelia", text: "Explain it to me with one tumbler. I’m old, not slow." },
      { speaker: "system", text: "The ghost is the vault’s Oracle, and it only ever flips the helper qubit. Follow what that does to a tumbler’s qubit." },
      { speaker: "system", text: "This is Rocío’s kickback: aim a flip at a |−⟩ helper and the minus sign travels back to the qubit that controlled it." },
    ],
  },
  bvWire: {
    title: "Open the black box", place: "desk", objective: "Build the one-question circuit from boxes.",
    lines: [
      { speaker: "system", text: "Remember the sealed Oracle in the workshop? It had a helper qubit hidden inside. This time you prepare the helper yourself." },
      { speaker: "system", text: "Put the helper in |−⟩, Candela’s flip-proof candle, and the Oracle’s answer, the ghost’s knock, becomes a phase. Then read the phases with H." },
    ],
  },
  execute: {
    title: "One question", place: "desk", objective: "Execute the circuit: one question to the ghost.",
    lines: [
      { speaker: "ofelia", text: "One candle. All twenty-five tumblers?" },
      { speaker: "system", text: "One question." },
    ],
  },
  unlock: {
    title: "Open the vault", place: "vault", objective: "Drag the mask onto the tumblers. Opening the door is free.",
    lines: [
      { speaker: "ofelia", text: "Those are his numbers. Put them in the tumblers." },
    ],
  },
  done: {
    title: "The ghost is laid to rest", place: "vault", objective: "The vault is open. Return to town when you’re ready.",
    lines: [
      { speaker: "ofelia", text: "…It’s his handwriting." },
      { speaker: "ofelia", text: "So there never was a ghost." },
      { speaker: "system", text: "Only one thing in that house was invisible: the phase. Twenty-five questions by hand, about 4,549 with Grover, one with Bernstein–Vazirani." },
      { speaker: "ofelia", text: "Two candles left. I’ll keep them for Anselmo." },
    ],
  },
};
