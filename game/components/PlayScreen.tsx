"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import type { ActNumber } from "@/content/types";
import { getAct } from "@/content";
import { DialogBox } from "./DialogBox";
import { GameOver } from "./GameOver";
import { HackerTerminal } from "./HackerTerminal";
import { ObjectiveList } from "./ObjectiveList";
import { ReportForm } from "./ReportForm";
import { SuspicionMeter } from "./SuspicionMeter";
import { Workbench } from "./Workbench";
import { useGame } from "@/game/state";

// Excalibur is browser-only, so the canvas host never renders on the server.
const GameCanvas = dynamic(
  () => import("./GameCanvas").then((mod) => mod.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 grid place-items-center text-[11px] text-stage-muted">
        Loading the street...
      </div>
    ),
  },
);

export function PlayScreen({ act }: { act: ActNumber }) {
  const phase = useGame((s) => s.phase);
  const panel = useGame((s) => s.panel);
  const near = useGame((s) => s.near);
  const pendingTravel = useGame((s) => s.pendingTravel);
  const script = getAct(act);

  const exploring = phase === "exploring";
  const canInteract = exploring && pendingTravel !== null && near === pendingTravel.at;

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-stage-bg">
      <header className="flex shrink-0 items-center justify-between border-b-2 border-stage-border px-4 py-2">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-[10px] text-stage-muted hover:text-accent-teal">
            &lt; acts
          </Link>
          <h1 className="text-[11px] text-accent-amber">
            Act {act}: {script.title}
          </h1>
          <span className="text-[10px] text-stage-muted">{script.subtitle}</span>
        </div>
        <span className="text-[10px] text-stage-muted">
          Move: arrows / WASD &middot; Talk: Space &middot; Choose: 1-3
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1">
          <GameCanvas act={act} />

          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
            <div className="flex justify-end">
              <SuspicionMeter />
            </div>

            <div className="flex flex-col items-center gap-3">
              {exploring && pendingTravel && (
                <div className="textbox px-4 py-3 text-center">
                  <p className="text-[11px] text-[#e8f4f8]">
                    {pendingTravel.objective}
                  </p>
                  {canInteract && (
                    <p className="mt-2 animate-pulse text-[10px] text-accent-amber">
                      Press Space
                    </p>
                  )}
                </div>
              )}
              <DialogBox />
            </div>
          </div>

          <GameOver act={act} />
        </section>

        {/* Job sheet on top, whatever the story needs in the middle, the raw
            backend log underneath. All three stay up the whole act. */}
        <aside className="hidden w-80 shrink-0 flex-col gap-3 border-l-2 border-stage-border p-3 lg:flex xl:w-96">
          <ObjectiveList />
          {panel === "report" ? <ReportForm /> : <Workbench act={act} />}
          <div className="h-48 shrink-0">
            <HackerTerminal />
          </div>
        </aside>
      </div>
    </main>
  );
}
