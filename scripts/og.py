#!/usr/bin/env python3
"""The social preview image (og.png, 2400 x 1260: 1200 x 630 at 2x for sharp previews), drawn from live numbers.

    python3 scripts/og.py data/og.json

`build.mjs` writes data/og.json (tool count, success rate, MCP tools, price range,
one dot per public tool) and runs this, so every build's preview shows the current
catalogue. Needs Pillow. Uses Inter (fonts/, OFL). og_tools.py shares the background, fonts
and chips for the per-tool images.

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


# Layout is in 1200 x 630 units; drawn at K x and scaled down once to OUT x, so curves and text stay smooth.
K = 4
OUT = 2
# Logos for the right-hand wall, most familiar first; then any other public tool with an icon.
WALL = [
    "amazon-products", "google-maps-places", "spotify-scraper", "youtube-scraper", "soundcloud-scraper",
    "tiktok-scraper", "linkedin-jobs-scraper", "vimeo-scraper",
    "indeed-jobs", "zillow-scraper", "walmart-products", "airbnb-listings", "facebook-pages", "google-trends",
    "pinterest-scraper", "glassdoor-jobs-scraper", "threads-scraper", "shopify-products", "trustpilot-reviews",
    "google-hotels", "telegram-scraper", "bluesky-scraper", "rightmove-scraper", "google-news",
    "eventbrite-events-scraper", "greenhouse-jobs-scraper", "copart-auctions", "linkedin-companies",
    "google-flights", "instagram-scraper", "naukri-jobs-scraper", "youtube-transcripts", "realtor-scraper",
]
# What sets the tools apart, shown as chips on the home image.
FEATURES = ["Same fields across sources", "Only new results", "Schedules and alerts", "API, CSV or AI agent (MCP)"]


def S(v):
    return int(round(v * K))


def sans(weight, size):
    """Inter (fonts/, OFL) at a weight of its variable axis; size in layout units."""
    f = ImageFont.truetype(str(ROOT / "fonts" / "inter-latin-wght-normal.woff2"), S(size))
    f.set_variation_by_axes([weight])
    return f


def soft_background(pools=None):
    """Deep navy with large blurred colour pools; no grid, no lines. Drawn small and scaled up (smooth, fast)."""
    w, h = W // 4, H // 4
    img = Image.new("RGB", (w, h), BG1)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w) * 0.55 + (y / h) * 0.45
            px[x, y] = tuple(int(BG1[i] + (BG2[i] - BG1[i]) * t) for i in range(3))
    img = img.convert("RGBA")
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(layer)
    for cx, cy, r, col, a in pools or [(-80, 40, 520, ACCENT, 80), (1080, 300, 560, ACCENT2, 70), (640, 760, 420, (236, 72, 153), 45)]:
        g.ellipse([(cx - r) / 4, (cy - r) / 4, (cx + r) / 4, (cy + r) / 4], fill=(*col, a))
    img = Image.alpha_composite(img, layer.filter(ImageFilter.GaussianBlur(40)))
    return img.resize((S(W), S(H)), Image.BICUBIC)


def fetch_icon(url, size):
    import io
    import urllib.request

    try:
        # A listing without a Store icon yet uses the site's own copy (icons/<name>.png).
        data = (ROOT / url).read_bytes() if not url.startswith("http") else urllib.request.urlopen(url, timeout=20).read()
        return Image.open(io.BytesIO(data)).convert("RGBA").resize((size, size), Image.LANCZOS)
    except Exception as e:  # a missing logo just leaves a gap in the wall
        print(f"og: icon {url[:60]}: {e}", file=sys.stderr)
        return None


def tile(img, im, x, y, size, radius, shadow=True):
    """A rounded icon tile with a soft drop shadow and a faint rim, at pixel coordinates."""
    if shadow:
        sh = Image.new("RGBA", (size + S(60), size + S(60)), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([S(30), S(36), S(30) + size, S(36) + size], radius, fill=(0, 0, 12, 140))
        sh = sh.filter(ImageFilter.GaussianBlur(S(9)))
        img.alpha_composite(sh, (x - S(30), y - S(30)))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius, fill=255)
    img.paste(im, (x, y), mask)
    ImageDraw.Draw(img).rounded_rectangle([x, y, x + size - 1, y + size - 1], radius, outline=(255, 255, 255, 46), width=S(1.5))


def logo_wall(img, icons, x0=716, x1=1168, size=72, gap=16):
    """Whole logo tiles on the right, alternate columns offset by half a step; the wall fades out
    towards the top, the bottom and the text side, so no tile is cut by the frame."""
    icons = {n: u or (f"icons/{n}.png" if (ROOT / "icons" / f"{n}.png").exists() else "") for n, u in icons.items()}
    names = [n for n in WALL if icons.get(n)] + sorted(n for n in icons if icons[n] and n not in WALL)
    step = size + gap
    cols = (x1 - x0 + gap) // step
    x0 = x1 - (cols * step - gap)
    rows = (H - 24 + gap) // step
    top = (H - (rows * step - gap)) / 2
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    slots = [(c, r) for c in range(cols) for r in range(rows - 1 if c % 2 else rows)]
    seen, k = set(), 0
    for name in names:
        if k >= len(slots):
            break
        im = fetch_icon(icons[name], S(size))
        if im is None:
            continue
        key = im.resize((16, 16)).tobytes()  # variants share a logo (YouTube, LinkedIn): show it once
        if key in seen:
            continue
        seen.add(key)
        c, r = slots[k]
        k += 1
        tile(layer, im, S(x0 + c * step), S(top + (step / 2 if c % 2 else 0) + r * step), S(size), S(size * 0.24))
    # fade mask: vertical ease at both ends, horizontal ease in from the text side
    fade = Image.new("L", (W, H), 0)
    fp = fade.load()
    for y in range(H):
        ty = min(y, H - 1 - y) / 170
        vy = 0.18 + 0.82 * min(1, ty) ** 1.4
        for x in range(x0 - 40, W):
            vx = min(1, max(0, (x - (x0 - 40)) / 150))
            fp[x, y] = int(255 * vy * (0.25 + 0.75 * vx))
    fade = fade.resize(img.size, Image.BICUBIC)
    layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", img.size, 0), fade))
    img.alpha_composite(layer)
    return k


def chip(d, x, y, text, f, fill=(255, 255, 255, 18), outline=(255, 255, 255, 60), dot=None, color=TEXT, pad=14, h=34):
    """A rounded label in layout units; returns its width. A coloured dot leads when given."""
    tw = d.textlength(text, font=f) / K
    lead = 16 if dot else 0
    w = tw + 2 * pad + lead
    d.rounded_rectangle([S(x), S(y), S(x + w), S(y + h)], S(h / 2), fill=fill, outline=outline, width=S(1))
    if dot:
        d.ellipse([S(x + pad), S(y + h / 2 - 4), S(x + pad + 8), S(y + h / 2 + 4)], fill=dot)
    d.text((S(x + pad + lead), S(y + h / 2)), text, font=f, fill=color, anchor="lm")
    return w


def brand_row(img, d, name, sub, y=60):
    brand = Image.open(ROOT / "icon-512.png").convert("RGBA").resize((S(52), S(52)), Image.LANCZOS)
    img.paste(brand, (S(72), S(y)), brand)
    d.text((S(138), S(y + 4)), name, font=sans(650, 23), fill=TEXT)
    d.text((S(138), S(y + 32)), sub, font=sans(450, 16), fill=MUTED)


def gradient_fill(img, mask):
    """Paint the mask's text with one left-to-right indigo to cyan sweep."""
    x0, _, x1, _ = mask.getbbox()
    ramp = Image.linear_gradient("L").rotate(90, expand=True).resize((x1 - x0, img.height))
    a, b = Image.new("RGBA", ramp.size, (*ACCENT, 255)), Image.new("RGBA", ramp.size, (*ACCENT2, 255))
    sweep = Image.new("RGBA", img.size, (*ACCENT, 255))
    sweep.paste(Image.composite(a, b, ramp), (x0, 0))
    img.paste(sweep, (0, 0), mask)


