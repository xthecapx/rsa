import { medalFor, type MedalId } from "@/content/medals";
import { SCENARIOS } from "@/content/scenarios";
import { useGame } from "./state";
import { useMedals } from "./medals";
import { useProgress } from "./progress";
import { useTown } from "./town";

export const QWARD_DISCOVERY = "Congratulations! You found the qWard. You’re ready to begin your quantum journey. This little companion will follow you as you explore. There’s always another experiment to try.";

/** Optional cards and campus activities never gate the final companion. */
export function canFindQward(completed: Record<string, string[]>, earned: Partial<Record<MedalId, string>>): boolean {
  return SCENARIOS.every(({ id, missions }) => missions.every((mission) => {
    const medal = medalFor(id, mission);
    return completed[id]?.includes(mission) || !!(medal && earned[medal.id]);
  }));
}

/** Only Professor Thecap's explicit invitation claims the reward. */
export function findQward(): boolean {
  const game = useGame.getState();
  const town = useTown.getState();
  if (town.location !== "town" || game.operations > 0 || game.phase === "busy" || game.busyLabel
    || !canFindQward(useProgress.getState().completed, useMedals.getState().earned)) return false;
  town.patch({ qwardFound: true, welcomed: true, tracked: null });
  return true;
}
