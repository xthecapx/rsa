import { Actor, BoundingBox, Circle, Color, Engine, Keys, Rectangle, Scene, TileMap, vec, type Sprite } from "excalibur";
import type { PointerEvent, Subscription } from "excalibur";

import { useLocale, t } from "@/i18n";
import { COIN_TOWN_ANIMALS, COIN_TOWN_DOOR, COIN_TOWN_EAST_SIGN, COIN_TOWN_NORTH_ROAD, COIN_TOWN_NPCS, COIN_TOWN_SIDE_ROAD, COIN_TOWN_SPAWN, COIN_TOWN_WEST_SIGN,
  EAST_GATE_COL, NORTH_GATE_ROW, WEST_GATE_COL, type AnimalSpec } from "@/content/coinTown";
import { FOUNDRY_ANIMALS, FOUNDRY_BELT, FOUNDRY_DOOR, FOUNDRY_NPCS, FOUNDRY_PROPS, FOUNDRY_SMOKE, FOUNDRY_SPAWN } from "@/content/foundry";
import { HOLLOW_ANIMALS, HOLLOW_DOOR, HOLLOW_FOG, HOLLOW_NPCS, HOLLOW_PROPS, HOLLOW_SPAWN } from "@/content/hollow";
import type { PropSpec, PropSprite } from "@/content/knowledge";
import { foundryMap } from "../maps/foundryMap";
import { hollowMap } from "../maps/hollowMap";
import { Wanderer } from "../actors/Wanderer";
import { coinTownMap } from "../maps/coinTownMap";
import { Character } from "../actors/Character";
import { TownSign } from "../actors/TownSign";
import { bus } from "../bus";
import type { EngineCommand } from "../bus";
import { tileCenter, type GridPos } from "../maps/street";
import { citySprite, npcImages, propImages, type NpcSprite } from "../resources";
import { TILE_SIZE } from "../tiles";
import { clearTouchInput, consumeTouchInteract } from "../touchInput";
import { findRoute, walkable, type WorldGrid } from "../maps/grid";

/** Everything a small town needs: terrain, where people stand and which doors open. */
export interface WorldDef {
  map: { width: number; height: number; rows: string[]; overlay: string[]; legend: Record<string, { tile: number; solid: boolean }>; overlayLegend: Record<string, { tile: number; solid: boolean } | null> };
  spawn: GridPos;
  npcs: { id: NpcSprite; at: GridPos; label: string }[];
  doors: { id: string; at: GridPos; stand: GridPos; label: string }[];
  animals?: AnimalSpec[];
  /** Barriers React can lift, e.g. the road to the next town. Closed until told otherwise. */
  gates?: { id: string; tiles: GridPos[] }[];
  /** Decor drawn over the terrain; every prop blocks its tile. */
  props?: PropSpec[];
  /** A conveyor row that crates ride along, from one tile column to another. */
  belt?: { y: number; from: number; to: number };
  /** Tiles that smoke rises from. */
  smoke?: GridPos[];
  /** Tiles that low mist drifts across. */
  fog?: GridPos[];
  /** Dim the town to night; these props glow warm and flicker. */
  night?: { glow: PropSprite[] };
}

const MOVE_KEYS: { keys: Keys[]; delta: GridPos }[] = [
  { keys: [Keys.ArrowUp, Keys.W], delta: { x: 0, y: -1 } },
  { keys: [Keys.ArrowDown, Keys.S], delta: { x: 0, y: 1 } },
  { keys: [Keys.ArrowLeft, Keys.A], delta: { x: -1, y: 0 } },
  { keys: [Keys.ArrowRight, Keys.D], delta: { x: 1, y: 0 } },
];
const WALK_SETTLE_MS = 220;
/** Crates ride the belt this many tiles apart, at this many tiles per second. */
const CRATE_GAP = 3, BELT_SPEED = 0.6;
/** Puffs per stack, and seconds for one puff to rise and fade. */
const PUFFS = 3, PUFF_SECONDS = 3.6;
/** Mist wisps per tile, and seconds for one to drift across and fade. */
const WISPS = 2, WISP_SECONDS = 7;

