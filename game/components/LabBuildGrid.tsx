"use client";
import { LAB_ITEMS } from "@/content/lab";
import {
  footprint,
  LAB_HEIGHT,
  LAB_ENTRY,
  type Placement,
} from "@/game/labLayout";
import { t } from "@/i18n";
import { PuzzleDragDrop, PuzzlePiece, PuzzleSlot } from "./PuzzleDragDrop";
import { LabItemIcon, LabFloorTile } from "./LabArt";
export function LabBuildGrid({
  owned,
  layout,
  width,
  selected,
  setSelected,
  rotated,
  setRotated,
  eligible,
  place,
  commit,
  canUndo,
  onUndo,
}: {
  owned: string[];
  layout: Placement[];
  width: number;
  selected: string | null;
  setSelected: (id: string | null) => void;
  rotated: boolean;
  setRotated: (rotated: boolean) => void;
  eligible: (id: string) => boolean;
  place: (cell: string, id?: string | null) => void;
  commit: (layout: Placement[]) => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  return (
    <div className="lab-build-scroll">
      <PuzzleDragDrop
        labels={Object.fromEntries(LAB_ITEMS.map((i) => [i.id, t(i.title)]))}
        targets={Object.fromEntries(
          Array.from({ length: width * LAB_HEIGHT }, (_, i) => [
            `${i % width},${Math.floor(i / width)}`,
            `${i % width},${Math.floor(i / width)}`,
          ]),
        )}
        onPlace={place}
        renderPreview={(id) => (
          <span className="flex items-center gap-2">
            <LabItemIcon id={id} />
            {t(LAB_ITEMS.find((i) => i.id === id)!.title)}
          </span>
        )}
      >
        <div className="flex flex-wrap gap-2">
          {owned
            .filter(
              (id) =>
                eligible(id) && !LAB_ITEMS.find((i) => i.id === id)!.module,
            )
            .map((id) => (
              <PuzzlePiece
                key={id}
                id={id}
                label={t(LAB_ITEMS.find((i) => i.id === id)!.title)}
                selected={selected === id}
                onSelect={() => {
                  setSelected(id);
                  setRotated(layout.find((p) => p.id === id)?.rotated ?? false);
                }}
              >
                <LabItemIcon id={id} />
                {t(LAB_ITEMS.find((i) => i.id === id)!.title)}
              </PuzzlePiece>
            ))}
        </div>
        <div
          className="lab-floor"
          style={{ gridTemplateColumns: `repeat(${width},44px)` }}
        >
          {Array.from({ length: width * LAB_HEIGHT }, (_, i) => {
            const x = i % width,
              y = Math.floor(i / width),
              p = layout.find((p) =>
                footprint(p).some((c) => c.x === x && c.y === y),
              ),
              item = LAB_ITEMS.find((i) => i.id === p?.id);
            return (
              <PuzzleSlot
                key={i}
                id={`${x},${y}`}
                label={`${t("Floor tile")} ${x + 1}, ${y + 1}${item ? `: ${t(item.title)}` : ""}`}
                className={`lab-cell ${p ? "occupied" : ""}`}
                onSelect={() =>
                  selected
                    ? place(`${x},${y}`)
                    : p && (setSelected(p.id), setRotated(p.rotated))
                }
              >
                <svg
                  className="lab-build-ground"
                  viewBox="0 0 28 28"
                  aria-hidden="true"
                >
                  <LabFloorTile variant={i * 7} />
                </svg>
                {x === LAB_ENTRY.x && y === LAB_ENTRY.y && (
                  <span className="lab-entry-marker" aria-hidden="true">
                    ↧
                  </span>
                )}
                {p && p.x === x && p.y === y && (
                  <span
                    className="lab-build-furniture"
                    style={{
                      width: (p.rotated ? item!.h : item!.w) * 46 - 2,
                      height: (p.rotated ? item!.w : item!.h) * 46 - 2,
                    }}
                  >
                    <LabItemIcon id={p.id} rotated={p.rotated} />
                  </span>
                )}
              </PuzzleSlot>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            disabled={!selected}
            onClick={() => setRotated(!rotated)}
          >
            {t("Rotate furniture")} {rotated ? "90°" : "0°"}
          </button>
          <button
            className="btn-ghost"
            disabled={!selected}
            onClick={() => {
              commit(layout.filter((p) => p.id !== selected));
              setSelected(null);
            }}
          >
            {t("Store item")}
          </button>
          <button className="btn-ghost" disabled={!canUndo} onClick={onUndo}>
            {t("Undo")}
          </button>
        </div>
      </PuzzleDragDrop>
    </div>
  );
}
