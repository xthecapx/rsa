import { ImageSource, Loader, SpriteSheet } from "excalibur";

import { SHEET_COLUMNS, TILE_SIZE } from "./tiles";

export const images = {
  city: new ImageSource("/assets/kenney/city_tiles.png"),
  characters: new ImageSource("/assets/kenney/characters.png"),
  doctor: new ImageSource("/assets/characters/town-doctor.svg"),
  portraits: new ImageSource("/assets/kenney/portraits.png"),
};

/** Town neighbors, drawn by tools/gen_npc_sprites.cjs. */
export const NPC_IDS = ["mayor", "luz", "nico", "tomas", "marisol", "oscar", "warden", "vpcap", "rosa", "paco", "ines", "joaquin", "vera",
  "keepercap", "fausto", "candela", "rocio", "ramiro", "aurelio"] as const;
export type NpcSprite = (typeof NPC_IDS)[number];
export const ANIMAL_KINDS = ["cat", "dog", "pigeon", "duck", "bot", "crow", "bat"] as const;
export const animalImages = Object.fromEntries(ANIMAL_KINDS.map((kind) => [kind, new ImageSource(`/assets/characters/animal-${kind}.svg`)])) as Record<(typeof ANIMAL_KINDS)[number], ImageSource>;
export const PROP_SPRITES = ["stack-top", "stack-base", "silo-top", "silo-base", "belt", "crate", "press-top", "press-base", "crane-top", "crane-base", "sign",
  "grave", "cross", "deadtree-top", "deadtree-base", "pumpkin", "lantern", "crypt-top", "crypt-base", "bell-top", "bell-base", "candles"] as const;
export const propImages = Object.fromEntries(PROP_SPRITES.map((name) => [name, new ImageSource(`/assets/characters/prop-${name}.svg`)])) as Record<(typeof PROP_SPRITES)[number], ImageSource>;
export const npcImages = Object.fromEntries(NPC_IDS.map((id) => [id, new ImageSource(`/assets/characters/${id}.svg`)])) as Record<NpcSprite, ImageSource>;

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
  const loader = new Loader([...Object.values(images), ...Object.values(npcImages), ...Object.values(animalImages), ...Object.values(propImages)]);
  loader.suppressPlayButton = true;
  loader.backgroundColor = "#0b1f26";
  // React owns the visible loader. Keep any canvas fallback on-brand too.
  loader.logo = "/icons/icon-192.png";
  loader.logoWidth = 96;
  loader.logoHeight = 96;
  return loader;
}
