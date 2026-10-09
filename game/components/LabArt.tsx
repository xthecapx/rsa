"use client";

import { LAB_ITEMS } from "@/content/lab";
import { LAB_ENTRY, LAB_HEIGHT, type Placement } from "@/game/labLayout";

// Original Kenney CC0 sheets, 16px tiles with 1px gutters. Keep crop metadata
// separate from footprints: art updates must never change collisions or saves.
const SHEETS = {
  indoors: { href: "/assets/kenney/lab/indoors.png", width: 458, height: 305 },
  caves: { href: "/assets/kenney/lab/caves.png", width: 492, height: 305 },
};

function Tile({
  sheet = "indoors",
  col,
  row,
  x = 0,
  y = 0,
  width = 28,
  height = 28,
}: {
  sheet?: keyof typeof SHEETS;
  col: number;
  row: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const source = SHEETS[sheet];
  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox={`${col * 17} ${row * 17} 16 16`}
      preserveAspectRatio="none"
      overflow="hidden"
    >
      <image href={source.href} width={source.width} height={source.height} />
    </svg>
  );
}

export function LabFloorTile({
  x = 0,
  y = 0,
  variant = 0,
}: {
  x?: number;
  y?: number;
  variant?: number;
}) {
  return (
    <Tile sheet="caves" col={17 + (variant % 3)} row={10} x={x} y={y} />
  );
}

function ItemDrawing({ id }: { id: string }) {
  switch (id) {
    case "desk":
      return (
        <>
          <Tile col={0} row={1} />
          <Tile col={2} row={1} x={28} />
        </>
      );
    case "laptop":
      return (
        <>
          <Tile col={4} row={4} />
          <image
            href="/assets/characters/prop-crt.svg"
            x={2}
            y={-6}
            width={24}
            height={24}
          />
          <path d="M7 19h14v4H7z" fill="#a2aeac" />
          <path
            d="M8 20h2m1 0h2m1 0h2m1 0h2m-9 2h7"
            stroke="#4b6469"
            strokeWidth="1"
          />
        </>
      );
    case "lamp":
      return <Tile col={19} row={5} />;
    case "storage":
      return <Tile sheet="caves" col={6} row={6} />;
    case "stool":
      return <Tile col={17} row={3} />;
    case "plant":
      return (
        <>
          <Tile col={16} row={0} />
          <Tile
            sheet="caves"
            col={1}
            row={3}
            x={16}
            y={17}
            width={10}
            height={10}
          />
        </>
      );
    case "bloch":
      return (
        <>
          <Tile col={22} row={10} x={2} y={8} width={24} height={24} />
          <circle
            cx={14}
            cy={9}
            r={9}
            fill="#174f56"
            stroke="#79d8cf"
            strokeWidth="1"
          />
          <ellipse
            cx={14}
            cy={9}
            rx={9}
            ry={3}
            fill="none"
            stroke="#79d8cf"
            strokeWidth=".8"
          />
          <ellipse
            cx={14}
            cy={9}
            rx={3}
            ry={9}
            fill="none"
            stroke="#79d8cf"
            strokeWidth=".8"
          />
          <path d="M14 9 19 3" stroke="#ffe2a3" strokeWidth="1.5" />
          <circle cx={19} cy={3} r={1.5} fill="#ffe2a3" />
        </>
      );
    case "register":
      return (
        <image href="/assets/characters/prop-rack.svg" width={28} height={28} />
      );
    default:
      return (
        <>
          <Tile sheet="caves" col={22} row={17} />
          <rect x={6} y={7} width={16} height={12} fill="#173940" />
          <text
            x={14}
            y={16}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize={9}
            fontWeight="bold"
            fill="#9fe2cf"
          >
            {LAB_ITEMS.find((item) => item.id === id)?.glyph}
          </text>
        </>
      );
  }
}

/** Actual room art, shared by the inventory and the build-grid preview. */
export function LabFurniture({
  id,
  x = 0,
  y = 0,
  rotated = false,
}: {
  id: string;
  x?: number;
  y?: number;
  rotated?: boolean;
}) {
  const item = LAB_ITEMS.find((item) => item.id === id)!;
  return (
    <g
      transform={
        rotated
          ? `translate(${x + item.h * 28} ${y}) rotate(90)`
          : `translate(${x} ${y})`
      }
    >
      <ItemDrawing id={id} />
    </g>
  );
}

