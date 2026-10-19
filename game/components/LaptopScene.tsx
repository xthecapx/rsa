"use client";
import { t, tOptional, localize, useLocale } from "@/i18n";
import { useExecution } from "@/lib/execution";

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
import { useAsyncOperation } from "./useAsyncOperation";
import { LaptopShell } from "./LaptopShell";
import { LaptopChoiceButton, LaptopQuestion, StepHeader } from "./LaptopControls";
import { PlaintextWorkbench } from "./PlaintextWorkbench";
import { RsaWorkbench } from "./RsaWorkbench";
import { ShorPipeline } from "./ShorPipeline";
import { RsaProgress } from "./RsaProgress";
import { RsaMemoryRail } from "./RsaMemoryRail";

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

  const background = useExecution((state) => !!state.background);
  // Freeze street controls only while the laptop owns the screen.
  useEffect(() => {
    if (!laptopOpen || background) return;
    void bus.send({ type: "lockInput", locked: true });
    return () => {
      if (useGame.getState().phase === "exploring") {
        void bus.send({ type: "lockInput", locked: false });
      }
    };
  }, [laptopOpen, background]);

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
    <LaptopShell restartControl={restartControl} open={laptopOpen} calculator={act >= 3} title={tOptional(`RSA · Act ${act}`)} onClose={close}
      status={busyLabel || (operations ? "Finishing the current operation…" : `Suspicion: ${suspicion}%`)} closeDisabled={operations > 0 || phase === "busy"}
      memory={<div className="space-y-3"><RsaProgress act={act} showObjective /><RsaMemoryRail act={act} /></div>}
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
  const operation = useAsyncOperation();
  const { busy } = operation;

  const step = recovered ? 3 : candidates.length ? 2 : 1;

  async function bruteForce() {
    if (!armed) return;
    const token = missionGeneration();
    return operation.run(() => Promise.all(
      String(cipherText).split("").map((char) => api.caesar.crack(char)),
    ), {
      isCurrent: () => token === missionGeneration(),
      success(perChar) {
        const rows = Array.from({ length: 25 }, (_, i) => {
          const shift = i + 1;
          const word = perChar.map((res) => res.trials.find((t) => t.shift === shift)?.candidate ?? "?").join("");
          return { shift, word };
        });
        setCandidates(rows);
        useGame.getState().setLabMemory({ candidates: rows });
        pushTerminal({ tone: "info", text: `Tried all 25 shifts against "${cipherText}". One of them is English.` });
        gameAudio.playSfx("computer");
      },
      error(cause) { useGame.getState().setError(cause instanceof Error ? cause.message : String(cause)); },
    });
  }

  function pick(row: { shift: number; word: string }) {
    if (!armed) return;
    setVars({ recovered: row.word, shift: row.shift });
    pushTerminal({ tone: "good", text: `Caesar shift k = ${row.shift} gives "${row.word}".` });
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
                  <span className="text-stage-muted">{t("Shift")} k = {localize(String(row.shift).padStart(2, " "))}
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

