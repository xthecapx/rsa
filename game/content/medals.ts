import type { ScenarioId } from "./scenarios";

/** Knowledge medals: one per finished lesson. Each medal is a skill the player keeps
 * for later challenges (a battle system will read `ability`). Replaying a lesson never
 * removes a medal; only "Start the whole game over" clears the case. */
export interface Medal {
  id: MedalId;
  scenario: ScenarioId;
  mission: string;
  glyph: string;
  title: string;
  skill: string;
  description: string;
  ability: string;
  hint: string;
}

export type MedalId = "quantum-coin" | "coin-town" | "codebook" | "key-ring" | "prime-cutter" | "period-lens" | "amplifier" | "foundry-town" | "ghost-key" | "hollow-town" | "cipher-town";

export const MEDALS: readonly Medal[] = [
  {
    id: "quantum-coin", scenario: "coin", mission: "coin", glyph: "◐",
    title: "Quantum Coin", skill: "Superposition",
    description: "You built and simulated a one-qubit circuit that gives 0 or 1 with equal probability. On ideal quantum hardware, the circuit tells you the odds, not the next result.",
    ability: "Fair Toss: prepare |0⟩, apply H, then measure for an equal chance of 0 or 1.",
    hint: "Finish Who Goes First? in the coin house.",
  },
  {
    id: "coin-town", scenario: "coin", mission: "town", glyph: "✪",
    title: "Coin Town Badge", skill: "Qubit states · |0⟩ |1⟩ |+⟩ |−⟩",
    description: "You settled game night with a fair quantum coin. The town’s optional neighbor lessons explore qubit states, gates, interference and hidden signs.",
    ability: "Qubit Sense: prepare |0⟩, |1⟩, |+⟩ or |−⟩ and read the ± basis with H before measuring.",
    hint: "Settle the coin toss, then visit Mayor Cap. Knowledge cards are optional.",
  },
  {
    id: "codebook", scenario: "rsa", mission: "1", glyph: "≡",
    title: "Codebook", skill: "Decoding",
    description: "You read a message that was only encoded, not encrypted. A shared table is not a secret.",
    ability: "Read Table: turn intercepted numbers back into letters instantly.",
    hint: "Clear Act 1: Plaintext with the RSA client.",
  },
  {
    id: "key-ring", scenario: "rsa", mission: "2", glyph: "⚷",
    title: "Key Ring", skill: "Brute force",
    description: "You tried every Caesar shift until words appeared. A tiny key space is no protection.",
    ability: "Shift Sweep: try all 25 shifts of a Caesar cipher in one move.",
    hint: "Clear Act 2: Caesar with the RSA client.",
  },
  {
    id: "prime-cutter", scenario: "rsa", mission: "3", glyph: "÷",
    title: "Prime Cutter", skill: "Factoring",
    description: "You split a small N into p·q, rebuilt the private key d, and decrypted with modular arithmetic.",
    ability: "Factor Strike: split a small modulus into its primes and rebuild the private key.",
    hint: "Clear Act 3: RSA with the RSA client.",
  },
  {
    id: "period-lens", scenario: "rsa", mission: "4", glyph: "◎",
    title: "Quantum Solver", skill: "Shor’s algorithm",
    description: "You connected classical processing to a quantum circuit. Your laptop used the circuit’s measurements to find a period, then recovered the factors, key, and message.",
    ability: "Quantum Solve: hand the hard step to a QPU, then finish the job on a classical machine.",
    hint: "Clear Act 4: Shor with the RSA client.",
  },
  {
    id: "amplifier", scenario: "grover", mission: "grover", glyph: "▲",
    title: "Amplitude Amplifier", skill: "Grover search",
    description: "You prepared all sixteen PINs in superposition, then used three Oracle and Diffuser rounds to make the right PIN much more likely.",
    ability: "Needle Finder: find one marked item among N in about √N queries.",
    hint: "Disarm the drone core in Thecap’s workshop.",
  },
  {
    id: "foundry-town", scenario: "grover", mission: "town", glyph: "⚙",
    title: "Foundry Badge", skill: "Amplitude amplification",
    description: "You disarmed the drone core with Grover’s search. The crew’s optional lessons explore registers, the Oracle, the Diffuser and the right number of rounds.",
    ability: "Round Counter: build Grover rounds from an Oracle and a Diffuser and stop at about π/4·√N.",
    hint: "Disarm the drone core, then visit VP Cap. Knowledge cards are optional.",
  },
  {
    id: "ghost-key", scenario: "vault", mission: "vault", glyph: "±",
    title: "Ghost Key", skill: "Phase kickback · Bernstein–Vazirani",
    description: "You put a helper qubit in |−⟩, turned a parity lock’s answers into phases, and read a 25-bit secret with one question.",
    ability: "Parity Read: learn an n-bit secret s from f(x) = s·x in a single query.",
    hint: "Open the vault in Casa Ofelia.",
  },
  {
    id: "hollow-town", scenario: "vault", mission: "town", glyph: "🕯",
    title: "Hollow Badge", skill: "Phase kickback",
    description: "You opened Anselmo’s vault using phase kickback. The neighbors’ optional lessons explore controlled gates, the helper qubit, parity and the one-question trick.",
    ability: "Kickback: turn an Oracle’s answer into a phase with a |−⟩ helper, and read it with H.",
    hint: "Open the vault in Casa Ofelia, then visit Keeper Cap. Knowledge cards are optional.",
  },
  {
    id: "cipher-town", scenario: "rsa", mission: "town", glyph: "🔐",
    title: "Cipher Badge", skill: "Public-key crypto",
    description: "You finished all four of the client’s jobs, from encoding to Shor’s algorithm. The neighbors’ optional lessons explore keys, clock math and public padlocks.",
    ability: "Padlock Sense: build an RSA key from two primes, and know that whoever splits N, or hears its rhythm, opens it.",
    hint: "Finish all four client jobs, then visit Root Cap. Knowledge cards are optional.",
  },
];

export function medalFor(scenario: ScenarioId, mission: string): Medal | undefined {
  return MEDALS.find((medal) => medal.scenario === scenario && medal.mission === mission);
}
export function getMedal(id: MedalId): Medal {
  return MEDALS.find((medal) => medal.id === id)!;
}
