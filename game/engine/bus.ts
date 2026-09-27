import type { TownTarget, WorldFacing } from "@/content/town";
import type { Landmark } from "./maps/street";

export type { Landmark };

/**
 * The only channel between React and Excalibur. React sends commands and
 * awaits them; the scene reports player interactions back. Neither side
 * imports the other's modules.
 */

export type PacketStyle = "plain" | "caesar" | "rsa" | "key" | "quantum";

export type EngineCommand =
  | { type: "walkTo"; target: Landmark }
  | { type: "face"; target: Landmark }
  | { type: "packet"; style: PacketStyle; from: Landmark; to: Landmark; intercept: boolean }
  | { type: "bubble"; actor: "ale" | "brayan" | "hacker"; face: BubbleKind }
  | { type: "tapGlow"; on: boolean }
  | { type: "lockInput"; locked: boolean }
  | { type: "reset" }
  | { type: "placePlayer"; at: { x: number; y: number }; facing: WorldFacing }
  | { type: "townProgress"; coinComplete: boolean; rsaComplete: boolean; rsaPaused: boolean }
  | { type: "track"; target: TownTarget | "car" | "tap" | "ale" | "brayan" | null };

export type BubbleKind = "none" | "question" | "alert" | "success";

export type EngineEvent =
  | { type: "ready" }
  | { type: "townMoved"; near: TownTarget | null }
  | { type: "townInteract"; target: TownTarget }
  | { type: "position"; at: { x: number; y: number }; facing: WorldFacing }
  | { type: "interact"; target: Landmark }
  | { type: "moved"; near: Landmark | null }
  | { type: "walking"; walking: boolean };

type CommandEnvelope = { id: number; command: EngineCommand };
type CommandHandler = (command: EngineCommand) => void | Promise<void>;
type EventHandler = (event: EngineEvent) => void;

class GameBus {
  private commandHandler: CommandHandler | null = null;
  private eventHandlers = new Set<EventHandler>();
  private pending = new Map<number, () => void>();
  private queue: CommandEnvelope[] = [];
  private nextId = 1;

  /** Called by the scene once it is running. */
  setCommandHandler(handler: CommandHandler | null): void {
    this.commandHandler = handler;
    if (!handler) return;
    const queued = this.queue.splice(0);
    for (const envelope of queued) void this.dispatch(envelope);
  }

  /** Send a command and resolve once the scene has finished acting on it. */
  send(command: EngineCommand): Promise<void> {
    const id = this.nextId++;
    const envelope = { id, command };
    const done = new Promise<void>((resolve) => this.pending.set(id, resolve));
    if (this.commandHandler) {
      void this.dispatch(envelope);
    } else {
      this.queue.push(envelope);
    }
    return done;
  }

  private async dispatch(envelope: CommandEnvelope): Promise<void> {
    try {
      await this.commandHandler?.(envelope.command);
    } finally {
      this.pending.get(envelope.id)?.();
      this.pending.delete(envelope.id);
    }
  }

  emit(event: EngineEvent): void {
    for (const handler of this.eventHandlers) handler(event);
  }

  on(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /** Resolve everything in flight; used when a scene is torn down. */
  drain(): void {
    for (const resolve of this.pending.values()) resolve();
    this.pending.clear();
    this.queue = [];
  }
}

export const bus = new GameBus();
