import { Actor, Canvas, vec } from "excalibur";
import { LAB_TILES } from "@/content/labArtwork";
import type { CampusStandSpec } from "@/content/campusStands";
import { images, propImages } from "../resources";
import { tileCenter } from "../maps/street";

type Context = CanvasRenderingContext2D;

function tile(ctx: Context, col: number, row: number, x: number, y: number) {
  ctx.drawImage(images.indoors.image, col * 17, row * 17, 16, 16, x, y, 16, 16);
}
function furniture(
  ctx: Context,
  part: keyof Omit<typeof LAB_TILES, "desk">,
  x: number,
  y: number,
) {
  const { col, row } = LAB_TILES[part];
  tile(ctx, col, row, x, y);
}
function prop(ctx: Context, name: keyof typeof propImages, x: number, y: number, size = 16) {
  ctx.drawImage(propImages[name].image, x, y, size, size);
}
function line(ctx: Context, color: string, points: number[][]) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function circle(
  ctx: Context,
  color: string,
  x: number,
  y: number,
  radius: number,
  fill = false,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = ctx.fillStyle = color;
  if (fill) ctx.fill();
  else ctx.stroke();
}
function display(
  ctx: Context,
  color: string,
  x: number,
  y: number,
  draw: () => void,
) {
  ctx.fillStyle = "#705c48";
  ctx.fillRect(x + 6, y + 15, 3, 13);
  ctx.fillStyle = "#e4d9b6";
  ctx.fillRect(x - 2, y - 2, 20, 20);
  ctx.fillStyle = "#183c43";
  ctx.fillRect(x, y, 16, 16);
  ctx.strokeStyle = color;
  ctx.strokeRect(x, y, 16, 16);
  draw();
}

/** Cached pixel composition: lab furniture plus small experiment-specific apparatus.
 * Its coordinates match CAMPUS_FURNITURE; all interaction stays with the host.
 */
export class CampusStand extends Actor {
  constructor(stand: CampusStandSpec) {
    const at = tileCenter(stand.at);
    super({
      name: `campus-stand-${stand.id}`,
      pos: vec(at.x - 56, at.y - 56),
      z: 2,
    });
    this.graphics.anchor = vec(0, 0);
    this.graphics.use(
      new Canvas({
        width: 112,
        height: 64,
        cache: true,
        smoothing: false,
        draw: (ctx) => this.drawStand(ctx, stand),
      }),
    );
  }

  private drawStand(ctx: Context, { id, color, number }: CampusStandSpec) {
    ctx.imageSmoothingEnabled = false;
    // Woven rugs stop short of the aisle. Grass stays visible between every stand.
    ctx.fillStyle = "#173c3540";
    ctx.fillRect(5, 18, 104, 45);
    ctx.fillStyle = id === "quiet" ? "#546e63" : "#d9c7a0";
    ctx.fillRect(4, 16, 104, 45);
    ctx.fillStyle = color;
    ctx.fillRect(6, 18, 100, 2);
    ctx.fillRect(6, 57, 100, 2);
    for (let x = 6; x < 108; x += 4) {
      ctx.fillRect(x, 14, 2, 2);
      ctx.fillRect(x, 61, 2, 2);
    }
    ctx.fillStyle = "#fff3d32b";
    for (let x = 9; x < 104; x += 8) ctx.fillRect(x, 22, 1, 33);
    // Suspended pennants, not a roof: the equipment remains visible from above.
    line(ctx, "#746e57", [
      [4, 3],
      [28, 6],
      [56, 7],
      [84, 6],
      [108, 3],
    ]);
    for (let x = 8; x < 108; x += 10) {
      const y = x < 28 || x > 88 ? 4 : 6;
      ctx.fillStyle = ((x / 10) | 0) % 2 ? color : "#f5e2ad";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 7, y);
      ctx.lineTo(x + 3, y + 7);
      ctx.fill();
    }
    // The same real Kenney table used in the cave; a runner makes each host's own.
    ctx.fillStyle = "#18362d4d";
    ctx.fillRect(30, 35, 54, 14);
    LAB_TILES.desk.forEach(({ col, row }, i) =>
      tile(ctx, col, row, 32 + i * 16, 32),
    );
    ctx.fillStyle = color;
    ctx.fillRect(47, 33, 18, 11);
    ctx.fillStyle = "#fff1cf";
    ctx.fillRect(47, 43, 18, 2);
    // Every stand visibly lends a computer. No experiments run in this drawing.
    prop(ctx, "crt", 48, 23);
    ctx.fillStyle = "#d2d6c1";
    ctx.fillRect(51, 38, 10, 3);
    ctx.fillStyle = "#24484b";
    ctx.fillRect(52, 39, 8, 1);

