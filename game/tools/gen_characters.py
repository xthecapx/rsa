#!/usr/bin/env python3
"""Generate the overworld walk spritesheet at public/assets/kenney/characters.png.

Kenney's Roguelike Characters pack is a set of front-facing busts, so it cannot
drive a four-direction overworld. This script draws the three cast members in
the same 16x16 pixel idiom as the Kenney city tiles.

Sheet layout: 12 columns x 3 rows of 16x16 tiles, no spacing.
  rows    -> hacker, ale, brayan
  columns -> down[3], up[3], left[3], right[3]  (frames: step A, idle, step B)

Run:  python3 tools/gen_characters.py
"""
from pathlib import Path

from PIL import Image

TS = 16
OUT = Path(__file__).resolve().parent.parent / "public/assets/kenney/characters.png"

# Legs are swapped in per frame so the walk cycle reads at 4x zoom.
LEGS = {
    "idle": ["....oppooppo....", "....obboobbo...."],
    "a": ["....oppooppo....", "....obbo........"],
    "b": ["....oppooppo....", "........obbo...."],
}

DOWN = [
    "................",
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "....hhhhhhhh....",
    "....hssssssh....",
    "....hsessesh....",
    "....osssssso....",
    ".....osssso.....",
    "....occcccco....",
    "...soccccccos...",
    "....occcccco....",
    "....oCCCCCCo....",
    "....oppppppo....",
]

UP = [
    "................",
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "....hhhhhhhh....",
    "....hhhhhhhh....",
    "....hhhhhhhh....",
    "....ohhhhhho....",
    ".....ohhhho.....",
    "....occcccco....",
    "...soccccccos...",
    "....occcccco....",
    "....oCCCCCCo....",
    "....oppppppo....",
]

RIGHT = [
    "................",
    "................",
    ".....oooooo.....",
    "....ohhhhhho....",
    "....hhhhhhho....",
    "....hhssssso....",
    "....hhssseso....",
    "....ohssssso....",
    ".....osssso.....",
    "....occcccco....",
    "....occccccos...",
    "....occcccco....",
    "....oCCCCCCo....",
    "....oppppppo....",
]

# The hacker wears a hood, so the face sits in shadow instead of showing eyes.
HACKER_OVERRIDES = {
    "down": {5: "....hhhhhhhh....", 6: "....hHseesHh....", 7: "....ohssssho...."},
    "up": {},
    "right": {5: "....hhhhhssh....", 6: "....hhHsseHo....", 7: "....ohssssho...."},
    "left": {5: "....hhhhhssh....", 6: "....hhHsseHo....", 7: "....ohssssho...."},
}

PALETTES = {
    "hacker": {
        "o": "#161a20",
        "h": "#3a3f52",
        "H": "#262b3a",
        "s": "#d8a273",
        "e": "#fb7185",
        "c": "#2f3b45",
        "C": "#1c242b",
        "p": "#232a31",
        "b": "#12161a",
    },
    "ale": {
        "o": "#16202a",
        "h": "#f2c14e",
        "H": "#c99a2e",
        "s": "#f0c8a0",
        "e": "#16202a",
        "c": "#38bdf8",
        "C": "#1f8fc4",
        "p": "#2c3e50",
        "b": "#1a2632",
    },
    "brayan": {
        "o": "#1a2016",
        "h": "#6b4a2f",
        "H": "#4a3220",
        "s": "#d9a066",
        "e": "#1a2016",
        "c": "#a3e635",
        "C": "#74a821",
        "p": "#3b3b3b",
        "b": "#1f1f1f",
    },
}


def hex_rgba(value: str) -> tuple[int, int, int, int]:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


def draw(pattern: list[str], palette: dict[str, str], flip: bool) -> Image.Image:
    tile = Image.new("RGBA", (TS, TS), (0, 0, 0, 0))
    px = tile.load()
    for y, line in enumerate(pattern):
        if y >= TS:
            break
        for x, ch in enumerate(line[:TS]):
            if ch == ".":
                continue
            colour = palette.get(ch)
            if colour is None:
                continue
            px[x, y] = hex_rgba(colour)
    if flip:
        tile = tile.transpose(Image.FLIP_LEFT_RIGHT)
    return tile


def build() -> Image.Image:
    names = ["hacker", "ale", "brayan"]
    dirs = [("down", DOWN, False), ("up", UP, False), ("left", RIGHT, True), ("right", RIGHT, False)]
    frames = ["a", "idle", "b"]

    sheet = Image.new("RGBA", (TS * 12, TS * len(names)), (0, 0, 0, 0))
    for row, name in enumerate(names):
        palette = PALETTES[name]
        for d, (dir_name, body, flip) in enumerate(dirs):
            for f, frame in enumerate(frames):
                pattern = list(body) + LEGS[frame]
                overrides = HACKER_OVERRIDES.get(dir_name) if name == "hacker" else None
                if overrides:
                    for y, line in overrides.items():
                        pattern[y] = line
                tile = draw(pattern, palette, flip)
                sheet.paste(tile, ((d * 3 + f) * TS, row * TS), tile)
    return sheet


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    build().save(OUT)
    print(f"wrote {OUT}")
