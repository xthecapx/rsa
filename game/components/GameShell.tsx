"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { t, useLocale } from "@/i18n";
import { MuteButton } from "./MuteButton";
import { SceneLoading } from "./SceneLoading";
import { OrientationNotice } from "./OrientationNotice";

/** Every scenario occupies the same game screen; only its world and tools change. */
export function GameShell({ title, subtitle, backHref, backLabel, sidebar, objectives, children, laptopOpen, laptopReady, onOpenLaptop, sceneReady = true, sceneFailed = false }: {
  title: string; subtitle: string; backHref: string; backLabel: string;
  sidebar: ReactNode; objectives: ReactNode; children: ReactNode;
  laptopOpen: boolean; laptopReady: boolean; onOpenLaptop: () => void;
  sceneReady?: boolean; sceneFailed?: boolean;
}) {
  useLocale((s) => s.locale);
  const [objectivesOpen, setObjectivesOpen] = useState(false);
  return <main className="game-shell flex h-dvh max-h-dvh w-screen flex-col overflow-hidden bg-stage-bg">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-stage-border px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <Link href={backHref} className="shrink-0 text-[10px] text-stage-muted hover:text-accent-teal">{backLabel}</Link>
        <h1 className="truncate text-[11px] text-accent-amber">{title}</h1>
        <span className="hidden truncate text-[10px] text-stage-muted xl:inline">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span id="game-controls-help" className="sr-only 2xl:not-sr-only 2xl:text-xs 2xl:text-stage-muted">{t("Move: arrows / WASD · Talk: Space")}</span>
        <span className="hidden text-[10px] text-stage-muted sm:inline xl:hidden">{t("Tap to walk")}</span>
        <button className="btn-ghost text-xs" disabled={!sceneReady} aria-expanded={objectivesOpen} onClick={() => setObjectivesOpen((open) => !open)}>{t("Objectives")}</button>
        <MuteButton />
      </div>
    </header>
    <div className="flex min-h-0 flex-1">
      <section className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="absolute inset-0" inert={!sceneReady} aria-hidden={!sceneReady} style={{ visibility: sceneReady ? "visible" : "hidden" }}>{children}</div>
        {!sceneReady && <SceneLoading failed={sceneFailed} />}
        {sceneReady && !laptopOpen && <button type="button" onClick={onOpenLaptop} className={clsx(
          "absolute left-3 top-3 z-10 border-2 px-3 py-2 text-[10px] uppercase tracking-widest",
          laptopReady ? "animate-pulse border-accent-amber bg-accent-amber/20 text-accent-amber" : "border-stage-border bg-stage-surface/90 text-accent-teal",
        )}>{t("Laptop")}</button>}
      </section>
      {sceneReady && objectivesOpen && <aside className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l-2 border-stage-border p-3 lg:flex">{sidebar}</aside>}
    </div>
    {sceneReady && objectivesOpen && <div role="dialog" aria-modal="true" aria-label={t("Objectives")} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") setObjectivesOpen(false); }} className="fixed inset-0 z-50 flex flex-col justify-end bg-black/55 lg:hidden">
      <button aria-label={t("Close job sheet")} className="min-h-0 flex-1" onClick={() => setObjectivesOpen(false)} />
      <div className="max-h-[70dvh] overflow-y-auto border-t-2 border-stage-border bg-stage-bg p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2 flex justify-end"><button autoFocus className="btn-ghost text-xs" onClick={() => setObjectivesOpen(false)}>{t("Close")}</button></div>
        {objectives}
      </div>
    </div>}
    <OrientationNotice />
  </main>;
}
