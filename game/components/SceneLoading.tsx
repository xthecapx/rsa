"use client";

import { t, useLocale } from "@/i18n";

/** The same scene-ready screen for every renderer; no simulated percentages. */
export function SceneLoading({ failed = false }: { failed?: boolean }) {
  useLocale((s) => s.locale);
  return <div className="absolute inset-0 z-30 grid place-items-center bg-stage-bg p-6" aria-busy={!failed}>
    <div className="flex max-w-sm flex-col items-center text-center" role={failed ? "alert" : "status"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={72} height={72} className="pixelated mb-5" />
      <p className="text-xs uppercase tracking-widest text-accent-teal">{t("Learn by playing")}</p>
      <h2 className="mt-2 text-xl font-bold text-accent-amber">{t("Quantum Playground")}</h2>
      <p className="mt-4 text-sm leading-relaxed text-stage-muted">{t(failed ? "The scene could not load. Please try again." : "Preparing the scene…")}</p>
      {failed ? <button className="btn-primary mt-5 text-sm" onClick={() => window.location.reload()}>{t("Try again")}</button>
        : <div aria-hidden="true" className="mt-5 h-2 w-48 overflow-hidden rounded bg-stage-surface"><div className="h-full w-full animate-pulse bg-accent-amber/70 motion-reduce:animate-none" /></div>}
    </div>
  </div>;
}
