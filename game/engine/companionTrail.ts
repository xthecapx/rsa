interface Point { x: number; y: number }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
// Engine vectors expose x/y through getters, so object spreading loses them.
const point = (at: Point): Point => ({ x: at.x, y: at.y });

/** Follow the actual walked path, keeping a gap without cutting across corners. */
export class CompanionTrail {
  private points: Point[];
  private length = 0;

  constructor(at: Point, private readonly gap: number) { this.points = [point(at)]; }

  reset(at: Point): void { this.points = [point(at)]; this.length = 0; }

  follow(at: Point, travel: number): Point {
    const last = this.points[this.points.length - 1];
    const moved = distance(last, at);
    if (moved > 0) { this.points.push(point(at)); this.length += moved; }
    let remaining = Math.min(Math.max(0, travel), Math.max(0, this.length - this.gap));
    while (remaining > 0 && this.points.length > 1) {
      const from = this.points[0], to = this.points[1], segment = distance(from, to);
      const step = Math.min(segment, remaining);
      if (step >= segment) this.points.shift();
      else this.points[0] = { x: from.x + (to.x - from.x) * step / segment, y: from.y + (to.y - from.y) * step / segment };
      remaining -= step;
      this.length -= step;
    }
    return { ...this.points[0] };
  }
}
