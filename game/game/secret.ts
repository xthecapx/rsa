/**
 * Picks the message Ale sends this run.
 *
 * Acts 1 and 2 can carry a whole word: the mapping and the Caesar shift work
 * one character at a time, so the wire just carries more of them. Acts 3 and 4
 * are stuck with a single letter, because the toy RSA modulus (15 or 21) can
 * only carry a number smaller than itself -- which is a point those acts make
 * out loud rather than hide.
 */

/** Short enough to decode by hand, and in character for the two of them. */
const WORDS = [
  "MEET",
  "TONIGHT",
  "ROOF",
  "SAME",
  "PLACE",
  "MISS",
  "SOON",
  "CAFE",
  "LATE",
  "STAIRS",
];

export interface Secret {
  /** The plaintext the player has to hand back to the client. */
  message: string;
  /** First character, for the acts that can only carry one. */
  letter: string;
  /** Numeric value of that first character. */
  value: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** A=1 .. Z=26, the mapping Ale and Brayan agree on in the prologue. */
export function valueOf(char: string): number {
  return char.toUpperCase().charCodeAt(0) - 64;
}

export function charOf(value: number): string {
  return String.fromCharCode(64 + value);
}

export function lettersOf(message: string): string[] {
  return message.toUpperCase().split("");
}

export function pickSecret(kind: "word" | "letter", modulus: number): Secret {
  if (kind === "word") {
    const message = WORDS[Math.floor(Math.random() * WORDS.length)];
    return { message, letter: message[0], value: valueOf(message[0]) };
  }

  // Modular arithmetic needs a value below the modulus and coprime to it,
  // otherwise the message is not recoverable.
  const usable = Array.from({ length: 26 }, (_, i) => i + 1).filter(
    (v) => v < modulus && gcd(v, modulus) === 1,
  );
  const value = usable[Math.floor(Math.random() * usable.length)];
  const letter = charOf(value);
  return { message: letter, letter, value };
}