/** Build the solid grid once from both tile layers plus the people standing on it. */
export function worldGrid(def: WorldDef): WorldGrid {
  const grid = def.map.rows.map((row, y) => [...row].map((tile, x) =>
    !!def.map.legend[tile]?.solid || !!def.map.overlayLegend[def.map.overlay[y][x]]?.solid));
  for (const npc of def.npcs) grid[npc.at.y][npc.at.x] = true;
  for (const prop of def.props ?? []) grid[prop.at.y][prop.at.x] = true;
  return grid;
}

/** The person or door the player is standing beside, if any. */
export function worldTargetAt(def: WorldDef, pos: GridPos): string | null {
  const near = (at: GridPos) => Math.abs(at.x - pos.x) + Math.abs(at.y - pos.y) <= 1;
  return def.doors.find((door) => near(door.at))?.id ?? def.npcs.find((npc) => near(npc.at))?.id ?? null;
}

/**
 * A tile town with neighbors and doors and no scripted street scenes. React
 * owns every conversation; the scene only walks, reports who is near and
 * draws markers. Quantum Town keeps its own CityScene for the RSA mission.
 */
export class WorldScene extends Scene {
  private grid: WorldGrid;
  private player!: Character;
  private signs: { actor: TownSign; id: string; text: string; done: boolean; alert: boolean }[] = [];
  private beacon!: Actor;
  private tracked: GridPos | null = null;
  private inputLocked = true;
  private needsSpaceRelease = false;
  private lastNear: string | null = null;
  private lastPosition = "";
  private lastWalking = false;
  private walkIdleMs = 0;
  private locale = "";
  private pointerSub: Subscription | null = null;
  private animals: Wanderer[] = [];
  /** Neighbors stay on their tile; they only breathe and glance around. */
  private idlers: { actor: Actor; sprite: Sprite; seed: number; glance: number }[] = [];
  private clock = 0;
  private gates = new Map<string, { tiles: GridPos[]; bars: Actor[] }>();
  private crates: Actor[] = [];
  private puffs: { actor: Actor; from: GridPos; offset: number }[] = [];
  private wisps: { actor: Actor; from: GridPos; offset: number }[] = [];
  private glows: { actor: Actor; seed: number }[] = [];

  constructor(private readonly def: WorldDef) {
    super();
    this.grid = worldGrid(def);
  }

