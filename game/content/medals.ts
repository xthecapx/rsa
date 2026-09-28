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

export type MedalId = "quantum-coin" | "codebook" | "key-ring" | "prime-cutter" | "period-lens";

export const MEDALS: readonly Medal[] = [
  {
    id: "quantum-coin", scenario: "coin", mission: "coin", glyph: "◐",
    title: "Quantum Coin", skill: "Superposition",
    description: "You built a one-qubit circuit whose outcome nobody can predict, not even with the source code.",
    ability: "Fair Toss: produce a truly unpredictable bit with H then measure.",
    hint: "Finish Who Goes First? in the coin house.",
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
];

export function medalFor(scenario: ScenarioId, mission: string): Medal | undefined {
  return MEDALS.find((medal) => medal.scenario === scenario && medal.mission === mission);
}
export function getMedal(id: MedalId): Medal {
  return MEDALS.find((medal) => medal.id === id)!;
}
