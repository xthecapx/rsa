import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorldMinimap } from "@/components/WorldMinimap";
import { TownMinimap } from "@/components/TownMinimap";
import { LAB_ENTRANCES } from "@/content/labEntrances";
import { coinTownMap } from "@/engine/maps/coinTownMap";
import { useTown } from "@/game/town";
import { useLocale } from "@/i18n";
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("ordinary exploration never reveals an entrance; explicit discovery displays its marker beyond fog", () => {
  useLocale.setState({ locale: "en" });
  const door = LAB_ENTRANCES.coinTown;
  const props = {
    map: coinTownMap,
    places: [],
    roads: [],
    ariaLabel: "Town minimap",
    legend: [],
    position: door.stand,
    facing: door.facing,
    done: [],
    pending: [],
    tracked: null,
    labTown: "coinTown" as const,
    explored: [door.at.y * 100 + door.at.x],
  };
  const view = render(<WorldMinimap {...props} labRevealed={false} />);
  expect(screen.queryByText("Personal quantum lab")).toBeNull();
  view.rerender(<WorldMinimap {...props} explored={[]} labRevealed />);
  expect(screen.getByText("Personal quantum lab")).toBeTruthy();
});
it("Quantum Town uses explicit entrance discovery, independently of nearby target visits and fog", () => {
  useTown.getState().reset();
  useTown.setState({
    discovered: ["labDoor"],
    explored: [LAB_ENTRANCES.town.at.y * 64 + LAB_ENTRANCES.town.at.x],
  });
  const view = render(<TownMinimap />);
  expect(screen.queryByText(/Personal quantum lab/)).toBeNull();
  useTown.setState({ labEntrances: { town: true } });
  view.rerender(<TownMinimap />);
  expect(screen.getByText("Personal quantum lab · Visited")).toBeTruthy();
});
