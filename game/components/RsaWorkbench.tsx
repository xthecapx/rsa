"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { t, useLocale } from "@/i18n";
import { gameAudio } from "@/game/audio";
import { runApiCall } from "@/game/effects";
import { valueOf } from "@/game/secret";
import { useGame } from "@/game/state";
import { missionGeneration } from "@/game/runtime";
import { api } from "@/lib/api";
import { StepHeader } from "./LaptopControls";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";

/** Primes on offer. Every toy modulus is a product of two of these. */
const PRIMES = [2, 3, 5, 7, 11, 13, 17];
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const TOTAL = 5;

type Pair = [number | null, number | null];
type Scratch = {
  primes: Pair;
  found: [number, number] | null;
  phiParts: [number | null, number | null, number | null];
  phi: number | null;
  tried: number[];
  d: number | null;
  residues: number[];
  misses: number;
};
const EMPTY: Scratch = { primes: [null, null], found: null, phiParts: [null, null, null], phi: null, tried: [], d: null, residues: [], misses: 0 };

type Chip = { id: string; value: number | string; label: string; caption?: string; spent?: boolean };

/**
 * Act 3 by hand, but with the numbers already on the table. Each step is an
 * equation with holes; the player drags the right piece into each hole. The
 * laptop does the multiplying, the player does the choosing.
 */
