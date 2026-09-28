"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { t, useLocale } from "@/i18n";
import { gameAudio } from "@/game/audio";
import { useGame } from "@/game/state";
import { missionGeneration } from "@/game/runtime";
import { api } from "@/lib/api";
import { StepHeader } from "./LaptopControls";

const TOTAL = 3;

type Row = { char: string; value: number };
type Scratch = { filled: string[]; misses: number };
const EMPTY: Scratch = { filled: [], misses: 0 };

/**
 * Act 1 by hand. The wire carries numbers; the player pulls the A=1..Z=26
 * table and then taps, one number at a time, the letter that sits at that
 * position. The word appears under the payload as they go.
 */
export function PlaintextWorkbench({ armed }: { armed: boolean }) {
  useLocale((state) => state.locale);
  const values = useGame((s) => s.vars.values);
  const recovered = useGame((s) => s.vars.recovered);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const [table, setTable] = useState<Row[]>(() => (useGame.getState().labMemory.alphabet as Row[] | undefined) ?? []);
  const [scratch, setScratch] = useState<Scratch>(() => ({ ...EMPTY, ...((useGame.getState().labMemory.plain1 as Partial<Scratch> | undefined) ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "bad" | "good"; text: string } | null>(null);

  useEffect(() => { useGame.getState().setLabMemory({ plain1: scratch }); }, [scratch]);

  const numbers = String(values ?? "").trim().split(/\s+/).filter(Boolean).map(Number);
  const cursor = Math.min(scratch.filled.length, numbers.length);
  const target = numbers[cursor];
  const step = recovered ? 3 : table.length ? 2 : 1;

  async function loadTable() {
    if (!armed) return;
    const token = missionGeneration();
    setBusy(true);
    try {
      const res = await api.keyboard();
      const alphabet = res.keys.map((key) => ({ char: key.char, value: key.value }));
      setTable(alphabet);
      useGame.getState().setLabMemory({ alphabet });
      pushTerminal({ tone: "info", text: "Pulled the alphabet table: A=1 through Z=26." });
      gameAudio.playSfx("computer");
    } catch (error) {
      if (token === missionGeneration()) useGame.getState().setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function pick(row: Row) {
    if (!armed || recovered || target === undefined) return;
    if (row.value !== target) {
      gameAudio.playSfx("error");
      setNote({ tone: "bad", text: `${row.char} = ${row.value}, but the wire says ${target}. Count again.` });
      setScratch((prev) => ({ ...prev, misses: prev.misses + 1 }));
      return;
    }
    const filled = [...scratch.filled, row.char];
    pushTerminal({ tone: "info", text: `${target} -> ${row.char}` });
    setNote(null);
    if (filled.length < numbers.length) {
      gameAudio.playSfx("select");
      setScratch({ filled, misses: 0 });
      return;
    }
    const word = filled.join("");
    pushTerminal({ tone: "good", text: `Message reads: ${word}` });
    setVars({ recovered: word });
    setScratch({ filled, misses: 0 });
    setNote({ tone: "good", text: `Every number turned back into a letter. The message reads “${word}”.` });
    gameAudio.playSfx("confirm");
  }

  function rewind(index: number) {
    if (!armed || recovered || index >= scratch.filled.length) return;
    gameAudio.playSfx("click");
    setScratch({ filled: scratch.filled.slice(0, index), misses: 0 });
    setNote(null);
  }

  return (
    <div className={clsx("laptop-challenge space-y-3", !armed && "pointer-events-none opacity-50")}>
      {step === 1 && <>
        <StepHeader step={1} total={TOTAL} title={t("Fetch the alphabet table")} />
        <p className="laptop-note">{t("The wire carries numbers. Pull A=1 … Z=26 from the backend, then map the payload.")}</p>
        <button type="button" className="btn-primary" disabled={!armed || busy} onClick={() => void loadTable()}>
          {busy ? `${t("Working")}…` : t("Fetch alphabet table")}
        </button>
      </>}

      {step >= 2 && <>
        <StepHeader step={step} total={TOTAL} title={recovered ? t("Plaintext recovered") : t("Map each number to its letter")} />
        <div className="flex flex-wrap gap-1.5" aria-label={t("Payload")}>
          {numbers.map((n, i) => {
            const letter = scratch.filled[i] ?? (recovered ? String(recovered)[i] : undefined);
            const active = !recovered && i === cursor;
            return (
              <button key={`${i}-${n}`} type="button" onClick={() => rewind(i)} disabled={!letter || !!recovered}
                aria-label={letter ? t(`${n} is ${letter}. Tap to redo from here.`) : String(n)}
                className={clsx("flex min-w-[44px] flex-col items-center rounded border px-1.5 py-1 font-mono",
                  active ? "border-accent-amber bg-[#2a3a1c] text-[#ffe5aa]" : letter ? "border-[#3d6b60] bg-[#102630] text-accent-teal" : "border-[#688c91] bg-[#102630] text-[#cfe6ee]")}>
                <span className="text-xs">{n}</span>
                <span className={clsx("text-lg leading-tight", !letter && "text-stage-muted")}>{letter ?? "_"}</span>
              </button>
            );
          })}
        </div>
        {!recovered && <p className="laptop-question">{t(`The wire says ${target}. Tap the letter numbered ${target}.`)}</p>}
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))]" aria-label={t("Alphabet table")}>
          {table.map((row) => (
            <button key={row.char} type="button" onClick={() => pick(row)} disabled={!!recovered}
              className={clsx("min-h-[44px] rounded border font-mono text-sm",
                recovered && scratch.filled.includes(row.char) ? "border-[#3d6b60] bg-[#163a34] text-accent-teal" : "border-[#688c91] bg-[#102630] text-[#d8ede5] hover:border-accent-amber")}>
              {row.char}<span className="block text-[10px] text-stage-muted">{row.value}</span>
            </button>
          ))}
        </div>
        {!recovered && scratch.misses >= 2 && <p className="laptop-note">{t(`Hint: start at A = 1 and count along the table until you reach ${target}.`)}</p>}
        {recovered && <p className="laptop-note">{t("Hit “I have it” and report the word to the client.")}</p>}
      </>}

      {note && <p role="status" className={clsx("laptop-note font-mono", note.tone === "bad" ? "text-actor-hacker" : "text-accent-teal")}>{t(note.text)}</p>}
    </div>
  );
}
