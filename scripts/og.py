#!/usr/bin/env python3
"""The social preview image (og.png, 1200 x 630), drawn from live numbers.

    python3 scripts/og.py data/og.json

`build.mjs` writes data/og.json (tool count, success rate, MCP tools, price range,
one dot per public tool) and runs this, so every build's preview shows the current
catalogue. Needs Pillow. Uses the site's own font (JetBrains Mono) from fonts/.

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
CAT = {
    "jobs": (99, 102, 241), "leads": (6, 182, 212), "reviews": (245, 158, 11), "gov": (16, 185, 129),
    "commerce": (236, 72, 153), "health": (239, 68, 68), "finance": (234, 179, 8), "sports": (249, 115, 22),
    "travel": (139, 92, 246),
}


def font(weight, size):
    """The site's one typeface, JetBrains Mono, at a weight of its variable axis."""
    f = ImageFont.truetype(str(ROOT / "fonts" / "jetbrains-mono-latin-wght-normal.woff2"), size)
    f.set_variation_by_axes([weight])
    return f


DISPLAY = lambda s: font(700, s)
BODY = lambda s: font(500, s)
MONO = lambda s: font(400, s)


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


# The share image is drawn at 2x and scaled down once, so curves and text stay smooth.
K = 2
# Logos for the right-hand wall, most familiar first; only public tools with an icon are used.
WALL = [
    "amazon-products", "google-maps-places", "linkedin-jobs-scraper", "youtube-scraper", "tiktok-scraper",
    "indeed-jobs", "zillow-scraper", "walmart-products", "airbnb-listings", "facebook-pages", "google-trends",
    "pinterest-scraper", "glassdoor-jobs-scraper", "threads-scraper", "shopify-products", "trustpilot-reviews",
    "google-hotels", "telegram-scraper", "bluesky-scraper", "rightmove-scraper", "google-news",
    "eventbrite-events-scraper", "greenhouse-jobs-scraper", "copart-auctions", "linkedin-companies",
]


def sans(weight, size):
    """Inter (fonts/, OFL) for the share image: headline and labels."""
    f = ImageFont.truetype(str(ROOT / "fonts" / "inter-latin-wght-normal.woff2"), size * K)
    f.set_variation_by_axes([weight])
    return f


