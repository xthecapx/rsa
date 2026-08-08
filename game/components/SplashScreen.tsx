"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import clsx from "clsx";

import { gameAudio, useAudio } from "@/game/audio";

type Phase = "loading" | "ready" | "leaving" | "gone";

/**
 * PWA-style boot splash: Kenney UI chrome, load progress, then a tap to
 * unlock audio (browsers block autoplay) and enter the title screen.
 *
 * Rendered on the first paint (no mounted-gate) so the title never flashes
 * underneath. Soft SPA remounts skip it once audio is already unlocked.
 */
export function SplashScreen() {
  const ready = useAudio((s) => s.ready);
  const unlocked = useAudio((s) => s.unlocked);
  const [phase, setPhase] = useState<Phase>(() => (unlocked ? "gone" : "loading"));
  const [progress, setProgress] = useState(0);

  useLayoutEffect(() => {
    if (unlocked) {
      setPhase("gone");
      document.documentElement.dataset.boot = "done";
      return;
    }
    document.documentElement.dataset.boot = "1";
    void gameAudio.preload();
  }, [unlocked]);

  useEffect(() => {
    if (phase === "gone" || unlocked) return;

    let cancelled = false;
    let frame = 0;

    const tick = () => {
      if (cancelled) return;
      setProgress((p) => Math.min(p + (ready ? 8 : 1.2), ready ? 100 : 88));
      frame = window.setTimeout(tick, 40);
    };
    frame = window.setTimeout(tick, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(frame);
    };
  }, [ready, phase, unlocked]);

  useEffect(() => {
    if (phase !== "loading") return;
    if (ready && progress >= 100) setPhase("ready");
  }, [ready, progress, phase]);

  const enter = async () => {
    if (phase !== "ready" && phase !== "loading") return;
    setPhase("leaving");
    await gameAudio.unlock();
    document.documentElement.dataset.boot = "done";
    window.setTimeout(() => setPhase("gone"), 520);
  };

  if (phase === "gone") return null;

  const pct = Math.min(100, Math.round(progress));

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-stage-bg transition-opacity duration-500",
        phase === "leaving" && "pointer-events-none opacity-0",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Loading Man in the Middle"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(45,212,191,0.12), transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(245,166,35,0.08), transparent 45%)",
        }}
      />
      <div aria-hidden className="scanline pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 pixelated drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          draggable={false}
        />

        <p className="mt-6 text-[9px] uppercase tracking-[0.4em] text-accent-teal">
          Progressive wiretap
        </p>
        <h1 className="mt-3 text-base leading-relaxed text-accent-amber sm:text-xl">
          Man in the Middle
        </h1>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/kenney/ui/divider_edges.png"
          alt=""
          className="mt-5 h-3 w-48 pixelated opacity-80 sm:w-64"
          draggable={false}
        />

        <p className="mt-5 max-w-sm text-[10px] leading-relaxed text-stage-muted sm:text-[11px]">
          One street. One cable. Four schemes between Ale and Brayan —
          and you in the junction box.
        </p>

        <div
          className="relative mt-8 w-full max-w-xs px-4 py-3"
          style={{
            backgroundImage: "url(/assets/kenney/ui/input_outline.png)",
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
          }}
        >
          <div className="h-3 overflow-hidden rounded-sm bg-black/40">
            <div
              className="h-full bg-accent-amber transition-[width] duration-100 ease-linear"
              style={{
                width: `${pct}%`,
                backgroundImage: "url(/assets/kenney/ui/slide_fill.png)",
                backgroundSize: "cover",
                imageRendering: "pixelated",
              }}
            />
          </div>
          <p className="mt-2 text-[9px] tracking-widest text-stage-muted">
            {phase === "ready" ? "READY" : `LOADING ${pct}%`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void enter()}
          disabled={phase === "leaving"}
          onMouseEnter={() => {
            if (phase === "ready") gameAudio.playSfx("rollover");
          }}
          className={clsx(
            "kenney-btn kenney-btn-amber mt-8 min-w-[220px] px-8 py-4 text-[11px] uppercase tracking-[0.25em] text-[#1a1208] transition-transform active:scale-[0.98]",
            phase === "ready" ? "animate-pulse cursor-pointer" : "cursor-default opacity-70",
          )}
        >
          <span className="inline-flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/kenney/ui/icon_play.png"
              alt=""
              className="h-4 w-4 pixelated"
              draggable={false}
            />
            {phase === "ready" ? "Tap to enter" : "Warming up…"}
          </span>
        </button>

        <p className="mt-8 text-[8px] leading-relaxed text-stage-muted/80">
          UI &amp; audio by{" "}
          <a
            href="https://kenney.nl"
            className="text-accent-teal hover:underline"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            Kenney
          </a>{" "}
          (CC0)
        </p>
      </div>
    </div>
  );
}