  override onInitialize(engine: Engine): void {
    engine.backgroundColor = Color.fromHex("#0b1f26");
    this.add(this.layer("rows", 0));
    this.add(this.layer("overlay", 1));
    for (const npc of this.def.npcs) {
      const at = tileCenter(npc.at);
      const actor = new Actor({ name: npc.id, pos: vec(at.x, at.y), width: TILE_SIZE, height: TILE_SIZE, z: 10 });
      const sprite = npcImages[npc.id].toSprite();
      actor.graphics.use(sprite);
      this.add(actor);
      this.idlers.push({ actor, sprite, seed: this.idlers.length * 1.7, glance: 2000 + Math.random() * 5000 });
      // The name board floats over the neighbor, clear of the tile the player talks from.
      const sign = new TownSign(at.x, at.y - 9, true);
      this.add(sign); this.signs.push({ actor: sign, id: npc.id, text: npc.label, done: false, alert: false });
    }
    for (const door of this.def.doors) {
      const at = tileCenter(door.at);
      const sign = new TownSign(at.x, at.y - 9, true);
      this.add(sign); this.signs.push({ actor: sign, id: door.id, text: door.label, done: false, alert: false });
    }
    for (const gate of this.def.gates ?? []) {
      const bars = gate.tiles.map((tile) => {
        const at = tileCenter(tile);
        const bar = new Actor({ pos: vec(at.x, at.y), width: TILE_SIZE, height: TILE_SIZE, z: 2 });
        bar.graphics.use(citySprite(645));
        this.add(bar);
        this.grid[tile.y][tile.x] = true;
        return bar;
      });
      this.gates.set(gate.id, { tiles: gate.tiles, bars });
    }
    for (const prop of this.def.props ?? []) {
      const at = tileCenter(prop.at);
      const actor = new Actor({ pos: vec(at.x, at.y), width: TILE_SIZE, height: TILE_SIZE, z: 3 });
      actor.graphics.use(propImages[prop.sprite].toSprite());
      this.add(actor);
    }
    if (this.def.belt) {
      const { from, to, y } = this.def.belt;
      for (let x = from; x <= to; x += CRATE_GAP) {
        const at = tileCenter({ x, y });
        const crate = new Actor({ pos: vec(at.x, at.y - 3), width: TILE_SIZE, height: TILE_SIZE, z: 4 });
        crate.graphics.use(propImages.crate.toSprite());
        this.add(crate); this.crates.push(crate);
      }
    }
    for (const from of this.def.smoke ?? []) for (let i = 0; i < PUFFS; i++) {
      const actor = new Actor({ z: 20 });
      actor.graphics.use(new Circle({ radius: 3, color: Color.fromHex("#cbd5e1") }));
      this.add(actor); this.puffs.push({ actor, from, offset: i / PUFFS });
    }
    for (const from of this.def.fog ?? []) for (let i = 0; i < WISPS; i++) {
      const actor = new Actor({ z: 14 });
      actor.graphics.use(new Circle({ radius: 6, color: Color.fromHex("#dbe4f0") }));
      actor.scale = vec(2.6, 0.55);
      this.add(actor); this.wisps.push({ actor, from, offset: i / WISPS });
    }
    if (this.def.night) {
      // A dark-blue veil over the whole town, with warm light pooled around lanterns and candles.
      const veil = new Actor({ pos: vec(0, 0), anchor: vec(0, 0), z: 12 });
      veil.graphics.use(new Rectangle({ width: this.def.map.width * TILE_SIZE, height: this.def.map.height * TILE_SIZE, color: Color.fromRGB(14, 18, 48, 0.42) }));
      this.add(veil);
      for (const prop of this.def.props ?? []) {
        if (!this.def.night.glow.includes(prop.sprite)) continue;
        const at = tileCenter(prop.at);
        const glow = new Actor({ pos: vec(at.x, at.y - 4), z: 13 });
        glow.graphics.use(new Circle({ radius: 14, color: Color.fromRGB(253, 186, 72, 0.13) }));
        this.add(glow); this.glows.push({ actor: glow, seed: this.glows.length * 2.3 });
      }
      // Name boards and the tracking ring stay readable above the night.
      for (const sign of this.signs) sign.actor.z = 30;
    }
    const ground = (pos: GridPos) => this.def.map.rows[pos.y]?.[pos.x] ?? "";
    for (const spec of this.def.animals ?? []) { const animal = new Wanderer(spec, this.grid, ground); this.animals.push(animal); this.add(animal); }
    this.player = new Character("hacker", this.def.spawn, "up");
    this.add(this.player);
    this.beacon = new Actor({ z: this.def.night ? 30 : 5 });
    this.beacon.graphics.use(new Circle({ radius: 10, color: Color.Transparent, strokeColor: Color.fromHex("#efbe67"), lineWidth: 2 }));
    this.beacon.graphics.visible = false;
    this.add(this.beacon);
    this.camera.strategy.lockToActor(this.player);
    this.camera.strategy.limitCameraBounds(new BoundingBox(0, 0, this.def.map.width * TILE_SIZE, this.def.map.height * TILE_SIZE));
    this.pointerSub = engine.input.pointers.on("down", (event) => this.onPointerDown(event));
    bus.setCommandHandler((command) => this.handle(command));
    bus.emit({ type: "ready" });
  }

