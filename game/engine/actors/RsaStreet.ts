import { vec, type Scene } from "excalibur";

import { gameAudio } from "@/game/audio";
import type { EngineCommand, Landmark } from "../bus";
import { LANDMARKS, PARKING_BAYS, assignClientCar, landmarkAt, landmarkCenter, tileCenter, type GridPos } from "../maps/street";
import { TILE_SIZE } from "../tiles";
import { Character, type CastMember } from "./Character";
import { Bubble, Packet, ParkedCar, TapGlow, Wire, createParkedCar } from "./Props";

/** Commands the street answers; everything else stays with the scene. */
type StreetCommand = Extract<EngineCommand, { type: "walkTo" | "face" | "bubble" | "tapGlow" | "packet" }>;
const STREET_COMMANDS = new Set<string>(["walkTo", "face", "bubble", "tapGlow", "packet"]);
export function isStreetCommand(command: EngineCommand): command is StreetCommand { return STREET_COMMANDS.has(command.type); }

/**
 * Ale and Brayan's street: the parked cars with the client's among them, the
 * tapped line with its junction box, the two of them at their windows and the
 * packet that runs along the wire. Any scene whose map carries `street.json`
 * at RSA_OFFSET can mount it, so the RSA acts play the same in every town.
 */
export class RsaStreet {
  readonly cast = {} as Record<CastMember, Character>;
  private bubbles = {} as Record<CastMember, Bubble>;
  private packet!: Packet;
  private tapGlow!: TapGlow;
  private parkedCars: ParkedCar[] = [];
  private clientCar!: ParkedCar;
  private clientCarFound = false;
  private alive = false;

  constructor(private readonly scene: Scene, private readonly player: Character) {
    this.cast.hacker = player;
  }

  /** Cars and the junction-box glow sit under the people; Ale, Brayan, bubbles and the packet over them. */
  mountGround(): void {
    this.alive = true;
    this.parkedCars = PARKING_BAYS.map((bay) => createParkedCar({ ...bay, paint: "slate" }));
    for (const car of this.parkedCars) this.scene.add(car);
    this.configureClientCar();
    this.tapGlow = new TapGlow(landmarkCenter("tap"));
    this.scene.add(this.tapGlow);
  }

  mountPeople(): void {
    this.cast.ale = new Character("ale", LANDMARKS.ale.at, "down");
    this.cast.brayan = new Character("brayan", LANDMARKS.brayan.at, "down");
    this.scene.add(this.cast.ale); this.scene.add(this.cast.brayan);
    for (const member of ["hacker", "ale", "brayan"] as CastMember[]) {
      const bubble = new Bubble();
      this.bubbles[member] = bubble;
      this.scene.add(bubble);
    }
    this.packet = new Packet();
    this.packet.graphics.visible = false;
    this.scene.add(this.packet);
    // The tapped line runs above the sidewalk from Ale's window, past the junction box, to Brayan's.
    this.scene.add(new Wire([LANDMARKS.ale.at, { x: LANDMARKS.tap.at.x - 4, y: LANDMARKS.tap.at.y }, LANDMARKS.tap.at, { x: LANDMARKS.tap.at.x + 3, y: LANDMARKS.tap.at.y }, LANDMARKS.brayan.at]));
    this.clientCar.setHighlighted(true);
  }

  /** Parked cars and the cast are actors rather than tiles, so block them by hand. */
  static block(grid: boolean[][]): void {
    for (const bay of PARKING_BAYS) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      if (grid[bay.at.y + dy]?.[bay.at.x + dx] !== undefined) grid[bay.at.y + dy][bay.at.x + dx] = true;
    }
    for (const key of ["ale", "brayan"] as const) grid[LANDMARKS[key].at.y][LANDMARKS[key].at.x] = true;
  }

  /** The landmark beside the player; finding the client's car lights it up. */
  near(pos: GridPos): Landmark | null {
    const near = landmarkAt(pos);
    if (near === "car" && !this.clientCarFound) { this.clientCarFound = true; this.clientCar.setHighlighted(true); }
    return near;
  }

  /** Tapping a building, a person or the car walks to the landmark's stand. */
  standFor(tapped: GridPos): GridPos | null {
    for (const key of Object.keys(LANDMARKS) as Landmark[]) {
      const { at, size } = LANDMARKS[key];
      if (tapped.x >= at.x && tapped.x < at.x + size.w && tapped.y >= at.y && tapped.y < at.y + size.h) return LANDMARKS[key].stand;
    }
    return null;
  }

  reset(): void {
    this.packet.hide();
    this.tapGlow.setActive(false);
    this.clientCar.setHighlighted(true);
    for (const bubble of Object.values(this.bubbles)) bubble.hide();
  }

  deactivate(): void {
    this.alive = false;
    this.packet.hide();
  }

  async handle(command: StreetCommand, route: (goal: GridPos) => GridPos[] | null): Promise<void> {
    switch (command.type) {
      case "face":
        this.player.faceTowards(LANDMARKS[command.target].at);
        return;
      case "walkTo": {
        const path = route(LANDMARKS[command.target].stand);
        if (path?.length) await this.player.follow(path);
        this.player.faceTowards(LANDMARKS[command.target].at);
        return;
      }
      case "bubble":
        this.bubbles[command.actor].showAbove(this.cast[command.actor].pos, command.face);
        return;
      case "tapGlow":
        this.tapGlow.setActive(command.on);
        return;
      case "packet":
        await this.runPacket(command);
        return;
    }
  }

  /** Assign the stable client bay when a world instance starts. */
  private configureClientCar(): void {
    this.clientCarFound = false;
    const { clientIndex, paints } = assignClientCar();
    this.parkedCars.forEach((car, i) => car.setPaint(paints[i]));
    this.clientCar = this.parkedCars[clientIndex];
  }

  private async runPacket(command: Extract<EngineCommand, { type: "packet" }>): Promise<void> {
    const from = LANDMARKS[command.from].at;
    const to = LANDMARKS[command.to].at;
    const tap = LANDMARKS.tap.at;
    const wireY = tileCenter(from).y + TILE_SIZE * 0.15;
    const point = (pos: GridPos) => vec(tileCenter(pos).x, wireY);

    this.packet.show(command.style, point(from));
    gameAudio.playSynth("wire");
    const legDuration = 900;
    if (command.intercept) {
      await this.packet.travelTo(point(tap), legDuration);
      if (!this.alive) return;
      this.tapGlow.setActive(true);
      gameAudio.playSynth("capture");
      this.bubbles.hacker.showAbove(this.player.pos, "success");
      await wait(520);
      if (!this.alive) return;
      this.bubbles.hacker.hide();
      await this.packet.travelTo(point(to), legDuration);
    } else {
      await this.packet.travelTo(point(to), legDuration * 1.6);
    }
    if (!this.alive) return;
    await wait(220);
    if (!this.alive) return;
    this.packet.hide();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
