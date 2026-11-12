#!/usr/bin/env python3
"""The apirows mark: JSON braces around three rows of a table (an API that returns rows).

Each row is a cell, a bar and a cell, lined up in the same columns, and each row has its own colour.
Every colour is a mid-tone with at least 3:1 contrast on both white and near-black, so one mark works
on light and dark backgrounds with no tile behind it.

Two drawings of the same mark:
  full   cells per row, for the logo (header, app icons, social images)
  small  one solid bar per row and slightly heavier, for 16 to 64 px (favicons), where cells blur

Outputs:
  favicon.svg                  small, transparent
  scripts/logo-1024.png        full, transparent: read by scripts/make-assets.py and scripts/og.py
  scripts/logo-small-1024.png  small, transparent: read by scripts/make-assets.py (favicon.png)
  build.mjs MARK               printed here; paste it when the mark changes

Needs Pillow. Run scripts/make-assets.py after.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

BRACE = "#3b82f6"  # blue-500
ROWS = ("#0284c7", "#6366f1", "#8b5cf6")  # sky-600, indigo-500, violet-500, top to bottom

# 64-unit grid
TOP, BOT, MID = 12, 52, 32  # brace ends and tip line
TIPS = ((4, 1), (60, -1))  # tip x and the way the brace opens
ROW_Y = (20, 32, 44)
CELLS = ((15, 6), (24.5, 15), (43, 6))  # x, width: left cell, bar, right cell
BAR = ((15, 34),)
WEIGHT = {"full": (4.5, 6), "small": (5.5, 7)}  # brace stroke, row height


def brace_segments(x, d):
    """The brace as straight and cubic segments: straight arms, a short tip on the middle row."""
    w, a = 6.5 * d, 3.2 * d
    return [
        ("C", (x + w, TOP), (x + a, TOP), (x + a, TOP + 2), (x + a, TOP + 5)),
        ("L", (x + a, TOP + 5), (x + a, MID - 5)),
        ("C", (x + a, MID - 5), (x + a, MID - 1.5), (x + a * 0.5, MID), (x, MID)),
        ("C", (x, MID), (x + a * 0.5, MID), (x + a, MID + 1.5), (x + a, MID + 5)),
        ("L", (x + a, MID + 5), (x + a, BOT - 5)),
        ("C", (x + a, BOT - 5), (x + a, BOT - 2), (x + a, BOT), (x + w, BOT)),
    ]


def f(n):
    return f"{round(n, 2):g}"


def brace_path(x, d):
    segs = brace_segments(x, d)
    out = f"M{f(segs[0][1][0])} {f(segs[0][1][1])}"
    for s in segs:
        pts = s[2:] if s[0] == "C" else s[2:]
        out += s[0] + " ".join(f"{f(px)} {f(py)}" for px, py in pts)
    return out


def svg(kind):
    sw, h = WEIGHT[kind]
    parts = "".join(brace_path(x, d) for x, d in TIPS)
    body = f'<path d="{parts}" fill="none" stroke="{BRACE}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round"/>'
    for y, colour in zip(ROW_Y, ROWS):
        for x, w in CELLS if kind == "full" else BAR:
            body += f'<rect x="{f(x)}" y="{f(y - h / 2)}" width="{f(w)}" height="{h}" rx="{f(h / 2)}" fill="{colour}"/>'
    return body


def sample(seg, n=120):
    if seg[0] == "L":
        (ax, ay), (bx, by) = seg[1], seg[2]
        return [(ax + (bx - ax) * i / n, ay + (by - ay) * i / n) for i in range(n + 1)]
    p0, p1, p2, p3 = seg[1:]
    pts = []
    for i in range(n + 1):
        t = i / n
        m = 1 - t
        pts.append(tuple(m**3 * p0[k] + 3 * m * m * t * p1[k] + 3 * m * t * t * p2[k] + t**3 * p3[k] for k in (0, 1)))
    return pts


def rgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def png(kind, size=1024):
    """Transparent PNG, drawn at 4x and scaled down for smooth edges."""
    sw, h = WEIGHT[kind]
    s = size * 4
    u = s / 64
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = sw / 2 * u
    for x, dd in TIPS:
        for seg in brace_segments(x, dd):
            for px, py in sample(seg):
                d.ellipse((px * u - r, py * u - r, px * u + r, py * u + r), fill=rgba(BRACE))
    for y, colour in zip(ROW_Y, ROWS):
        for x, w in CELLS if kind == "full" else BAR:
            d.rounded_rectangle((x * u, (y - h / 2) * u, (x + w) * u, (y + h / 2) * u), radius=h / 2 * u, fill=rgba(colour))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    (ROOT / "favicon.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{svg("small")}</svg>\n')
    png("full").save(ROOT / "scripts" / "logo-1024.png", optimize=True)
    png("small").save(ROOT / "scripts" / "logo-small-1024.png", optimize=True)
    print("wrote favicon.svg, scripts/logo-1024.png, scripts/logo-small-1024.png")
    print("MARK for build.mjs (64 grid):")
    print(svg("full"))
