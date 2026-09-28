"use client";
import { t, tOptional, localize, useLocale } from "@/i18n";

import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

import type { ActNumber } from "@/content/types";
import { gameAudio } from "@/game/audio";
import { resolvePanel } from "@/game/dialog";
import { runApiCall } from "@/game/effects";
import { useGame } from "@/game/state";
import { missionGeneration } from "@/game/runtime";
import { api } from "@/lib/api";
import { bus } from "@/engine/bus";
import { LaptopShell } from "./LaptopShell";
import { LaptopChoiceButton, LaptopQuestion, StepHeader } from "./LaptopControls";
import { PlaintextWorkbench } from "./PlaintextWorkbench";
import { RsaWorkbench } from "./RsaWorkbench";
import { ShorPipeline } from "./ShorPipeline";
import { RsaProgress } from "./RsaProgress";

/**
 * Full-screen laptop: bezel + CRT screen. Decode work happens here one step
 * at a time; the street stays underneath with input locked while the lid is up.
 */
export function LaptopScene({ act, restartControl }: { act: ActNumber; restartControl?: ReactNode }) {
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
  const operations = useGame((s) => s.operations);
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
    if (useGame.getState().operations || useGame.getState().phase === "busy") return;
    gameAudio.playSfx("switch");
    setLaptopOpen(false);
    if (phase === "exploring") void bus.send({ type: "lockInput", locked: false });
  }

  function finish() {
    if (!armed || !recovered || useGame.getState().operations) return;
    gameAudio.playSfx("confirm");
    void resolvePanel();
  }

  return (
    <LaptopShell restartControl={restartControl} open={laptopOpen} title={tOptional(`RSA · Act ${act}`)} onClose={close}
      status={busyLabel || (operations ? "Finishing the current operation…" : `Suspicion: ${suspicion}%`)} closeDisabled={operations > 0 || phase === "busy"}
      memory={<div className="space-y-3"><RsaProgress act={act} showObjective /><MemoryRail /></div>}
      footer={<>
        <p>{localize(armed ? recovered ? "Plaintext ready. Hand it to the client on the street." : "Work the steps. Results land in memory."
          : capture ? "Lid open for notes — tools unlock when the story needs the workbench." : "No capture yet. Listen on the street first.")}</p>
        <button className="btn-primary" disabled={!armed || !recovered || operations > 0} onClick={finish}>{t("I have it")}</button>
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
            <p className="text-xs text-stage-muted">{localize(capture.scheme)}</p>
            <p className="break-all font-mono text-sm text-accent-amber">
              {capture.payload}
            </p>
          </>
        ) : null}
      </MemorySlot>
      <MemorySlot label={t("Notes")} empty={t("Run a tool")}>
        {noteBits.length ? (
          <p className="font-mono text-xs leading-relaxed text-[#9fc4d0]">
            {localize(noteBits.join(" · "))}
          </p>
        ) : null}
      </MemorySlot>
      <MemorySlot label={t("Plaintext")} empty={t("Not recovered")}>
        {recovered ? (
          <p className="break-all font-mono text-sm text-actor-brayan">
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
      <p className="mb-1 text-xs uppercase tracking-widest text-accent-teal">
        {localize(label)}
      </p>
      {localize(children ?? (
        <p className="text-xs text-stage-muted">{localize(empty)}</p>
      ))}
    </div>
  );
}

function Wizard({ act, armed }: { act: ActNumber; armed: boolean }) {
  useLocale((state) => state.locale);
  const capture = useGame((s) => s.capture);
  if (!capture) {
    return (
      <div className="border border-dashed border-stage-border px-3 py-6 text-center text-sm text-stage-muted">{t("Waiting for a packet on the wire.")}</div>
    );
  }
  if (act === 1) return <PlaintextWorkbench armed={armed} />;
  if (act === 2) return <CaesarWizard armed={armed} />;
  if (act === 3) return <RsaWorkbench armed={armed} />;
  return <ShorPipeline armed={armed} />;
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
    <LaptopChoiceButton
      onClick={() => {
        gameAudio.playSfx("click");
        onClick();
      }}
      disabled={disabled || busy}
      className="w-full"
    >
      {busy ? `${t(label)}…` : t(label)}
    </LaptopChoiceButton>
  );
}

function CaesarWizard({ armed }: { armed: boolean }) {
  useLocale((state) => state.locale);
  const cipherText = useGame((s) => s.vars.cipherText);
  const recovered = useGame((s) => s.vars.recovered);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const [candidates, setCandidates] = useState<{ shift: number; word: string }[]>(() => (useGame.getState().labMemory.candidates as { shift: number; word: string }[] | undefined) ?? []);
  const [busy, setBusy] = useState(false);

  const step = recovered ? 3 : candidates.length ? 2 : 1;

  async function bruteForce() {
    if (!armed) return;
    const token = missionGeneration();
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
      useGame.getState().setLabMemory({ candidates: rows });
      pushTerminal({
        tone: "info",
        text: `Tried all 25 shifts against "${cipherText}". One of them is English.`,
      });
      gameAudio.playSfx("computer");
    } catch (error) {
      if (token === missionGeneration()) useGame.getState().setError(error instanceof Error ? error.message : String(error));
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
    <div className="laptop-challenge space-y-3">
      {step === 1 && (
        <>
          <StepHeader step={1} total={3} title={t("Brute-force the shift")} />
          <p className="laptop-note">{t("Only twenty-five keys. Ask the backend for every candidate word.")}</p>
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
          <LaptopQuestion prompt={t("Which line reads like a real word? Tap it to lock plaintext.")} className="space-y-3">
          <ul className="max-h-[40dvh] space-y-2 overflow-y-auto sm:max-h-64">
            {candidates.map((row) => (
              <li key={row.shift}>
                <LaptopChoiceButton
                  disabled={!armed}
                  onClick={() => pick(row)}
                  className="flex w-full gap-3 font-mono"
                >
                  <span className="text-stage-muted">{t("k=")}{localize(String(row.shift).padStart(2, " "))}
                  </span>
                  <span>{row.word}</span>
                </LaptopChoiceButton>
              </li>
            ))}
          </ul>
          </LaptopQuestion>
        </>
      )}
      {step === 3 && (
        <>
          <StepHeader step={3} total={3} title={t("Plaintext locked")} />
          <p className="laptop-note">{t("You chose the English candidate. Close when ready, or hit “I have it”.")}</p>
        </>
      )}
    </div>
  );
}

