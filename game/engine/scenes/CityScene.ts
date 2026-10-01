import {
  Actor,
  Circle,
  BoundingBox,
  Color,
  Engine,
  Keys,
  Scene,
  TileMap,
  vec,
} from "excalibur";
import type { PointerEvent, Subscription } from "excalibur";

import { TOWN_LOCATIONS, townTargetAt, type TownTarget } from "@/content/town";
import { t, useLocale } from "@/i18n";

import { Character } from "../actors/Character";
import { RsaStreet, isStreetCommand } from "../actors/RsaStreet";
import { TownSign } from "../actors/TownSign";
import { bus } from "../bus";
import type { EngineCommand, Landmark } from "../bus";
import {
  LANDMARKS,
  PLAYER_SPAWN,
  buildSolidGrid,
  findPath,
  isWalkable,
  street,
  tileCenter,
} from "../maps/street";
import type { GridPos } from "../maps/street";
import { citySprite, images } from "../resources";
import { TILE_SIZE } from "../tiles";
import { clearTouchInput, consumeTouchInteract } from "../touchInput";

const MOVE_KEYS: { keys: Keys[]; delta: GridPos }[] = [
  { keys: [Keys.ArrowUp, Keys.W], delta: { x: 0, y: -1 } },
  { keys: [Keys.ArrowDown, Keys.S], delta: { x: 0, y: 1 } },
  { keys: [Keys.ArrowLeft, Keys.A], delta: { x: -1, y: 0 } },
  { keys: [Keys.ArrowRight, Keys.D], delta: { x: 1, y: 0 } },
];

/** How long the player has to stand still before they count as stopped. */
const WALK_SETTLE_MS = 220;
// Marker keys for captions that are built per locale and progress.
const GUIDE_LABEL = "Professor Thecap · next challenge";
const SIGN_LABEL = "Quantum Town signpost";

