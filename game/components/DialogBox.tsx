"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { Portrait, SPEAKER_COLOR, SPEAKER_NAME } from "./Portrait";
import { advance, choose, submitReport, visibleChoices } from "@/game/dialog";
import { useGame } from "@/game/state";

const TYPE_MS = 12;
/** Reveal a few glyphs per tick so long lines do not feel stuck. */
const CHARS_PER_TICK = 3;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

/** Pokemon-style textbox: portrait on the left, typewriter text, then choices. */
export function DialogBox() {
  const phase = useGame((s) => s.phase);
  const lines = useGame((s) => s.lines);
  const lineIndex = useGame((s) => s.lineIndex);
  const choicesVisible = useGame((s) => s.choicesVisible);
  const feedback = useGame((s) => s.feedback);
  const waitingFor = useGame((s) => s.waitingFor);
  const reportError = useGame((s) => s.reportError);
  const recovered = useGame((s) => s.vars.recovered);
  const flags = useGame((s) => s.flags);
  const nodeId = useGame((s) => s.nodeId);

  const busyLabel = useGame((s) => s.busyLabel);

  const line = lines[lineIndex];
  const fullText = feedback ?? line?.text ?? "";
  const speaker = feedback ? "system" : (line?.speaker ?? "system");

  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportField = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTyped("");
    if (!fullText) return;
    let i = 0;
    timer.current = setInterval(() => {
      i = Math.min(fullText.length, i + CHARS_PER_TICK);
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length && timer.current) clearInterval(timer.current);
    }, TYPE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [fullText]);

  const settled = fullText.length === 0 || typed.length >= fullText.length;
  const onLastLine = lineIndex >= lines.length - 1;
  const waitingOnWorkbench = waitingFor === "workbench" && onLastLine && settled;
  const waitingOnReport = waitingFor === "report" && onLastLine && settled;
  // Only block advancing once the last line is fully shown; skip must still work.
  const blocked = Boolean(waitingFor) && onLastLine && settled;

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
      if (timer.current) clearInterval(timer.current);
      setTyped(fullText);
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
          if (timer.current) clearInterval(timer.current);
          setTyped(fullText);
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
            <div className="mb-2 text-[10px] uppercase tracking-widest text-stage-muted">
              System
            </div>
            <p className="animate-pulse text-[12px] leading-relaxed text-accent-amber sm:text-[13px]">
              {busyLabel ?? "Working"}…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase !== "dialog" || !fullText) return null;

  // Clicks can always skip the typewriter; only the report field owns the box
  // once that form is up.
  const canTapContinue = !choices.length && !waitingOnReport;

  return (
    <div className="pointer-events-auto w-full max-w-4xl">
      <div
        className="textbox flex gap-3 p-3 sm:gap-4 sm:p-4"
        role={canTapContinue ? "button" : undefined}
        tabIndex={canTapContinue ? 0 : undefined}
        onClick={() => {
          if (!canTapContinue) return;
          continueLine();
        }}
      >
        <div className="hidden sm:block">
          <Portrait speaker={speaker} size={72} />
        </div>
        <div className="sm:hidden">
          <Portrait speaker={speaker} size={48} />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={clsx(
              "mb-2 text-[10px] uppercase tracking-widest",
              SPEAKER_COLOR[speaker],
            )}
          >
            {feedback ? "Think again" : SPEAKER_NAME[speaker]}
          </div>

          <p className="min-h-[3rem] text-[12px] leading-relaxed text-[#e8f4f8] sm:min-h-[3.5rem] sm:text-[13px]">
            {typed}
            {!settled && <span className="animate-pulse">|</span>}
          </p>

          {choices.length > 0 && settled ? (
            <ul className="mt-3 space-y-1.5">
              {choices.map((choice, index) => (
                <li key={choice.label}>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void choose(index);
                    }}
                    className="group flex w-full items-start gap-3 border-2 border-transparent px-2 py-1.5 text-left text-[12px] leading-relaxed text-[#cfe6ee] transition-colors hover:border-accent-amber hover:bg-accent-amber/10 hover:text-white"
                  >
                    <span className="text-accent-amber">{index + 1}.</span>
                    <span>{choice.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : waitingOnReport ? (
            <form
              onSubmit={(event) => void tellBoss(event)}
              onClick={(event) => event.stopPropagation()}
              className="mt-3 space-y-2"
            >
              {recovered && (
                <p className="text-[10px] text-stage-muted">
                  Your notes read{" "}
                  <span className="font-mono text-actor-brayan">{recovered}</span>.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <input
                  ref={reportField}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Say what crossed the wire"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 border-2 border-stage-border bg-stage-bg px-2.5 py-2 font-mono text-[13px] uppercase tracking-widest text-[#e8f4f8] outline-none focus:border-accent-amber"
                />
                <button
                  type="submit"
                  disabled={!answer.trim() || sending}
                  className="shrink-0 border-2 border-accent-amber px-3 py-2 text-[11px] text-accent-amber transition-colors hover:bg-accent-amber/15 disabled:cursor-not-allowed disabled:border-stage-border disabled:text-stage-muted"
                >
                  {sending ? "Saying it…" : "Tell him"}
                </button>
              </div>
              {reportError && (
                <p className="text-[11px] leading-relaxed text-actor-hacker">
                  {reportError}
                </p>
              )}
            </form>
          ) : (
            <div
              className={clsx(
                "mt-3 text-right text-[10px]",
                waitingOnWorkbench ? "text-accent-amber" : "text-stage-muted",
              )}
            >
              {!settled ? (
                <>
                  <span className="lg:hidden">Tap to skip</span>
                  <span className="hidden lg:inline">Space to skip</span>
                </>
              ) : waitingOnWorkbench ? (
                <>
                  <span className="lg:hidden">Open Laptop</span>
                  <span className="hidden lg:inline">Use the panel on the right</span>
                </>
              ) : (
                <>
                  <span className="lg:hidden">Tap to continue</span>
                  <span className="hidden lg:inline">Space to continue</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
