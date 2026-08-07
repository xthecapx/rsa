import type { ActNumber, ActScript } from "./types";
import { act1 } from "./acts/act1";
import { act2 } from "./acts/act2";
import { act3 } from "./acts/act3";
import { act4 } from "./acts/act4";

/**
 * All the writing lives in content/acts/*.ts. To change the story you only
 * ever need to edit those four files: the engine, the HUD and the backend
 * calls are driven by the `effects` on each node.
 *
 * Placeholders you can use inside any line, written as `{name}`:
 *
 *   {message}         the plaintext Ale sent this run, and the answer the
 *                     player has to type at the car
 *   {cipherText}      what actually crossed the wire, ready to display
 *   {values}          the numbers behind it, space separated
 *   {letter}          first character of the message
 *   {value}           that letter as a number, A=1 .. Z=26
 *   {shift}           the Caesar key k, once it is known
 *   {cipherChar}      the first Caesar ciphertext letter
 *   {crackMs}         milliseconds the 25-shift brute force took
 *   {modulus}         the RSA modulus N (15 or 21)
 *   {e} {d} {p} {q}   RSA exponents and prime factors
 *   {cipherNumber}    the RSA ciphertext c
 *   {factors}         the factorisation of N, as "3 x 5"
 *   {projectedYears}  projected years to break RSA-2048 classically
 *   {base}            the base a used for period finding
 *   {order}           the period r recovered by Shor
 *   {qpuName}         which backend produced the result
 *   {recovered}       the letter recovered after rebuilding the private key
 *
 * An unknown placeholder is left on screen verbatim, so typos are visible
 * rather than silently blank.
 */
const ACTS: Record<ActNumber, ActScript> = {
  1: act1 as ActScript,
  2: act2 as ActScript,
  3: act3 as ActScript,
  4: act4 as ActScript,
};

export const ACT_NUMBERS: ActNumber[] = [1, 2, 3, 4];

export function getAct(act: ActNumber): ActScript {
  return ACTS[act];
}

export { act1, act2, act3, act4 };
