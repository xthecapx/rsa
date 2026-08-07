#!/usr/bin/env python3
"""Render engine/maps/street.json to a PNG so tile picks can be eyeballed.

Run:  python3 tools/preview_map.py [out.png] [scale]
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

data = json.loads((ROOT / "engine/maps/street.json").read_text())
sheet = Image.open(ROOT / "public/assets/kenney/city_tiles.png").convert("RGBA")
chars = Image.open(ROOT / "public/assets/kenney/characters.png").convert("RGBA")

TS = data["tileSize"]
SHEET_COLS = data["sheetColumns"]
W, H = data["width"], data["height"]

out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/street_preview.png")
scale = int(sys.argv[2]) if len(sys.argv) > 2 else 4


def sprite(idx: int) -> Image.Image:
    sx, sy = (idx % SHEET_COLS) * TS, (idx // SHEET_COLS) * TS
    return sheet.crop((sx, sy, sx + TS, sy + TS))


def paint(layer_key: str, legend_key: str, canvas: Image.Image) -> None:
    legend = data[legend_key]
    for y, row in enumerate(data[layer_key]):
        assert len(row) == W, f"{layer_key} row {y} is {len(row)} chars, expected {W}"
        for x, ch in enumerate(row):
            assert ch in legend, f"{layer_key} row {y} col {x}: no legend entry for {ch!r}"
            entry = legend[ch]
            if entry is None:
                continue
            tile = sprite(entry["tile"])
            canvas.paste(tile, (x * TS, y * TS), tile)


canvas = Image.new("RGBA", (W * TS, H * TS), (12, 16, 22, 255))
paint("rows", "legend", canvas)
paint("overlay", "overlayLegend", canvas)

# Drop the cast in so the scale of the sprites against the buildings is visible.
for row, (tx, ty) in enumerate([(19, 12), (7, 5), (29, 5)]):
    tile = chars.crop((16, row * 16, 32, row * 16 + 16))
    canvas.paste(tile, (tx * TS, ty * TS), tile)

canvas = canvas.resize((canvas.width * scale, canvas.height * scale), Image.NEAREST)
canvas.save(out_path)
print(out_path, canvas.size)
