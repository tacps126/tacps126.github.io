#!/usr/bin/env python3
"""Regenerates the icon set and the social preview image (needs Pillow: pip install pillow).

    python3 scripts/make-assets.py

Writes icon-512.png, icon-192.png, apple-touch-icon.png, favicon.png and og.png next to index.html.
The same icon.png (512 x 512) is copied by hand into the webdata-tools-mcp repo.
favicon.svg is hand-written SVG of the same glyph.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent


def gradient(size, c1, c2):
    w, h = size
    g = Image.new("RGB", (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return g


def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=255)
    return m


def font(size):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


# --- icon: three data rows on an indigo-to-cyan tile
N = 1024
icon = Image.new("RGBA", (N, N), (0, 0, 0, 0))
icon.paste(gradient((N, N), (79, 70, 229), (6, 182, 212)), (0, 0), rounded_mask((N, N), 230))
d = ImageDraw.Draw(icon)
for i, (cy, wf) in enumerate([(300, 0.78), (512, 1.0), (724, 0.6)]):
    x0, h, bar = 210, 96, int(520 * wf)
    col = (255, 255, 255, 255) if i == 1 else (255, 255, 255, 170)
    d.ellipse([x0, cy - h // 2, x0 + h, cy + h // 2], fill=col)
    d.rounded_rectangle([x0 + h + 40, cy - h // 2, x0 + h + 40 + bar - 60, cy + h // 2], h // 2, fill=col)
sx, sy = 800, 230
d.polygon([(sx, sy - 70), (sx + 22, sy - 22), (sx + 70, sy), (sx + 22, sy + 22), (sx, sy + 70), (sx - 22, sy + 22), (sx - 70, sy), (sx - 22, sy - 22)], fill=(255, 255, 255, 235))
icon.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
icon.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
icon.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
icon.resize((64, 64), Image.LANCZOS).save(OUT / "favicon.png")

# --- social preview 1200 x 630
W, H = 1200, 630
og = gradient((W, H), (15, 19, 34), (30, 27, 75)).convert("RGBA")
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([700, -150, 1300, 450], fill=(6, 182, 212, 90))
gd.ellipse([-200, 350, 400, 900], fill=(79, 70, 229, 90))
og = Image.alpha_composite(og, glow.filter(ImageFilter.GaussianBlur(120)))
layer = Image.new("RGBA", og.size, (0, 0, 0, 0))
layer.paste(icon.resize((150, 150), Image.LANCZOS), (80, 80))
og = Image.alpha_composite(og, layer)
d = ImageDraw.Draw(og)
d.text((260, 100), "tacps126", font=font(54), fill=(255, 255, 255, 255))
d.text((260, 165), "web data tools on Apify", font=font(30), fill=(165, 180, 252, 255))
d.text((80, 330), "Clean web data for jobs,", font=font(76), fill=(255, 255, 255, 255))
d.text((80, 420), "news, reviews and leads.", font=font(76), fill=(255, 255, 255, 255))
d.text((80, 545), "About $1 per 1,000 results  ·  40+ tools on Apify  ·  MCP server for AI agents", font=font(30), fill=(148, 163, 184, 255))
og.convert("RGB").save(OUT / "og.png")
print("assets written")
