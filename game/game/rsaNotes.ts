import type { ActNumber } from "@/content/types";
import type { GameState } from "./state";
import { caesar, gcd, modPow } from "./crypto";
import { isToyModulus } from "./secret";

export interface RsaNote {
  label:
    | "Alphabet encoding"
    | "Caesar shift k"
    | "Modulus N"
    | "Public exponent e"
    | "Prime factors p, q"
    | "Totient φ(N)"
    | "Private exponent d"
    | "Period r"
    | "Reference period r";
  value: string;
}

type Evidence = Pick<GameState, "act" | "capture" | "vars" | "labMemory">;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const note = (label: RsaNote["label"], value: string | number): RsaNote => ({
  label,
  value: String(value),
});

/** Display earned evidence for this act, never the story's secret/default values.
 * Legacy checkpoints keep their data; missing proof simply leaves a note hidden.
 */
export function rsaNotesForAct(act: ActNumber, state: Evidence): RsaNote[] {
  const { capture, vars, labMemory } = state;
  if (
    state.act !== act ||
    !capture ||
    typeof capture.scheme !== "string" ||
    typeof capture.payload !== "string"
  )
    return [];
  if (act === 1) {
    const alphabet = labMemory.alphabet;
    const learned =
      Array.isArray(alphabet) &&
      alphabet.length === 26 &&
      Array.from({ length: 26 }, (_, i) => i + 1).every((value) =>
        alphabet.some(
          (entry) =>
            record(entry).value === value &&
            record(entry).char === String.fromCharCode(64 + value),
        ),
      );
    return learned ? [note("Alphabet encoding", "A = 1 … Z = 26")] : [];
  }
  if (act === 2) {
    const word = vars.recovered;
    return capture.scheme.startsWith("Caesar") &&
      typeof word === "string" &&
      word.length > 0 &&
      positive(vars.shift) &&
      vars.shift < 26 &&
      capture.payload === vars.cipherText &&
      caesar(word, vars.shift) === capture.payload
      ? [note("Caesar shift k", vars.shift)]
      : [];
  }

  // The key must have crossed the wire. Defaults and an unrelated old capture
  // cannot reveal either public inputs or private workbench answers.
  const N = vars.modulus,
    e = vars.e;
  if (
    !capture.scheme.startsWith("RSA") ||
    !isToyModulus(N) ||
    !positive(e) ||
    Number(capture.scheme.match(/\bN\s*=\s*(\d+)/)?.[1]) !== N ||
    Number(capture.scheme.match(/\be\s*=\s*(\d+)/)?.[1]) !== e ||
    !positive(vars.cipherNumber) ||
    vars.cipherNumber >= N ||
    capture.payload.replace(/\s/g, "") !== `c=${vars.cipherNumber}`
  )
    return [];
  const notes = [note("Modulus N", N), note("Public exponent e", e)];
  const scratch = record(labMemory.rsa3);
  let pair: unknown = scratch.found;
  let phiEvidence = scratch.phi;
  let privateEvidence = scratch.d;
  if (act === 4) {
    const run = record(record(labMemory.shor4).run);
    const r = vars.order,
      a = vars.base;
    const observed =
      typeof run.picked === "string" &&
      Number(record(run.counts)[run.picked]) > 0;
    if (
      run.N !== N ||
      run.a !== a ||
      (!observed && run.fromReference !== true) ||
      !positive(a) ||
      a >= N ||
      gcd(a, N) !== 1 ||
      !positive(r) ||
      r > N ||
      r % 2 !== 0 ||
      modPow(a, r, N) !== 1
    )
      return notes;
    const half = modPow(a, r / 2, N);
    const p = gcd(half - 1, N),
      q = gcd(half + 1, N);
    if (
      p <= 1 ||
      q <= 1 ||
      p * q !== N ||
      ![p, q].includes(vars.p ?? 0) ||
      ![p, q].includes(vars.q ?? 0) ||
      vars.p === vars.q
    )
      return notes;
    notes.push(
      note(run.fromReference === true ? "Reference period r" : "Period r", r),
    );
    pair = [vars.p, vars.q];
    phiEvidence = (p - 1) * (q - 1); // Automatic classical postprocessing in Act 4.
    privateEvidence = vars.d;
  }
  if (!Array.isArray(pair) || pair.length !== 2) return notes;
  const [p, q] = pair;
  if (!positive(p) || !positive(q) || p <= 1 || q <= 1 || p * q !== N)
    return notes;
  notes.push(note("Prime factors p, q", `${p} × ${q}`));
  const phi = (p - 1) * (q - 1);
  if (phiEvidence !== phi) return notes;
  notes.push(note("Totient φ(N)", phi));
  if (
    positive(privateEvidence) &&
    privateEvidence < phi &&
    (e * privateEvidence) % phi === 1
  )
    notes.push(note("Private exponent d", privateEvidence));
  return notes;
}
