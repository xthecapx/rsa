"use client";
import { useEffect, useMemo, useState } from "react";
import { LAB_ENTRANCES, type LabTown } from "@/content/labEntrances";
import { LAB_ITEMS, itemAvailable, labTier } from "@/content/lab";
import { useLab } from "@/game/lab";
import { useMedals } from "@/game/medals";
import {
  defaultLayout,
  validLayout,
  footprint,
  labWidth,
  LAB_HEIGHT,
  LAB_ENTRY,
  type Placement,
} from "@/game/labLayout";
import { createRoom } from "@/game/room";
import { storageUnavailable } from "@/game/storage";
import { t, useLocale } from "@/i18n";
import { BackendLabel } from "./BackendLabel";
import { SimulatorPicker } from "./SimulatorPicker";
import { LanguageSwitch } from "./LanguageSwitch";
import { MuteButton } from "./MuteButton";
import { StartOverControl } from "./StartOverControl";
import { HouseRoom } from "./HouseRoom";
import { LabBuildGrid } from "./LabBuildGrid";
import { LabSupplies } from "./LabSupplies";
import { LabTransfer } from "./LabTransfer";
import { LabLaptop } from "./LabLaptop";
import { useExecution } from "@/lib/execution";
import { LabRoomArt } from "./LabArt";

