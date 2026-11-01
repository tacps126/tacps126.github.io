#!/usr/bin/env python3
"""Regenerates the icon set from the logo (needs Pillow: pip install pillow).

    python3 scripts/make-assets.py

Writes icon-512.png, icon-192.png, apple-touch-icon.png and favicon.png next to index.html from
scripts/logo-1024.png, the 1024 px export of favicon.svg (the hand-written logo: a honey bee on a
honeycomb cell). Re-export it after editing the SVG.
icon-512.png is copied by hand into the webdata-tools-mcp repo as icon.png.
"""
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent


# --- icon: the honey bee on a honeycomb cell (scripts/logo-1024.png, exported from favicon.svg)
icon = Image.open(OUT / "scripts" / "logo-1024.png").convert("RGBA")
icon.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
icon.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
icon.resize((64, 64), Image.LANCZOS).save(OUT / "favicon.png")
# iOS fills transparency with black: the touch icon gets the site's dark background.
touch = Image.new("RGBA", (180, 180), (10, 14, 31, 255))
touch.alpha_composite(icon.resize((150, 150), Image.LANCZOS), (15, 15))
touch.convert("RGB").save(OUT / "apple-touch-icon.png")
print("icons written; og.png is drawn by scripts/og.py on every build")
