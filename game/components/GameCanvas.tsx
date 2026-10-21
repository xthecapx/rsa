"use client";

import { useEffect, useId, useRef } from "react";
import { useAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import type { Engine } from "excalibur";

import { createGame, disposeGame, type WorldName } from "@/engine/createGame";

/**
 * Owns the Excalibur canvas. Excalibur reaches for `window` and a WebGL
 * context at import time, so the page must load this with `ssr: false`.
 */
export function GameCanvas({
  onReady,
  onError,
  world = "city",
  active = true,
}: {
  onReady: () => void | Promise<void>;
  onError: () => void;
  world?: WorldName;
  active?: boolean;
}) {
  useLocale((state) => state.locale);
  // The splash uses audio unlock as its explicit Enter action.
  const entered = useAudio((state) => state.unlocked);
  const controlsActive = active && entered;
  const helpId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    let cancelled = false;
    let bootEngine: Engine | null = null;

    // Keep the booted engine on the promise itself: teardown has to wait for
    // the boot it belongs to, or it disposes nothing and leaks a live engine.
    const booted = (async (): Promise<Engine | null> => {
      const host = hostRef.current;
      if (!host) return null;
      try {
        const engine = await createGame(host, world);
        bootEngine = engine;
        if (cancelled) return engine;
        engineRef.current = engine;
        if (!cancelled) await onReady();
        return engine;
      } catch {
        if (!cancelled) onError();
        return bootEngine;
      }
    })();

    return () => {
      cancelled = true;
      void booted.then((engine) => {
        engineRef.current = null;
        return disposeGame(engine);
      });
    };
  }, [onReady, onError, world]);

  useEffect(() => {
    if (!controlsActive) {
      engineRef.current?.input.keyboard.clear();
      return;
    }
    const frame = requestAnimationFrame(() =>
      hostRef.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [controlsActive]);

  // Excalibur owns this subtree and measures the host for FitContainer.
  // CSS centers desktop FitContainer. On touch devices Excalibur positions
  // FitContainerAndZoom itself, so the host must not add another offset.
  return (
    <>
      <div
        ref={hostRef}
        className="game-canvas-host absolute inset-0"
        tabIndex={controlsActive ? 0 : -1}
        role="application"
        data-exploration-area="true"
        aria-label={t("Town exploration")}
        aria-disabled={!controlsActive}
        aria-describedby={helpId}
        inert={!controlsActive}
      />
      <p
        id={helpId}
        className="exploration-help pointer-events-none absolute bottom-3 left-1/2 z-20 w-max max-w-[90%] -translate-x-1/2 rounded border border-accent-amber bg-stage-bg p-2 text-center text-xs text-accent-amber"
      >
        {t(
          "Move with WASD or arrows. Space interacts. Tab leaves the play area; Return to exploration brings you back.",
        )}
      </p>
    </>
  );
}