export function LabItemIcon({
  id,
  rotated = false,
  className = "",
}: {
  id: string;
  rotated?: boolean;
  className?: string;
}) {
  const item = LAB_ITEMS.find((item) => item.id === id)!;
  const w = (rotated ? item.h : item.w) * 28,
    h = (rotated ? item.w : item.h) * 28;
  return (
    <svg
      aria-hidden="true"
      className={`lab-item-icon ${className}`}
      viewBox={`-3 -7 ${w + 6} ${h + 12}`}
      shapeRendering="crispEdges"
    >
      <LabFurniture id={id} rotated={rotated} />
    </svg>
  );
}

export function LabRoomArt({
  layout,
  width,
}: {
  layout: Placement[];
  width: number;
}) {
  const w = width * 28,
    h = LAB_HEIGHT * 28;
  return (
    <g className="lab-room-art" aria-hidden="true">
      <rect x={-16} y={-16} width={w + 32} height={h + 32} fill="#34484b" />
      {Array.from({ length: width * LAB_HEIGHT }, (_, i) => (
        <LabFloorTile
          key={i}
          x={(i % width) * 28}
          y={Math.floor(i / width) * 28}
          variant={i * 7}
        />
      ))}
      <rect width={w} height={h} fill="#17343a" opacity={0.18} />
      {Array.from({ length: width }, (_, x) => (
        <g key={x}>
          <Tile
            sheet="caves"
            col={9}
            row={0}
            x={x * 28}
            y={-16}
            width={28}
            height={16}
          />
          <Tile
            sheet="caves"
            col={9}
            row={2}
            x={x * 28}
            y={h}
            width={28}
            height={16}
          />
        </g>
      ))}
      {Array.from({ length: LAB_HEIGHT }, (_, y) => (
        <g key={y}>
          <Tile
            sheet="caves"
            col={8}
            row={1}
            x={-16}
            y={y * 28}
            width={16}
            height={28}
          />
          <Tile
            sheet="caves"
            col={11}
            row={1}
            x={w}
            y={y * 28}
            width={16}
            height={28}
          />
        </g>
      ))}
      {[
        [8, 0, -16, -16],
        [11, 0, w, -16],
        [8, 2, -16, h],
        [11, 2, w, h],
      ].map(([col, row, x, y]) => (
        <Tile
          key={`${x},${y}`}
          sheet="caves"
          col={col}
          row={row}
          x={x}
          y={y}
          width={16}
          height={16}
        />
      ))}
      <path
        d={`M0 0h${w} M0 0v${h} M${w} 0v${h}`}
        fill="none"
        stroke="#142f36"
        strokeWidth={4}
        opacity={0.35}
      />
      <Tile
        sheet="caves"
        col={14}
        row={13}
        x={-14}
        y={56}
        width={20}
        height={28}
      />
      <Tile
        sheet="caves"
        col={14}
        row={12}
        x={w - 5}
        y={h - 56}
        width={20}
        height={28}
      />
      <Tile
        col={11}
        row={4}
        x={LAB_ENTRY.x * 28}
        y={h - 6}
        width={28}
        height={16}
      />
      {layout
        .filter((p) => p.id === "lamp")
        .map((p) => (
          <g key={p.id}>
            <ellipse
              cx={p.x * 28 + 14}
              cy={p.y * 28 + 16}
              rx={36}
              ry={25}
              fill="#ffd392"
              opacity={0.09}
            />
            <ellipse
              cx={p.x * 28 + 14}
              cy={p.y * 28 + 16}
              rx={23}
              ry={16}
              fill="#ffd392"
              opacity={0.1}
            />
          </g>
        ))}
      {layout.map((p) => {
        const item = LAB_ITEMS.find((item) => item.id === p.id)!;
        const pw = (p.rotated ? item.h : item.w) * 28,
          ph = (p.rotated ? item.w : item.h) * 28;
        return (
          <g key={p.id}>
            <ellipse
              cx={p.x * 28 + pw / 2}
              cy={p.y * 28 + ph - 3}
              rx={pw / 2 - 2}
              ry={4}
              fill="#152b30"
              opacity={0.3}
            />
            <LabFurniture {...p} x={p.x * 28} y={p.y * 28} />
          </g>
        );
      })}
    </g>
  );
}
