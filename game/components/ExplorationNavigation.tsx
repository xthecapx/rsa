"use client";

import { useEffect, useId, useState } from "react";
import { bus, type EngineEvent } from "@/engine/bus";
import { focusExploration } from "@/engine/explorationKeyboard";
import { executionPending, useExecution } from "@/lib/execution";
import { t, useLocale } from "@/i18n";

export interface WalkingDestination {
  id: string;
  label: string;
  at: { x: number; y: number };
  locked?: boolean;
  exit?: boolean;
}

export function ExplorationNavigation({
  destinations,
}: {
  destinations: WalkingDestination[];
}) {
  useLocale((state) => state.locale);
  const busy = useExecution(
    (state) => state.active.length > 0 || !!state.background,
  );
  const selectId = useId();
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<Extract<
    EngineEvent,
    { type: "navigation" }
  > | null>(null);
  useEffect(
    () =>
      bus.on((event) => {
        if (event.type === "navigation") setStatus(event);
      }),
    [],
  );
  const destination =
    destinations.find((item) => item.id === selected) ?? destinations[0];
  const disabled =
    !destination || destination.locked || (destination.exit && busy);
  return (
    <div className="exploration-navigation mt-2 border-t border-stage-border pt-2 text-xs">
      <button
        type="button"
        className="btn-ghost w-full text-xs"
        onClick={focusExploration}
      >
        {t("Return to exploration")}
      </button>
      <details className="mt-1">
        <summary className="cursor-pointer py-2 text-accent-teal">
          {t("Walk to a destination")}
        </summary>
        <label htmlFor={selectId} className="block py-1">
          {t("Destination")}
        </label>
        <select
          id={selectId}
          className="w-full min-w-0 rounded border border-stage-border bg-stage-bg p-2"
          value={destination?.id ?? ""}
          onChange={(event) => setSelected(event.target.value)}
        >
          {destinations.map((item) => (
            <option
              key={item.id}
              value={item.id}
              disabled={item.locked || (item.exit && busy)}
            >
              {t(item.label)}
              {item.locked
                ? ` · ${t("Locked")}`
                : item.exit && busy
                  ? ` · ${t("Finishing the current operation…")}`
                  : ""}
            </option>
          ))}
        </select>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className="btn-ghost text-xs"
            disabled={disabled}
            onClick={() => {
              if (
                !destination ||
                destination.locked ||
                (destination.exit && executionPending())
              )
                return;
              focusExploration();
              void bus.send({
                type: "navigate",
                at: destination.at,
                label: destination.label,
              });
            }}
          >
            {t("Walk")}
          </button>
          <button
            className="btn-ghost text-xs"
            disabled={status?.state !== "walking"}
            onClick={() => {
              void bus.send({ type: "stopNavigation" });
              focusExploration();
            }}
          >
            {t("Stop walking")}
          </button>
        </div>
        <p className="mt-2 text-stage-muted">
          {t(
            "Walking follows the paths. Use Space or Talk on arrival. WASD or arrows cancel the route. Roads leave town.",
          )}
        </p>
      </details>
      <p
        className="mt-1 text-stage-muted"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status &&
          `${t({ walking: "Walking to", arrived: "Arrived at", stopped: "Walking stopped", unreachable: "No open path to" }[status.state])}: ${t(status.label)}`}
      </p>
    </div>
  );
}
