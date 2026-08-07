import { Color, DisplayMode, Engine } from "excalibur";

import { CityScene } from "./scenes/CityScene";
import { bus } from "./bus";
import { createLoader } from "./resources";

/**
 * React runs effects twice on mount in development, so a boot and a teardown
 * can overlap on the same canvas. Every create/dispose goes through one queue
 * and only the newest engine is kept, otherwise two engines end up sharing the
 * canvas and each frame is drawn twice.
 */
let queue: Promise<unknown> = Promise.resolve();
let current: Engine | null = null;

function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function teardown(engine: Engine): Promise<void> {
  bus.setCommandHandler(null);
  bus.drain();
  engine.stop();
  engine.dispose();
  if (current === engine) current = null;
}

/**
 * Excalibur touches `window` and `document`, so this module must only ever be
 * imported from a client component loaded with `ssr: false`.
 */
export function createGame(canvas: HTMLCanvasElement): Promise<Engine> {
  return serial(async () => {
    if (current) await teardown(current);

    const engine = new Engine({
      canvasElement: canvas,
      // 30 x 16 tiles of 16px, matching the street map exactly so the camera
      // bounds are never smaller than the viewport.
      resolution: { width: 480, height: 256 },
      displayMode: DisplayMode.FitContainer,
      pixelArt: true,
      suppressPlayButton: true,
      backgroundColor: Color.fromHex("#0b1f26"),
      scenes: { city: CityScene },
    });

    await engine.start("city", { loader: createLoader() });
    current = engine;
    return engine;
  });
}

export function disposeGame(engine: Engine | null): Promise<void> {
  return serial(async () => {
    // A stale generation losing the race must not tear down the live engine.
    if (!engine || engine !== current) return;
    await teardown(engine);
  });
}
