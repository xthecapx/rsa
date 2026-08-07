"use client";

import { useEffect, useRef, useState } from "react";
import type { Engine } from "excalibur";

import type { ActNumber } from "@/content/types";
import { getAct } from "@/content";
import { bus } from "@/engine/bus";
import { createGame, disposeGame } from "@/engine/createGame";
import { openScene, startAct } from "@/game/dialog";
import { useGame } from "@/game/state";

/**
 * Owns the Excalibur canvas. Excalibur reaches for `window` and a WebGL
 * context at import time, so the page must load this with `ssr: false`.
 */
export function GameCanvas({ act }: { act: ActNumber }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Keep the booted engine on the promise itself: teardown has to wait for
    // the boot it belongs to, or it disposes nothing and leaks a live engine.
    const booted = (async (): Promise<Engine | null> => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        const engine = await createGame(canvas);
        if (cancelled) return engine;
        engineRef.current = engine;
        await startAct(act);
        return engine;
      } catch (error) {
        if (!cancelled) {
          setFailed(error instanceof Error ? error.message : String(error));
        }
        return null;
      }
    })();

    return () => {
      cancelled = true;
      void booted.then((engine) => {
        engineRef.current = null;
        return disposeGame(engine);
      });
    };
  }, [act]);

  useEffect(() => {
    const script = getAct(act);
    return bus.on((event) => {
      const state = useGame.getState();
      if (event.type === "moved") {
        state.setNear(event.near);
        return;
      }
      if (
        event.type === "interact" &&
        state.phase === "exploring" &&
        event.target === script.opensAt
      ) {
        void openScene(act);
      }
    });
  }, [act]);

  return (
    <div className="absolute inset-0">
      {/* Excalibur owns the canvas dimensions in FitContainer mode; sizing it
          with CSS too makes the two fight over the element every resize. */}
      <canvas ref={canvasRef} />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-stage-bg/90 p-8 text-center text-[12px] text-actor-hacker">
          The street could not be drawn: {failed}
        </div>
      )}
    </div>
  );
}
