import { Actor, vec, type Sprite } from "excalibur";
import { images } from "../resources";
import { CompanionTrail } from "../companionTrail";
import { TILE_SIZE } from "../tiles";
import { tileCenter, type GridPos } from "../maps/street";
import { WALK_TILES_PER_SECOND, type Character } from "./Character";

/** A decorative follower; never participates in collision or interaction targets. */
export class QwardCompanion extends Actor {
  private readonly trail: CompanionTrail;
  private readonly sprite: Sprite;
  private enabled = false;

  constructor(private readonly player: Character, private readonly walkable: (at: GridPos) => boolean) {
    super({ name: "qward-companion", pos: player.pos.clone(), width: 14, height: 12, z: 10 });
    this.trail = new CompanionTrail(player.pos, TILE_SIZE);
    this.sprite = images.qward.toSprite();
    this.sprite.width = 14; this.sprite.height = 12;
    this.graphics.use(this.sprite);
    this.graphics.visible = false;
  }

  setEnabled(enabled: boolean): void {
    if (enabled !== this.enabled) this.reset();
    this.enabled = enabled;
    this.graphics.visible = enabled;
  }

  reset(): void {
    const behind = { up: { x: 0, y: 1 }, down: { x: 0, y: -1 }, left: { x: 1, y: 0 }, right: { x: -1, y: 0 } };
    const offsets = [behind[this.player.facing], ...Object.values(behind)];
    const at = offsets.map((offset) => ({ x: this.player.grid.x + offset.x, y: this.player.grid.y + offset.y })).find(this.walkable);
    const start = at ? tileCenter(at) : this.player.pos;
    this.trail.reset(start);
    this.pos = vec(start.x, start.y);
  }

  tick(elapsed: number): void {
    if (!this.enabled) return;
    const next = this.trail.follow(this.player.pos, TILE_SIZE * WALK_TILES_PER_SECOND * elapsed / 1000);
    const dx = next.x - this.pos.x;
    if (Math.abs(dx) > 0.01) this.sprite.flipHorizontal = dx < 0;
    this.pos = vec(next.x, next.y);
  }
}