  override onDeactivate(): void {
    this.pointerSub?.close(); this.pointerSub = null;
    this.player.stop(); clearTouchInput();
    bus.setCommandHandler(null); bus.drain();
  }

  private layer(key: "rows" | "overlay", z: number): TileMap {
    const map = new TileMap({ name: key, pos: vec(0, 0), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE, columns: this.def.map.width, rows: this.def.map.height, renderFromTopOfGraphic: true });
    map.z = z;
    const legend = key === "rows" ? this.def.map.legend : this.def.map.overlayLegend;
    for (let y = 0; y < this.def.map.height; y++) for (let x = 0; x < this.def.map.width; x++) {
      const entry = legend[this.def.map[key][y][x]];
      if (entry) map.getTile(x, y)?.addGraphic(citySprite(entry.tile));
    }
    return map;
  }

  override onPreUpdate(engine: Engine, elapsed: number): void {
    this.reportWalking(elapsed);
    this.animateLife(elapsed);
    const locale = useLocale.getState().locale;
    if (locale !== this.locale) {
      this.locale = locale;
      for (const sign of this.signs) sign.actor.setCaption(`${sign.alert ? "! " : sign.done ? "★ " : ""}${t(sign.text)}`, sign.done && !sign.alert);
    }
    if (!this.player.isMoving) {
      const position = `${this.player.grid.x},${this.player.grid.y},${this.player.facing}`;
      if (position !== this.lastPosition) {
        this.lastPosition = position;
        bus.emit({ type: "position", at: { ...this.player.grid }, facing: this.player.facing });
      }
    }
    if (this.tracked) { this.beacon.pos = vec(tileCenter(this.tracked).x, tileCenter(this.tracked).y); this.beacon.graphics.opacity = 0.75; }
    if (this.inputLocked) return;
    const near = worldTargetAt(this.def, this.player.grid);
    if (near !== this.lastNear) { this.lastNear = near; bus.emit({ type: "worldNear", near }); }
    if (this.needsSpaceRelease && !engine.input.keyboard.isHeld(Keys.Space)) this.needsSpaceRelease = false;
    const talked = (!this.needsSpaceRelease && engine.input.keyboard.wasPressed(Keys.Space)) || consumeTouchInteract();
    if (near && talked) {
      this.player.stop(); this.inputLocked = true;
      const npc = this.def.npcs.find((person) => person.id === near);
      if (npc) this.player.faceTowards(npc.at);
      bus.emit({ type: "worldInteract", target: near });
      return;
    }
    if (MOVE_KEYS.some(({ keys }) => keys.some((key) => engine.input.keyboard.isHeld(key)))) this.player.clearRoute();
    if (this.player.isMoving) return;
    for (const { keys, delta } of MOVE_KEYS) {
      if (!keys.some((key) => engine.input.keyboard.isHeld(key))) continue;
      const next = { x: this.player.grid.x + delta.x, y: this.player.grid.y + delta.y };
      if (walkable(this.grid, next)) this.player.stepTowards(next); else this.player.faceTowards(next);
      break;
    }
  }

