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
import type { GridPos } from "../maps/street";
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

/** The client's car, a 2x2 top-down vehicle from the Kenney city sheet. */
export function createCar(topLeft: GridPos): Actor {
  const center = tileCenter(topLeft);
  const car = new Actor({
    name: "car",
    pos: vec(center.x + TILE_SIZE / 2, center.y + TILE_SIZE / 2),
    z: 5,
  });
  const base = PropTiles.CAR_TOP_LEFT;
  car.graphics.use(
    new GraphicsGroup({
      members: [
        { graphic: citySprite(base), offset: vec(0, 0) },
        { graphic: citySprite(base + 1), offset: vec(TILE_SIZE, 0) },
        { graphic: citySprite(base + 37), offset: vec(0, TILE_SIZE) },
        { graphic: citySprite(base + 38), offset: vec(TILE_SIZE, TILE_SIZE) },
      ],
    }),
  );
  return car;
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
