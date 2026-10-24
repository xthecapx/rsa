/** Shared meaning of activity markers; completion always wins over old evidence. */
export type ExplorationStatus = "new" | "working" | "ready" | "complete";

export const EXPLORATION_STATUS: Record<
  ExplorationStatus,
  { symbol: string; label: string }
> = {
  new: { symbol: "!", label: "New problem" },
  working: { symbol: "…", label: "Investigation in progress" },
  ready: { symbol: "?", label: "Ready to discuss" },
  complete: { symbol: "✓", label: "Completed" },
};