def soft_background():
    """Deep navy with three large, blurred colour pools; no grid, no lines."""
    w, h = W * K, H * K
    img = Image.new("RGB", (w // 8, h // 8), BG1)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            t = (x / img.width) * 0.55 + (y / img.height) * 0.45
            px[x, y] = tuple(int(BG1[i] + (BG2[i] - BG1[i]) * t) for i in range(3))
    img = img.resize((w, h), Image.BICUBIC).convert("RGBA")
    pools = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(pools)
    for (cx, cy, r, col, a) in [(-80, 40, 520, ACCENT, 80), (1080, 300, 560, ACCENT2, 70), (640, 760, 420, (236, 72, 153), 45)]:
        g.ellipse([(cx - r) * K, (cy - r) * K, (cx + r) * K, (cy + r) * K], fill=(*col, a))
    return Image.alpha_composite(img, pools.filter(ImageFilter.GaussianBlur(160 * K)))


def fetch_icon(url, size):
    import io
    import urllib.request

    try:
        data = urllib.request.urlopen(url, timeout=20).read()
        return Image.open(io.BytesIO(data)).convert("RGBA").resize((size, size), Image.LANCZOS)
    except Exception as e:  # a missing logo just leaves a gap in the wall
        print(f"og: icon {url[:60]}: {e}", file=sys.stderr)
        return None


def logo_wall(img, icons):
    """Staggered columns of rounded logo tiles that run off the right edge, fading in from the left."""
    tile, gap, radius = 118 * K, 24 * K, 30 * K
    cols, x0 = 4, 700 * K
    names = [n for n in WALL if icons.get(n)][:cols * 5]
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    mask = Image.new("L", (tile, tile), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tile - 1, tile - 1], radius, fill=255)
    k = 0
    for c in range(cols):
        x = x0 + c * (tile + gap)
        y = (-70 if c % 2 == 0 else -10) * K
        while y < img.height and k < len(names):
            im = fetch_icon(icons[names[k]], tile)
            k += 1
            if im is None:
                continue
            sd.rounded_rectangle([x + 6 * K, y + 14 * K, x + tile + 6 * K, y + tile + 14 * K], radius, fill=(0, 0, 10, 150))
            layer.paste(im, (x, y), mask)
            ImageDraw.Draw(layer).rounded_rectangle([x, y, x + tile - 1, y + tile - 1], radius, outline=(255, 255, 255, 40), width=2 * K)
            y += tile + gap
    shadow = shadow.filter(ImageFilter.GaussianBlur(14 * K))
    fade = Image.new("L", img.size, 255)
    fp = ImageDraw.Draw(fade)
    for x in range(x0 - 60 * K, x0 + 160 * K):  # tiles fade in from the text side
        a = max(0, min(255, int(255 * (x - (x0 - 60 * K)) / (220 * K))))
        fp.line([(x, 0), (x, img.height)], fill=a)
    for part in (shadow, layer):
        part.putalpha(Image.composite(part.getchannel("A"), Image.new("L", img.size, 0), fade))
        img.alpha_composite(part)


def main(path):
    data = json.loads(Path(path).read_text())
    img = soft_background()
    logo_wall(img, data.get("icons", {}))
    d = ImageDraw.Draw(img, "RGBA")
    S = lambda v: v * K

    # brand
    brand = Image.open(ROOT / "icon-512.png").convert("RGBA").resize((S(56), S(56)), Image.LANCZOS)
    img.alpha_composite(brand, (S(72), S(64)))
    d.text((S(142), S(70)), data["name"], font=sans(650, 24), fill=TEXT)
    d.text((S(142), S(100)), "web data tools on Apify", font=sans(450, 17), fill=MUTED)

    # headline: three short lines, the last two in the accent gradient
    y = 176
    d.text((S(70), S(y)), "Clean data", font=sans(800, 74), fill=TEXT)
    # the accent lines share one left-to-right sweep
    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    for line in ["from sites", "you know."]:
        y += 84
        md.text((S(70), S(y)), line, font=sans(800, 74), fill=255)
    x0, _, x1, _ = mask.getbbox()
    ramp = Image.linear_gradient("L").rotate(90, expand=True).resize((x1 - x0, img.height))
    sweep = Image.new("RGBA", img.size, (*ACCENT, 255))
    sweep.paste(Image.composite(Image.new("RGBA", ramp.size, (*ACCENT, 255)), Image.new("RGBA", ramp.size, (*ACCENT2, 255)), ramp), (x0, 0))
    img.paste(sweep, (0, 0), mask)
    y += 84
    d.text((S(72), S(y + 18)), "Jobs, leads, shopping, social and public records,", font=sans(450, 22), fill=MUTED)
    d.text((S(72), S(y + 48)), "as clean tables or straight into your AI agent.", font=sans(450, 22), fill=MUTED)

    # quiet stats row
    stats = [(str(data["tools"]), "tools"), (data["from"], "per 1,000, from"), (str(data["mcpTools"]), "AI-agent tools")]
    if data.get("okShare"):
        stats.insert(1, (f'{data["okShare"]}%', "runs succeed"))
    x, y = 72, 540
    for n, (value, label) in enumerate(stats):
        if n:
            d.line([(S(x - 22), S(y + 4)), (S(x - 22), S(y + 50))], fill=(255, 255, 255, 46), width=S(1))
        d.text((S(x), S(y)), value, font=sans(750, 30), fill=TEXT)
        d.text((S(x), S(y + 38)), label, font=sans(450, 14), fill=MUTED)
        x += max(int(d.textlength(value, font=sans(750, 30)) / K), int(d.textlength(label, font=sans(450, 14)) / K)) + 46

    img.convert("RGB").resize((W, H), Image.LANCZOS).save(ROOT / "og.png", optimize=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data" / "og.json")
