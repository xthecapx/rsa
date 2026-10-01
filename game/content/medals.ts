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

export type MedalId = "quantum-coin" | "coin-town" | "codebook" | "key-ring" | "prime-cutter" | "period-lens" | "amplifier" | "foundry-town" | "ghost-key" | "hollow-town";

export const MEDALS: readonly Medal[] = [
  {
    id: "quantum-coin", scenario: "coin", mission: "coin", glyph: "◐",
    title: "Quantum Coin", skill: "Superposition",
    description: "You built a one-qubit circuit whose outcome nobody can predict, not even with the source code.",
    ability: "Fair Toss: produce a truly unpredictable bit with H then measure.",
    hint: "Finish Who Goes First? in the coin house.",
  },
  {
    id: "coin-town", scenario: "coin", mission: "town", glyph: "✪",
    title: "Coin Town Badge", skill: "Qubit states · |0⟩ |1⟩ |+⟩ |−⟩",
    description: "You learned what a single qubit can be, how H and Z move it, how interference cancels amplitudes and how to read a hidden sign, then settled game night with a fair quantum coin.",
    ability: "Qubit Sense: prepare |0⟩, |1⟩, |+⟩ or |−⟩ and read the ± basis with H before measuring.",
    hint: "Collect all five knowledge cards in Coin Town and settle the coin toss.",
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
    description: "You wired a classical program around a quantum processor: the Shor box found the period, and your laptop turned it into factors, a key and the message.",
    ability: "Quantum Solve: hand the hard step to a QPU, then finish the job on a classical machine.",
    hint: "Clear Act 4: Shor with the RSA client.",
  },
  {
    id: "amplifier", scenario: "grover", mission: "grover", glyph: "▲",
    title: "Amplitude Amplifier", skill: "Grover search",
    description: "You spread a guess over all sixteen PINs, then let the Oracle and Diffuser grow the right one in three rounds.",
    ability: "Needle Finder: find one marked item among N in about √N queries.",
    hint: "Disarm the drone core in Thecap’s workshop.",
  },
  {
    id: "foundry-town", scenario: "grover", mission: "town", glyph: "⚙",
    title: "Foundry Badge", skill: "Amplitude amplification",
    description: "You learned how a register holds 2ⁿ states, how one H box spreads it evenly, how the Oracle marks the answer with a hidden minus, how the Diffuser lifts it and when to stop, then disarmed the drone core.",
    ability: "Round Counter: build Grover rounds from an Oracle and a Diffuser and stop at about π/4·√N.",
    hint: "Collect all five Foundry cards and disarm the drone core in Thecap’s workshop.",
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
    description: "You learned how a CNOT flips only when its control is 1, why a flip only hands |−⟩ a minus sign, how that minus kicks back onto the control, what parity the ghost answers and how one question reads it all, then opened Anselmo’s vault.",
    ability: "Kickback: turn an Oracle’s answer into a phase with a |−⟩ helper, and read it with H.",
    hint: "Collect all five Hollow cards and open the vault in Casa Ofelia.",
  },
];

export function medalFor(scenario: ScenarioId, mission: string): Medal | undefined {
  return MEDALS.find((medal) => medal.scenario === scenario && medal.mission === mission);
}
export function getMedal(id: MedalId): Medal {
  return MEDALS.find((medal) => medal.id === id)!;
}