  private animateLife(elapsed: number): void {
    this.clock += elapsed;
    if (this.def.belt) {
      const { from, to } = this.def.belt;
      const span = (to - from + 1) * TILE_SIZE;
      const start = from * TILE_SIZE;
      this.crates.forEach((crate, i) => {
        const x = (i * CRATE_GAP * TILE_SIZE + (this.clock / 1000) * BELT_SPEED * TILE_SIZE) % span;
        crate.pos = vec(start + x + TILE_SIZE / 2, crate.pos.y);
      });
    }
    for (const puff of this.puffs) {
      const life = ((this.clock / 1000) / PUFF_SECONDS + puff.offset) % 1;
      const at = tileCenter(puff.from);
      puff.actor.pos = vec(at.x + life * 6, at.y - 8 - life * 22);
      puff.actor.scale = vec(0.7 + life * 1.1, 0.7 + life * 1.1);
      puff.actor.graphics.opacity = 0.55 * (1 - life);
    }
    for (const wisp of this.wisps) {
      const life = ((this.clock / 1000) / WISP_SECONDS + wisp.offset) % 1;
      const at = tileCenter(wisp.from);
      wisp.actor.pos = vec(at.x - 14 + life * 28, at.y + 4 - life * 3);
      wisp.actor.graphics.opacity = 0.2 * Math.sin(life * Math.PI);
    }
    for (const glow of this.glows) glow.actor.graphics.opacity = 0.85 + 0.15 * Math.sin(this.clock / 170 + glow.seed) * Math.sin(this.clock / 410 + glow.seed);
    for (const animal of this.animals) animal.tick(elapsed, this.player.grid);
    for (const idler of this.idlers) {
      // A one-pixel lift now and then reads as breathing without making the town jittery.
      idler.actor.graphics.offset = vec(0, Math.sin(this.clock / 900 + idler.seed) > 0.7 ? -1 : 0);
      idler.glance -= elapsed;
      if (idler.glance <= 0) { idler.sprite.flipHorizontal = !idler.sprite.flipHorizontal; idler.glance = 3000 + Math.random() * 6000; }
    }
  }

  private reportWalking(elapsed: number): void {
    if (this.player.isMoving) {
      this.walkIdleMs = 0;
      if (!this.lastWalking) { this.lastWalking = true; bus.emit({ type: "walking", walking: true }); }
      return;
    }
    if (!this.lastWalking) return;
    this.walkIdleMs += elapsed;
    if (this.walkIdleMs < WALK_SETTLE_MS) return;
    this.lastWalking = false;
    bus.emit({ type: "walking", walking: false });
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.inputLocked) return;
    if ("button" in event.nativeEvent && event.nativeEvent.button !== 0) return;
    if ("isPrimary" in event.nativeEvent && event.nativeEvent.isPrimary === false) return;
    if ("touches" in event.nativeEvent && (event.nativeEvent as TouchEvent).touches.length > 1) return;
    const tapped = { x: Math.floor(event.coordinates.worldPos.x / TILE_SIZE), y: Math.floor(event.coordinates.worldPos.y / TILE_SIZE) };
    const goal = this.reachable(tapped);
    if (!goal) return;
    const route = findRoute(this.grid, this.player.grid, goal);
    if (route?.length) void this.player.follow(route);
  }

  /** Tapping a neighbor or a door walks to the tile beside it. */
  private reachable(tapped: GridPos): GridPos | null {
    if (walkable(this.grid, tapped)) return tapped;
    const door = this.def.doors.find(({ at }) => Math.abs(at.x - tapped.x) <= 1 && Math.abs(at.y - tapped.y) <= 1);
    if (door) return door.stand;
    const options = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]
      .map((d) => ({ x: tapped.x + d.x, y: tapped.y + d.y })).filter((pos) => walkable(this.grid, pos));
    if (!options.length) return null;
    const distance = (pos: GridPos) => Math.abs(pos.x - this.player.grid.x) + Math.abs(pos.y - this.player.grid.y);
    return options.reduce((best, pos) => (distance(pos) < distance(best) ? pos : best));
  }

  private standFor(id: string): GridPos | null {
    const door = this.def.doors.find((d) => d.id === id);
    if (door) return door.stand;
    const npc = this.def.npcs.find((n) => n.id === id);
    if (!npc) return null;
    return [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }]
      .map((d) => ({ x: npc.at.x + d.x, y: npc.at.y + d.y })).find((pos) => walkable(this.grid, pos)) ?? null;
  }

  private async handle(command: EngineCommand): Promise<void> {
    switch (command.type) {
      case "lockInput":
        this.inputLocked = command.locked;
        if (command.locked) this.player.stop(); else this.needsSpaceRelease = true;
        clearTouchInput();
        return;
      case "placePlayer": {
        const requested = { x: Math.round(command.at.x), y: Math.round(command.at.y) };
        const at = Number.isFinite(requested.x) && walkable(this.grid, requested) ? requested : this.def.spawn;
        this.player.stop(); this.player.grid = { ...at };
        this.player.pos = vec(tileCenter(at).x, tileCenter(at).y);
        this.player.face(command.facing);
        this.lastNear = null; this.lastPosition = "";
        return;
      }
      case "worldTrack":
        this.tracked = command.target ? this.standFor(command.target) : null;
        this.beacon.graphics.visible = !!this.tracked;
        return;
      case "worldMarkers":
        for (const sign of this.signs) { sign.done = command.done.includes(sign.id); sign.alert = command.alerts.includes(sign.id); }
        this.locale = "";
        return;
      case "worldGate": {
        const gate = this.gates.get(command.id);
        if (!gate) return;
        gate.bars.forEach((bar) => { bar.graphics.visible = !command.open; });
        for (const tile of gate.tiles) this.grid[tile.y][tile.x] = !command.open;
        return;
      }
      default:
        return;
    }
  }
}

