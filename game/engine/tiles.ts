/**
 * Named indices into public/assets/kenney/city_tiles.png (Kenney Roguelike
 * Modern City, tilemap_packed.png: 37 columns x 28 rows of 16px tiles, no
 * spacing). index = row * 37 + column.
 *
 * These are here so the map legend in maps/street.json stays readable; run
 * tools/preview_map.py after changing anything to see the result.
 */

export const SHEET_COLUMNS = 37;
export const TILE_SIZE = 16;

export const Ground = {
  GRASS: 888,
  GRASS_ALT: 889,
  SIDEWALK: 890,
  SIDEWALK_ALT: 891,
  DIRT: 892,
  SAND: 894,
  MANHOLE: 897,
  ROAD: 898,
  ROAD_CENTER_LINE: 716,
  CROSSWALK: 827,
} as const;

export const Brick = {
  RED_CORNICE_LEFT: 148,
  RED_CORNICE: 149,
  RED_CORNICE_RIGHT: 151,
  RED_LEFT: 185,
  RED: 186,
  RED_RIGHT: 188,
  TAN_CORNICE_LEFT: 156,
  TAN_CORNICE: 157,
  TAN_CORNICE_RIGHT: 159,
  TAN_LEFT: 193,
  TAN: 194,
  TAN_RIGHT: 196,
} as const;

export const Props = {
  WINDOW_GRAY: 691,
  WINDOW_GRAY_PANES: 728,
  WINDOW_WOOD: 580,
  WINDOW_WOOD_PANES: 617,
  GLASS_DOOR: 801,
  JUNCTION_BOX_TOP: 518,
  JUNCTION_BOX_BOTTOM: 555,
  STREET_LAMP_TOP: 593,
  STREET_LAMP_BOTTOM: 630,
  /** Top-left tile of the 2x2 top-down van used for the hacker's rig. */
  VAN_TOP_LEFT: 847,
} as const;
