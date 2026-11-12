#!/usr/bin/env python3
"""Draws scripts/logo-1024.png, the 1024 px export of favicon.svg (the apirows mark: three rows of a
table on an ink square, the last row short and blue). Needs Pillow. Run scripts/make-assets.py after.
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / "logo-1024.png"
S = 4096  # drawn at 4x, then scaled down for smooth edges
u = S / 32
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=8 * u, fill=(10, 10, 10, 255))
for y, w, fill in ((9, 16, (255, 255, 255, 255)), (14.5, 16, (140, 140, 140, 255)), (20, 9, (59, 130, 246, 255))):
    d.rounded_rectangle((8 * u, y * u, (8 + w) * u, (y + 3) * u), radius=1.5 * u, fill=fill)
img.resize((1024, 1024), Image.LANCZOS).save(OUT)
print(f"wrote {OUT}")
