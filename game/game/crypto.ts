/**
 * The small arithmetic behind Cipher Town's benches and bounties: the A1Z26
 * table, Caesar shifts, clock (modular) arithmetic and toy RSA. Everything is
 * pure so the tests can solve every bench without a browser.
 */
const A = "A".charCodeAt(0);

/** A=1 … Z=26: an encoding everyone can read. */
export function letterNumber(letter: string): number { return letter.toUpperCase().charCodeAt(0) - A + 1; }
export function numberLetter(value: number): string { return String.fromCharCode(A + ((value - 1) % 26 + 26) % 26); }

/** Shift every letter forward by `key`; a negative key shifts back. */
export function caesar(text: string, key: number): string {
  return text.toUpperCase().replace(/[A-Z]/g, (letter) => String.fromCharCode(A + ((letter.charCodeAt(0) - A + key) % 26 + 26) % 26));
}

export function mod(value: number, n: number): number { return ((value % n) + n) % n; }
export function modPow(base: number, exponent: number, n: number): number {
  let result = 1 % n, b = mod(base, n), e = exponent;
  while (e > 0) { if (e & 1) result = (result * b) % n; b = (b * b) % n; e >>= 1; }
  return result;
}
export function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
/** The d with e·d ≡ 1 (mod φ), or null when e and φ share a factor. */
export function modInverse(e: number, phi: number): number | null {
  for (let d = 1; d < phi; d++) if ((e * d) % phi === 1) return d;
  return null;
}
/** The smallest r > 0 with aʳ ≡ 1 (mod n): the rhythm Shor's algorithm listens for. */
export function period(a: number, n: number): number | null {
  if (gcd(a, n) !== 1) return null;
  for (let r = 1, value = a % n; r <= n; r++, value = (value * a) % n) if (value === 1) return r;
  return null;
}

/** One slot of a bench: what it asks, written in math only so it reads the same in every language, and the piece that answers it. */
export interface CryptoSlot { ask: string; answer: string }

/** Every slot holds its answer. */
export function slotsSolved(slots: CryptoSlot[], placed: (string | null)[]): boolean {
  return slots.every((slot, i) => placed[i] === slot.answer);
}

/** A tiny deterministic generator, so a bounty can be rebuilt from its seed. */
export function seeded(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}
export function pick<T>(random: () => number, items: readonly T[]): T { return items[Math.floor(random() * items.length)]; }
/** The answers plus a few look-alikes, deduplicated and shuffled. */
export function trayFor(answers: string[], decoys: string[], random: () => number): string[] {
  const tray = [...new Set([...answers, ...decoys])];
  for (let i = tray.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [tray[i], tray[j]] = [tray[j], tray[i]]; }
  return tray;
}

export const BOUNTY_WORDS = ["CODE", "LOCK", "KEY", "BYTE", "ROOT", "WIRE", "PORT", "NODE", "HASH", "SAFE"] as const;
/** Toy RSA keys whose arithmetic fits on a bench: N = p·q, e public, d private. */
export const TOY_KEYS = [
  { p: 3, q: 5, e: 3, d: 3 }, { p: 3, q: 7, e: 5, d: 5 }, { p: 3, q: 11, e: 3, d: 7 }, { p: 5, q: 7, e: 5, d: 5 }, { p: 3, q: 13, e: 5, d: 5 },
] as const;
