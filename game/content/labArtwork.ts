/** Kenney CC0 sheets shared by the cave furniture and outdoor demonstration tables. */
export const LAB_SHEETS = {
  indoors: { href: "/assets/kenney/lab/indoors.png", width: 458, height: 305 },
  caves: { href: "/assets/kenney/lab/caves.png", width: 492, height: 305 },
} as const;

export const LAB_TILES = {
  signpost: { col: 12, row: 16 },
  desk: [
    { col: 0, row: 1 },
    { col: 1, row: 1 },
    { col: 2, row: 1 },
  ],
  lamp: { col: 19, row: 5 },
  stool: { col: 17, row: 3 },
  plant: { col: 16, row: 0 },
} as const;
