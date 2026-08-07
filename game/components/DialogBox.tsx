"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { Portrait, SPEAKER_COLOR, SPEAKER_NAME } from "./Portrait";
import { advance, choose, visibleChoices } from "@/game/dialog";
import { useGame } from "@/game/state";

const TYPE_SPEED_MS = 18;

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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;

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
  }, [choices.length, settled, fullText]);

  if (phase !== "dialog" || !fullText) return null;

  return (
    <div className="pointer-events-auto w-full max-w-4xl">
      <div className="textbox flex gap-4 p-4">
        <Portrait speaker={speaker} size={72} />

        <div className="min-w-0 flex-1">
          <div
            className={clsx(
              "mb-2 text-[10px] uppercase tracking-widest",
              SPEAKER_COLOR[speaker],
            )}
          >
            {feedback ? "Think again" : SPEAKER_NAME[speaker] || "Line"}
          </div>

          <p className="min-h-[3.5rem] text-[13px] leading-relaxed text-[#e8f4f8]">
            {typed}
            {!settled && <span className="animate-pulse">|</span>}
          </p>

          {choices.length > 0 && settled ? (
            <ul className="mt-3 space-y-1.5">
              {choices.map((choice, index) => (
                <li key={choice.label}>
                  <button
                    type="button"
                    onClick={() => void choose(index)}
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
            (awaitingPanel && lineIndex >= lines.length - 1 ? (
              <div className="mt-3 text-right text-[10px] text-accent-amber">
                Use the uplink panel on the right
              </div>
            ) : (
              <div className="mt-3 text-right text-[10px] text-stage-muted">
                Space to continue
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
