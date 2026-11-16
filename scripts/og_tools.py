#!/usr/bin/env python3
"""Social preview images for the tool pages: og/<name>.jpg, 2400 x 1260 (1200 x 630 at 2x; JPEG, since the
soft gradient background is many times smaller than as PNG).

    python3 scripts/og_tools.py data/og-tools.json

build.mjs writes the list (name, title, one-line description, price, topic, icon URL, feature labels)
and runs this. An image is redrawn only when its inputs or this script change (og/inputs.json), so a
daily build leaves the files alone. Needs Pillow; shares background, fonts and chips with scripts/og.py.
"""
import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import og  # noqa: E402  (shared background, fonts, chips and colours)
from og import S, sans  # noqa: E402

ROOT = og.ROOT
OUT = ROOT / "og"
OUT.mkdir(exist_ok=True)
seen_file = OUT / "inputs.json"
seen = json.loads(seen_file.read_text()) if seen_file.exists() else {}
# A change to the drawing code redraws every image.
STYLE = hashlib.sha256(Path(__file__).read_bytes() + (ROOT / "scripts" / "og.py").read_bytes()).hexdigest()[:12]


def icon(url, fallback):
    try:
        data = urllib.request.urlopen(url, timeout=30).read()
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:
        return Image.open(fallback).convert("RGBA") if fallback and Path(fallback).exists() else None


def wrap(d, text, f, width, lines):
    """Up to `lines` lines that fit `width` (layout units); the last ends in ... when text is cut."""
    width *= og.K
    words, out, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= width:
            cur = t
        else:
            out.append(cur)
            cur = w
            if len(out) == lines:
                break
    if len(out) < lines and cur:
        out.append(cur)
    if len(out) == lines and " ".join(out) != text:
        while out[-1] and d.textlength(out[-1] + "...", font=f) > width:
            out[-1] = out[-1][:-1]
        out[-1] = out[-1].rstrip(" ,;:-") + "..."
    return out


def draw(t):
    col = og.CAT.get(t["cat"], og.ACCENT)
    img = og.soft_background([(-120, -40, 480, og.ACCENT, 70), (1010, 170, 420, col, 95), (520, 780, 460, og.ACCENT2, 40)])
    # tool icon: big tile on the right with a glow in the topic colour
    pic = icon(t["icon"], t.get("local"))
    if pic:
        size = 216
        x, y = 1200 - 72 - size, 70
        glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([S(x - 50), S(y - 40), S(x + size + 50), S(y + size + 60)], fill=(*col, 110))
        img.alpha_composite(glow.resize((og.W // 4, og.H // 4)).filter(ImageFilter.GaussianBlur(14)).resize(img.size, Image.BICUBIC))
        og.tile(img, pic.resize((S(size), S(size)), Image.LANCZOS), S(x), S(y), S(size), S(size * 0.24))
    img = img.convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    og.brand_row(img, d, "tacps126", "web data tools on Apify", y=56)

    # topic chip, title, description
    og.chip(d, 72, 150, t["topic"], sans(600, 15), fill=(*col, 40), outline=(*col, 150), dot=col)
    width = 1200 - 72 - (72 + 216 + 48 if pic else 72)
    tf = sans(800, 52)
    lines = wrap(d, t["t"], tf, width, 2)
    if d.textlength(t["t"], font=tf) > 2 * width * og.K * 0.98:
        tf = sans(800, 42)
        lines = wrap(d, t["t"], tf, width, 3)
    y = 202
    for ln in lines:
        d.text((S(72), S(y)), ln, font=tf, fill=og.TEXT)
        y += tf.size / og.K * 1.16
    y = max(y + 18, 304)
    bf = sans(450, 23)
    for ln in wrap(d, t["d"], bf, 1200 - 144, 3 if y < 380 else 2):
        d.text((S(72), S(y)), ln, font=bf, fill=og.MUTED)
        y += 34

    # footer: price, then what the tool offers
    x, y = 72, 534
    if t.get("p"):
        x += og.chip(d, x, y, t["p"], sans(700, 21), fill=(*col, 60), outline=col, h=46, pad=20) + 14
    for text in t.get("f", []):
        w = d.textlength(text, font=sans(560, 15)) / og.K + 44
        if x + w > 1200 - 72:
            break
        x += og.chip(d, x, y + 6, text, sans(560, 15), dot=og.ACCENT2) + 10
    og.save(img, OUT / f"{t['n']}.jpg", quality=86, optimize=True, progressive=True)


def main(path):
    tools = json.loads(Path(path).read_text())
    keep = set()
    for t in tools:
        keep.add(t["n"])
        key = hashlib.sha256((STYLE + json.dumps(t, sort_keys=True)).encode()).hexdigest()
        if seen.get(t["n"]) == key and (OUT / f"{t['n']}.jpg").exists():
            continue
        try:
            draw(t)
            seen[t["n"]] = key
        except Exception as e:
            print(f"og/{t['n']}.jpg not drawn: {e}", file=sys.stderr)
    for f in [*OUT.glob("*.png"), *OUT.glob("*.jpg")]:
        if f.stem not in keep or f.suffix == ".png":
            f.unlink()
    seen_file.write_text(json.dumps({k: v for k, v in sorted(seen.items()) if k in keep}, indent=0))


if __name__ == "__main__":
    main(sys.argv[1])