const NEIGHBOURS: GridPos[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

export class CityScene extends Scene {
  private solid = buildSolidGrid();
  private player!: Character;
  private rsaStreet!: RsaStreet;
  // Stay locked through asset loading and the opening story setup.
  private inputLocked = true;
  private lastNear: Landmark | null = null;
  private lastWalking = false;
  private walkIdleMs = 0;
  /**
   * The same Space press that finishes a line would otherwise arrive here the
   * instant input is unlocked, interacting with whatever the player happens to
   * be standing next to. Wait for the key to come up first.
   */
  private needsSpaceRelease = false;
  private pointerSub: Subscription | null = null;
  private lastTownNear: TownTarget | null = null;
  private lastPosition = "";
  /** Title of the challenge Thecap recommends next; null once all are done. */
  private guideNext: string | null = "Who Goes First?";
  private markerLabels: { actor: TownSign; text: string; completed?: boolean; paused?: boolean }[] = [];
  private markerLocale = "";
  private beacon!: Actor;
  private tracked: TownTarget | Landmark | null = null;

  override onInitialize(engine: Engine): void {
    engine.backgroundColor = Color.fromHex("#0b1f26");

    this.add(this.buildLayer("rows", "legend", 0));
    this.add(this.buildLayer("overlay", "overlayLegend", 1));

    this.player = new Character("hacker", PLAYER_SPAWN, "up");
    this.rsaStreet = new RsaStreet(this, this.player);
    this.rsaStreet.mountGround();
    this.add(this.player);
    this.rsaStreet.mountPeople();

    const worldWidth = street.width * TILE_SIZE;
    const worldHeight = street.height * TILE_SIZE;
    this.camera.strategy.lockToActor(this.player);
    this.camera.strategy.limitCameraBounds(
      new BoundingBox(0, 0, worldWidth, worldHeight),
    );
    const guide = new Actor({ name: "professor-thecap", pos: vec(tileCenter(TOWN_LOCATIONS.guide.at).x, tileCenter(TOWN_LOCATIONS.guide.at).y), width: TILE_SIZE, height: TILE_SIZE, z: 10 });
    guide.graphics.use(images.doctor.toSprite());
    this.add(guide);
    for (const [key, location] of Object.entries(TOWN_LOCATIONS)) {
      // The south road is an open path, marked by the signpost instead of a board.
      if (location.kind === "path") continue;
      const at = tileCenter(location.at);
      const mounted = location.kind === "coin" || location.kind === "grover" || location.kind === "vault";
      const label = new TownSign(at.x - (key === "guide" ? 44 : 0), at.y + (mounted ? -9 : 8), mounted);
      this.add(label);
      this.markerLabels.push({ actor: label, text: key === "coinDoor" ? "Coin house" : key === "groverDoor" ? "Thecap’s workshop" : key === "vaultDoor" ? "Casa Ofelia" : key === "guide" ? GUIDE_LABEL : SIGN_LABEL });
    }
    const clientLabel = new TownSign(tileCenter(LANDMARKS.car.at).x + 40, tileCenter(LANDMARKS.car.at).y + 40);
    this.add(clientLabel); this.markerLabels.push({ actor: clientLabel, text: "RSA · Talk to the client" });
    this.beacon = new Actor({ z: 5 });
    this.beacon.graphics.use(new Circle({ radius: 10, color: Color.Transparent, strokeColor: Color.fromHex("#efbe67"), lineWidth: 2 }));
    this.beacon.graphics.visible = false;
    this.add(this.beacon);

    this.pointerSub = engine.input.pointers.on("down", (event) =>
      this.onPointerDown(event),
    );

    bus.setCommandHandler((command) => this.handle(command));
    bus.emit({ type: "ready" });
  }

  override onDeactivate(): void {
    this.pointerSub?.close();
    this.pointerSub = null;
    this.player.stop();
    this.rsaStreet.deactivate();
    clearTouchInput();
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

  override onPreUpdate(engine: Engine, elapsed: number): void {
    this.reportWalking(elapsed);
    const locale = useLocale.getState().locale;
    if (locale !== this.markerLocale) {
      this.markerLocale = locale;
      for (const { actor, text, completed, paused } of this.markerLabels) {
        const caption = text === GUIDE_LABEL ? (this.guideNext ? `${t("Professor Thecap")}\n${t(this.guideNext)}` : t("Professor Thecap"))
          : text === SIGN_LABEL ? `${t("Cipher Town ↓ · RSA →")}\n${t("Workshop ↖ · Casa Ofelia ↑")}` : t(paused ? "RSA · Resume mission" : text);
        actor.setCaption(`${completed ? "★ " : paused ? "Ⅱ " : ""}${caption}`, completed);
      }
      // Sign widths change with their translated captions and mission status.
      this.solid = buildSolidGrid();
      for (const { actor } of this.markerLabels) actor.blockTiles(this.solid);
    }
    if (!this.player.isMoving) {
      const position = `${this.player.grid.x},${this.player.grid.y},${this.player.facing}`;
      if (position !== this.lastPosition) {
        this.lastPosition = position;
        bus.emit({ type: "position", at: { ...this.player.grid }, facing: this.player.facing });
      }
    }
    if (this.tracked && this.beacon) {
      const at = this.tracked in TOWN_LOCATIONS ? TOWN_LOCATIONS[this.tracked as TownTarget].stand : LANDMARKS[this.tracked as Landmark].stand;
      this.beacon.pos = vec(tileCenter(at).x, tileCenter(at).y);
      this.beacon.graphics.opacity = 0.75;
    }
    if (this.inputLocked) return;
    const townNear = townTargetAt(this.player.grid);
    if (townNear !== this.lastTownNear) { this.lastTownNear = townNear; bus.emit({ type: "townMoved", near: townNear }); }

    const near = this.rsaStreet.near(this.player.grid);
    if (near !== this.lastNear) {
      this.lastNear = near;
      bus.emit({ type: "moved", near });
    }

    if (this.needsSpaceRelease) {
      if (!engine.input.keyboard.isHeld(Keys.Space)) this.needsSpaceRelease = false;
    }

    const talked =
      (!this.needsSpaceRelease && engine.input.keyboard.wasPressed(Keys.Space)) ||
      consumeTouchInteract();

    if (townNear && talked) {
      this.player.stop(); this.inputLocked = true;
      bus.emit({ type: "townInteract", target: townNear });
      return;
    }
    if (near && talked) {
      this.player.stop();
      bus.emit({ type: "interact", target: near });
      return;
    }

    // Keyboard input takes over after the current tile, without snapping the
    // character or waiting for the entire clicked route to finish.
    if (MOVE_KEYS.some(({ keys }) => keys.some((key) => engine.input.keyboard.isHeld(key)))) this.player.clearRoute();
    if (this.player.isMoving) return;

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
  }

  /**
   * Tells React when the player is on the move so the HUD can step aside.
   * Reported during scripted walks too, and held briefly past the end of a
   * step: a route walked one tile at a time is idle for a frame between tiles,
   * which would otherwise flicker whatever is listening.
   */
  private reportWalking(elapsed: number): void {
    if (this.player.isMoving) {
      this.walkIdleMs = 0;
      if (this.lastWalking) return;
      this.lastWalking = true;
      bus.emit({ type: "walking", walking: true });
      return;
    }

    if (!this.lastWalking) return;
    this.walkIdleMs += elapsed;
    if (this.walkIdleMs < WALK_SETTLE_MS) return;
    this.lastWalking = false;
    bus.emit({ type: "walking", walking: false });
  }

  /** Click or tap the world to walk there with the same collision-aware route. */
  private onPointerDown(event: PointerEvent): void {
    if (this.inputLocked) return;
    // Only primary clicks/taps move the player; secondary clicks and extra
    // fingers must not replace the route.
    if ("button" in event.nativeEvent && event.nativeEvent.button !== 0) return;
    if ("isPrimary" in event.nativeEvent && event.nativeEvent.isPrimary === false) return;
    // Pinch and other multi-finger gestures are not movement.
    if ("touches" in event.nativeEvent) {
      const touches = (event.nativeEvent as TouchEvent).touches;
      if (touches.length > 1) return;
    }

    const { x: wx, y: wy } = event.coordinates.worldPos;
    const goal = this.reachableTile({
      x: Math.floor(wx / TILE_SIZE),
      y: Math.floor(wy / TILE_SIZE),
    });
    if (!goal) return;

    const route = findPath(this.solid, this.player.grid, goal);
    if (!route?.length) return;
    void this.player.follow(route);
  }

  /**
   * Tapping a building, a person or the car should still walk the player over
   * rather than doing nothing, so solid tiles resolve to the closest free tile
   * beside them.
   */
  private reachableTile(tapped: GridPos): GridPos | null {
    if (isWalkable(this.solid, tapped)) return tapped;

    for (const location of Object.values(TOWN_LOCATIONS)) {
      if (Math.abs(tapped.x - location.at.x) <= 1 && Math.abs(tapped.y - location.at.y) <= 1) return { ...location.stand };
    }
    const landmark = this.rsaStreet.standFor(tapped);
    if (landmark) return landmark;

    const options = NEIGHBOURS.map((delta) => ({
      x: tapped.x + delta.x,
      y: tapped.y + delta.y,
    })).filter((pos) => isWalkable(this.solid, pos));
    if (!options.length) return null;

    const distance = (pos: GridPos) =>
      Math.abs(pos.x - this.player.grid.x) + Math.abs(pos.y - this.player.grid.y);
    return options.reduce((best, pos) =>
      distance(pos) < distance(best) ? pos : best,
    );
  }

  private async handle(command: EngineCommand): Promise<void> {
    if (isStreetCommand(command)) return this.rsaStreet.handle(command, (goal) => findPath(this.solid, this.player.grid, goal));
    switch (command.type) {
      case "lockInput":
        this.inputLocked = command.locked;
        if (command.locked) this.player.stop();
        else this.needsSpaceRelease = true;
        clearTouchInput();
        return;

      case "placePlayer": {
        const requested = Number.isFinite(command.at?.x) && Number.isFinite(command.at?.y) ? { x: Math.round(command.at.x), y: Math.round(command.at.y) } : PLAYER_SPAWN;
        const at = isWalkable(this.solid, requested) ? requested : PLAYER_SPAWN;
        this.player.stop(); this.player.grid = { ...at };
        this.player.pos = vec(tileCenter(at).x, tileCenter(at).y);
        this.player.face(command.facing);
        this.lastNear = null; this.lastTownNear = null; this.lastPosition = "";
        return;
      }
      case "townProgress":
        for (const label of this.markerLabels) {
          if (label.text === "Coin house") label.completed = command.coinComplete;
          if (label.text === "RSA · Talk to the client") { label.completed = command.rsaComplete; label.paused = command.rsaPaused && !command.rsaComplete; }
          if (label.text === "Thecap’s workshop") label.completed = command.groverComplete;
          if (label.text === "Casa Ofelia") label.completed = command.vaultComplete;
        }
        this.guideNext = !command.coinComplete ? "Who Goes First?" : !command.rsaComplete ? "Breaking RSA" : !command.groverComplete ? "Echo Chamber" : !command.vaultComplete ? "Operation Ghost Key" : null;
        this.markerLocale = "";
        return;
      case "track":
        this.tracked = command.target;
        this.beacon.graphics.visible = command.target !== null;
        return;
      case "reset":
        this.player.stop();
        this.rsaStreet.reset();
        this.needsSpaceRelease = false;
        this.lastWalking = false;
        this.walkIdleMs = 0;
        clearTouchInput();
        return;
    }
  }
}