export const COIN_TOWN_WORLD: WorldDef = {
  map: coinTownMap, spawn: COIN_TOWN_SPAWN,
  npcs: COIN_TOWN_NPCS.map((npc) => ({ id: npc.id, at: npc.at, label: npc.title })),
  doors: [{ id: "coinDoor", ...COIN_TOWN_DOOR, label: "Coin house" },
    { id: "eastSign", ...COIN_TOWN_EAST_SIGN, label: "Foundry Town →" }, { id: "westSign", ...COIN_TOWN_WEST_SIGN, label: "← Hollow Town" }],
  animals: COIN_TOWN_ANIMALS,
  gates: [{ id: "north", tiles: COIN_TOWN_NORTH_ROAD.map((x) => ({ x, y: NORTH_GATE_ROW })) },
    { id: "east", tiles: COIN_TOWN_SIDE_ROAD.map((y) => ({ x: EAST_GATE_COL, y })) }, { id: "west", tiles: COIN_TOWN_SIDE_ROAD.map((y) => ({ x: WEST_GATE_COL, y })) }],
  props: [{ sprite: "sign", at: COIN_TOWN_EAST_SIGN.at }, { sprite: "sign", at: COIN_TOWN_WEST_SIGN.at }],
};

export class CoinTownScene extends WorldScene {
  constructor() { super(COIN_TOWN_WORLD); }
}

export const FOUNDRY_WORLD: WorldDef = {
  map: foundryMap, spawn: FOUNDRY_SPAWN,
  npcs: FOUNDRY_NPCS.map((npc) => ({ id: npc.id, at: npc.at, label: npc.title })),
  doors: [{ id: "workshopDoor", ...FOUNDRY_DOOR, label: "Thecap’s workshop" }],
  animals: FOUNDRY_ANIMALS,
  props: FOUNDRY_PROPS, belt: FOUNDRY_BELT, smoke: FOUNDRY_SMOKE,
};

export class FoundryScene extends WorldScene {
  constructor() { super(FOUNDRY_WORLD); }
}

export const HOLLOW_WORLD: WorldDef = {
  map: hollowMap, spawn: HOLLOW_SPAWN,
  npcs: HOLLOW_NPCS.map((npc) => ({ id: npc.id, at: npc.at, label: npc.title })),
  doors: [{ id: "vaultDoor", ...HOLLOW_DOOR, label: "Casa Ofelia" }],
  animals: HOLLOW_ANIMALS,
  props: HOLLOW_PROPS, fog: HOLLOW_FOG,
  night: { glow: ["lantern", "candles", "pumpkin"] },
};

export class HollowScene extends WorldScene {
  constructor() { super(HOLLOW_WORLD); }
}
