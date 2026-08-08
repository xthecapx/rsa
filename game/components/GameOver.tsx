"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { ActNumber } from "@/content/types";
import { getAct } from "@/content";
import { gameAudio } from "@/game/audio";
import { useGame } from "@/game/state";

/** Shown when the act ends, either because you won it or because they saw you. */
export function GameOver({ act }: { act: ActNumber }) {
  const phase = useGame((s) => s.phase);
  const suspicion = useGame((s) => s.suspicion);
  const played = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "won" && phase !== "caught") return;
    if (played.current === phase) return;
    played.current = phase;
    void gameAudio.playJingle(phase === "caught" ? "lose" : "win");
  }, [phase]);

  if (phase !== "won" && phase !== "caught") return null;

  const caught = phase === "caught";
  const next = (act + 1) as ActNumber;
  const hasNext = next <= 4;
  const script = getAct(act);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center bg-stage-bg/85 p-6">
      <div className="textbox w-full max-w-md p-6 text-center">
        <h2
          className={`text-sm ${caught ? "text-actor-hacker" : "text-actor-brayan"}`}
        >
          {caught ? "They found you" : `Act ${act} clear`}
        </h2>

        <p className="mt-3 text-[11px] leading-relaxed text-stage-muted">
          {caught
            ? "The suspicion meter filled. Everything you learned this act was correct; the way you went about it was not."
            : `${script.title} - ${script.subtitle}. You finished on ${suspicion}% suspicion.`}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              gameAudio.playSfx("click");
              window.location.reload();
            }}
            className="btn-ghost text-[11px]"
          >
            {caught ? "Try this act again" : "Replay this act"}
          </button>

          {!caught && hasNext && (
            <Link
              href={`/play/${next}`}
              onClick={() => gameAudio.playSfx("confirm")}
              className="btn-primary text-[11px]"
            >
              Continue to Act {next}
            </Link>
          )}

          {!caught && !hasNext && (
            <p className="text-[11px] text-accent-amber">
              That was the last act. You broke every scheme on the wire.
            </p>
          )}

          <Link
            href="/"
            onClick={() => gameAudio.playSfx("click")}
            className="btn-ghost text-[11px]"
          >
            Back to the acts
          </Link>
        </div>
      </div>
    </div>
  );
}
