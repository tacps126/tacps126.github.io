#!/usr/bin/env python3
"""Small copies of the tool icons for the site: icons/<name>.png at 72x72 (shown at 36 and 64 px).

Usage: python3 scripts/thumbs.py data/icons.json   (build.mjs writes the list and runs this; needs Pillow)
Skips icons whose source URL has not changed since the last run (icons/sources.json)."""
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)
seen_file = OUT / "sources.json"
seen = json.loads(seen_file.read_text()) if seen_file.exists() else {}
want = json.loads(Path(sys.argv[1]).read_text())
for name, url in want:
    dest = OUT / f"{name}.png"
    if seen.get(name) == url and dest.exists():
        continue
    try:
        data = urllib.request.urlopen(url, timeout=30).read()
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img.thumbnail((72, 72), Image.LANCZOS)
        img.save(dest, optimize=True)
        seen[name] = url
    except Exception as e:  # keep the last copy (or the remote URL) when a download fails
        print(f"icon {name}: {e}", file=sys.stderr)
seen_file.write_text(json.dumps(seen, indent=1, sort_keys=True))
