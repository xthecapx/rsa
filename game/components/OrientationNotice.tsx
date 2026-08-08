"use client";

import { useEffect, useState } from "react";

/**
 * The street is a wide strip (480x256), so a portrait phone can only ever show
 * a sliver of it. Landscape is the intended way to play, but the game still
 * works turned the other way, so this asks rather than blocks.
 */
export function OrientationNotice() {
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)");
    const upright = window.matchMedia("(orientation: portrait)");

    const sync = () => setPortrait(touch.matches && upright.matches);
    sync();

    upright.addEventListener("change", sync);
    touch.addEventListener("change", sync);
    return () => {
      upright.removeEventListener("change", sync);
      touch.removeEventListener("change", sync);
    };
  }, []);

  if (!portrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-stage-bg p-8 text-center">
      <div className="text-[40px] leading-none" aria-hidden>
        ⟳
      </div>

      <div className="space-y-3">
        <h2 className="text-[13px] text-accent-amber">Turn your phone sideways</h2>
        <p className="text-[11px] leading-relaxed text-stage-muted">
          The street is wider than it is tall. In landscape you can see Ale,
          Brayan and the junction box at once.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="border-2 border-stage-border px-4 py-2 text-[10px] uppercase tracking-widest text-stage-muted"
      >
        Play in portrait
      </button>
    </div>
  );
}
