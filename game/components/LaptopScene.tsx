"use client";
import { t, tOptional, localize, useLocale } from "@/i18n";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

import type { ActNumber } from "@/content/types";
import { QuantumUplink } from "./QuantumUplink";
import { gameAudio } from "@/game/audio";
import { resolvePanel } from "@/game/dialog";
import { runApiCall } from "@/game/effects";
import { charOf } from "@/game/secret";
import { useGame } from "@/game/state";
import { api } from "@/lib/api";
import { bus } from "@/engine/bus";
import { LaptopShell } from "./LaptopShell";

/**
 * Full-screen laptop: bezel + CRT screen. Decode work happens here one step
 * at a time; the street stays underneath with input locked while the lid is up.
 */
export function LaptopScene({ act }: { act: ActNumber }) {
  useLocale((state) => state.locale);
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
    <LaptopShell open={laptopOpen} title={tOptional(`RSA · Act ${act}`)} onClose={close}
      status={busyLabel || `Suspicion: ${suspicion}%`}
      memory={<MemoryRail />}
      footer={<>
        <p>{localize(armed ? recovered ? "Plaintext ready. Hand it to the client on the street." : "Work the steps. Results land in memory."
          : capture ? "Lid open for notes — tools unlock when the story needs the workbench." : "No capture yet. Listen on the street first.")}</p>
        <button className="btn-primary" disabled={!armed || !recovered} onClick={finish}>{t("I have it")}</button>
      </>}
    >
      <Wizard act={act} armed={armed} />
      {terminal.length > 0 && <p className="mt-4 text-xs text-stage-muted">{localize(terminal[terminal.length - 1]?.text)}</p>}
    </LaptopShell>
  );
}

function MemoryRail() {
  useLocale((state) => state.locale);
  const capture = useGame((s) => s.capture);
  const recovered = useGame((s) => s.vars.recovered);
  const vars = useGame((s) => s.vars);
  const noteBits: string[] = [];
  if (vars.factors) noteBits.push(`N = ${vars.factors}`);
  if (vars.d != null) noteBits.push(`d = ${vars.d}`);
  if (vars.recovered && vars.shift) noteBits.push(`k = ${vars.shift}`);

  return (
    <div className="grid shrink-0 gap-2 sm:grid-cols-3">
      <MemorySlot label={t("Wire")} empty={t("No capture")}>
        {capture ? (
          <>
            <p className="text-[7px] text-stage-muted sm:text-[8px]">{localize(capture.scheme)}</p>
            <p className="break-all font-mono text-[10px] text-accent-amber sm:text-[11px]">
              {capture.payload}
            </p>
          </>
        ) : null}
      </MemorySlot>
      <MemorySlot label={t("Notes")} empty={t("Run a tool")}>
        {noteBits.length ? (
          <p className="font-mono text-[9px] leading-relaxed text-[#9fc4d0] sm:text-[10px]">
            {localize(noteBits.join(" · "))}
          </p>
        ) : null}
      </MemorySlot>
      <MemorySlot label={t("Plaintext")} empty={t("Not recovered")}>
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
  useLocale((state) => state.locale);
  return (
    <div className="border border-[#1e4450] bg-black/25 px-2 py-1.5">
      <p className="mb-1 text-[7px] uppercase tracking-widest text-accent-teal sm:text-[8px]">
        {localize(label)}
      </p>
      {localize(children ?? (
        <p className="text-[8px] text-stage-muted sm:text-[9px]">{localize(empty)}</p>
      ))}
    </div>
  );
}

function Wizard({ act, armed }: { act: ActNumber; armed: boolean }) {
  useLocale((state) => state.locale);
  const capture = useGame((s) => s.capture);
  if (!capture) {
    return (
      <div className="border border-dashed border-stage-border px-3 py-6 text-center text-[10px] text-stage-muted">{t("Waiting for a packet on the wire.")}</div>
    );
  }
  if (act === 1) return <MappingWizard armed={armed} />;
  if (act === 2) return <CaesarWizard armed={armed} />;
  if (act === 3) return <RsaWizard armed={armed} />;
  return (
    <div className={clsx(!armed && "pointer-events-none opacity-50")}>
      <StepHeader step={1} total={1} title={t("Quantum uplink")} />
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
  useLocale((state) => state.locale);
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 className="text-[10px] uppercase tracking-widest text-[#e8f4f8] sm:text-[11px]">
        {localize(title)}
      </h2>
      <span className="text-[8px] text-stage-muted sm:text-[9px]">{t("Step ")}{step}/{total}
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
  useLocale((state) => state.locale);
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
      {busy ? `${t(label)}…` : t(label)}
    </button>
  );
}

function MappingWizard({ armed }: { armed: boolean }) {
  useLocale((state) => state.locale);
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
          <StepHeader step={1} total={3} title={t("Fetch the alphabet table")} />
          <p className="text-[9px] leading-relaxed text-stage-muted sm:text-[10px]">{t("The wire carries numbers. Pull A=1 … Z=26 from the backend, then map the payload.")}</p>
          <StepButton
            label={t("Fetch alphabet table")}
            busy={busy}
            disabled={!armed}
            onClick={() => void loadTable()}
          />
        </>
      )}
      {step >= 2 && (
        <>
          <StepHeader step={2} total={3} title={t("Apply the mapping")} />
          <div className="grid grid-cols-6 gap-x-2 gap-y-0.5 border border-stage-border px-2 py-1.5 font-mono text-[8px] text-stage-muted sm:text-[9px]">
            {table.map((row) => (
              <span key={row.char}>
                {row.char}={row.value}
              </span>
            ))}
          </div>
          {!recovered && (
            <StepButton
              label={t("Run payload through the table")}
              disabled={!armed}
              onClick={applyMapping}
            />
          )}
        </>
      )}
      {localize(recovered && (
        <StepHeader step={3} total={3} title={t("Plaintext recovered")} />
      ))}
    </div>
  );
}

