"use client";

import { useEffect, useState } from "react";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || iosStandalone;
}

/**
 * The street is a wide strip (480x256), so a portrait phone can only ever show
 * a sliver of it. Landscape is required — especially when installed as a PWA
 * (manifest orientation + Screen Orientation lock). This overlay blocks play
 * until the device is sideways; the dismiss escape hatch is only offered in
 * the regular browser tab, not in the installed app.
 */
export function OrientationNotice() {
  const [portrait, setPortrait] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse)");
    const upright = window.matchMedia("(orientation: portrait)");

    const sync = () => {
      setStandalone(isStandaloneDisplay());
      setPortrait(touch.matches && upright.matches);
    };
    sync();

    upright.addEventListener("change", sync);
    touch.addEventListener("change", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      upright.removeEventListener("change", sync);
      touch.removeEventListener("change", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  // Installed PWA: always block portrait. Browser tab: same, but allow a one-tap escape.
  const forced = standalone || portrait;
  if (!forced || !portrait || (dismissed && !standalone)) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-stage-bg p-8 text-center">
      <div className="text-[40px] leading-none" aria-hidden>
        ⟳
      </div>

      <div className="space-y-3">
        <h2 className="text-[13px] text-accent-amber">Turn your phone sideways</h2>
        <p className="text-[11px] leading-relaxed text-stage-muted">
          The street is wider than it is tall. Landscape is required so you can
          see Ale, Brayan and the junction box at once.
        </p>
      </div>

      {!standalone && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="border-2 border-stage-border px-4 py-2 text-[10px] uppercase tracking-widest text-stage-muted"
        >
          Play in portrait anyway
        </button>
      )}
    </div>
  );
}
