import { bus, type EngineEvent } from "./bus";
import type { GridPos } from "./maps/street";

type Walker = {
  grid: GridPos;
  isMoving: boolean;
  clearRoute: () => void;
  follow: (route: GridPos[]) => Promise<void>;
};
/** Share click-to-walk paths, and never announce a cancelled route as an arrival. */
export class DestinationNavigation {
  private generation = 0;
  private label: string | null = null;
  constructor(
    private report: (event: EngineEvent) => void = (event) => bus.emit(event),
  ) {}
  cancel() {
    this.generation++;
    if (this.label)
      this.report({ type: "navigation", state: "stopped", label: this.label });
    this.label = null;
  }
  async walk(
    player: Walker,
    goal: GridPos | null,
    label: string,
    path: (to: GridPos) => GridPos[] | null,
  ) {
    this.cancel();
    player.clearRoute();
    const route = goal ? path(goal) : null;
    if (!route) {
      this.report({ type: "navigation", state: "unreachable", label });
      return;
    }
    const generation = this.generation;
    this.label = label;
    this.report({ type: "navigation", state: "walking", label });
    await player.follow(route);
    if (generation !== this.generation) return;
    const arrived =
      goal &&
      player.grid.x === goal.x &&
      player.grid.y === goal.y &&
      !player.isMoving;
    this.report({
      type: "navigation",
      state: arrived ? "arrived" : "stopped",
      label,
    });
    this.label = null;
  }
}