function CaesarWizard({ armed }: { armed: boolean }) {
  useLocale((state) => state.locale);
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
          <StepHeader step={1} total={3} title={t("Brute-force the shift")} />
          <p className="text-[9px] leading-relaxed text-stage-muted sm:text-[10px]">{t("Only twenty-five keys. Ask the backend for every candidate word.")}</p>
          <StepButton
            label={t("Try all 25 shifts")}
            busy={busy}
            disabled={!armed}
            onClick={() => void bruteForce()}
          />
        </>
      )}
      {step === 2 && (
        <>
          <StepHeader step={2} total={3} title={t("Pick the English word")} />
          <p className="text-[9px] leading-relaxed text-accent-amber sm:text-[10px]">{t("Which line reads like a real word? Tap it to lock plaintext.")}</p>
          <ul className="max-h-[40dvh] space-y-0.5 overflow-y-auto border border-stage-border px-1 py-1 font-mono text-[10px] sm:max-h-64 sm:text-[11px]">
            {candidates.map((row) => (
              <li key={row.shift}>
                <button
                  type="button"
                  disabled={!armed}
                  onClick={() => pick(row)}
                  className="flex w-full gap-3 px-2 py-1.5 text-left text-[#cfe6ee] hover:bg-accent-amber/20 hover:text-white"
                >
                  <span className="text-stage-muted">{t("k=")}{localize(String(row.shift).padStart(2, " "))}
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
          <StepHeader step={3} total={3} title={t("Plaintext locked")} />
          <p className="text-[9px] text-stage-muted sm:text-[10px]">{t("You chose the English candidate. Close when ready, or hit “I have it”.")}</p>
        </>
      )}
    </div>
  );
}

function RsaWizard({ armed }: { armed: boolean }) {
  useLocale((state) => state.locale);
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
        <dt className="text-stage-muted">{t("public e")}</dt>
        <dd className="text-[#cfe6ee]">{vars.e ?? "?"}</dd>
        <dt className="text-stage-muted">{t("modulus N")}</dt>
        <dd className="text-[#cfe6ee]">{vars.modulus}</dd>
        <dt className="text-stage-muted">{t("ciphertext c")}</dt>
        <dd className="text-accent-amber">{vars.cipherNumber ?? "?"}</dd>
        <dt className="text-stage-muted">{t("factors")}</dt>
        <dd className="text-[#cfe6ee]">{vars.factors ?? "—"}</dd>
        <dt className="text-stage-muted">{t("private d")}</dt>
        <dd className="text-[#cfe6ee]">{vars.d ?? "—"}</dd>
      </dl>

      {step === 1 && (
        <>
          <StepHeader step={1} total={3} title={t("Factor the modulus")} />
          <StepButton
            label={tOptional(`Factor N = ${vars.modulus}`)}
            busy={busy === "factor"}
            disabled={!armed}
            onClick={() => void run("rsaCrack", "factor")}
          />
        </>
      )}
      {step === 2 && (
        <>
          <StepHeader step={2} total={3} title={t("Derive d and decrypt")} />
          <StepButton
            label={t("Rebuild private key and read c")}
            busy={busy === "derive"}
            disabled={!armed}
            onClick={() => void run("deriveKey", "derive")}
          />
        </>
      )}
      {step === 3 && (
        <StepHeader step={3} total={3} title={t("Letter recovered")} />
      )}
    </div>
  );
}
