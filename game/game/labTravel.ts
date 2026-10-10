import {
  LAB_ENTRANCES,
  LAB_REVEAL,
  type LabTown,
} from "@/content/labEntrances";
import { useTown } from "./town";
import { useLab } from "./lab";
import { useGame } from "./state";

export function labTravelBusy(): boolean {
  const state = useGame.getState();
  return state.operations > 0 || state.phase === "busy" || !!state.busyLabel;
}
/** Discovery is independent of entry and never changes inventory or executes work. */
export function discoverLab(where: LabTown): boolean {
  const town = useTown.getState();
  if (town.labEntrances[where]) return false;
  town.patch({ labEntrances: { ...town.labEntrances, [where]: true } });
  return true;
}
/** Call only after the two persisted stores have hydrated. */
export function migrateLabEntrance(): void {
  if (useLab.getState().discovered) discoverLab("coinTown");
}
export function enterLab(where: LabTown, pause: () => boolean): boolean {
  if (labTravelBusy() || !pause()) return false;
  const town = useTown.getState();
  town.patch({
    location: "lab",
    labFrom: where,
    labEntrances: { ...town.labEntrances, [where]: true },
  });
  return true;
}
export function leaveLab(): boolean {
  if (labTravelBusy()) return false;
  const town = useTown.getState(),
    where = town.labFrom,
    door = LAB_ENTRANCES[where];
  const placement =
    where === "town"
      ? { position: { ...door.stand }, facing: door.facing }
      : {
          [where]: {
            ...town[where],
            position: { ...door.stand },
            facing: door.facing,
          },
        };
  town.patch({ ...placement, location: where });
  return true;
}
/** Shared reveal dialogue for both outdoor scene owners. */
export function inspectLab(
  where: LabTown,
  enter: () => void,
  close: () => void,
) {
  if (labTravelBusy()) return null;
  if (!discoverLab(where)) {
    enter();
    return null;
  }
  return {
    title: "Personal quantum lab",
    text: LAB_REVEAL,
    speaker: "system" as const,
    choices: [
      { label: "Enter the lab", action: enter },
      { label: "Keep exploring", action: close },
    ],
  };
}
