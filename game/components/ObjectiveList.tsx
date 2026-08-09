"use client";

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
  const tasks = useGame((s) => s.tasks);

  if (!tasks.length) return null;

  return (
    <div className="panel shrink-0">
      <div className="border-b-2 border-stage-border px-3 py-2 text-[10px] uppercase tracking-widest text-accent-teal">
        Job sheet
      </div>

      <ul className="space-y-1.5 px-3 py-2 font-mono text-[11px] leading-relaxed">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={clsx("flex items-start gap-2", STYLE[task.status])}
          >
            <span aria-hidden className="shrink-0 whitespace-nowrap">
              {MARK[task.status]}
            </span>
            <span className="min-w-0 break-words">{task.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
