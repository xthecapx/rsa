import { Actor, vec, type Sprite, type Vector } from "excalibur";

import type { AnimalSpec } from "@/content/coinTown";
import { animalImages } from "../resources";
import { TILE_SIZE } from "../tiles";
import { tileCenter, type GridPos } from "../maps/street";
import { findRoute, tilesNear, type WorldGrid } from "../maps/grid";

/** Tiles per second, and how long each kind likes to stand still between walks. */
const PACE: Record<AnimalSpec["kind"], { speed: number; rest: [number, number] }> = {
  cat: { speed: 2.2, rest: [3000, 8000] },
  dog: { speed: 3.2, rest: [1200, 4000] },
  pigeon: { speed: 2.6, rest: [900, 2600] },
  duck: { speed: 0.9, rest: [1500, 4000] },
};
const FLY_SPEED = 9;
const random = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * A town animal. It strolls between tiles near its home along real routes, so
 * it never walks through a bench, rests a while, and hops a pixel as it steps.
 * It never blocks the player; shy ones take off when the player gets close.
 */
export class Wanderer extends Actor {
  grid: GridPos;
  private sprite: Sprite;
  private route: GridPos[] = [];
  private from: Vector | null = null;
  private to: Vector | null = null;
  private progress = 0;
  private speed: number;
  private flying = false;
  private rest = random(300, 2500);
  private clock = Math.random() * 10000;

  constructor(private readonly spec: AnimalSpec, private readonly world: WorldGrid, private readonly ground: (pos: GridPos) => string) {
    const at = tileCenter(spec.home);
    super({ name: spec.kind, pos: vec(at.x, at.y), width: TILE_SIZE, height: TILE_SIZE, z: spec.kind === "duck" ? 2 : 9 });
    this.grid = { ...spec.home };
    this.speed = PACE[spec.kind].speed;
    this.sprite = animalImages[spec.kind].toSprite();
    this.sprite.flipHorizontal = Math.random() < 0.5;
    this.graphics.use(this.sprite);
  }

  private allowed = (pos: GridPos) => !this.spec.ground || this.ground(pos) === this.spec.ground;

  /** Called by the scene every frame with the player's tile. */
  tick(elapsed: number, player: GridPos): void {
    this.clock += elapsed;
    if (this.to && this.from) { this.step(elapsed); return; }
    const near = Math.abs(player.x - this.grid.x) + Math.abs(player.y - this.grid.y);
    if (this.spec.shy && near <= 2) { this.takeOff(player); return; }
    this.idle();
    this.rest -= elapsed;
    if (this.rest > 0) return;
    this.rest = random(...PACE[this.spec.kind].rest);
    const options = tilesNear(this.world, this.spec.home, this.spec.radius, this.allowed)
      .filter((pos) => (pos.x !== player.x || pos.y !== player.y) && (pos.x !== this.grid.x || pos.y !== this.grid.y));
    if (!options.length) return;
    const goal = options[Math.floor(Math.random() * options.length)];
    const route = this.spec.ground ? this.basinRoute(goal) : findRoute(this.world, this.grid, goal);
    if (route?.length && route.length <= this.spec.radius * 2 + 2) this.walk(route, PACE[this.spec.kind].speed);
  }

  /** Ducks paddle only inside the basin, so route with the basin as the whole world. */
  private basinRoute(goal: GridPos): GridPos[] | null {
    const water = this.world.map((row, y) => row.map((solid, x) => solid || !this.allowed({ x, y })));
    return findRoute(water, this.grid, goal);
  }

  private walk(route: GridPos[], speed: number): void {
    this.route = route; this.speed = speed; this.next();
  }

  private next(): void {
    const tile = this.route.shift();
    if (!tile) { this.from = this.to = null; this.flying = false; this.graphics.offset = vec(0, 0); return; }
    const target = tileCenter(tile);
    this.from = this.pos.clone(); this.to = vec(target.x, target.y); this.progress = 0;
    if (target.x !== this.pos.x) this.sprite.flipHorizontal = target.x < this.pos.x;
    this.grid = { ...tile };
  }

  private step(elapsed: number): void {
    const tiles = Math.max(1, this.from!.distance(this.to!) / TILE_SIZE);
    this.progress = Math.min(1, this.progress + (elapsed / 1000) * this.speed / tiles);
    this.pos = this.from!.lerp(this.to!, this.progress);
    // Walkers hop a pixel per tile; a startled bird arcs up and lands.
    const lift = this.flying ? Math.sin(this.progress * Math.PI) * 10 : this.spec.kind === "duck" ? 0 : Math.abs(Math.sin(this.progress * Math.PI)) * 1.5;
    this.graphics.offset = vec(0, -Math.round(lift));
    if (this.progress >= 1) this.next();
  }

  /** Small signs of life while resting: pigeons peck, ducks bob, the cat's tail keeps time. */
  private idle(): void {
    const t = this.clock / 1000;
    const dip = this.spec.kind === "pigeon" ? (Math.sin(t * 5) > 0.85 ? 1 : 0)
      : this.spec.kind === "duck" ? Math.round(Math.sin(t * 2)) * 0.5 : 0;
    this.graphics.offset = vec(0, dip);
  }

  /** Fly to a free tile away from the player, straight over whatever is in between. */
  private takeOff(player: GridPos): void {
    const options = tilesNear(this.world, this.spec.home, this.spec.radius + 3)
      .filter((pos) => Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y) >= 4);
    if (!options.length) return;
    const goal = options[Math.floor(Math.random() * options.length)];
    this.flying = true;
    this.walk([goal], FLY_SPEED);
    this.rest = random(2000, 4000);
  }
}