def save(img, path, **kw):
    img = img.convert("RGB").resize((W * OUT, H * OUT), Image.LANCZOS)
    img.save(path, **kw)


def main(path):
    data = json.loads(Path(path).read_text())
    img = soft_background()
    logo_wall(img, data.get("icons", {}))
    img = img.convert("RGB")  # Pillow blends translucent ink only onto RGB images
    d = ImageDraw.Draw(img, "RGBA")
    brand_row(img, d, data["name"], "web data tools on Apify")

    # headline: "Clean data" in white, the last two lines in the accent sweep
    hf = sans(800, 66)
    d.text((S(70), S(150)), "Clean data", font=hf, fill=TEXT)
    mask = Image.new("L", img.size, 0)
    md = ImageDraw.Draw(mask)
    md.text((S(70), S(226)), "from sites", font=hf, fill=255)
    md.text((S(70), S(302)), "you know.", font=hf, fill=255)
    gradient_fill(img, mask)
    d.text((S(72), S(392)), "Jobs, leads, shopping, social and public records.", font=sans(450, 21), fill=MUTED)

    # what sets it apart: two rows of chips
    cf = sans(560, 15)
    x, y = 72, 432
    for i, text in enumerate(FEATURES):
        w = chip(d, x, y, text, cf, fill=(*ACCENT, 40), outline=(*ACCENT, 130), dot=ACCENT2)
        x += w + 10
        if x > 470 and i < len(FEATURES) - 1:
            x, y = 72, y + 44

    # quiet stats row
    stats = [(str(data["tools"]), "tools"), (data["from"], "per 1,000, from"), (str(data["mcpTools"]), "AI-agent tools")]
    if data.get("okShare"):
        stats.insert(1, (f'{data["okShare"]}%', "runs succeed"))
    x, y = 72, 548
    for n, (value, label) in enumerate(stats):
        if n:
            d.line([(S(x - 22), S(y + 4)), (S(x - 22), S(y + 46))], fill=(255, 255, 255, 46), width=S(1))
        d.text((S(x), S(y)), value, font=sans(750, 27), fill=TEXT)
        d.text((S(x), S(y + 34)), label, font=sans(450, 13), fill=MUTED)
        x += max(d.textlength(value, font=sans(750, 27)), d.textlength(label, font=sans(450, 13))) / K + 44

    save(img, ROOT / "og.png", optimize=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data" / "og.json")
