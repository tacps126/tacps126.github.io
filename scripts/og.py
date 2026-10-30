#!/usr/bin/env python3
"""The social preview image (og.png, 1200 x 630), drawn from live numbers.

    python3 scripts/og.py data/og.json

`build.mjs` writes data/og.json (tool count, success rate, MCP tools, price range,
one dot per public tool) and runs this, so every build's preview shows the current
catalogue. Needs Pillow. Uses the site's own fonts from fonts/.

Platforms (Discord, Slack, LinkedIn, X) only show PNG or JPEG previews, never SVG,
which is why this renders a PNG instead of serving an SVG.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
BG1, BG2 = (9, 13, 30), (24, 22, 64)
ACCENT, ACCENT2 = (129, 140, 248), (34, 211, 238)
TEXT, MUTED = (236, 239, 252), (154, 164, 204)
CAT = {"jobs": (99, 102, 241), "leads": (6, 182, 212), "reviews": (245, 158, 11), "gov": (16, 185, 129), "commerce": (236, 72, 153)}


def font(name, size):
    return ImageFont.truetype(str(ROOT / "fonts" / name), size)


DISPLAY = lambda s: font("space-grotesk-latin-700-normal.woff2", s)
BODY = lambda s: font("inter-latin-500-normal.woff2", s)
MONO = lambda s: font("jetbrains-mono-latin-400-normal.woff2", s)


def background():
    img = Image.new("RGB", (W, H), BG1)
    px = img.load()
    for y in range(H):
        for x in range(0, W, 2):
            t = (x / W) * 0.6 + (y / H) * 0.4
            c = tuple(int(BG1[i] + (BG2[i] - BG1[i]) * t) for i in range(3))
            px[x, y] = c
            if x + 1 < W:
                px[x + 1, y] = c
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse([760, -220, 1380, 300], fill=(*ACCENT2, 60))
    g.ellipse([-200, 380, 420, 860], fill=(*ACCENT, 70))
    img = Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(110)))
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 48):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 9))
    for y in range(0, H, 48):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 9))
    return Image.alpha_composite(img, grid)


def stacked_box(d, box, radius=16, fill=(19, 25, 52), edge1=(52, 50, 120), edge2=(20, 70, 90)):
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0 + 8, y0 + 8, x1 + 8, y1 + 8], radius, fill=edge2)
    d.rounded_rectangle([x0 + 4, y0 + 4, x1 + 4, y1 + 4], radius, fill=edge1)
    d.rounded_rectangle(box, radius, fill=fill, outline=(58, 64, 112), width=1)


def gradient_text(img, xy, text, f):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).text(xy, text, font=f, fill=255)
    bbox = mask.getbbox() or (0, 0, 1, 1)
    grad = Image.new("RGBA", img.size)
    gp = grad.load()
    x0, x1 = bbox[0], max(bbox[2], bbox[0] + 1)
    for x in range(x0, x1):
        t = (x - x0) / (x1 - x0)
        c = tuple(int(ACCENT[i] + (ACCENT2[i] - ACCENT[i]) * t) for i in range(3)) + (255,)
        for y in range(bbox[1], bbox[3]):
            gp[x, y] = c
    img.paste(grad, (0, 0), mask)


def main(path):
    data = json.loads(Path(path).read_text())
    img = background()
    d = ImageDraw.Draw(img, "RGBA")

    # brand: icon + name
    icon = Image.open(ROOT / "icon-192.png").convert("RGBA").resize((72, 72))
    img.alpha_composite(icon, (64, 56))
    d.text((154, 58), data["name"], font=DISPLAY(38), fill=TEXT)
    d.text((156, 106), "web data tools on Apify", font=MONO(20), fill=MUTED)

    # headline
    d.text((64, 170), "Clean web data for", font=DISPLAY(54), fill=TEXT)
    gradient_text(img, (64, 230), "jobs, news, reviews", DISPLAY(54))
    gradient_text(img, (64, 290), "and leads.", DISPLAY(54))

    # stat tiles with stacked edges
    tiles = [(str(data["tools"]), "public tools"), (f'{data["okShare"]}%' if data.get("okShare") else "pay", "runs succeeded" if data.get("okShare") else "per result"), (str(data["mcpTools"]), "tools for AI agents"), (data["from"], "from, per 1,000 results")]
    x = 64
    for value, label in tiles:
        w = 210
        stacked_box(d, (x, 384, x + w, 494))
        d.rounded_rectangle([x + 18, 384, x + w - 18, 387], 2, fill=ACCENT2)
        d.text((x + 20, 398), value, font=DISPLAY(42), fill=TEXT)
        d.text((x + 20, 454), label, font=BODY(17), fill=MUTED)
        x += w + 28

    # the library: one dot per public tool, by topic, size by runs
    dots = data["dots"]
    stacked_box(d, (760, 56, 1136, 340), radius=18)
    d.text((782, 74), f'{len(dots)} tools, one dot each', font=MONO(16), fill=MUTED)
    cx, cy, rowh = 790, 116, 0
    maxr = max([t["runs"] for t in dots] + [1])
    for t in dots:
        r = int(7 + 12 * math.sqrt(t["runs"] / maxr))
        if cx + 2 * r > 1112:
            cx, cy, rowh = 790, cy + rowh + 10, 0
        col = CAT.get(t["cat"], ACCENT)
        d.ellipse([cx, cy, cx + 2 * r, cy + 2 * r], fill=col)
        d.ellipse([cx + r * 0.45, cy + r * 0.35, cx + r * 0.95, cy + r * 0.8], fill=(255, 255, 255, 90))
        cx += 2 * r + 9
        rowh = max(rowh, 2 * r)

    # topic legend with counts
    x = 64
    for key, label, n in data["cats"]:
        col = CAT.get(key, ACCENT)
        text = f"{label} {n}"
        tw = d.textlength(text, font=MONO(18))
        d.rounded_rectangle([x, 540, x + tw + 44, 576], 18, fill=(26, 31, 64), outline=(64, 70, 120))
        d.ellipse([x + 14, 552, x + 26, 564], fill=col)
        d.text((x + 34, 548), text, font=MONO(18), fill=TEXT)
        x += tw + 58

    img.convert("RGB").save(ROOT / "og.png", optimize=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data" / "og.json")
