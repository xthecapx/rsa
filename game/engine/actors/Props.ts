import {
  Actor,
  Circle,
  Color,
  EasingFunctions,
  Font,
  FontUnit,
  GraphicsGroup,
  Rectangle,
  Text,
  Vector,
  vec,
} from "excalibur";

import { citySprite } from "../resources";
import { Props as PropTiles, TILE_SIZE } from "../tiles";
import type { BubbleKind, PacketStyle } from "../bus";
import type { CarFacing, CarPaint, ParkedCarSpec } from "../maps/street";
import { tileCenter } from "../maps/street";

const PACKET_COLORS: Record<PacketStyle, Color> = {
  plain: Color.fromHex("#f5a623"),
  caesar: Color.fromHex("#2dd4bf"),
  rsa: Color.fromHex("#38bdf8"),
  key: Color.fromHex("#a3e635"),
  quantum: Color.fromHex("#c084fc"),
};

/** The little payload that travels the wire between the two buildings. */
export class Packet extends Actor {
  constructor() {
    super({ name: "packet", pos: vec(-100, -100), z: 40 });
  }

  show(style: PacketStyle, at: Vector): void {
    const color = PACKET_COLORS[style];
    const halo = color.clone();
    halo.a = 0.28;
    this.graphics.use(
      new GraphicsGroup({
        members: [
          { graphic: new Circle({ radius: 7, color: halo }), offset: vec(0, 0) },
          { graphic: new Circle({ radius: 3, color }), offset: vec(4, 4) },
        ],
      }),
    );
    this.pos = at.clone();
    this.graphics.visible = true;
  }

  hide(): void {
    this.graphics.visible = false;
    this.actions.clearActions();
  }

  travelTo(target: Vector, durationMs: number): Promise<void> {
    this.actions.easeTo(target, durationMs, EasingFunctions.EaseInOutQuad);
    return this.actions.toPromise().then(() => undefined);
  }
}

const BUBBLE_TEXT: Record<Exclude<BubbleKind, "none">, string> = {
  question: "?",
  alert: "!",
  success: "*",
};

const BUBBLE_COLOR: Record<Exclude<BubbleKind, "none">, string> = {
  question: "#f5a623",
  alert: "#fb7185",
  success: "#a3e635",
};

/** Pokemon-style "?" / "!" thought bubble pinned above a character. */
export class Bubble extends Actor {
  constructor() {
    super({ name: "bubble", pos: vec(-100, -100), z: 50 });
    this.graphics.visible = false;
  }

  showAbove(pos: Vector, kind: BubbleKind): void {
    if (kind === "none") {
      this.hide();
      return;
    }
    const color = Color.fromHex(BUBBLE_COLOR[kind]);
    this.graphics.use(
      new GraphicsGroup({
        members: [
          {
            graphic: new Rectangle({
              width: 12,
              height: 12,
              color: Color.fromHex("#0d2630"),
              strokeColor: color,
              lineWidth: 1,
            }),
            offset: vec(0, 0),
          },
          {
            graphic: new Text({
              text: BUBBLE_TEXT[kind],
              color,
              font: new Font({ family: "monospace", size: 9, unit: FontUnit.Px }),
            }),
            offset: vec(6, 6),
          },
        ],
      }),
    );
    this.pos = vec(pos.x, pos.y - TILE_SIZE);
    this.graphics.visible = true;
  }

  hide(): void {
    this.graphics.visible = false;
  }
}

/**
 * Sheet cars face north; we rotate them onto the east-west roadway.
 * Two native body tiles plus multiply tints give a street full of different
 * parked cars without needing extra art.
 */
