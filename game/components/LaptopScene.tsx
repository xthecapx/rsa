"use client";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

import type { ActNumber } from "@/content/types";
import { QuantumUplink } from "./QuantumUplink";
import { gameAudio } from "@/game/audio";
import { resolvePanel } from "@/game/dialog";
import { runApiCall } from "@/game/effects";
import { charOf } from "@/game/secret";
import { bandFor } from "@/game/suspicion";
import { useGame } from "@/game/state";
import { api } from "@/lib/api";
import { bus } from "@/engine/bus";

const BAR: Record<string, string> = {
  calm: "bg-suspicion-calm",
  uneasy: "bg-suspicion-uneasy",
  alarmed: "bg-suspicion-alarmed",
};

/**
 * Full-screen laptop: bezel + CRT screen. Decode work happens here one step
 * at a time; the street stays underneath with input locked while the lid is up.
 */
export function LaptopScene({ act }: { act: ActNumber }) {
  const laptopOpen = useGame((s) => s.laptopOpen);
  const setLaptopOpen = useGame((s) => s.setLaptopOpen);
  const phase = useGame((s) => s.phase);
  const waitingFor = useGame((s) => s.waitingFor);
  const panel = useGame((s) => s.panel);
  const capture = useGame((s) => s.capture);
  const recovered = useGame((s) => s.vars.recovered);
  const terminal = useGame((s) => s.terminal);
  const busyLabel = useGame((s) => s.busyLabel);
  const suspicion = useGame((s) => s.suspicion);
  const armed = waitingFor === "workbench" && panel === "workbench";

  // Freeze street controls while the laptop owns the screen.
  useEffect(() => {
    if (!laptopOpen) return;
    void bus.send({ type: "lockInput", locked: true });
    return () => {
      if (useGame.getState().phase === "exploring") {
        void bus.send({ type: "lockInput", locked: false });
      }
    };
  }, [laptopOpen]);

  if (!laptopOpen) return null;

  const band = bandFor(suspicion);

  function close() {
    gameAudio.playSfx("switch");
    setLaptopOpen(false);
    if (phase === "exploring") void bus.send({ type: "lockInput", locked: false });
  }

  function finish() {
    if (!armed || !recovered) return;
    gameAudio.playSfx("confirm");
    void resolvePanel();
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050e12]/92 p-2 sm:p-4">
      <div
        className="flex max-h-full w-full max-w-3xl flex-col"
        role="dialog"
        aria-label="th3c4p"
      >
        {/* Bezel */}
        <div className="flex min-h-0 flex-1 flex-col rounded-t-lg border-2 border-[#3d4a52] bg-[#8b949a] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.65)] sm:rounded-t-xl sm:p-3">
          <div className="mb-1.5 flex items-center justify-center gap-1.5 sm:mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2a3238] sm:h-2 sm:w-2" />
            <span className="font-mono text-[8px] tracking-[0.18em] text-[#2a3238] sm:text-[9px]">
              th3c4p
            </span>
          </div>

          {/* CRT screen */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border-2 border-[#1a2228] bg-[#0a1a20]">
            <div className="scanline pointer-events-none absolute inset-0 z-10 opacity-40" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 opacity-[0.07]"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 50%, #000 100%)",
              }}
            />

            <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-[#1e4450] bg-[#0d222a]/90 px-2 py-1.5 sm:px-3 sm:py-2">
              <div className="min-w-0">
                <p className="truncate text-[9px] uppercase tracking-widest text-accent-teal sm:text-[10px]">
                  th3c4p · act {act}
                </p>
                {busyLabel && (
                  <p className="truncate text-[8px] text-accent-amber sm:text-[9px]">
                    {busyLabel}…
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="w-20 sm:w-28">
                  <div className="mb-0.5 flex justify-between text-[7px] uppercase tracking-widest text-stage-muted sm:text-[8px]">
                    <span>Sus</span>
                    <span>{suspicion}%</span>
                  </div>
                  <div className="h-1.5 border border-stage-border bg-black/40 sm:h-2">
                    <div
                      className={clsx("h-full transition-[width] duration-500", BAR[band])}
                      style={{ width: `${suspicion}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="border border-stage-border px-2 py-1 text-[8px] uppercase tracking-widest text-stage-muted hover:border-accent-teal hover:text-accent-teal sm:text-[9px]"
                >
                  Close
                </button>
              </div>
            </header>

            <div className="relative z-20 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-3">
              <MemoryRail />
              <Wizard act={act} armed={armed} />
            </div>

            <footer className="relative z-20 flex shrink-0 flex-col gap-2 border-t border-[#1e4450] bg-[#0d222a]/90 p-2 sm:flex-row sm:items-center sm:p-3">
              <p className="min-w-0 flex-1 text-[8px] leading-relaxed text-stage-muted sm:text-[9px]">
                {armed
                  ? recovered
                    ? "Plaintext ready. Hand it to the client on the street."
                    : "Work the steps. Results land in memory."
                  : capture
                    ? "Lid open for notes — tools unlock when the story needs the workbench."
                    : "No capture yet. Listen on the street first."}
              </p>
              <button
                type="button"
                disabled={!armed || !recovered}
                onClick={finish}
                className={clsx(
                  "shrink-0 border-2 px-3 py-2 text-[9px] uppercase tracking-widest sm:text-[10px]",
                  armed && recovered
                    ? "border-accent-amber text-accent-amber hover:bg-accent-amber/15"
                    : "cursor-not-allowed border-stage-border text-stage-muted",
                )}
              >
                I have it
              </button>
            </footer>
          </div>
        </div>

        {/* Keyboard deck */}
        <div className="rounded-b-lg border-2 border-t-0 border-[#3d4a52] bg-[#6d757c] px-3 py-2 sm:rounded-b-xl sm:px-6 sm:py-3">
          <div className="mx-auto h-1.5 max-w-[8rem] rounded-full bg-[#2a3238]/50 sm:h-2" />
        </div>

        {/* Recent log peek */}
        {terminal.length > 0 && (
          <p className="mt-1 truncate px-1 text-center text-[7px] text-stage-muted sm:text-[8px]">
            log: {terminal[terminal.length - 1]?.text}
          </p>
        )}
      </div>
    </div>
  );
}

function MemoryRail() {
  const capture = useGame((s) => s.capture);
  const recovered = useGame((s) => s.vars.recovered);
  const vars = useGame((s) => s.vars);
  const noteBits: string[] = [];
  if (vars.factors) noteBits.push(`N = ${vars.factors}`);
  if (vars.d != null) noteBits.push(`d = ${vars.d}`);
  if (vars.recovered && vars.shift) noteBits.push(`k = ${vars.shift}`);

  return (
    <div className="grid shrink-0 gap-2 sm:grid-cols-3">
      <MemorySlot label="Wire" empty="No capture">
        {capture ? (
          <>
            <p className="text-[7px] text-stage-muted sm:text-[8px]">{capture.scheme}</p>
            <p className="break-all font-mono text-[10px] text-accent-amber sm:text-[11px]">
              {capture.payload}
            </p>
          </>
        ) : null}
      </MemorySlot>
      <MemorySlot label="Notes" empty="Run a tool">
        {noteBits.length ? (
          <p className="font-mono text-[9px] leading-relaxed text-[#9fc4d0] sm:text-[10px]">
            {noteBits.join(" · ")}
          </p>
        ) : null}
      </MemorySlot>
      <MemorySlot label="Plaintext" empty="Not recovered">
        {recovered ? (
          <p className="break-all font-mono text-[12px] text-actor-brayan sm:text-[14px]">
            {recovered}
          </p>
        ) : null}
      </MemorySlot>
    </div>
  );
}

function MemorySlot({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <div className="border border-[#1e4450] bg-black/25 px-2 py-1.5">
      <p className="mb-1 text-[7px] uppercase tracking-widest text-accent-teal sm:text-[8px]">
        {label}
      </p>
      {children ?? (
        <p className="text-[8px] text-stage-muted sm:text-[9px]">{empty}</p>
      )}
    </div>
  );
}

function Wizard({ act, armed }: { act: ActNumber; armed: boolean }) {
  const capture = useGame((s) => s.capture);
  if (!capture) {
    return (
      <div className="border border-dashed border-stage-border px-3 py-6 text-center text-[10px] text-stage-muted">
        Waiting for a packet on the wire.
      </div>
    );
  }
  if (act === 1) return <MappingWizard armed={armed} />;
  if (act === 2) return <CaesarWizard armed={armed} />;
  if (act === 3) return <RsaWizard armed={armed} />;
  return (
    <div className={clsx(!armed && "pointer-events-none opacity-50")}>
      <StepHeader step={1} total={1} title="Quantum uplink" />
      <QuantumUplink disabled={!armed} />
    </div>
  );
}

function StepHeader({
  step,
  total,
  title,
}: {
  step: number;
  total: number;
  title: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 className="text-[10px] uppercase tracking-widest text-[#e8f4f8] sm:text-[11px]">
        {title}
      </h2>
      <span className="text-[8px] text-stage-muted sm:text-[9px]">
        Step {step}/{total}
      </span>
    </div>
  );
}

function StepButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        gameAudio.playSfx("click");
        onClick();
      }}
      disabled={disabled || busy}
      className={clsx(
        "w-full border-2 px-3 py-2.5 text-left text-[10px] transition-colors sm:text-[11px]",
        disabled || busy
          ? "cursor-not-allowed border-stage-border text-stage-muted"
          : "border-accent-teal/60 text-[#cfe6ee] hover:border-accent-teal hover:bg-accent-teal/10",
      )}
    >
      {busy ? `${label}…` : label}
    </button>
  );
}

function MappingWizard({ armed }: { armed: boolean }) {
  const values = useGame((s) => s.vars.values);
  const recovered = useGame((s) => s.vars.recovered);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const [table, setTable] = useState<{ char: string; value: number }[]>([]);
  const [busy, setBusy] = useState(false);

  const step = recovered ? 3 : table.length ? 2 : 1;

  async function loadTable() {
    if (!armed) return;
    setBusy(true);
    try {
      const res = await api.keyboard();
      setTable(res.keys.map((key) => ({ char: key.char, value: key.value })));
      pushTerminal({
        tone: "info",
        text: "Pulled the alphabet table: A=1 through Z=26.",
      });
      gameAudio.playSfx("computer");
    } finally {
      setBusy(false);
    }
  }

  function applyMapping() {
    if (!armed || !table.length) return;
    const numbers = String(values).trim().split(/\s+/).filter(Boolean);
    const lookup = new Map(table.map((row) => [row.value, row.char]));
    const word = numbers
      .map((n) => lookup.get(Number(n)) ?? charOf(Number(n)))
      .join("");
    for (const n of numbers) {
      pushTerminal({
        tone: "info",
        text: `${n} -> ${lookup.get(Number(n)) ?? "?"}`,
      });
    }
    pushTerminal({ tone: "good", text: `Message reads: ${word}` });
    setVars({ recovered: word });
    gameAudio.playSfx("confirm");
  }

  return (
    <div className="space-y-3">
      {step === 1 && (
        <>
          <StepHeader step={1} total={3} title="Fetch the alphabet table" />
          <p className="text-[9px] leading-relaxed text-stage-muted sm:text-[10px]">
            The wire carries numbers. Pull A=1 … Z=26 from the backend, then map
            the payload.
          </p>
          <StepButton
            label="Fetch alphabet table"
            busy={busy}
            disabled={!armed}
            onClick={() => void loadTable()}
          />
        </>
      )}
      {step >= 2 && (
        <>
          <StepHeader step={2} total={3} title="Apply the mapping" />
          <div className="grid grid-cols-6 gap-x-2 gap-y-0.5 border border-stage-border px-2 py-1.5 font-mono text-[8px] text-stage-muted sm:text-[9px]">
            {table.map((row) => (
              <span key={row.char}>
                {row.char}={row.value}
              </span>
            ))}
          </div>
          {!recovered && (
            <StepButton
              label="Run payload through the table"
              disabled={!armed}
              onClick={applyMapping}
            />
          )}
        </>
      )}
      {recovered && (
        <StepHeader step={3} total={3} title="Plaintext recovered" />
      )}
    </div>
  );
}

function CaesarWizard({ armed }: { armed: boolean }) {
  const cipherText = useGame((s) => s.vars.cipherText);
  const recovered = useGame((s) => s.vars.recovered);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const [candidates, setCandidates] = useState<{ shift: number; word: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const step = recovered ? 3 : candidates.length ? 2 : 1;

  async function bruteForce() {
    if (!armed) return;
    setBusy(true);
    try {
      const perChar = await Promise.all(
        String(cipherText)
          .split("")
          .map((char) => api.caesar.crack(char)),
      );
      const rows = Array.from({ length: 25 }, (_, i) => {
        const shift = i + 1;
        const word = perChar
          .map((res) => res.trials.find((t) => t.shift === shift)?.candidate ?? "?")
          .join("");
        return { shift, word };
      });
      setCandidates(rows);
      pushTerminal({
        tone: "info",
        text: `Tried all 25 shifts against "${cipherText}". One of them is English.`,
      });
      gameAudio.playSfx("computer");
    } finally {
      setBusy(false);
    }
  }

  function pick(row: { shift: number; word: string }) {
    if (!armed) return;
    setVars({ recovered: row.word, shift: row.shift });
    pushTerminal({ tone: "good", text: `k=${row.shift} gives "${row.word}".` });
    gameAudio.playSfx("select");
  }

  return (
    <div className="space-y-3">
      {step === 1 && (
        <>
          <StepHeader step={1} total={3} title="Brute-force the shift" />
          <p className="text-[9px] leading-relaxed text-stage-muted sm:text-[10px]">
            Only twenty-five keys. Ask the backend for every candidate word.
          </p>
          <StepButton
            label="Try all 25 shifts"
            busy={busy}
            disabled={!armed}
            onClick={() => void bruteForce()}
          />
        </>
      )}
      {step === 2 && (
        <>
          <StepHeader step={2} total={3} title="Pick the English word" />
          <p className="text-[9px] leading-relaxed text-accent-amber sm:text-[10px]">
            Which line reads like a real word? Tap it to lock plaintext.
          </p>
          <ul className="max-h-[40dvh] space-y-0.5 overflow-y-auto border border-stage-border px-1 py-1 font-mono text-[10px] sm:max-h-64 sm:text-[11px]">
            {candidates.map((row) => (
              <li key={row.shift}>
                <button
                  type="button"
                  disabled={!armed}
                  onClick={() => pick(row)}
                  className="flex w-full gap-3 px-2 py-1.5 text-left text-[#cfe6ee] hover:bg-accent-amber/20 hover:text-white"
                >
                  <span className="text-stage-muted">
                    k={String(row.shift).padStart(2, " ")}
                  </span>
                  <span>{row.word}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {step === 3 && (
        <>
          <StepHeader step={3} total={3} title="Plaintext locked" />
          <p className="text-[9px] text-stage-muted sm:text-[10px]">
            You chose the English candidate. Close when ready, or hit “I have it”.
          </p>
        </>
      )}
    </div>
  );
}

function RsaWizard({ armed }: { armed: boolean }) {
  const vars = useGame((s) => s.vars);
  const recovered = useGame((s) => s.vars.recovered);
  const setVars = useGame((s) => s.setVars);
  const [busy, setBusy] = useState<string | null>(null);

  const step = recovered ? 3 : vars.factors ? 2 : 1;

  async function run(call: "rsaCrack" | "deriveKey", key: string) {
    if (!armed) return;
    setBusy(key);
    try {
      await runApiCall(call);
      if (call === "deriveKey") {
        const next = useGame.getState().vars.recovered;
        if (next) setVars({ recovered: String(next) });
        gameAudio.playSfx("confirm");
      } else {
        gameAudio.playSfx("computer");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 border border-stage-border px-2 py-1.5 font-mono text-[9px] sm:text-[10px]">
        <dt className="text-stage-muted">public e</dt>
        <dd className="text-[#cfe6ee]">{vars.e ?? "?"}</dd>
        <dt className="text-stage-muted">modulus N</dt>
        <dd className="text-[#cfe6ee]">{vars.modulus}</dd>
        <dt className="text-stage-muted">ciphertext c</dt>
        <dd className="text-accent-amber">{vars.cipherNumber ?? "?"}</dd>
        <dt className="text-stage-muted">factors</dt>
        <dd className="text-[#cfe6ee]">{vars.factors ?? "—"}</dd>
        <dt className="text-stage-muted">private d</dt>
        <dd className="text-[#cfe6ee]">{vars.d ?? "—"}</dd>
      </dl>

      {step === 1 && (
        <>
          <StepHeader step={1} total={3} title="Factor the modulus" />
          <StepButton
            label={`Factor N = ${vars.modulus}`}
            busy={busy === "factor"}
            disabled={!armed}
            onClick={() => void run("rsaCrack", "factor")}
          />
        </>
      )}
      {step === 2 && (
        <>
          <StepHeader step={2} total={3} title="Derive d and decrypt" />
          <StepButton
            label="Rebuild private key and read c"
            busy={busy === "derive"}
            disabled={!armed}
            onClick={() => void run("deriveKey", "derive")}
          />
        </>
      )}
      {step === 3 && (
        <StepHeader step={3} total={3} title="Letter recovered" />
      )}
    </div>
  );
}