export function RsaWorkbench({ armed }: { armed: boolean }) {
  useLocale((state) => state.locale);
  const vars = useGame((s) => s.vars);
  const recovered = useGame((s) => s.vars.recovered);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const [scratch, setScratch] = useState<Scratch>(() => ({ ...EMPTY, ...((useGame.getState().labMemory.rsa3 as Partial<Scratch> | undefined) ?? {}) }));
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "bad" | "good" | "note"; text: string } | null>(null);

  useEffect(() => { useGame.getState().setLabMemory({ rsa3: scratch }); }, [scratch]);

  const N = vars.modulus;
  const e = vars.e ?? 0;
  const c = vars.cipherNumber ?? 0;
  const [p, q] = scratch.found ?? [null, null];
  const phi = scratch.phi;
  const d = scratch.d;
  // known[i] = c^(i+1) mod N. c^1 needs no work, so it is always known.
  const known = scratch.residues.length ? scratch.residues : [c % N];
  const step = recovered ? 6 : !scratch.found ? 1 : phi === null ? 2 : d === null ? 3 : known.length < d ? 4 : 5;
  const m = d !== null && known.length === d ? known[d - 1] : null;

  function patch(next: Partial<Scratch>) { setScratch((prev) => ({ ...prev, ...next })); }
  function miss(text: string) {
    gameAudio.playSfx("error");
    setNote({ tone: "bad", text });
    patch({ misses: scratch.misses + 1 });
  }
  function hit(text: string) {
    gameAudio.playSfx("confirm");
    setNote({ tone: "good", text });
    pushTerminal({ tone: "good", text });
  }
  const numberOf = (id: string) => Number(id.slice(id.indexOf(":") + 1));

  // Step 1: N = p × q. Two slots, seven primes.
  function placePrime(slot: "p" | "q", prime: number) {
    const primes: Pair = slot === "p" ? [prime, scratch.primes[1]] : [scratch.primes[0], prime];
    if (primes[0] === null || primes[1] === null) { gameAudio.playSfx("select"); patch({ primes }); return; }
    const [a, b] = [primes[0], primes[1]].sort((x, y) => x - y) as [number, number];
    if (a * b !== N) { patch({ primes: [null, null] }); miss(`${a} × ${b} = ${a * b}, not ${N}. Try another pair.`); return; }
    patch({ primes, found: [a, b], misses: 0 });
    setVars({ p: a, q: b, factors: `${a} x ${b}` });
    hit(`${a} × ${b} = ${N}. Those are Brayan's primes.`);
    const token = missionGeneration();
    // The backend confirms the split and projects the same attack on RSA-2048 for the ending.
    void runApiCall("rsaCrack").catch((error) => { if (token === missionGeneration()) useGame.getState().setError(error instanceof Error ? error.message : String(error)); });
  }

  // Step 2: φ(N) = (p − 1)(q − 1). Two factor slots and the product slot.
  function placePhiPart(index: 0 | 1 | 2, value: number) {
    if (p === null || q === null) return;
    const parts = [...scratch.phiParts] as Scratch["phiParts"];
    parts[index] = value;
    if (parts.some((part) => part === null)) { gameAudio.playSfx("select"); patch({ phiParts: parts }); return; }
    const [a, b, product] = parts as [number, number, number];
    const expected = (p - 1) * (q - 1);
    const factorsOk = (a === p - 1 && b === q - 1) || (a === q - 1 && b === p - 1);
    if (!factorsOk) { patch({ phiParts: [null, null, product] }); miss(`p − 1 is ${p - 1} and q − 1 is ${q - 1}, not ${a} and ${b}.`); return; }
    if (product !== expected) { patch({ phiParts: [a, b, null] }); miss(`${a} × ${b} = ${expected}, not ${product}.`); return; }
    patch({ phiParts: parts, phi: expected, misses: 0 });
    hit(`φ(N) = (${p} − 1)(${q} − 1) = ${expected}. Brayan's d has to satisfy e × d mod ${expected} = 1.`);
  }

  // Step 3: e × d must land one past a multiple of φ. Each piece shows its product.
  function placeCandidate(k: number) {
    if (phi === null || scratch.tried.includes(k)) return;
    const product = e * k;
    const tried = [...scratch.tried, k];
    if (product % phi === 1) {
      patch({ tried, d: k, misses: 0 });
      setVars({ d: k });
      hit(`${e} × ${k} = ${product} = ${Math.floor(product / phi)} × ${phi} + 1. So d = ${k}.`);
    } else {
      gameAudio.playSfx("select");
      patch({ tried });
      setNote({ tone: "note", text: `${e} × ${k} = ${product} = ${Math.floor(product / phi)} × ${phi} + ${product % phi}. Not one past a multiple of ${phi}.` });
    }
  }

  // Step 4: c^d mod N by repeated multiplication. The laptop multiplies and
  // finds the biggest multiple of N; the player drags in what is left over.
  const previous = known[known.length - 1];
  const power = known.length + 1;
  const product = previous * c;
  const whole = Math.floor(product / N);
  const fits = product >= N;
  function placeResidue(answer: number) {
    if (d === null) return;
    const expected = product % N;
    if (answer !== expected) { miss(fits ? `${whole} × ${N} = ${whole * N}, and ${product} − ${whole * N} is not ${answer}.` : `${product} is already below ${N}, so the remainder is ${product} itself, not ${answer}.`); return; }
    const residues = [...known, expected];
    patch({ residues, misses: 0 });
    if (residues.length < d) {
      gameAudio.playSfx("confirm");
      setNote({ tone: "good", text: `c^${residues.length} mod ${N} = ${expected}. Multiply by ${c} again.` });
      return;
    }
    hit(`c^${d} mod ${N} = ${expected}. That is m.`);
    const token = missionGeneration();
    void api.rsa.decrypt(c, d, N).then((res) => {
      if (token !== missionGeneration()) return;
      useGame.getState().pushTerminal({ tone: res.m === expected ? "info" : "bad", text: res.m === expected ? `Backend agrees: ${res.equation}` : `Backend disagrees: ${res.equation}` });
    }).catch(() => { /* The hand computation stands on its own; the check is a courtesy. */ });
  }

  // Step 5: number back to letter with the table from Act 1.
  function placeLetter(letter: string) {
    if (m === null) return;
    if (valueOf(letter) === m) {
      setVars({ recovered: letter });
      hit(`m = ${m} is the letter ${letter}. Brayan's private key opened Ale's message.`);
    } else miss(`${letter} is ${valueOf(letter)}, not ${m}. Count again from A = 1.`);
  }

  // One tray and one set of slots per step.
  let chips: Chip[] = [];
  const slots: Record<string, string> = {};
  if (step === 1) {
    chips = PRIMES.map((prime) => ({ id: `prime:${prime}`, value: prime, label: String(prime) }));
    slots.p = t("first prime"); slots.q = t("second prime");
  } else if (step === 2 && p !== null && q !== null) {
    const expected = (p - 1) * (q - 1);
    const pool = [...new Set([p - 1, q - 1, p, q, p + 1, q + 1, expected, N, expected + 2, expected - 2, (p + 1) * (q + 1)])].filter((v) => v > 0).sort((a, b) => a - b);
    chips = pool.map((value) => ({ id: `num:${value}`, value, label: String(value) }));
    slots.a = t("p minus one"); slots.b = t("q minus one"); slots.phi = t("the product φ(N)");
  } else if (step === 3 && phi !== null) {
    chips = Array.from({ length: phi - 1 }, (_, i) => i + 1).map((k) => ({ id: `k:${k}`, value: k, label: `${k}, ${e} × ${k} = ${e * k}`, caption: `${e}×${k}=${e * k}`, spent: scratch.tried.includes(k) }));
    slots.d = t("private exponent d");
  } else if (step === 4 && d !== null) {
    const expected = product % N;
    const pool = [expected, (expected + 1) % N, product % (N + 1), product % (N - 1), (expected + N - 1) % N, (expected + 5) % N, (expected + 9) % N];
    const options = [...new Set(pool)].filter((v) => v >= 0 && v < N).slice(0, 4).sort((a, b) => a - b);
    chips = options.map((value) => ({ id: `r:${value}`, value, label: String(value) }));
    slots.r = t("remainder");
  } else if (step === 5 && m !== null) {
    chips = ALPHABET.map((letter, i) => ({ id: `L:${letter}`, value: letter, label: `${letter} = ${i + 1}`, caption: String(i + 1) }));
    slots.letter = t("the letter m stands for");
  }
  const labels = Object.fromEntries(chips.map((chip) => [chip.id, chip.label]));
  const targets = phi !== null ? Array.from({ length: Math.floor((e * (phi - 1) - 1) / phi) }, (_, i) => (i + 1) * phi + 1) : [];
  const targetList = targets.length > 1 ? `${targets.slice(0, -1).join(", ")} ${t("or")} ${targets[targets.length - 1]}` : String(targets[0] ?? "");

  function place(target: string, source: string) {
    if (!armed) return;
    setSelected(null);
    if (!Object.hasOwn(labels, source)) return;
    if (step === 1 && (target === "p" || target === "q")) placePrime(target, numberOf(source));
    else if (step === 2 && (target === "a" || target === "b" || target === "phi")) placePhiPart(target === "a" ? 0 : target === "b" ? 1 : 2, numberOf(source));
    else if (step === 3 && target === "d") placeCandidate(numberOf(source));
    else if (step === 4 && target === "r") placeResidue(numberOf(source));
    else if (step === 5 && target === "letter") placeLetter(source.slice(2));
  }

  function slot(id: string, value: number | string | null, wide = false) {
    return <PuzzleSlot id={id} label={value === null ? slots[id] : `${slots[id]}: ${value}`} className={clsx("rsa-slot", value !== null && "filled", wide && "wide")}
      onSelect={() => { if (selected) place(id, selected); }}>{value ?? "?"}</PuzzleSlot>;
  }
  const tray = <div className="flex flex-wrap gap-1.5">
    {chips.map((chip) => <PuzzlePiece key={chip.id} id={chip.id} label={chip.label} selected={selected === chip.id} className={clsx("rsa-chip", chip.spent && "spent")}
      onSelect={() => { if (chip.spent) return; setSelected(selected === chip.id ? null : chip.id); }}>
      <span>{chip.value}{chip.caption && <small>{chip.caption}</small>}</span>
    </PuzzlePiece>)}
  </div>;

  return (
    <div className={clsx("laptop-challenge space-y-3", !armed && "pointer-events-none opacity-50")}>
      <dl className="grid grid-cols-3 gap-x-2 gap-y-1 border border-stage-border px-3 py-2 font-mono text-xs sm:grid-cols-6">
        <Fact label={t("public e")} value={e || "?"} />
        <Fact label={t("modulus N")} value={N} />
        <Fact label={t("ciphertext c")} value={c || "?"} tone="amber" />
        <Fact label="p · q" value={scratch.found ? `${p} · ${q}` : "?"} />
        <Fact label="φ(N)" value={phi ?? "?"} />
        <Fact label={t("private d")} value={d ?? "?"} tone={d !== null ? "good" : undefined} />
      </dl>
      {step === 1 && <p className="laptop-note">{t("Ale locked her letter m with Brayan's public key: c = m^e mod N. Only the private number d unlocks it. Brayan built d from the two primes hidden inside N, so once you find them you can build d too.")}</p>}

      {step <= 5 && <PuzzleDragDrop labels={labels} targets={slots} onPlace={place} renderPreview={(source) => <span className="font-mono">{labels[source]}</span>}>
        {step === 1 && <>
          <StepHeader step={1} total={TOTAL} title={t("Split N into its two primes")} />
          <p className="laptop-note">{t("Only one pair of primes has product N. Drag those two numbers into the slots.")}</p>
          <p className="rsa-eq">{N} = {slot("p", scratch.primes[0])} × {slot("q", scratch.primes[1])}</p>
          {tray}
          {scratch.misses >= 2 && <p className="laptop-note">{t(`Hint: N = ${N} is odd, so 2 is out. Divide ${N} by 3, then 5, then 7 and see which leaves no remainder.`)}</p>}
        </>}

        {step === 2 && p !== null && q !== null && <>
          <StepHeader step={2} total={TOTAL} title={t("Count the coprime numbers: φ(N)")} />
          <p className="laptop-note">{t("φ(N) counts the positive integers below N that share no factor with it except 1. For two distinct primes, φ(N) = (p − 1) × (q − 1). Drag p − 1 and q − 1 into the brackets, then their product.")}</p>
          <p className="rsa-eq">φ({N}) = ({slot("a", scratch.phiParts[0])} ) × ({slot("b", scratch.phiParts[1])} ) = {slot("phi", scratch.phiParts[2])}</p>
          {tray}
          {scratch.misses >= 2 && <p className="laptop-note">{t(`Hint: ${p} − 1 = ${p - 1} and ${q} − 1 = ${q - 1}. Their product is the piece you want in the last slot.`)}</p>}
        </>}

        {step === 3 && phi !== null && <>
          <StepHeader step={3} total={TOTAL} title={t("Find the private exponent d")} />
          <p className="laptop-note">{t(`Brayan's d is the number that makes ${e} × d land exactly one past a multiple of ${phi}. Those landing spots are ${targetList}. Every piece shows ${e} × its number. Drag the one whose product is a landing spot.`)}</p>
          <p className="rsa-eq">{e} × {slot("d", d)} = {targetList}</p>
          <p className="laptop-note font-mono text-xs">{phi} + 1, 2 × {phi} + 1, 3 × {phi} + 1, …</p>
          {tray}
        </>}

        {step === 4 && d !== null && <>
          <StepHeader step={4} total={TOTAL} title={t("Unlock the message: m = c^d mod N")} />
          <p className="laptop-note">{t(`c^d means c multiplied by itself ${d} times. Do one multiplication at a time and keep only the remainder mod ${N} after each, so the numbers stay small. c^1 is just c, so ${d - 1} multiplications to go.`)}</p>
          <ol className="space-y-1 font-mono text-xs text-stage-muted">
            <li className="text-[#cfe6ee]">c^1 = {c}{c >= N ? ` mod ${N} = ${c % N}` : ""} <span className="text-stage-muted">({t("c itself, nothing to compute")})</span></li>
            {known.slice(1).map((residue, i) => {
              const before = known[i];
              const raw = before * c;
              return <li key={i} className="text-[#cfe6ee]">c^{i + 2} = {before} × {c} = {raw}{raw >= N ? ` = ${Math.floor(raw / N)} × ${N} + ` : ` → `}<strong className="text-accent-teal">{residue}</strong></li>;
            })}
          </ol>
          <p className="rsa-eq">c^{power} = c^{power - 1} × c = {previous} × {c} = {product}{fits ? ` = ${whole} × ${N} + ` : ` → `}{slot("r", null)}</p>
          <p className="laptop-note">{fits
            ? t(`${whole} × ${N} = ${whole * N} is the biggest multiple of ${N} that fits inside ${product}. The remainder is ${product} − ${whole * N}.`)
            : t(`${product} is already smaller than ${N}, so there is nothing to take away. The remainder is ${product} itself.`)}</p>
          {tray}
        </>}

        {step === 5 && m !== null && <>
          <StepHeader step={5} total={TOTAL} title={t("Turn the number into a letter")} />
          <p className="laptop-note">{t("m is a position in the alphabet, A = 1 … Z = 26. Drag the letter into the slot.")}</p>
          <p className="rsa-eq">m = {m} = {slot("letter", null)}</p>
          {tray}
        </>}
      </PuzzleDragDrop>}

      {step === 6 && <>
        <StepHeader step={TOTAL} total={TOTAL} title={t("Letter recovered")} />
        <p className="laptop-note">{t(`You rebuilt d = ${d} from the public key and decrypted c = ${c} to "${recovered}" by hand. Hit “I have it” and report to the client.`)}</p>
      </>}

      {note && <p role="status" className={clsx("laptop-note font-mono", note.tone === "bad" ? "text-actor-hacker" : note.tone === "good" ? "text-accent-teal" : "text-accent-amber")}>{t(note.text)}</p>}
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string | number; tone?: "amber" | "good" }): ReactNode {
  return <div>
    <dt className="text-stage-muted">{label}</dt>
    <dd className={tone === "amber" ? "text-accent-amber" : tone === "good" ? "text-accent-teal" : "text-[#cfe6ee]"}>{value}</dd>
  </div>;
}
