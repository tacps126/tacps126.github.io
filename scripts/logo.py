#!/usr/bin/env python3
"""The apirows mark: a capital A cut into four rows of a table, its crossbar the one blue row
(the row you asked for). One geometry, three outputs:

  favicon.svg            the tile, light and dark (follows the system theme)
  scripts/logo-1024.png  1024 px export, read by scripts/make-assets.py (icons) and scripts/og.py
  build.mjs MARK         the header mark; printed here as path data and pasted by hand when it changes

Needs Pillow. Run scripts/make-assets.py after.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
INK, ACCENT = (10, 10, 10), (59, 130, 246)

# Glyph on a 64 grid: an equilateral A sliced into four rows with even 3-unit gaps.
# Each row is a horizontal slice of the triangle, so the outer edges stay straight.
ROWS = [
    ("fg", [(32, 8), (36.75, 17.5), (27.25, 17.5)]),  # apex
    ("fg", [(25.75, 20.5), (38.25, 20.5), (43, 30), (36, 30), (32, 22), (28, 30), (21, 30)]),  # counter
    ("accent", [(19.5, 33), (44.5, 33), (49.25, 42.5), (14.75, 42.5)]),  # crossbar
    ("fg", [(13.25, 45.5), (20.25, 45.5), (15.5, 55), (8.5, 55)]),  # left leg
    ("fg", [(43.75, 45.5), (50.75, 45.5), (55.5, 55), (48.5, 55)]),  # right leg
]
CENTER = (32, 31.5)
SCALE = 0.38  # glyph on the 32-unit tile: about 56% of its width
RADIUS = 8  # tile corner on the 32 grid


def tile_points(points):
    """Glyph points (64 grid) to tile points (32 grid), glyph centred on the tile."""
    return [(round((x - CENTER[0]) * SCALE + 16, 2), round((y - CENTER[1]) * SCALE + 16, 2)) for x, y in points]


def path_data(points):
    return "M" + " L".join(f"{x:g} {y:g}" for x, y in tile_points(points)) + "Z"


def svg_paths(fg, accent):
    by = {"fg": [], "accent": []}
    for role, pts in ROWS:
        by[role].append(path_data(pts))
    return f'<path fill="{fg}" d="{"".join(by["fg"])}"/><path fill="{accent}" d="{"".join(by["accent"])}"/>'


def favicon():
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
        "  <style>.t{fill:#0a0a0a}.g{fill:#fff}@media (prefers-color-scheme:dark){.t{fill:#ededed}.g{fill:#0a0a0a}}</style>\n"
        f'  <rect class="t" width="32" height="32" rx="{RADIUS}"/>\n  '
        + svg_paths("#fff", "#3b82f6").replace('fill="#fff"', 'class="g"')
        + "\n</svg>\n"
    )


def png(size=1024):
    s = size * 4  # drawn at 4x, scaled down for smooth edges
    u = s / 32
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=RADIUS * u, fill=(*INK, 255))
    for role, pts in ROWS:
        colour = ACCENT if role == "accent" else (255, 255, 255)
        d.polygon([(x * u, y * u) for x, y in tile_points(pts)], fill=(*colour, 255))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    (ROOT / "favicon.svg").write_text(favicon())
    png().save(ROOT / "scripts" / "logo-1024.png")
    print("wrote favicon.svg and scripts/logo-1024.png")
    print("MARK paths for build.mjs:")
    print(svg_paths("var(--ink-fg)", "#3b82f6"))
