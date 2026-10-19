import { CAMPUS_EXHIBITS, CAMPUS_FACING, CAMPUS_SPAWN } from "@/content/campus";
import { useCampus } from "./campus";
import { checkpoint, CHECKPOINT_TOWNS } from "./checkpoints";
import { useTown } from "./town";
import { useKnowledge } from "./knowledge";
import { useProgress } from "./progress";
import { useWallet } from "./wallet";
import { useMedals } from "./medals";
import { useGame } from "./state";
import { invalidateMission } from "./runtime";
import { executionPending } from "@/lib/execution";
import { MEDALS } from "@/content/medals";
import { COIN_TOWN_SPAWN, QUANTUM_SOUTH_GATE } from "@/content/coinTown";
import { FOUNDRY_SPAWN } from "@/content/foundry";
import { HOLLOW_SPAWN } from "@/content/hollow";
import { CIPHER_SPAWN } from "@/content/cipher";

/** Merge a teaching milestone, then return to its town. Never runs a service. */
export function restoreCheckpoint(code: string): boolean {
  const saved = checkpoint(code);
  const game = useGame.getState();
  if (!saved || executionPending() || game.operations > 0 || game.phase === "busy" || game.busyLabel) return false;
  if (saved.location === "campus") {
    invalidateMission();
    if (saved.stage >= 2) {
      useCampus.setState({ completed: [...new Set([...useCampus.getState().completed, ...CAMPUS_EXHIBITS.map(e => e.id)])] });
      useProgress.getState().complete("campus", "orientation");
    }
    if (saved.stage === 3) {
      useProgress.getState().complete("campus", "festival");
      useMedals.getState().award("quantum-explorer");
      useMedals.getState().dismiss();
    }
    useGame.getState().resetRun(1);
    const town = useTown.getState();
    town.patch({ location: "campus", campus: { ...town.campus, position: { ...CAMPUS_SPAWN }, facing: CAMPUS_FACING, welcomed: true },
      labEntrances: { ...town.labEntrances, campus: true }, rsaRunning: false, requestedAct: null, checkpoint: null, interrupted: false, tracked: null });
    return true;
  }
  invalidateMission();
  const completed = { ...useProgress.getState().completed };
  for (const [scenario, missions] of Object.entries(saved.completed)) completed[scenario] = [...new Set([...(completed[scenario] ?? []), ...missions])];
  useProgress.setState({ completed });
  useKnowledge.setState({ cards: [...new Set([...useKnowledge.getState().cards, ...saved.cards])], fresh: null });
  const earned = { ...useMedals.getState().earned };
  for (const medal of MEDALS) if (completed[medal.scenario]?.includes(medal.mission)) earned[medal.id] ??= new Date().toISOString();
  useMedals.setState({ earned, fresh: null });
  const acts = ([1, 2, 3, 4] as const).filter((act) => completed.rsa?.includes(String(act)));
  useWallet.getState().grantFor(acts);
  useGame.getState().resetRun(1);
  useGame.setState({ completedActs: acts });
  const town = useTown.getState();
  for (const previous of CHECKPOINT_TOWNS) {
    if (saved.completed[previous.scenario]) town.patch({ [previous.location]: { ...town[previous.location], welcomed: true } });
  }
  const location = saved.location;
  const spawns = { coinTown: COIN_TOWN_SPAWN, foundry: FOUNDRY_SPAWN, hollow: HOLLOW_SPAWN, cipher: CIPHER_SPAWN };
  const placement = location === "town" ? { welcomed: true, position: { ...QUANTUM_SOUTH_GATE }, facing: "up" as const }
    : { [location]: { ...town[location], position: { ...spawns[location] }, facing: "up", welcomed: true } };
  town.patch({ ...placement, labEntrances: { ...town.labEntrances, [location]: true }, location, rsaRunning: false, requestedAct: null, checkpoint: null, interrupted: false, tracked: null });
  return true;
}
