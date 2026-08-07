import {
  Axis,
  BoundingBox,
  Color,
  Engine,
  Keys,
  Scene,
  TileMap,
  vec,
} from "excalibur";

import { Bubble, Packet, TapGlow, createVan } from "../actors/Props";
import { Character } from "../actors/Character";
import type { CastMember } from "../actors/Character";
import { bus } from "../bus";
import type { EngineCommand, Landmark } from "../bus";
import {
  LANDMARKS,
  PLAYER_SPAWN,
  buildSolidGrid,
  findPath,
  isWalkable,
  landmarkAt,
  landmarkCenter,
  street,
  tileCenter,
} from "../maps/street";
import type { GridPos } from "../maps/street";
import { citySprite } from "../resources";
import { TILE_SIZE } from "../tiles";

const MOVE_KEYS: { keys: Keys[]; delta: GridPos }[] = [
  { keys: [Keys.ArrowUp, Keys.W], delta: { x: 0, y: -1 } },
  { keys: [Keys.ArrowDown, Keys.S], delta: { x: 0, y: 1 } },
  { keys: [Keys.ArrowLeft, Keys.A], delta: { x: -1, y: 0 } },
  { keys: [Keys.ArrowRight, Keys.D], delta: { x: 1, y: 0 } },
];

export class CityScene extends Scene {
  private solid = buildSolidGrid();
  private player!: Character;
  private cast = {} as Record<CastMember, Character>;
  private packet!: Packet;
  private bubbles = {} as Record<CastMember, Bubble>;
  private tapGlow!: TapGlow;
  private inputLocked = false;
  private lastNear: Landmark | null = null;

  override onInitialize(engine: Engine): void {
    engine.backgroundColor = Color.fromHex("#0b1f26");

    this.add(this.buildLayer("rows", "legend", 0));
    this.add(this.buildLayer("overlay", "overlayLegend", 1));

    this.add(createVan(LANDMARKS.van.at));

    this.tapGlow = new TapGlow(landmarkCenter("tap"));
    this.add(this.tapGlow);

    this.player = new Character("hacker", PLAYER_SPAWN, "up");
    this.cast.hacker = this.player;
    this.cast.ale = new Character("ale", LANDMARKS.ale.at, "down");
    this.cast.brayan = new Character("brayan", LANDMARKS.brayan.at, "down");
    for (const member of Object.values(this.cast)) this.add(member);

    for (const member of ["hacker", "ale", "brayan"] as CastMember[]) {
      const bubble = new Bubble();
      this.bubbles[member] = bubble;
      this.add(bubble);
    }

    this.packet = new Packet();
    this.packet.graphics.visible = false;
    this.add(this.packet);

    const worldWidth = street.width * TILE_SIZE;
    const worldHeight = street.height * TILE_SIZE;
    this.camera.strategy.lockToActorAxis(this.player, Axis.X);
    this.camera.strategy.limitCameraBounds(
      new BoundingBox(0, 0, worldWidth, worldHeight),
    );
    this.camera.y = worldHeight / 2;

    bus.setCommandHandler((command) => this.handle(command));
    bus.emit({ type: "ready" });
  }

  override onDeactivate(): void {
    bus.setCommandHandler(null);
    bus.drain();
  }

  private buildLayer(
    rowsKey: "rows" | "overlay",
    legendKey: "legend" | "overlayLegend",
    z: number,
  ): TileMap {
    const tileMap = new TileMap({
      name: rowsKey,
      pos: vec(0, 0),
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      columns: street.width,
      rows: street.height,
      renderFromTopOfGraphic: true,
    });
    tileMap.z = z;
    const legend = street[legendKey] as Record<
      string,
      { tile: number; solid: boolean } | null
    >;
    for (let y = 0; y < street.height; y++) {
      const row = street[rowsKey][y];
      for (let x = 0; x < street.width; x++) {
        const entry = legend[row[x]];
        if (!entry) continue;
        const tile = tileMap.getTile(x, y);
        tile?.addGraphic(citySprite(entry.tile));
      }
    }
    return tileMap;
  }

  override onPreUpdate(engine: Engine): void {
    if (this.inputLocked || this.player.isMoving) return;

    for (const { keys, delta } of MOVE_KEYS) {
      if (!keys.some((key) => engine.input.keyboard.isHeld(key))) continue;
      const next = { x: this.player.grid.x + delta.x, y: this.player.grid.y + delta.y };
      if (isWalkable(this.solid, next)) {
        this.player.stepTowards(next);
      } else {
        this.player.faceTowards(next);
      }
      break;
    }

    const near = landmarkAt(this.player.grid);
    if (near !== this.lastNear) {
      this.lastNear = near;
      bus.emit({ type: "moved", near });
    }

    if (near && engine.input.keyboard.wasPressed(Keys.Space)) {
      bus.emit({ type: "interact", target: near });
    }
  }

  private async handle(command: EngineCommand): Promise<void> {
    switch (command.type) {
      case "lockInput":
        this.inputLocked = command.locked;
        if (command.locked) this.player.stop();
        return;

      case "reset":
        this.player.stop();
        this.player.grid = { ...PLAYER_SPAWN };
        this.player.pos = vec(
          tileCenter(PLAYER_SPAWN).x,
          tileCenter(PLAYER_SPAWN).y,
        );
        this.packet.hide();
        this.tapGlow.setActive(false);
        for (const bubble of Object.values(this.bubbles)) bubble.hide();
        return;

      case "face": {
        this.player.faceTowards(LANDMARKS[command.target].at);
        return;
      }

      case "walkTo": {
        const goal = LANDMARKS[command.target].stand;
        const route = findPath(this.solid, this.player.grid, goal);
        if (route?.length) await this.player.follow(route);
        this.player.faceTowards(LANDMARKS[command.target].at);
        return;
      }

      case "bubble": {
        const actor = this.cast[command.actor];
        this.bubbles[command.actor].showAbove(actor.pos, command.face);
        return;
      }

      case "tapGlow":
        this.tapGlow.setActive(command.on);
        return;

      case "packet":
        await this.runPacket(command);
        return;
    }
  }

  private async runPacket(
    command: Extract<EngineCommand, { type: "packet" }>,
  ): Promise<void> {
    const from = LANDMARKS[command.from].at;
    const to = LANDMARKS[command.to].at;
    const tap = LANDMARKS.tap.at;
    const wireY = tileCenter(from).y + TILE_SIZE * 0.15;

    const point = (pos: GridPos) => vec(tileCenter(pos).x, wireY);

    this.packet.show(command.style, point(from));
    const legDuration = 900;

    if (command.intercept) {
      await this.packet.travelTo(point(tap), legDuration);
      this.tapGlow.setActive(true);
      this.bubbles.hacker.showAbove(this.player.pos, "success");
      await wait(520);
      this.bubbles.hacker.hide();
      await this.packet.travelTo(point(to), legDuration);
    } else {
      await this.packet.travelTo(point(to), legDuration * 1.6);
    }

    await wait(220);
    this.packet.hide();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
