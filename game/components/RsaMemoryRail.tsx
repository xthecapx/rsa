"use client";

import type { ReactNode } from "react";
import type { ActNumber } from "@/content/types";
import { useGame } from "@/game/state";
import { rsaNotesForAct } from "@/game/rsaNotes";
import { t, localize, useLocale } from "@/i18n";

export function RsaMemoryRail({ act }: { act: ActNumber }) {
  useLocale((state) => state.locale);
  const state = useGame();
  const capture = state.act === act ? state.capture : null;
  const recovered = state.act === act ? state.vars.recovered : null;
  const notes = rsaNotesForAct(act, state);
  return (
    <div className="grid shrink-0 gap-2 sm:grid-cols-3">
      <MemorySlot label={t("Wire")} empty={t("No capture")}>
        {capture ? (
          <>
            <p className="text-xs text-stage-muted">
              {localize(capture.scheme)}
            </p>
            <p className="break-all font-mono text-sm text-accent-amber">
              {capture.payload}
            </p>
          </>
        ) : null}
      </MemorySlot>
      <MemorySlot label={t("Notes")} empty={t("Run a tool")}>
        {notes.length ? (
          <dl className="space-y-1 text-xs leading-relaxed text-[#9fc4d0]">
            {notes.map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-wrap items-baseline justify-between gap-x-2"
              >
                <dt>{t(label)}</dt>
                <dd className="break-words font-mono">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </MemorySlot>
      <MemorySlot label={t("Plaintext")} empty={t("Not recovered")}>
        {typeof recovered === "string" && recovered ? (
          <p className="break-all font-mono text-sm text-actor-brayan">
            {recovered}
          </p>
        ) : null}
      </MemorySlot>
    </div>
  );
}

function MemorySlot({
  label,
  empty,
  children,
}: {
  label: string;
  empty: string;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="min-w-0 border border-[#1e4450] bg-black/25 px-2 py-1.5"
    >
      <p className="mb-1 text-xs uppercase tracking-widest text-accent-teal">
        {label}
      </p>
      {children ?? <p className="text-xs text-stage-muted">{empty}</p>}
    </section>
  );
}
