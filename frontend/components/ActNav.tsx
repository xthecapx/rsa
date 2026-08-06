"use client";

import Link from "next/link";
import clsx from "clsx";
import { ACT_SUBTITLES, ACT_TITLES } from "@/content/levels";
import { useGameStore, type ActNumber } from "@/store/game";

const ACTS: ActNumber[] = [1, 2, 3, 4];

interface ActNavProps {
  /** Vertical list for drawers */
  vertical?: boolean;
  onNavigate?: () => void;
}

export default function ActNav({ vertical = false, onNavigate }: ActNavProps) {
  const act = useGameStore((s) => s.act);
  const tier = useGameStore((s) => s.tier);

  return (
    <nav
      className={clsx(
        vertical ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2",
      )}
    >
      {ACTS.map((n) => {
        const active = act === n;
        return (
          <Link
            key={n}
            href={`/act/${n}?tier=${tier}`}
            onClick={onNavigate}
            className={clsx(
              "rounded-lg border transition",
              vertical ? "px-3 py-3" : "px-3 py-2",
              active
                ? "border-accent-amber bg-accent-amber/15 text-accent-amber shadow-glow"
                : "border-stage-border bg-stage-bg/40 text-stage-muted hover:border-accent-teal hover:text-accent-teal",
            )}
          >
            <div className="font-display font-semibold">
              Act {n} · {ACT_TITLES[n]}
            </div>
            {vertical && (
              <p className="mt-0.5 text-xs text-stage-muted">{ACT_SUBTITLES[n]}</p>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
