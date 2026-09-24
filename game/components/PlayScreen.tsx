"use client";
import { t, localize, useLocale } from "@/i18n";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";

import type { ActNumber } from "@/content/types";
import { getAct } from "@/content";
import { DialogBox } from "./DialogBox";
import { GameOver } from "./GameOver";
import { LaptopScene } from "./LaptopScene";
import { ObjectiveList } from "./ObjectiveList";
import { GameShell } from "./GameShell";
import { SidePanel } from "./SidePanel";
import { SuspicionMeter } from "./SuspicionMeter";
import { TouchControls } from "./TouchControls";
import { gameAudio } from "@/game/audio";
import { useGame } from "@/game/state";

// Excalibur is browser-only, so the canvas host never renders on the server.
const GameCanvas = dynamic(
  () => import("./GameCanvas").then((mod) => mod.GameCanvas),
  { ssr: false, loading: () => null },
);

export function PlayScreen({ act }: { act: ActNumber }) {
  useLocale((state) => state.locale);
  const [sceneStatus, setSceneStatus] = useState<{ act: ActNumber; state: "ready" | "error" } | null>(null);
  const sceneReady = sceneStatus?.act === act && sceneStatus.state === "ready";
  const sceneFailed = sceneStatus?.act === act && sceneStatus.state === "error";
  const onSceneReady = useCallback(() => setSceneStatus({ act, state: "ready" }), [act]);
  const onSceneError = useCallback(() => setSceneStatus({ act, state: "error" }), [act]);
  const phase = useGame((s) => s.phase);
  const panel = useGame((s) => s.panel);
  const near = useGame((s) => s.near);
  const walking = useGame((s) => s.walking);
  const pendingTravel = useGame((s) => s.pendingTravel);
  const waitingFor = useGame((s) => s.waitingFor);
  const laptopOpen = useGame((s) => s.laptopOpen);
  const setLaptopOpen = useGame((s) => s.setLaptopOpen);
  const script = getAct(act);

  const exploring = phase === "exploring";
  const canInteract = exploring && pendingTravel !== null && near === pendingTravel.at;
  const workbenchArmed = waitingFor === "workbench" || panel === "workbench";

  useEffect(() => {
    void gameAudio.playMusic("play");
  }, []);

  return (
    <GameShell title={`${t("Act")} ${act}: ${t(script.title)}`} subtitle={t(script.subtitle)}
      backHref="/scenarios/rsa" backLabel={t("< RSA missions")} sidebar={<SidePanel />} objectives={<ObjectiveList />}
      sceneReady={sceneReady} sceneFailed={sceneFailed}
      laptopOpen={laptopOpen} laptopReady={workbenchArmed} onOpenLaptop={() => { gameAudio.playSfx("switch"); setLaptopOpen(true); }}>
          <GameCanvas key={act} act={act} onReady={onSceneReady} onError={onSceneError} />

          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
            <div className="flex flex-col items-end gap-2">
              {!laptopOpen && <SuspicionMeter />}
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
                  <p className="text-sm leading-relaxed text-[#e8f4f8]">
                    {localize(pendingTravel.objective)}
                  </p>
                  {canInteract ? (
                    <p className="mt-2 animate-pulse text-xs text-accent-amber">
                      <span className="lg:hidden">{t("Tap Talk")}</span>
                      <span className="hidden lg:inline">{t("Press Space")}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-stage-muted lg:hidden">{t("Tap the street to walk")}</p>
                  )}
                </div>
              )}
              {sceneReady && !laptopOpen && <DialogBox />}
            </div>
          </div>

          <TouchControls canInteract={canInteract} visible={sceneReady && exploring && !laptopOpen} />

          {/* Anchored to the street column so desktop centering skips the sidebar. */}
          {sceneReady && <LaptopScene act={act} />}

          {sceneReady && <GameOver act={act} />}
    </GameShell>
  );
}
