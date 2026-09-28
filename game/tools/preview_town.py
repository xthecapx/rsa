"""Render the composed town map to /tmp/town_preview.png. Run tools/dump-town.cjs first."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
data = json.loads(Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/town.json").read_text())
sheet = Image.open(ROOT / "public/assets/kenney/city_tiles.png").convert("RGBA")
TS = 16; COLS = data["sheetColumns"]; W, H = data["width"], data["height"]
def sprite(i):
    sx, sy = (i % COLS) * TS, (i // COLS) * TS
    return sheet.crop((sx, sy, sx + TS, sy + TS))
cv = Image.new("RGBA", (W * TS, H * TS), (12, 16, 22, 255))
for y in range(H):
    for x in range(W):
        e = data["legend"].get(data["rows"][y][x])
        if e: cv.paste(sprite(e["tile"]), (x * TS, y * TS))
        o = data["overlayLegend"].get(data["overlay"][y][x])
        if o:
            t = sprite(o["tile"]); cv.paste(t, (x * TS, y * TS), t)
d = ImageDraw.Draw(cv)
marks = {"coinDoor": (8, 12), "futureA": (8, 5), "futureB": (21, 5), "guide": (24, 28), "sign": (24, 23), "spawn": (24, 32), "client": (40, 10)}
for k, (x, y) in marks.items():
    d.rectangle([x * TS, y * TS, x * TS + 15, y * TS + 15], outline=(255, 0, 0), width=1); d.text((x * TS, y * TS - 10), k, fill=(255, 255, 0))
cv = cv.resize((cv.width * 2, cv.height * 2), Image.NEAREST); cv.save("/tmp/town_preview.png"); print(cv.size)
