"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import clsx from "clsx";

import type { ActNumber } from "@/content/types";
import { getAct } from "@/content";
import { DialogBox } from "./DialogBox";
import { GameOver } from "./GameOver";
import { LaptopScene } from "./LaptopScene";
import { MuteButton } from "./MuteButton";
import { ObjectiveList } from "./ObjectiveList";
import { OrientationNotice } from "./OrientationNotice";
import { SidePanel } from "./SidePanel";
import { SuspicionMeter } from "./SuspicionMeter";
import { TouchControls } from "./TouchControls";
import { gameAudio } from "@/game/audio";
import { useGame } from "@/game/state";

// Excalibur is browser-only, so the canvas host never renders on the server.
const GameCanvas = dynamic(
  () => import("./GameCanvas").then((mod) => mod.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center bg-stage-bg">
        <div className="flex flex-col items-center px-6 text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 pixelated opacity-90"
            draggable={false}
          />
          <img
            src="/assets/kenney/ui/divider.png"
            alt=""
            className="mt-4 h-2 w-32 pixelated opacity-70"
            draggable={false}
          />
          <p className="mt-4 text-[11px] tracking-widest text-accent-teal">
            Loading the street…
          </p>
          <div
            className="mt-4 w-48 px-3 py-2"
            style={{
              backgroundImage: "url(/assets/kenney/ui/input_outline.png)",
              backgroundSize: "100% 100%",
              imageRendering: "pixelated",
            }}
          >
            <div className="h-2 overflow-hidden bg-black/40">
              <div className="h-full w-2/3 animate-pulse bg-accent-amber/80" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
);

export function PlayScreen({ act }: { act: ActNumber }) {
  const phase = useGame((s) => s.phase);
  const panel = useGame((s) => s.panel);
  const near = useGame((s) => s.near);
  const walking = useGame((s) => s.walking);
  const pendingTravel = useGame((s) => s.pendingTravel);
  const waitingFor = useGame((s) => s.waitingFor);
  const laptopOpen = useGame((s) => s.laptopOpen);
  const setLaptopOpen = useGame((s) => s.setLaptopOpen);
  const tasks = useGame((s) => s.tasks);
  const [jobSheetOpen, setJobSheetOpen] = useState(false);
  const script = getAct(act);

  const exploring = phase === "exploring";
  const canInteract = exploring && pendingTravel !== null && near === pendingTravel.at;
  const workbenchArmed = waitingFor === "workbench" || panel === "workbench";
  const hasJobs = tasks.length > 0;

  useEffect(() => {
    void gameAudio.playMusic("play");
  }, []);

  return (
    <main className="flex h-dvh max-h-dvh w-screen flex-col overflow-hidden bg-stage-bg">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-stage-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
          <Link
            href="/"
            onClick={() => gameAudio.playSfx("click")}
            className="shrink-0 text-[10px] text-stage-muted hover:text-accent-teal"
          >
            &lt; acts
          </Link>
          <h1 className="truncate text-[11px] text-accent-amber">
            Act {act}: {script.title}
          </h1>
          <span className="hidden truncate text-[10px] text-stage-muted sm:inline">
            {script.subtitle}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[10px] text-stage-muted lg:inline">
            Move: arrows / WASD &middot; Talk: Space &middot; Choose: 1-3
          </span>
          <span className="text-[10px] text-stage-muted lg:hidden">Tap to walk</span>
          <MuteButton />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-0 min-w-0 flex-1">
          <GameCanvas act={act} />

          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
            <div className="flex flex-col items-end gap-2">
              {!laptopOpen && <SuspicionMeter />}
              {/* Mobile-only job sheet opener, sits under the meter. */}
              {!laptopOpen && hasJobs && (
                <button
                  type="button"
                  onClick={() => {
                    gameAudio.playSfx("click");
                    setJobSheetOpen(true);
                  }}
                  className="pointer-events-auto border-2 border-stage-border bg-stage-surface/90 px-3 py-2 text-[10px] uppercase tracking-widest text-accent-teal lg:hidden"
                >
                  Job sheet
                </button>
              )}
            </div>

            <div
              className={clsx(
                "flex w-full flex-col items-center gap-3",
                // Talk FAB only needs clearance while exploring on phones.
                exploring
                  ? "pb-20 lg:pb-0"
                  : "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
              )}
            >
              {exploring && pendingTravel && (
                <div
                  className={clsx(
                    "textbox max-w-md px-3 py-2 text-center transition-opacity duration-200 sm:px-4 sm:py-3",
                    walking && "opacity-20",
                  )}
                >
                  <p className="text-[10px] leading-relaxed text-[#e8f4f8] sm:text-[11px]">
                    {pendingTravel.objective}
                  </p>
                  {canInteract ? (
                    <p className="mt-2 animate-pulse text-[10px] text-accent-amber">
                      <span className="lg:hidden">Tap Talk</span>
                      <span className="hidden lg:inline">Press Space</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-[10px] text-stage-muted lg:hidden">
                      Tap the street to walk
                    </p>
                  )}
                </div>
              )}
              {!laptopOpen && <DialogBox />}
            </div>
          </div>

          <TouchControls canInteract={canInteract} visible={exploring && !laptopOpen} />

          {/* Re-open if they closed the lid early. */}
          {!laptopOpen && (
            <div className="pointer-events-none absolute left-3 top-3 z-10">
              <button
                type="button"
                onClick={() => {
                  gameAudio.playSfx("switch");
                  setLaptopOpen(true);
                }}
                className={clsx(
                  "pointer-events-auto border-2 px-3 py-2 text-[10px] uppercase tracking-widest",
                  workbenchArmed
                    ? "animate-pulse border-accent-amber bg-accent-amber/20 text-accent-amber"
                    : "border-stage-border bg-stage-surface/90 text-accent-teal",
                )}
              >
                Laptop
              </button>
            </div>
          )}

          {/* Anchored to the street column so desktop centering skips the sidebar. */}
          <LaptopScene act={act} />

          <GameOver act={act} />
        </section>

        <aside className="hidden w-72 shrink-0 flex-col gap-3 border-l-2 border-stage-border p-3 lg:flex xl:w-80">
          <SidePanel />
        </aside>
      </div>

      {/* Mobile job sheet overlay */}
      {jobSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/55 lg:hidden">
          <button
            type="button"
            aria-label="Close job sheet"
            className="min-h-0 flex-1"
            onClick={() => {
              gameAudio.playSfx("click");
              setJobSheetOpen(false);
            }}
          />
          <div className="max-h-[70dvh] overflow-y-auto border-t-2 border-stage-border bg-stage-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="relative">
              <ObjectiveList />
              <button
                type="button"
                onClick={() => {
                  gameAudio.playSfx("click");
                  setJobSheetOpen(false);
                }}
                className="absolute right-2 top-1.5 border border-stage-border bg-stage-surface px-2 py-1 text-[10px] uppercase tracking-widest text-stage-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <OrientationNotice />
    </main>
  );
}
