# tacps126.github.io

Static site for <https://tacps126.github.io>. No framework, no build dependencies beyond Node 18+.

```bash
node build.mjs                   # regenerates index.html, mcp.html, 404.html, sitemap.xml, llms.txt
git add -A && git commit -m "Refresh" && git push     # GitHub Pages deploys in about a minute
python3 scripts/make-assets.py   # only if you change the icon or the social image (needs Pillow)
```

`build.mjs` reads the public Apify pages of the `tacps126` account, so the tool list, titles,
prices (every charge event), run numbers and the social image (`scripts/og.py`, needs Pillow) match the
Store. `.github/workflows/refresh.yml` rebuilds every day at 05:17 UTC and commits only when something
changed, so a new public Actor or a price change reaches the site within a day without a manual build;
run it now from the Actions tab ("Refresh from Apify" → Run workflow). Edit these in `build.mjs`:

- `CATS` lists which public Actors appear and in which category. A new public Actor that is not listed
  is left out and the build prints a warning.
- `MCP_TOOLS` lists the tools of the MCP server (name, one line, Actor, price). The counts on the
  pages are derived from it.
- The copy for each section sits in `indexBody` and `mcpBody`.

`style.css` and `app.js` are hand-written. Preview locally with `python3 -m http.server 8765` and
open <http://localhost:8765>.

## Blog

Add an article as `posts/<slug>.md` with front matter `title`, `tags`, `date` (YYYY-MM-DD) and run
`node build.mjs`; it becomes `/blog/<slug>.html` and joins the blog index and sitemap. Publish here
first; when reposting on Medium, dev.to or LinkedIn, set the post's canonical URL to
`https://tacps126.github.io/blog/<slug>.html` (Medium: Import a story from this URL; dev.to:
`canonical_url` in the front matter) so search engines credit this site.

## Quality rules

- Plain HTML, CSS and JavaScript; no trackers, no third-party scripts, no cookies. Fonts are self-hosted
  in `fonts/` (Inter, Space Grotesk, JetBrains Mono; SIL Open Font License), never loaded from a CDN.
- Every page gets the same furniture from `decorate()` in `build.mjs`: sections with a `sec-head` are
  numbered and listed in the side indicator (`data-label` sets a short label), and every hero gets the
  floating layers. Don't hand-build these per page.
- Every page keeps the header "Tapaswai Choudhary (tacps126)", works without JavaScript for reading,
  and stays readable at phone width.
- Prices, counts and titles come from the Apify Store at build time; don't hard-code them in copy.
- CI (`.github/workflows/check.yml`) syntax-checks `build.mjs` and `app.js` and checks the header.
