import { Actor, Color, Font, FontUnit, GraphicsGroup, Rectangle, Text, vec } from "excalibur";
import { TILE_SIZE } from "../tiles";

/** A wooden street sign, or a plaque mounted on a house facade. */
export class TownSign extends Actor {
  private boardWidth = 0;
  private boardHeight = 0;
  constructor(x: number, y: number, private readonly mounted = false) {
    super({ pos: vec(x, y), z: 7 });
    this.graphics.anchor = vec(0.5, 1);
  }

  /** `locked` paints the board red, for a gate that is still closed. */
  setCaption(caption: string, completed = false, locked = false): void {
    const text = new Text({ text: caption, color: Color.fromHex(completed ? "#b8edce" : "#ffedbf"),
      font: new Font({ family: "monospace", size: 6, unit: FontUnit.Px }) });
    const width = Math.max(36, Math.ceil(text.width) + 12);
    const height = Math.ceil(text.height) + 8;
    this.boardWidth = width;
    this.boardHeight = height;
    this.graphics.use(new GraphicsGroup({ members: [
      ...(!this.mounted ? [{ graphic: new Rectangle({ width: 4, height: height + 12, color: Color.fromHex("#634431") }), offset: vec(width / 2 - 2, 0) }] : []),
      { graphic: new Rectangle({ width, height, color: Color.fromHex(locked ? "#7f1d1d" : "#483323"), strokeColor: Color.fromHex(locked ? "#fca5a5" : "#bf9664"), lineWidth: 1 }), offset: vec(0, 0) },
      { graphic: new Rectangle({ width: width - 4, height: 1, color: Color.fromHex("#896442") }), offset: vec(2, height - 3) },
      { graphic: text, offset: vec(6, 4) },
    ] }));
  }

  blockTiles(grid: boolean[][]): void {
    // House plaques are already on solid walls. Street signs block their board
    // and narrow post separately, leaving room to walk beside the post.
    if (this.mounted || !this.boardWidth) return;
    const left = this.pos.x - this.boardWidth / 2;
    const top = this.pos.y - this.boardHeight - 12;
    const block = (x: number, y: number, width: number, height: number) => {
      for (let row = Math.floor(y / TILE_SIZE); row < Math.ceil((y + height) / TILE_SIZE); row++) {
        for (let col = Math.floor(x / TILE_SIZE); col < Math.ceil((x + width) / TILE_SIZE); col++) {
          if (grid[row]?.[col] !== undefined) grid[row][col] = true;
        }
      }
    };
    block(left, top, this.boardWidth, this.boardHeight);
    block(this.pos.x - 2, top + this.boardHeight, 4, 12);
  }
}
