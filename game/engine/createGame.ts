import { Color, DisplayMode, Engine } from "excalibur";

import { CityScene } from "./scenes/CityScene";
import { bus } from "./bus";
import { createLoader } from "./resources";

/**
 * React runs effects twice on mount in development, so a boot and a teardown
 * can overlap. Every create/dispose goes through one queue and only the newest
 * engine is kept, otherwise two engines end up sharing the canvas and each
 * frame is drawn twice.
 */
let queue: Promise<unknown> = Promise.resolve();
let current: LiveGame | null = null;

interface LiveGame {
  engine: Engine;
  canvas: HTMLCanvasElement;
}

function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function teardown(live: LiveGame): Promise<void> {
  bus.setCommandHandler(null);
  bus.drain();
  live.engine.stop();
  live.engine.input?.pointers?.detach();
  live.engine.input?.toggleEnabled(false);
  live.engine.dispose();

  // Excalibur attaches pointer listeners to the canvas more than once and
  // detaches only the most recent set, and dispose() nulls the screen's canvas
  // reference. Any surviving listener would then throw on the next mouse move,
  // so throw the element away too: a detached node receives no events.
  live.canvas.remove();

  if (current === live) current = null;
}

/**
 * Phones get a fraction of the width a desktop sidebar layout leaves for the
 * street, so letterboxing it to fit would leave the sprites too small to read.
 * Zooming instead keeps the tiles legible and lets the camera pan, at the cost
 * of some map being off screen. Pointer type is fixed for the life of the tab,
 * so this never has to change mid-session.
 */
function displayModeForDevice(): DisplayMode {
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches;
  return coarse ? DisplayMode.FitContainerAndZoom : DisplayMode.FitContainer;
}

/**
 * Excalibur touches `window` and `document`, so this module must only ever be
 * imported from a client component loaded with `ssr: false`.
 *
 * The canvas is created here rather than rendered by React because each engine
 * needs an element of its own to leave its listeners on.
 */
export function createGame(container: HTMLElement): Promise<Engine> {
  return serial(async () => {
    if (current) await teardown(current);

    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    const engine = new Engine({
      canvasElement: canvas,
      // 30 x 16 tiles of 16px, matching the street map exactly so the camera
      // bounds are never smaller than the viewport.
      resolution: { width: 480, height: 256 },
      displayMode: displayModeForDevice(),
      pixelArt: true,
      suppressPlayButton: true,
      backgroundColor: Color.fromHex("#0b1f26"),
      scenes: { city: CityScene },
    });

    const live = { engine, canvas };
    current = live;
    try {
      await engine.start("city", { loader: createLoader() });
      return engine;
    } catch (error) {
      await teardown(live);
      throw error;
    }
  });
}

export function disposeGame(engine: Engine | null): Promise<void> {
  return serial(async () => {
    // A stale generation losing the race must not tear down the live engine.
    if (!engine || current?.engine !== engine) return;
    await teardown(current);
  });
}
