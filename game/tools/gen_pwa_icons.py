#!/usr/bin/env python3
"""Build PWA icons from a Kenney Game Icons glyph.

Source: Kenney "Game Icons" (CC0) — locked.png on the game stage background.
Re-run after changing the glyph or brand colours:

    python3 tools/gen_pwa_icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/assets/kenney/icons/locked.png"
OUT = ROOT / "public/icons"
APP_ICON = ROOT / "app/icon.png"

BG = (11, 31, 38, 255)  # --stage-bg #0b1f26
AMBER = (245, 166, 35)  # --accent-amber #f5a623


def tint_amber(icon: Image.Image) -> Image.Image:
    """Recolor the white Kenney glyph to the game amber."""
    out = icon.copy()
    pixels = out.load()
    assert pixels is not None
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            strength = a / 255.0
            pixels[x, y] = (
                int(AMBER[0] * strength + r * (1 - strength)),
                int(AMBER[1] * strength + g * (1 - strength)),
                int(AMBER[2] * strength + b * (1 - strength)),
                a,
            )
    return out


def make_icon(src: Image.Image, size: int, *, maskable: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    # Maskable icons need ~20% safe-zone padding so Android masks don't crop.
    pad_ratio = 0.28 if maskable else 0.22
    pad = int(size * pad_ratio)
    target = max(size - pad * 2, 1)
    glyph = tint_amber(src.resize((target, target), Image.Resampling.NEAREST))
    canvas.paste(glyph, (pad, pad), glyph)
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing Kenney source icon: {SRC}")

    src = Image.open(SRC).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)

    outputs = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, False),
    }
    for name, (size, maskable) in outputs.items():
        img = make_icon(src, size, maskable=maskable)
        path = OUT / name
        img.save(path, optimize=True)
        print(f"wrote {path.relative_to(ROOT)} ({size}x{size})")

    favicon = make_icon(src, 512).resize((32, 32), Image.Resampling.NEAREST)
    favicon.save(APP_ICON)
    print(f"wrote {APP_ICON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
