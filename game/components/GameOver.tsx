"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { ActNumber } from "@/content/types";
import { getAct } from "@/content";
import { gameAudio } from "@/game/audio";
import { useGame } from "@/game/state";
import { useProgress } from "@/game/progress";
import { ACT_NUMBERS } from "@/content";
import { RsaProgress } from "./RsaProgress";

/** Shown when the act ends, either because you won it or because they saw you. */
export function GameOver({ act, onReturn, onRetry, onNext }: {
  act: ActNumber; onReturn?: () => void; onRetry?: () => void; onNext?: (act: ActNumber) => void;
}) {
  useLocale((state) => state.locale);
  const phase = useGame((s) => s.phase);
  const suspicion = useGame((s) => s.suspicion);
  const completed = useProgress((s) => s.completed.rsa);
  const played = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "won") return;
    void Promise.resolve(useProgress.persist.rehydrate()).then(() => useProgress.getState().complete("rsa", String(act)));
  }, [phase, act]);

  useEffect(() => {
    if (phase !== "won" && phase !== "caught") return;
    if (played.current === phase) return;
    played.current = phase;
    void gameAudio.playJingle(phase === "caught" ? "lose" : "win");
  }, [phase]);

  if (phase !== "won" && phase !== "caught") return null;

  const caught = phase === "caught";
  const next = ACT_NUMBERS[ACT_NUMBERS.indexOf(act) + 1]
    ?? ACT_NUMBERS.find((number) => number !== act && !completed?.includes(String(number)));
  const hasNext = next !== undefined;
  const script = getAct(act);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-stage-bg/85 p-3 sm:p-6">
      <div className="textbox w-full max-w-lg p-4 text-center sm:p-6">
        <h2
          className={`text-sm ${caught ? "text-actor-hacker" : "text-actor-brayan"}`}
        >
          {localize(caught ? "They found you" : `Act ${act} clear`)}
        </h2>

        <p className="mt-3 text-[11px] leading-relaxed text-stage-muted">
          {localize(caught
            ? "The suspicion meter filled. Everything you learned this act was correct; the way you went about it was not."
            : `${t(script.title)} - ${t(script.subtitle)}. You finished on ${suspicion}% suspicion.`)}
        </p>

        <div className="mt-4"><RsaProgress act={act} /></div>
        <div className="mt-6 flex flex-col gap-2">
          {!caught && hasNext && (onNext ? <button className="btn-primary text-[11px]" onClick={() => { gameAudio.playSfx("confirm"); onNext(next); }}>{t("Continue to Act ")}{next}: {t(getAct(next).title)}</button> : <Link
            href={`/scenarios/rsa/play/${next}`}
            onClick={() => gameAudio.playSfx("confirm")}
            className="btn-primary text-[11px]"
          >{t("Continue to Act ")}{next}: {t(getAct(next).title)}</Link>)}

          {!caught && !hasNext && <p className="text-[11px] text-accent-amber">{t("Breaking RSA complete. You finished all four missions.")}</p>}
          <button
            type="button"
            onClick={() => {
              gameAudio.playSfx("click");
              if (onRetry) onRetry(); else window.location.reload();
            }}
            className="btn-ghost text-[11px]"
          >
            {localize(caught ? "Try this act again" : "Replay this act")}
          </button>

          {onReturn ? <button className="btn-ghost text-[11px]" onClick={onReturn}>{t("Explore town")}</button> : <><Link
            href="/scenarios/rsa"
            onClick={() => gameAudio.playSfx("click")}
            className="btn-ghost text-[11px]"
          >{t("Back to RSA missions")}</Link>
          <Link href="/" className="btn-ghost text-[11px]">{t("All scenarios")}</Link></>}
        </div>
      </div>
    </div>
  );
}
