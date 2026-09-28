"use client";

import clsx from "clsx";
import { ACT_NUMBERS, getAct } from "@/content";
import type { ActNumber } from "@/content/types";
import { useProgress } from "@/game/progress";
import { useGame } from "@/game/state";
import { t, useLocale } from "@/i18n";

/** One shared mission timeline for the street, laptop, client, and results. */
export function RsaProgress({ act, showObjective = false }: { act: ActNumber; showObjective?: boolean }) {
  useLocale((state) => state.locale);
  const completed = useProgress((state) => state.completed.rsa);
  const tasks = useGame((state) => state.tasks);
  const task = tasks.find((item) => item.status === "active");

  return <section aria-label={t("RSA mission progress")} className="w-full min-w-0 space-y-1.5 text-left">
    <ol className="grid grid-cols-4 gap-1 sm:gap-2">
      {ACT_NUMBERS.map((number) => {
        const done = completed?.includes(String(number));
        const current = number === act;
        return <li key={number} aria-current={current ? "step" : undefined}
          className={clsx("flex min-w-0 items-center justify-center gap-1 rounded border px-1 py-1.5 text-[10px] sm:text-xs",
            current ? "border-accent-amber bg-accent-amber/10 text-accent-amber" : done ? "border-stage-border text-accent-teal" : "border-stage-border text-stage-muted")}>
          <span aria-hidden="true" className="text-base leading-none">{done ? "★" : "☆"}</span>
          <span className="min-w-0 truncate">{number}. {t(getAct(number).title)}</span>
          <span className="sr-only"> · {t(done ? "Completed" : "Not completed")}{current ? ` · ${t("Current act")}` : ""}</span>
        </li>;
      })}
    </ol>
    {showObjective && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" role="status">
      <span className="shrink-0 text-accent-amber">RSA · {t("Act")} {act}/{ACT_NUMBERS.length}</span>
      <span className="flex items-center gap-1" aria-label={t("Objectives")}>
        {tasks.map((item) => <span key={item.id} title={`${t(item.label)} · ${t(item.status === "done" ? "Completed" : item.status === "active" ? "Current objective" : "Not completed")}`}>
          <span aria-hidden="true" className={clsx("block h-1.5 w-4 rounded-full", item.status === "done" ? "bg-accent-teal" : item.status === "active" ? "bg-accent-amber" : "bg-stage-border")} />
          <span className="sr-only">{t(item.label)} · {t(item.status === "done" ? "Completed" : item.status === "active" ? "Current objective" : "Not completed")}. </span>
        </span>)}
      </span>
      {task && <span className="min-w-0 text-stage-muted">{t("Now")}: {t(task.label)}</span>}
    </div>}
  </section>;
}
