"use client";

import { useEffect, useRef } from "react";
import type { Engine } from "excalibur";

import { createGame, disposeGame } from "@/engine/createGame";

/**
 * Owns the Excalibur canvas. Excalibur reaches for `window` and a WebGL
 * context at import time, so the page must load this with `ssr: false`.
 */
export function GameCanvas({ onReady, onError }: { onReady: () => void | Promise<void>; onError: () => void }) {
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
  }, [onReady, onError]);

  // Excalibur owns this subtree and measures the host for FitContainer.
  // Center the fitted canvas so any unused space is shared on both sides.
  return <div ref={hostRef} className="game-canvas-host absolute inset-0" />;
}
