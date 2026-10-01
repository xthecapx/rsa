"use client";

import { useEffect, useState } from "react";
import { COIN_TOWN_SPAWN, QUANTUM_SOUTH_GATE } from "@/content/coinTown";
import { FOUNDRY_SPAWN } from "@/content/foundry";
import { HOLLOW_SPAWN } from "@/content/hollow";
import { useTown } from "@/game/town";
import { useTravelPass } from "@/game/travelPass";
import { t, useLocale } from "@/i18n";

type Stop = "coinTown" | "foundry" | "hollow" | "town";
const STOPS: { id: Stop; label: string }[] = [
  { id: "coinTown", label: "Coin Town" },
  { id: "foundry", label: "Foundry Town" },
  { id: "hollow", label: "Hollow Town" },
  { id: "town", label: "Quantum Town" },
];

/** Jump to a town's entrance. A reload rebuilds the scene cleanly; saved progress is untouched. */
function travel(to: Stop) {
  const town = useTown.getState();
  if (to === "coinTown") town.patch({ location: "coinTown", coinTown: { ...town.coinTown, position: { ...COIN_TOWN_SPAWN }, facing: "up" } });
  else if (to === "foundry") town.patch({ location: "foundry", foundry: { ...town.foundry, position: { ...FOUNDRY_SPAWN }, facing: "right" } });
  else if (to === "hollow") town.patch({ location: "hollow", hollow: { ...town.hollow, position: { ...HOLLOW_SPAWN }, facing: "left" } });
  else town.patch({ location: "town", position: { ...QUANTUM_SOUTH_GATE }, facing: "up" });
  window.location.reload();
}

/** The travel pass panel: only shown while the temporary pass is on. */
export function TravelPass() {
  useLocale((state) => state.locale);
  const { active, sync, end } = useTravelPass();
  const location = useTown((state) => state.location);
  const [open, setOpen] = useState(false);
  useEffect(() => { sync(); }, [sync]);
  if (!active) return null;
  return <div className="fixed left-1/2 top-16 z-40 -translate-x-1/2 text-xs">
    <div className="panel bg-stage-bg/95 px-3 py-2 shadow-lg">
      <button type="button" className="flex items-center gap-2 text-accent-amber" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">⌛</span><span>{t("Temporary travel pass")}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="mt-2 space-y-2">
        <p className="max-w-xs text-stage-muted">{t("Every built road is open. Jump to any town; progress, cards and medals are not changed. The pass ends when you close this tab.")}</p>
        <div className="flex flex-wrap gap-1">
          {STOPS.map((stop) => <button key={stop.id} type="button" className="btn-ghost text-xs" aria-current={location === stop.id ? "location" : undefined}
            disabled={location === stop.id} onClick={() => travel(stop.id)}>{location === stop.id ? "● " : ""}{t(stop.label)}</button>)}
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={() => { end(); setOpen(false); }}>{t("End the pass")}</button>
      </div>}
    </div>
  </div>;
}
