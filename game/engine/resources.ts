import { ImageSource, Loader, SpriteSheet } from "excalibur";

import { SHEET_COLUMNS, TILE_SIZE } from "./tiles";

export const images = {
  city: new ImageSource("/assets/kenney/city_tiles.png"),
  characters: new ImageSource("/assets/kenney/characters.png"),
  portraits: new ImageSource("/assets/kenney/portraits.png"),
};

/** Kenney's packed city tilemap: 37 x 28 tiles of 16px, tightly packed. */
export const citySheet = SpriteSheet.fromImageSource({
  image: images.city,
  grid: {
    rows: 28,
    columns: SHEET_COLUMNS,
    spriteWidth: TILE_SIZE,
    spriteHeight: TILE_SIZE,
  },
});

/**
 * Generated overworld cast: 12 columns (4 directions x 3 frames) by 3 rows
 * (hacker, ale, brayan). See tools/gen_characters.py.
 */
export const CHARACTER_COLUMNS = 12;
export const characterSheet = SpriteSheet.fromImageSource({
  image: images.characters,
  grid: {
    rows: 3,
    columns: CHARACTER_COLUMNS,
    spriteWidth: TILE_SIZE,
    spriteHeight: TILE_SIZE,
  },
});

/** Kenney's character busts, used for dialog portraits. 1px between tiles. */
export const portraitSheet = SpriteSheet.fromImageSource({
  image: images.portraits,
  grid: {
    rows: 12,
    columns: 54,
    spriteWidth: TILE_SIZE,
    spriteHeight: TILE_SIZE,
  },
  spacing: { margin: { x: 1, y: 1 } },
});

export function citySprite(index: number) {
  return citySheet.getSprite(index % SHEET_COLUMNS, Math.floor(index / SHEET_COLUMNS));
}

export function createLoader(): Loader {
  const loader = new Loader(Object.values(images));
  loader.suppressPlayButton = true;
  loader.backgroundColor = "#0b1f26";
  // React owns the visible loader. Keep any canvas fallback on-brand too.
  loader.logo = "/icons/icon-192.png";
  loader.logoWidth = 96;
  loader.logoHeight = 96;
  return loader;
}
