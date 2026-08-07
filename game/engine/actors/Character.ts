import { Actor, Animation, AnimationStrategy, Vector, vec } from "excalibur";

import { CHARACTER_COLUMNS, characterSheet } from "../resources";
import { TILE_SIZE } from "../tiles";
import type { GridPos } from "../maps/street";
import { tileCenter } from "../maps/street";

export type CastMember = "hacker" | "ale" | "brayan";
export type Facing = "down" | "up" | "left" | "right";

const CAST_ROW: Record<CastMember, number> = { hacker: 0, ale: 1, brayan: 2 };
const FACING_COLUMN: Record<Facing, number> = { down: 0, up: 3, left: 6, right: 9 };

/** Tiles crossed per second while walking. */
export const WALK_TILES_PER_SECOND = 4.5;

/**
 * A grid-snapped overworld character. Movement is tween-based rather than
 * physics-based, which is what makes it feel like a tile RPG instead of a
 * platformer.
 */
export class Character extends Actor {
  readonly member: CastMember;
  grid: GridPos;
  facing: Facing = "down";

  private walkAnimations = {} as Record<Facing, Animation>;
  private idleAnimations = {} as Record<Facing, Animation>;
  private route: GridPos[] = [];
  private stepFrom: Vector | null = null;
  private stepTo: Vector | null = null;
  private stepProgress = 0;
  private arrival: (() => void) | null = null;

  constructor(member: CastMember, grid: GridPos, facing: Facing = "down") {
    const center = tileCenter(grid);
    super({
      name: member,
      pos: vec(center.x, center.y),
      width: TILE_SIZE,
      height: TILE_SIZE,
      // Sorting by y makes characters overlap correctly against the buildings.
      z: 10,
    });
    this.member = member;
    this.grid = { ...grid };
    this.facing = facing;
  }

  override onInitialize(): void {
    const row = CAST_ROW[this.member];
    for (const facing of Object.keys(FACING_COLUMN) as Facing[]) {
      const base = FACING_COLUMN[facing];
      const frame = (offset: number) =>
        characterSheet.getSprite((base + offset) % CHARACTER_COLUMNS, row);
      this.walkAnimations[facing] = new Animation({
        frames: [
          { graphic: frame(0), duration: 130 },
          { graphic: frame(1), duration: 130 },
          { graphic: frame(2), duration: 130 },
          { graphic: frame(1), duration: 130 },
        ],
        strategy: AnimationStrategy.Loop,
      });
      this.idleAnimations[facing] = new Animation({
        frames: [{ graphic: frame(1), duration: 1000 }],
        strategy: AnimationStrategy.Loop,
      });
    }
    this.applyGraphic(false);
  }

  get isMoving(): boolean {
    return this.stepTo !== null || this.route.length > 0;
  }

  face(facing: Facing): void {
    if (this.facing === facing) return;
    this.facing = facing;
    if (!this.isMoving) this.applyGraphic(false);
  }

  faceTowards(target: GridPos): void {
    const dx = target.x - this.grid.x;
    const dy = target.y - this.grid.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.face(dx >= 0 ? "right" : "left");
    } else {
      this.face(dy >= 0 ? "down" : "up");
    }
  }

  /** Queue a route; resolves when the last tile is reached. */
  follow(route: GridPos[]): Promise<void> {
    this.arrival?.();
    this.arrival = null;
    this.route = [...route];
    if (!this.route.length) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.arrival = resolve;
    });
  }

  /** Take a single step if the destination is free. Used for keyboard input. */
  stepTowards(next: GridPos): boolean {
    if (this.isMoving) return false;
    this.route = [next];
    return true;
  }

  stop(): void {
    this.route = [];
    this.stepFrom = null;
    this.stepTo = null;
    this.stepProgress = 0;
    this.applyGraphic(false);
    this.arrival?.();
    this.arrival = null;
  }

  override onPostUpdate(_engine: unknown, elapsed: number): void {
    if (!this.stepTo && this.route.length) this.beginStep();
    if (!this.stepTo || !this.stepFrom) return;

    const seconds = elapsed / 1000;
    this.stepProgress += seconds * WALK_TILES_PER_SECOND;
    if (this.stepProgress >= 1) {
      this.pos = this.stepTo.clone();
      this.stepFrom = null;
      this.stepTo = null;
      this.stepProgress = 0;
      if (this.route.length) {
        this.beginStep();
      } else {
        this.applyGraphic(false);
        this.arrival?.();
        this.arrival = null;
      }
      return;
    }
    this.pos = this.stepFrom.lerp(this.stepTo, this.stepProgress);
  }

  private beginStep(): void {
    const next = this.route.shift();
    if (!next) return;
    const dx = next.x - this.grid.x;
    const dy = next.y - this.grid.y;
    if (dx !== 0) this.facing = dx > 0 ? "right" : "left";
    else if (dy !== 0) this.facing = dy > 0 ? "down" : "up";

    const target = tileCenter(next);
    this.stepFrom = this.pos.clone();
    this.stepTo = vec(target.x, target.y);
    this.stepProgress = 0;
    this.grid = { ...next };
    this.applyGraphic(true);
  }

  private applyGraphic(walking: boolean): void {
    const animation = walking
      ? this.walkAnimations[this.facing]
      : this.idleAnimations[this.facing];
    if (animation) this.graphics.use(animation);
  }
}
