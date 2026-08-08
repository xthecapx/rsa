"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { Portrait, SPEAKER_COLOR, SPEAKER_NAME } from "./Portrait";
import { advance, choose, visibleChoices } from "@/game/dialog";
import { useGame } from "@/game/state";

const TYPE_SPEED_MS = 18;

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
  const awaitingPanel = useGame((s) => s.awaitingPanel);
  const flags = useGame((s) => s.flags);
  const nodeId = useGame((s) => s.nodeId);

  const line = lines[lineIndex];
  const fullText = feedback ?? line?.text ?? "";
  const speaker = feedback ? "system" : (line?.speaker ?? "system");

  const [typed, setTyped] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setTyped("");
    if (!fullText) return;
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length && timer.current) clearInterval(timer.current);
    }, TYPE_SPEED_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [fullText]);

  const settled = typed.length >= fullText.length;

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
    void advance();
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
        void advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, choices.length, settled, fullText]);

  if (phase !== "dialog" || !fullText) return null;

  const waitingOnPanel = awaitingPanel && lineIndex >= lines.length - 1;
  const canTapContinue = !choices.length && !waitingOnPanel;

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
          ) : (
            settled &&
            (waitingOnPanel ? (
              <div className="mt-3 text-right text-[10px] text-accent-amber">
                <span className="lg:hidden">Open Laptop</span>
                <span className="hidden lg:inline">Use the panel on the right</span>
              </div>
            ) : (
              <div className="mt-3 text-right text-[10px] text-stage-muted">
                <span className="lg:hidden">Tap to continue</span>
                <span className="hidden lg:inline">Space to continue</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
