#!/usr/bin/env python3
"""Regenerates the icon set from the logo (needs Pillow: pip install pillow).

    python3 scripts/make-assets.py

Writes icon-512.png, icon-192.png, apple-touch-icon.png and favicon.png next to index.html from
scripts/logo-1024.png and scripts/logo-small-1024.png (the apirows mark, drawn by scripts/logo.py;
re-run that first when the mark changes). The mark is transparent; only the touch icon gets a background.
icon-512.png is copied by hand into the webdata-tools-mcp repo as icon.png.
"""
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent


# --- icon: the apirows mark (transparent; full drawing for icons, small drawing for the favicon)
icon = Image.open(OUT / "scripts" / "logo-1024.png").convert("RGBA")
small = Image.open(OUT / "scripts" / "logo-small-1024.png").convert("RGBA")
icon.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
icon.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
small.resize((64, 64), Image.LANCZOS).save(OUT / "favicon.png")
# iOS fills transparency with black and rounds the corners itself: white square, mark with a margin.
touch = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
touch.alpha_composite(icon.resize((148, 148), Image.LANCZOS), (16, 16))
touch.convert("RGB").save(OUT / "apple-touch-icon.png")
print("icons written; og.png is drawn by scripts/og.py on every build")
