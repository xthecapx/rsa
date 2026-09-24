"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { Portrait } from "./Portrait";
import { DialogueFrame, DialogueLine, useDialogueText } from "./DialoguePresentation";
import { advance, choose, submitReport, visibleChoices } from "@/game/dialog";
import { gameAudio } from "@/game/audio";
import { useGame } from "@/game/state";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, button, a, select"));
}

/** Pokemon-style textbox: portrait on the left, typewriter text, then choices. */
export function DialogBox() {
  useLocale((state) => state.locale);
  const phase = useGame((s) => s.phase);
  const lines = useGame((s) => s.lines);
  const lineIndex = useGame((s) => s.lineIndex);
  const choicesVisible = useGame((s) => s.choicesVisible);
  const feedback = useGame((s) => s.feedback);
  const waitingFor = useGame((s) => s.waitingFor);
  const reportError = useGame((s) => s.reportError);
  const recovered = useGame((s) => s.vars.recovered);
  const setLaptopOpen = useGame((s) => s.setLaptopOpen);
  const flags = useGame((s) => s.flags);
  const nodeId = useGame((s) => s.nodeId);

  const busyLabel = useGame((s) => s.busyLabel);

  const line = lines[lineIndex];
  const fullText = t(feedback ?? line?.text ?? "");
  const speaker = feedback ? "system" : (line?.speaker ?? "system");

  const { typed, settled, reveal } = useDialogueText(fullText);
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const reportField = useRef<HTMLInputElement | null>(null);

  const onLastLine = lineIndex >= lines.length - 1;
  const waitingOnWorkbench = waitingFor === "workbench" && onLastLine && settled;
  const waitingOnReport = waitingFor === "report" && onLastLine && settled;
  // Only block advancing once the last line is fully shown; skip must still work.
  const blocked = Boolean(waitingFor) && onLastLine && settled;

  // After the briefing lines, lift the lid so decode is its own scene.
  useEffect(() => {
    if (!waitingOnWorkbench) return;
    gameAudio.playSfx("switch");
    setLaptopOpen(true);
  }, [waitingOnWorkbench, setLaptopOpen]);

  useEffect(() => {
    if (!waitingOnReport) return;
    setAnswer("");
    reportField.current?.focus();
  }, [waitingOnReport, nodeId]);

  // `flags` and `nodeId` are read so the choice list refreshes when either
  // changes; visibleChoices() reads them straight off the store.
  const choices = choicesVisible && !feedback ? visibleChoices() : [];
  void flags;
  void nodeId;

  function continueLine() {
    if (!settled) {
      reveal();
      return;
    }
    if (blocked) return;
    void advance();
  }

  async function tellBoss(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!waitingOnReport || !answer.trim() || sending) return;
    setSending(true);
    try {
      await submitReport(answer);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (phase !== "dialog") return;

    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      // The report field wants its own spaces and digits.
      if (isTyping(event.target)) return;

      if (choices.length) {
        const digit = Number(event.key);
        if (digit >= 1 && digit <= choices.length) {
          event.preventDefault();
          void choose(digit - 1);
        }
        return;
      }

      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        if (!settled) {
          reveal();
          return;
        }
        if (blocked) return;
        void advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, choices.length, settled, fullText, blocked]);

  // Long cutscenes (packet flight, API) set phase to busy and used to blank the
  // dialog entirely. Keep a status line up so the street does not look frozen.
  if (phase === "busy") {
    return (
      <div className="pointer-events-none w-full max-w-4xl">
        <div className="textbox flex gap-3 p-3 sm:gap-4 sm:p-4">
          <div className="hidden sm:block">
            <Portrait speaker="system" size={72} />
          </div>
          <div className="sm:hidden">
            <Portrait speaker="system" size={48} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-[10px] uppercase tracking-widest text-stage-muted">{t("System")}</div>
            <p className="animate-pulse text-[12px] leading-relaxed text-accent-amber sm:text-[13px]">
              {localize(busyLabel ?? "Working")}…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase !== "dialog" || !fullText) return null;

  // Clicks can always skip the typewriter; only the report field / choices
  // own the box once those are up.
  const canTapContinue = !choices.length && !waitingOnReport;
  const showChoices = choices.length > 0 && settled;

  return (
    <div className="pointer-events-auto w-full max-w-4xl">
      <DialogueFrame
        role={canTapContinue ? "button" : undefined}
        tabIndex={canTapContinue ? 0 : undefined}
        onClick={() => {
          if (!canTapContinue) return;
          continueLine();
        }}
      >
        <DialogueLine speaker={speaker} label={feedback ? t("Think again") : undefined}>
          {typed}{!settled && <span className="animate-pulse">|</span>}
        </DialogueLine>

        {showChoices ? (
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-1">
            {choices.map((choice, index) => (
              <li key={choice.label} className="shrink-0">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    gameAudio.playSfx("select");
                    void choose(index);
                  }}
                  className="flex min-h-12 w-full items-start gap-3 border-2 border-stage-border bg-black/20 px-3 py-3 text-left text-[11px] leading-snug text-[#cfe6ee] transition-colors active:border-accent-amber active:bg-accent-amber/15 sm:min-h-0 sm:py-2.5 sm:text-[12px] sm:hover:border-accent-amber sm:hover:bg-accent-amber/10 sm:hover:text-white"
                >
                  <span className="shrink-0 pt-0.5 font-mono text-accent-amber">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1">{localize(choice.label)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : waitingOnReport ? (
          <form
            onSubmit={(event) => void tellBoss(event)}
            onClick={(event) => event.stopPropagation()}
            className="shrink-0 space-y-2"
          >
            {localize(recovered && (
              <p className="text-[10px] text-stage-muted">{t("Your notes read")}{localize(" ")}
                <span className="font-mono text-actor-brayan">{localize(recovered)}</span>.
              </p>
            ))}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                ref={reportField}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={t("Say what crossed the wire")}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 border-2 border-stage-border bg-stage-bg px-2.5 py-2 font-mono text-[13px] uppercase tracking-widest text-[#e8f4f8] outline-none focus:border-accent-amber"
              />
              <button
                type="submit"
                disabled={!answer.trim() || sending}
                className="min-h-11 shrink-0 border-2 border-accent-amber px-3 py-2 text-[11px] text-accent-amber transition-colors hover:bg-accent-amber/15 disabled:cursor-not-allowed disabled:border-stage-border disabled:text-stage-muted"
              >
                {localize(sending ? "Saying it…" : "Tell him")}
              </button>
            </div>
            {localize(reportError && (
              <p className="text-[11px] leading-relaxed text-actor-hacker">
                {localize(reportError)}
              </p>
            ))}
          </form>
        ) : (
          <div
            className={clsx(
              "shrink-0 text-right text-[10px]",
              waitingOnWorkbench ? "text-accent-amber" : "text-stage-muted",
            )}
          >
            {!settled ? (
              <>
                <span className="lg:hidden">{t("Tap to skip")}</span>
                <span className="hidden lg:inline">{t("Space to skip")}</span>
              </>
            ) : waitingOnWorkbench ? (
              <span>{t("Laptop unlocked — work the steps on screen")}</span>
            ) : (
              <>
                <span className="lg:hidden">{t("Tap to continue")}</span>
                <span className="hidden lg:inline">{t("Space to continue")}</span>
              </>
            )}
          </div>
        )}
      </DialogueFrame>
    </div>
  );
}