export function LabScreen({
  onExit,
  returnTown,
  onRestartGame,
}: {
  onExit: () => void;
  returnTown: LabTown;
  onRestartGame: () => void;
}) {
  useLocale((s) => s.locale);
  const background = useExecution((s) => !!s.background);
  const lab = useLab(),
    earned = useMedals((s) => s.earned),
    tier = labTier(earned),
    width = labWidth(tier);
  const [building, setBuilding] = useState(false),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [overlay, setOverlay] = useState(false);
  const [selected, setSelected] = useState<string | null>(null),
    [rotated, setRotated] = useState(false),
    [near, setNear] = useState<string | null>(null);
  const [message, setMessage] = useState(""),
    [history, setHistory] = useState<Placement[][]>([]),
    [transfer, setTransfer] = useState(false),
    [input, setInput] = useState("");
  const [suppliesOpen, setSuppliesOpen] = useState(true),
    [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px), (max-height: 550px)");
    setCompact(media.matches);
    if (media.matches) setSuppliesOpen(false);
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const eligible = (id: string) => {
    const item = LAB_ITEMS.find((i) => i.id === id);
    return !!item && itemAvailable(item, earned);
  };
  const layout = useMemo(() => {
    const filtered = lab.layout.filter((p) => {
      const item = LAB_ITEMS.find((i) => i.id === p.id);
      return (
        !!item &&
        itemAvailable(item, earned) &&
        footprint(p).every((c) => c.x < width)
      );
    });
    return validLayout(filtered, tier) ? filtered : defaultLayout();
  }, [lab.layout, earned, tier, width]);
  const scene = useMemo(() => {
    const occupied = new Set(
      layout.flatMap(footprint).map((c) => `${c.x},${c.y}`),
    );
    const stations: Record<string, { x: number; y: number }> = {};
    for (const p of layout) {
      const cells = footprint(p);
      const goal = cells
        .flatMap((c) =>
          [
            [0, 1],
            [1, 0],
            [-1, 0],
            [0, -1],
          ].map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })),
        )
        .find(
          (c) =>
            c.x >= 0 &&
            c.y >= 0 &&
            c.x < width &&
            c.y < LAB_HEIGHT &&
            !occupied.has(`${c.x},${c.y}`),
        );
      if (goal)
        stations[p.id] = { x: (goal.x + 0.5) * 28, y: (goal.y + 0.5) * 28 };
    }
    return createRoom({
      start: { x: (LAB_ENTRY.x + 0.5) * 28, y: (LAB_ENTRY.y + 0.5) * 28 },
      stations,
      blocks: layout.map((p) => {
        const cells = footprint(p);
        return [
          p.x * 28,
          p.y * 28,
          (Math.max(...cells.map((c) => c.x)) + 1) * 28,
          (Math.max(...cells.map((c) => c.y)) + 1) * 28,
        ] as const;
      }),
      floor: [14, 14, width * 28 - 14, LAB_HEIGHT * 28 - 14],
    });
  }, [layout, width]);
  function commit(next: Placement[]) {
    const hidden = lab.layout.filter(
      (p) =>
        !layout.some((active) => active.id === p.id) &&
        !next.some((active) => active.id === p.id),
    );
    const merged = [...next, ...hidden];
    if (busy || !validLayout(next, tier) || !validLayout(merged)) {
      setMessage(
        t(
          "Keep the entrance and every item reachable. Objects cannot overlap.",
        ),
      );
      return;
    }
    setHistory((h) => [...h.slice(-19), lab.layout]);
    useLab.setState({ layout: merged });
    setMessage("");
  }
  function place(cell: string, id = selected) {
    if (!id || busy || !eligible(id) || !lab.owned.includes(id)) return;
    const [x, y] = cell.split(",").map(Number);
    commit([...layout.filter((p) => p.id !== id), { id, x, y, rotated }]);
    setSelected(null);
  }
  function interact(id: string) {
    if (busy) return;
    if (id === "laptop" || id === "bloch") setOpen(true);
    else if (id === "storage") setBuilding(true);
    else setMessage(t("Use Build mode to arrange this item."));
  }
  const controls = (
    <>
      <StartOverControl
        disabled={busy}
        onOpenChange={setOverlay}
        options={[
          {
            label: "Reset lab layout",
            description:
              "Arrange the starter furniture again. Keep equipment, recipes and medals.",
            restart: () => {
              useLab.setState({ layout: defaultLayout() });
              setHistory([]);
            },
          },
          {
            label: "Start the whole game over",
            description:
              "Clear every lesson, your medal case, town progress, and your personal lab. Return to Mayor Cap’s welcome in Coin Town.",
            restart: onRestartGame,
          },
        ]}
      />
    </>
  );
  return (
    <main className="lab-screen viewport-overlay font-body flex flex-col overflow-hidden bg-stage-bg text-stage-text">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-stage-border p-3">
        <div>
          <h1 className="text-accent-amber">{t("Personal quantum lab")}</h1>
          <BackendLabel selected />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <LanguageSwitch />
          <MuteButton />
          <button className="btn-ghost" disabled={busy} onClick={onExit}>
            {t(`Return to ${t(LAB_ENTRANCES[returnTown].title)}`)}
          </button>
        </div>
      </header>
      <SimulatorPicker disabled={busy} lab />
      <div className="lab-toolbar shrink-0 flex flex-wrap gap-2 p-3">
        <button
          className="btn-ghost"
          disabled={busy}
          aria-expanded={suppliesOpen}
          onClick={() => setSuppliesOpen(!suppliesOpen)}
        >
          {t("Equipment supplies")}
        </button>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() => setBuilding(!building)}
        >
          {t(building ? "Explore cave" : "Build mode")}
        </button>
        <button
          className="btn-primary"
          disabled={busy || !layout.some((p) => p.id === "laptop")}
          onClick={() => setOpen(true)}
        >
          {t("Open quantum laptop")}
        </button>
        <button
          className="btn-ghost"
          disabled={busy}
          onClick={() => setTransfer(!transfer)}
        >
          {t("Export / import lab")}
        </button>
        <span className="self-center text-xs text-stage-muted">
          {t("Cave space")}: {width} × {LAB_HEIGHT} · {t("Free building")}
        </span>
      </div>
      {storageUnavailable && (
        <p role="status" className="px-3 text-accent-amber">
          {t(
            "Browser storage is unavailable. Export your lab before restarting.",
          )}
        </p>
      )}
      <div
        className={`lab-base-grid min-h-0 flex-1 p-3 ${suppliesOpen ? "with-supplies" : ""}`}
      >
        <section className="lab-scene-panel panel min-w-0 min-h-0 p-3">
          <div className="lab-scene-heading">
            <h2 className="text-accent-teal">
              {t(building ? "Arrange your cave" : "Your cave")}
            </h2>
            <p className="text-xs text-stage-muted">
              {t(
                building
                  ? "Select an item, then choose a floor tile. The doorway stays clear."
                  : "Walk to equipment or tap it. Space interacts; the southern doorway returns to town.",
              )}
            </p>
          </div>
          {building ? (
            <LabBuildGrid
              owned={lab.owned}
              layout={layout}
              width={width}
              selected={selected}
              setSelected={setSelected}
              rotated={rotated}
              setRotated={setRotated}
              eligible={eligible}
              place={place}
              commit={commit}
              canUndo={!!history.length}
              onUndo={() => {
                useLab.setState({ layout: history.at(-1)! });
                setHistory(history.slice(0, -1));
              }}
            />
          ) : (
            <HouseRoom
              key={JSON.stringify(layout)}
              followPlayer
              viewBox={`-16 -16 ${width * 28 + 32} 272`}
              room={scene}
              labels={Object.fromEntries(
                layout.map((p) => [
                  p.id,
                  t(LAB_ITEMS.find((i) => i.id === p.id)!.title),
                ]),
              )}
              regionLabel={t("Your cave")}
              mapLabel={t("Cave lab floor")}
              initialPlace={null}
              target={near}
              disabled={overlay || transfer}
              movementLocked={
                ((open || busy) && !background) || (compact && suppliesOpen)
              }
              onWalking={() => {}}
              onNear={setNear}
              onInteract={interact}
              onExit={() => {
                if (!busy && !open) onExit();
              }}
              tapTargets={layout.map((p) => ({
                box: [
                  p.x * 28,
                  p.y * 28,
                  (p.x +
                    (p.rotated
                      ? LAB_ITEMS.find((i) => i.id === p.id)!.h
                      : LAB_ITEMS.find((i) => i.id === p.id)!.w)) *
                    28,
                  (p.y +
                    (p.rotated
                      ? LAB_ITEMS.find((i) => i.id === p.id)!.w
                      : LAB_ITEMS.find((i) => i.id === p.id)!.h)) *
                    28,
                ],
                goal: scene.stations[p.id],
              }))}
            >
              <LabRoomArt layout={layout} width={width} />
            </HouseRoom>
          )}
          {!building && (
            <div className="lab-scene-actions">
              {near ? (
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => interact(near)}
                >
                  {t("Use equipment")}:{" "}
                  {t(LAB_ITEMS.find((i) => i.id === near)?.title ?? "")}
                </button>
              ) : (
                <span className="text-xs text-stage-muted">
                  {t(
                    "Tap the floor to walk. Use the minimap to reach distant equipment.",
                  )}
                </span>
              )}
            </div>
          )}
          {message && (
            <p role="status" className="text-accent-amber text-sm">
              {message}
            </p>
          )}
        </section>
        {suppliesOpen && (
          <LabSupplies
            earned={earned}
            busy={busy}
            onClose={() => setSuppliesOpen(false)}
          />
        )}
        {transfer && (
          <LabTransfer
            busy={busy}
            input={input}
            setInput={setInput}
            setMessage={setMessage}
            onClose={() => setTransfer(false)}
            onImported={() => setHistory([])}
          />
        )}
      </div>
      <LabLaptop
        open={open}
        onClose={() => setOpen(false)}
        onBusyChange={setBusy}
        controls={controls}
      />
    </main>
  );
}
