#!/usr/bin/env python3
"""The social preview image (og.png, 1200 x 630), drawn from live numbers.

    python3 scripts/og.py data/og.json

`build.mjs` writes data/og.json (tool count, success rate, MCP tools, price range,
one dot per public tool) and runs this, so every build's preview shows the current
catalogue. Needs Pillow. Uses JetBrains Mono from fonts/ and the mark from icon-512.png.

Platforms (Discord, Slack, LinkedIn, X) only show PNG or JPEG previews, never SVG,
which is why this renders a PNG instead of serving an SVG.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
# The site's dark theme: near-black, hairlines, one blue.
BG, SURFACE, BORDER = (10, 10, 10), (17, 17, 17), (40, 40, 40)
TEXT, MUTED = (237, 237, 237), (150, 150, 150)
ACCENT = ACCENT2 = (59, 130, 246)
CAT = {
    "jobs": (99, 102, 241), "leads": (6, 182, 212), "reviews": (245, 158, 11), "gov": (16, 185, 129),
    "commerce": (236, 72, 153), "health": (239, 68, 68), "finance": (234, 179, 8), "sports": (249, 115, 22),
    "travel": (139, 92, 246),
}


def font(weight, size):
    """JetBrains Mono (the site's code face) at a weight of its variable axis."""
    f = ImageFont.truetype(str(ROOT / "fonts" / "jetbrains-mono-latin-wght-normal.woff2"), size)
    f.set_variation_by_axes([weight])
    return f


DISPLAY = lambda s: font(700, s)
BODY = lambda s: font(500, s)
MONO = lambda s: font(400, s)


def background():
    """Flat near-black with a hairline frame."""
    img = Image.new("RGBA", (W, H), (*BG, 255))
    ImageDraw.Draw(img).rectangle([0, 0, W - 1, H - 1], outline=BORDER, width=2)
    return img


def brand(img, d, xy=(64, 56), size=52):
    """The mark and the word apirows."""
    mark = Image.open(ROOT / "icon-512.png").convert("RGBA").resize((size, size), Image.LANCZOS)
    img.alpha_composite(mark, xy)
    d.text((xy[0] + size + 18, xy[1] + size / 2), "apirows", font=DISPLAY(int(size * 0.66)), fill=TEXT, anchor="lm")


def main(path):
    data = json.loads(Path(path).read_text())
    img = background()
    d = ImageDraw.Draw(img, "RGBA")
    brand(img, d)

    # headline
    d.text((64, 190), "Public web data,", font=DISPLAY(66), fill=TEXT)
    d.text((64, 268), "as clean rows.", font=DISPLAY(66), fill=MUTED)

    # numbers in one row between hairlines
    tiles = [(str(data["tools"]), "data tools"), (str(data["mcpTools"]), "tools for AI agents"), (data["from"], "per 1k results, from")]
    if data.get("okShare"):
        tiles.insert(1, (f'{data["okShare"]}%', "of runs succeeded"))
    d.line([(64, 404), (W - 64, 404)], fill=BORDER, width=2)
    col_w = (W - 128) / len(tiles)
    for i, (value, label) in enumerate(tiles):
        x = 64 + i * col_w
        if i:
            d.line([(x, 404), (x, 520)], fill=BORDER, width=2)
        pad = 0 if i == 0 else 28
        d.text((x + pad, 430), value, font=DISPLAY(44), fill=TEXT)
        d.text((x + pad, 488), label, font=BODY(18), fill=MUTED)
    d.line([(64, 520), (W - 64, 520)], fill=BORDER, width=2)

    d.text((64, 566), "apirows.com", font=MONO(20), fill=MUTED, anchor="lm")
    d.ellipse([W - 64 - 12, 560, W - 64, 572], fill=ACCENT)
    img.convert("RGB").save(ROOT / "og.png", optimize=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data" / "og.json")
