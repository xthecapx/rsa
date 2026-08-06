"use client";

import clsx from "clsx";
import { useGameStore, type Tier } from "@/store/game";

const TIERS: { t: Tier; label: string; blurb: string }[] = [
  { t: 1, label: "Story", blurb: "Black boxes only" },
  { t: 2, label: "Math", blurb: "Equations with numbers" },
  { t: 3, label: "Deep", blurb: "Threat model & theory" },
];

interface TierToggleProps {
  vertical?: boolean;
}

export default function TierToggle({ vertical = false }: TierToggleProps) {
  const tier = useGameStore((s) => s.tier);
  const setTier = useGameStore((s) => s.setTier);

  if (vertical) {
    return (
      <div className="flex flex-col gap-2">
        {TIERS.map(({ t, label, blurb }) => (
          <button
            key={t}
            type="button"
            onClick={() => setTier(t)}
            className={clsx(
              "rounded-lg border px-3 py-3 text-left transition",
              tier === t
                ? "border-accent-amber bg-accent-amber/15 text-accent-amber"
                : "border-stage-border text-stage-muted hover:border-accent-teal hover:text-accent-teal",
            )}
          >
            <div className="font-display text-sm font-semibold">
              {t} · {label}
            </div>
            <p className="mt-0.5 text-xs opacity-70">{blurb}</p>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-stage-border bg-stage-surface/60 p-1">
      <span className="px-2 text-[10px] uppercase tracking-wider text-stage-muted">
        Math
      </span>
      {TIERS.map(({ t, label }) => (
        <button
          key={t}
          type="button"
          onClick={() => setTier(t)}
          className={clsx(
            "rounded-md px-2 py-1 font-display text-xs font-semibold transition sm:text-sm",
            tier === t
              ? "bg-accent-amber text-stage-bg"
              : "text-stage-muted hover:text-accent-teal",
          )}
          title={label}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
