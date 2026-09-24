"use client";

import { useEffect, useRef } from "react";
import type { Engine } from "excalibur";

import type { ActNumber } from "@/content/types";
import { bus } from "@/engine/bus";
import { createGame, disposeGame } from "@/engine/createGame";
import { interactAt, startAct } from "@/game/dialog";
import { useGame } from "@/game/state";

/**
 * Owns the Excalibur canvas. Excalibur reaches for `window` and a WebGL
 * context at import time, so the page must load this with `ssr: false`.
 */
export function GameCanvas({ act, onReady, onError }: { act: ActNumber; onReady: () => void; onError: () => void }) {
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
        const engine = await createGame(host);
        bootEngine = engine;
        if (cancelled) return engine;
        engineRef.current = engine;
        await startAct(act);
        if (!cancelled) onReady();
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
  }, [act, onReady, onError]);

  useEffect(
    () =>
      bus.on((event) => {
        if (event.type === "moved") {
          useGame.getState().setNear(event.near);
          return;
        }
        if (event.type === "walking") {
          useGame.getState().setWalking(event.walking);
          return;
        }
        // Which landmark matters depends on where the story is, so the runner
        // decides whether this press does anything.
        if (event.type === "interact") void interactAt(event.target);
      }),
    [],
  );

  return (
    <div className="absolute inset-0">
      {/* The canvas is created and removed by the engine, so React must not
          own this subtree. Excalibur measures this host for FitContainer. */}
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
