import { Actor, Circle, Color, GraphicsGroup, Sprite, vec } from "excalibur";
import { LAB_ENTRANCES, type LabTown } from "@/content/labEntrances";
import { t, useLocale } from "@/i18n";
import { citySprite, images } from "../resources";
import { tileCenter } from "../maps/street";
import { TownSign } from "./TownSign";

/** Kenney sand, loose stones and a stone arch. React owns saved discovery. */
export class LabEntrance extends Actor {
  readonly sign: TownSign;
  private revealed = false;
  private initialized = false;
  private locale = "";
  private dust = 0;
  private readonly dustPuff = new Actor({ z: 4 });
  constructor(where: LabTown) {
    const at = tileCenter(LAB_ENTRANCES[where].at);
    super({ name: "lab-entrance", pos: vec(at.x, at.y), z: 3 });
    this.dustPuff.graphics.use(
      new Circle({ radius: 9, color: Color.fromHex("#dfc7a1") }),
    );
    this.dustPuff.graphics.visible = false;
    this.addChild(this.dustPuff);
    this.sign = new TownSign(at.x, at.y - 15, true);
    this.sign.z = 30;
    this.sign.graphics.visible = false;
  }
  private stone(col: number, row: number, size: number) {
    return new Sprite({
      image: images.caves,
      sourceView: { x: col * 17, y: row * 17, width: 16, height: 16 },
      destSize: { width: size, height: size },
    });
  }
  setRevealed(revealed: boolean): void {
    if (
      this.initialized &&
      revealed &&
      !this.revealed &&
      !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      this.dust = 500;
    this.revealed = revealed;
    this.initialized = true;
    this.sign.graphics.visible = revealed;
    this.graphics.use(
      new GraphicsGroup({
        members: revealed
          ? Array.from({ length: 9 }, (_, index) => ({
              graphic: this.stone(
                21 + (index % 3),
                10 + Math.floor(index / 3),
                9,
              ),
              offset: vec(
                -13.5 + (index % 3) * 9,
                -16.5 + Math.floor(index / 3) * 9,
              ),
            }))
          : [
              { graphic: citySprite(894), offset: vec(-8, -8) },
              { graphic: this.stone(0, 0, 10), offset: vec(-9, -6) },
              { graphic: this.stone(0, 1, 8), offset: vec(1, -1) },
            ],
      }),
    );
    this.graphics.anchor = vec(0, 0);
  }
  override onInitialize(): void {
    this.setRevealed(false);
    this.initialized = false;
  }
  override onPreUpdate(_engine: unknown, elapsed: number): void {
    const locale = useLocale.getState().locale;
    if (locale !== this.locale) {
      this.locale = locale;
      this.sign.setCaption(t("Personal quantum lab"));
    }
    if (this.dust > 0) {
      this.dust = Math.max(0, this.dust - elapsed);
      // A translucent dust puff clears without delaying discovery or input.
      this.dustPuff.graphics.opacity = this.dust / 1000;
      this.dustPuff.graphics.visible = this.dust > 0;
      this.dustPuff.scale = vec(1 + (500 - this.dust) / 500, 0.5);
    }
  }
}
