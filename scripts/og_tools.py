#!/usr/bin/env python3
"""Social preview images for the tool pages: og/<name>.jpg, 1200 x 630 (JPEG: the gradient background is ten times smaller than as PNG).

    python3 scripts/og_tools.py data/og-tools.json

build.mjs writes the list (name, title, one-line description, price, topic, icon URL) and runs
this. An image is redrawn only when its inputs change (og/inputs.json), so a daily build leaves
the files alone. Needs Pillow; uses the site's font and background from scripts/og.py.
"""
import hashlib
import io
import json
import sys
import textwrap
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import og  # noqa: E402  (shared background, fonts and colours)

ROOT = og.ROOT
OUT = ROOT / "og"
OUT.mkdir(exist_ok=True)
seen_file = OUT / "inputs.json"
seen = json.loads(seen_file.read_text()) if seen_file.exists() else {}


def icon(url, fallback):
    try:
        data = urllib.request.urlopen(url, timeout=30).read()
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:
        return Image.open(fallback).convert("RGBA") if fallback and Path(fallback).exists() else None


def wrap(d, text, f, width, lines):
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
        out[-1] = out[-1].rstrip(" ,;: - -") + "..."
    return out


def draw(t):
    img = og.background()
    d = ImageDraw.Draw(img, "RGBA")
    col = og.CAT.get(t["cat"], og.ACCENT)
    # brand row
    brand = Image.open(ROOT / "icon-192.png").convert("RGBA").resize((44, 44))
    img.alpha_composite(brand, (64, 52))
    d.text((122, 58), "tacps126 · web data tools", font=og.MONO(22), fill=og.MUTED)
    # tool icon, topic and title
    pic = icon(t["icon"], t.get("local"))
    x = 64
    if pic:
        pic.thumbnail((132, 132), Image.LANCZOS)
        mask = Image.new("L", pic.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, pic.size[0] - 1, pic.size[1] - 1], 26, fill=255)
        img.paste(pic, (64, 150), mask)
        x = 64 + pic.size[0] + 36
    d.rounded_rectangle([x, 152, x + 14, 166], 7, fill=col)
    d.text((x + 24, 146), t["topic"].upper(), font=og.MONO(20), fill=og.MUTED)
    title_f = og.DISPLAY(56)
    lines = wrap(d, t["t"], title_f, 1200 - x - 64, 2)
    if len(lines) == 2 or d.textlength(t["t"], font=title_f) > 1200 - x - 64:
        title_f = og.DISPLAY(46)
        lines = wrap(d, t["t"], title_f, 1200 - x - 64, 3)
    y = 184
    for ln in lines:
        d.text((x, y), ln, font=title_f, fill=og.TEXT)
        y += int(title_f.size * 1.18)
    # description
    y = max(y + 24, 340)
    for ln in wrap(d, t["d"], og.BODY(27), 1200 - 128, 3):
        d.text((64, y), ln, font=og.BODY(27), fill=og.MUTED)
        y += 38
    # footer: price pill and call to action
    if t.get("p"):
        f = og.DISPLAY(28)
        w = int(d.textlength(t["p"], font=f)) + 44
        d.rounded_rectangle([64, 530, 64 + w, 584], 27, fill=(*col, 50), outline=col, width=2)
        d.text((86, 538), t["p"], font=f, fill=og.TEXT)
    msg = "Input builder · API call · sample output"
    d.text((1200 - 64 - d.textlength(msg, font=og.MONO(20)), 548), msg, font=og.MONO(20), fill=og.MUTED)
    img.convert("RGB").save(OUT / f"{t['n']}.jpg", quality=84, optimize=True, progressive=True)


def main(path):
    tools = json.loads(Path(path).read_text())
    keep = set()
    for t in tools:
        keep.add(t["n"])
        key = hashlib.sha256(json.dumps(t, sort_keys=True).encode()).hexdigest()
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
