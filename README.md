# tacps126.github.io

Static site for <https://tacps126.github.io>. No framework, no build dependencies beyond Node 18+.

```bash
node build.mjs                   # regenerates index.html, mcp.html, 404.html, sitemap.xml, llms.txt
git add -A && git commit -m "Refresh" && git push     # GitHub Pages deploys in about a minute
python3 scripts/make-assets.py   # only if you change the icon or the social image (needs Pillow)
```

`build.mjs` reads the public Apify pages of the `tacps126` account, so the tool list, titles and
prices always match the Store. Edit these in `build.mjs`:

- `CATS` lists which public Actors appear and in which category. A new public Actor that is not listed
  is left out and the build prints a warning.
- `MCP_TOOLS` lists the tools of the MCP server (name, one line, Actor, price). The counts on the
  pages are derived from it.
- The copy for each section sits in `indexBody` and `mcpBody`.

`style.css` and `app.js` are hand-written. Preview locally with `python3 -m http.server 8765` and
open <http://localhost:8765>.
