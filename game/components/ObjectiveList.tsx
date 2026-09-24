"use client";
import { t, localize, useLocale } from "@/i18n";

import clsx from "clsx";

import { useGame } from "@/game/state";
import type { Task } from "@/game/state";

const MARK: Record<Task["status"], string> = {
  pending: "[ ]",
  active: "[>]",
  done: "[x]",
};

const STYLE: Record<Task["status"], string> = {
  pending: "text-stage-muted",
  active: "text-accent-amber",
  done: "text-actor-brayan line-through decoration-1",
};

/** The job sheet: what has been done and what the client is still waiting on. */
export function ObjectiveList() {
  useLocale((state) => state.locale);
  const tasks = useGame((s) => s.tasks);

  return <MissionObjectives tasks={tasks} />;
}

export function MissionObjectives({ tasks }: { tasks: Task[] }) {
  useLocale((s) => s.locale);
  if (!tasks.length) return null;

  return (
    <div className="panel shrink-0">
      <div className="border-b-2 border-stage-border px-3 py-2 text-xs uppercase tracking-widest text-accent-teal">{t("Objectives")}</div>

      <ul className="space-y-1.5 px-3 py-2 text-sm leading-relaxed">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={clsx("flex items-start gap-2", STYLE[task.status])}
          >
            <span aria-hidden className="shrink-0 whitespace-nowrap">
              {localize(MARK[task.status])}
            </span>
            <span className="min-w-0 break-words">{localize(task.label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
