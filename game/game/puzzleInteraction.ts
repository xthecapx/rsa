interface DragManager {
  actions: { stop: (options: { canceled: boolean }) => void };
  dragOperation: { status: { idle: boolean } };
}

/** Owns the input guard and deferred drop for one mounted circuit builder. */
export class PuzzleInteraction {
  private suppressedUntil = 0;
  private generation = 0;
  private frame: number | null = null;
  private manager: DragManager | null = null;

  constructor(
    private readonly clock = {
      now: () => performance.now(),
      request: (callback: () => void) => requestAnimationFrame(callback),
      cancel: (frame: number) => cancelAnimationFrame(frame),
    },
  ) {}

  canClick = () => this.clock.now() > this.suppressedUntil;

  start(manager: DragManager) {
    this.manager = manager;
    this.suppressedUntil = Infinity;
  }

  end() {
    this.suppressedUntil = this.clock.now() + 250;
  }

  placeWhenIdle(manager: DragManager, place: () => void) {
    const generation = this.generation;
    const finish = () => {
      if (generation !== this.generation) return;
      if (manager.dragOperation.status.idle) {
        this.frame = null;
        place();
      } else this.frame = this.clock.request(finish);
    };
    finish();
  }

  reset() {
    // Invalidate old drops before canceling: stop can synchronously emit dragend.
    this.dispose();
    this.manager?.actions.stop({ canceled: true });
    this.manager = null;
    this.suppressedUntil = -Infinity;
  }

  dispose() {
    this.generation++;
    if (this.frame !== null) this.clock.cancel(this.frame);
    this.frame = null;
  }
}