const CAR_PAINT: Record<CarPaint, { tile: number; tint?: Color }> = {
  slate: { tile: PropTiles.CAR_SLATE },
  copper: { tile: PropTiles.CAR_COPPER },
  navy: { tile: PropTiles.CAR_SLATE, tint: Color.fromHex("#6a7fc4") },
  rose: { tile: PropTiles.CAR_COPPER, tint: Color.fromHex("#e8a0a0") },
  moss: { tile: PropTiles.CAR_SLATE, tint: Color.fromHex("#7aaa6a") },
  smoke: { tile: PropTiles.CAR_SLATE, tint: Color.fromHex("#c0c0c0") },
};

const FACING_ROTATION: Record<CarFacing, number> = {
  east: Math.PI / 2,
  west: -Math.PI / 2,
};

function carBody(paint: CarPaint): GraphicsGroup {
  const { tile, tint } = CAR_PAINT[paint];
  const sprite = (index: number) => {
    // getSprite returns a shared instance; clone before tinting or every car
    // that reuses the tile picks up the last paint.
    const graphic = citySprite(index).clone();
    if (tint) graphic.tint = tint;
    return graphic;
  };
  return new GraphicsGroup({
    members: [
      { graphic: sprite(tile), offset: vec(0, 0) },
      { graphic: sprite(tile + 1), offset: vec(TILE_SIZE, 0) },
      { graphic: sprite(tile + 37), offset: vec(0, TILE_SIZE) },
      { graphic: sprite(tile + 38), offset: vec(TILE_SIZE, TILE_SIZE) },
    ],
  });
}

/** A kerbside vehicle. The client's car can pulse an amber halo when found. */
export class ParkedCar extends Actor {
  private readonly glow: Actor;

  constructor(spec: ParkedCarSpec) {
    const center = tileCenter(spec.at);
    super({
      name: `parked-${spec.at.x}-${spec.at.y}`,
      pos: vec(center.x + TILE_SIZE / 2, center.y + TILE_SIZE / 2),
      z: 5,
      rotation: FACING_ROTATION[spec.facing],
    });
    this.graphics.use(carBody(spec.paint));

    // Child keeps world rotation cancelled so the halo stays a circle.
    this.glow = new Actor({ name: `${this.name}-glow`, pos: vec(0, 0), z: -1 });
    const halo = Color.fromHex("#f5a623");
    halo.a = 0.35;
    this.glow.graphics.use(new Circle({ radius: 18, color: halo }));
    this.glow.graphics.visible = false;
    this.addChild(this.glow);
  }

  override onPreUpdate(): void {
    // Undo the parent's east/west rotation so the find-halo stays round.
    this.glow.rotation = -this.rotation;
  }

  setPaint(paint: CarPaint): void {
    this.graphics.use(carBody(paint));
  }

  setHighlighted(on: boolean): void {
    this.glow.graphics.visible = on;
    this.glow.actions.clearActions();
    if (on) {
      this.glow.actions.repeatForever((ctx) => {
        ctx.scaleTo(vec(1.2, 1.2), vec(1.5, 1.5));
        ctx.scaleTo(vec(0.9, 0.9), vec(1.5, 1.5));
      });
    } else {
      this.glow.scale = vec(1, 1);
    }
  }
}

export function createParkedCar(spec: ParkedCarSpec): ParkedCar {
  return new ParkedCar(spec);
}

/** Amber halo that pulses on the junction box while a tap is live. */
export class TapGlow extends Actor {
  constructor(center: { x: number; y: number }) {
    super({ name: "tapGlow", pos: vec(center.x, center.y), z: 6 });
    const color = Color.fromHex("#f5a623");
    color.a = 0.3;
    this.graphics.use(new Circle({ radius: 13, color }));
    this.graphics.visible = false;
  }

  setActive(value: boolean): void {
    this.graphics.visible = value;
    this.actions.clearActions();
    if (value) {
      this.actions.repeatForever((ctx) => {
        ctx.scaleTo(vec(1.25, 1.25), vec(1.4, 1.4));
        ctx.scaleTo(vec(0.85, 0.85), vec(1.4, 1.4));
      });
    } else {
      this.scale = vec(1, 1);
    }
  }
}