    switch (id) {
      case "qubit":
        prop(ctx, "crate", 16, 32);
        furniture(ctx, "lamp", 16, 15);
        display(ctx, color, 80, 17, () => {
          line(ctx, color, [
            [82, 25],
            [94, 25],
          ]);
          for (const [x, c] of [
            [82, "#df9f6b"],
            [87, "#78bfab"],
            [92, "#e7cd76"],
          ] as const) {
            ctx.fillStyle = c;
            ctx.fillRect(x, 22, 3, 6);
          }
        });
        break;
      case "passports":
        // A globe on a Kenney pedestal, with printed passports beside the laptop.
        furniture(ctx, "stool", 16, 32);
        circle(ctx, "#365f73", 24, 25, 10, true);
        circle(ctx, color, 24, 25, 10);
        ctx.beginPath();
        ctx.ellipse(24, 25, 4, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(24, 25, 10, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        line(ctx, "#ffe4a5", [
          [24, 25],
          [29, 18],
        ]);
        tile(ctx, 8, 0, 80, 28);
        display(ctx, color, 80, 17, () => {
          line(ctx, color, [
            [83, 20],
            [82, 20],
            [82, 29],
            [83, 29],
          ]);
          line(ctx, color, [
            [93, 20],
            [94, 20],
            [94, 29],
            [93, 29],
          ]);
          ctx.fillStyle = "#eadbb6";
          ctx.fillRect(86, 22, 5, 1);
          ctx.fillRect(86, 26, 5, 1);
        });
        break;
      case "delivery":
        prop(ctx, "crate", 16, 17);
        prop(ctx, "crate", 18, 31);
        prop(ctx, "belt", 80, 31);
        display(ctx, color, 80, 17, () => {
          line(ctx, color, [
            [82, 25],
            [94, 25],
            [91, 22],
          ]);
          line(ctx, color, [
            [94, 25],
            [91, 28],
          ]);
        });
        ctx.fillStyle = "#e9e4c7";
        ctx.fillRect(34, 35, 7, 5);
        ctx.fillRect(70, 35, 7, 5);
        break;
      case "fountain":
        circle(ctx, "#697f7e", 24, 30, 13, true);
        circle(ctx, "#c2cbb8", 24, 28, 13, true);
        circle(ctx, "#4e9cae", 24, 28, 10, true);
        circle(ctx, "#a9eeeb", 24, 28, 7);
        circle(ctx, "#a9eeeb", 24, 28, 3);
        line(ctx, "#daf7f1", [
          [24, 28],
          [24, 17],
          [21, 14],
        ]);
        circle(ctx, "#eef7d8", 24, 15, 2, true);
        furniture(ctx, "lamp", 80, 29);
        display(ctx, color, 80, 17, () => {
          line(ctx, color, [
            [82, 25],
            [85, 21],
            [88, 25],
            [91, 29],
            [94, 25],
          ]);
          line(ctx, "#eadbb6", [
            [82, 25],
            [85, 29],
            [88, 25],
            [91, 21],
            [94, 25],
          ]);
        });
        break;
      case "observatory":
        line(ctx, "#737ab7", [
          [23, 38],
          [23, 47],
          [88, 47],
          [88, 38],
        ]);
        prop(ctx, "antenna-base", 16, 31);
        prop(ctx, "dish", 16, 15);
        prop(ctx, "antenna-base", 80, 31);
        prop(ctx, "dish", 80, 15);
        for (const [x, y] of [
          [35, 25],
          [73, 22],
          [36, 50],
          [76, 53],
        ]) {
          line(ctx, "#f4e6bf", [
            [x - 2, y],
            [x + 2, y],
          ]);
          line(ctx, "#f4e6bf", [
            [x, y - 2],
            [x, y + 2],
          ]);
        }
        break;
      case "arcade":
        prop(ctx, "arcade", 14, 16, 20);
        furniture(ctx, "stool", 16, 36);
        display(ctx, color, 80, 17, () => {
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 ? "#f3cf75" : color;
            ctx.fillRect(82 + i * 3, 30 - (i + 1) * 3, 2, (i + 1) * 3);
          }
        });
        ctx.fillStyle = "#f3e8c5";
        ctx.fillRect(69, 34, 7, 7);
        line(ctx, "#cc8fa3", [
          [71, 36],
          [74, 36],
          [74, 39],
          [71, 39],
        ]);
        break;
      case "quiet":
        furniture(ctx, "plant", 14, 16);
        furniture(ctx, "plant", 18, 32);
        furniture(ctx, "lamp", 80, 29);
        display(ctx, color, 80, 17, () => {
          line(ctx, color, [
            [84, 20],
            [92, 20],
            [92, 26],
            [88, 30],
            [84, 26],
            [84, 20],
          ]);
          circle(ctx, "#f3e6b7", 88, 24, 2, true);
        });
        ctx.fillStyle = "#a1caba80";
        ctx.fillRect(34, 30, 9, 11);
        ctx.strokeStyle = "#edf5d2";
        ctx.strokeRect(34, 30, 9, 11);
        break;
      case "rotations":
        prop(ctx, "rack", 16, 16);
        prop(ctx, "press-base", 16, 32);
        furniture(ctx, "stool", 80, 32);
        circle(ctx, "#6f7668", 88, 25, 10, true);
        circle(ctx, color, 88, 25, 9);
        circle(ctx, "#f4e9be", 88, 25, 2, true);
        line(ctx, "#f4e9be", [
          [88, 25],
          [94, 19],
        ]);
        for (const [x, y] of [
          [88, 17],
          [96, 25],
          [88, 33],
          [80, 25],
        ])
          circle(ctx, color, x, y, 1, true);
        break;
      case "festival":
        prop(ctx, "djbooth", 16, 23);
        prop(ctx, "rack", 80, 20);
        furniture(ctx, "plant", 16, 36);
        furniture(ctx, "plant", 80, 36);
        for (const [x, y] of [
          [35, 25],
          [75, 25],
          [36, 49],
          [76, 49],
        ]) {
          circle(ctx, "#f1cb79", x, y, 3, true);
          circle(ctx, "#eb9dad", x, y, 1, true);
        }
        break;
    }
    // Numbered floor pennants are legible without embedding language in art.
    ctx.fillStyle = color;
    ctx.fillRect(7, 45, 10, 12);
    ctx.fillStyle = "#233e43";
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillText(id === "festival" ? "F" : String(number), 12, 54);
  }
}
