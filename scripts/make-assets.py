#!/usr/bin/env python3
"""Regenerates the icon set from the logo (needs Pillow: pip install pillow).

    python3 scripts/make-assets.py

Writes icon-512.png, icon-192.png, apple-touch-icon.png and favicon.png next to index.html from
scripts/logo-1024.png, the 1024 px export of favicon.svg (the apirows mark, drawn by scripts/logo.py).
Re-run scripts/logo.py after editing the SVG.
icon-512.png is copied by hand into the webdata-tools-mcp repo as icon.png.
"""
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent


# --- icon: the apirows mark (scripts/logo-1024.png, drawn by scripts/logo.py)
icon = Image.open(OUT / "scripts" / "logo-1024.png").convert("RGBA")
icon.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
icon.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
icon.resize((64, 64), Image.LANCZOS).save(OUT / "favicon.png")
# iOS rounds the corners itself: the touch icon is the full square, edge to edge.
touch = Image.new("RGBA", (180, 180), (10, 10, 10, 255))
touch.alpha_composite(icon.resize((180, 180), Image.LANCZOS), (0, 0))
touch.convert("RGB").save(OUT / "apple-touch-icon.png")
print("icons written; og.png is drawn by scripts/og.py on every build")
