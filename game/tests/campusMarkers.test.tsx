import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampusScreen } from "@/components/CampusScreen";
import type { TownConfig } from "@/components/WorldTownScreen";
import { CAMPUS_FESTIVAL, CAMPUS_NOTEBOOK } from "@/content/campus";
import { campusSession, useCampus } from "@/game/campus";
import { useMedals } from "@/game/medals";
import { useGame } from "@/game/state";
import { useLocale } from "@/i18n";
import { setServiceTransport } from "@/lib/transport";

// Keep the real campus configuration, minimap and conversations; omit the engine.
let config: TownConfig;
vi.mock("@/components/CampusLaptop", () => ({ CampusLaptop: () => null }));
vi.mock("@/components/WorldTownScreen", () => ({
  WorldTownScreen: ({ config: value }: { config: TownConfig }) => {
    config = value;
    return (
      <>
        {value.minimap({
          position: { x: 18, y: 1 },
          facing: "down",
          tracked: null,
          done: value.exploration!.done,
          pending: [],
          explored: [CAMPUS_FESTIVAL.at, CAMPUS_NOTEBOOK.at].map(
            (at) => at.y * 100 + at.x,
          ),
        })}
        <button onClick={() => value.interaction!.interact("festival")}>
          Visit festival
        </button>
        {value.interaction!.layer}
      </>
    );
  },
}));
vi.mock("@/game/audio", () => ({
  gameAudio: { playSfx: vi.fn(), playSynth: vi.fn() },
}));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  useCampus.getState().reset();
  useMedals.getState().reset();
  useGame.getState().resetRun(1);
  useLocale.setState({ locale: "en" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setServiceTransport(null);
});
const viewCampus = () =>
  render(
    <CampusScreen
      onLeave={() => {}}
      onEnterLab={() => false}
      restartOptions={[]}
    />,
  );
function marker(title: string) {
  const node = screen.getByText(title, { selector: "title" }).parentElement!;
  return node.querySelector("text")!.textContent;
}

it("separates the notebook legend and keeps festival visual, accessible and host state consistent across language changes and reload", async () => {
  const request = vi.fn();
  setServiceTransport(request);
  let view = viewCampus();
  expect(marker("Open the Festival · New problem")).toBe("F");
  expect(marker("Campus field notebook")).toBe("▤");
  expect(screen.getByText("F · Festival", { selector: "li" })).toBeTruthy();
  expect(screen.getByText("▤ · Notebook", { selector: "li" })).toBeTruthy();
  act(() => useCampus.getState().event("festival", { type: "begin" }));
  expect(marker("Open the Festival · Investigation in progress")).toBe("…");
  expect(config.exploration!.working).toContain("festival");
  const session = campusSession();
  session.journey.phase = "apply";
  act(() => useCampus.getState().update("festival", session));
  expect(marker("Open the Festival · Ready to discuss")).toBe("?");
  expect(config.exploration!.ready).toContain("festival");
  // Earned completion must override retained evidence and an old discussion phase.
  act(() => useMedals.getState().award("quantum-explorer"));
  expect(marker("Open the Festival · Completed")).toBe("✓");
  expect(
    screen.getByRole("img", { name: /Open the Festival · Completed/ }),
  ).toBeTruthy();
  expect(config.challenge.complete).toBe(true);
  expect(config.exploration!.done).toContain("festival");
  expect(config.exploration!.ready).not.toContain("festival");
  expect(config.exploration!.working).not.toContain("festival");
  fireEvent.click(screen.getByRole("button", { name: "Visit festival" }));
  expect(screen.getByRole("button", { name: "Keep exploring" })).toBeTruthy();
  act(() => useLocale.setState({ locale: "es" }));
  expect(marker("Abrir el festival · Completado")).toBe("✓");
  expect(screen.getByText("▤ · Cuaderno", { selector: "li" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Seguir explorando" }),
  ).toBeTruthy();
  view.unmount();
  await act(async () => {
    await useCampus.persist.rehydrate();
    await useMedals.persist.rehydrate();
  });
  view = viewCampus();
  expect(marker("Abrir el festival · Completado")).toBe("✓");
  fireEvent.click(screen.getByRole("button", { name: "Visit festival" }));
  expect(
    screen.getByRole("button", { name: "Seguir explorando" }),
  ).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
  view.unmount();
});
