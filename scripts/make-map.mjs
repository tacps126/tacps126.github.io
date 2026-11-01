// Writes the coverage map data:
//   data/world.json     one SVG path per country (ISO 3166 alpha-2), equirectangular, 1000 wide
//   data/geo/<CC>.json  a country close up: outline plus state / province lines, for the map's zoom view
// Run once (or when the outline should change): node scripts/make-map.mjs [cache-dir]
// Source: Natural Earth 5.1.2 1:10m (public domain): admin 0 countries in India's point of view (India's
// official boundaries, Jammu and Kashmir and Ladakh whole) and admin 1 states and provinces. Lines are
// simplified here, so the downloads (about 55 MB) are cached in the cache dir (default: the OS temp dir).
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
const cache = process.argv[2] || join(tmpdir(), 'natural-earth-5.1.2');
mkdirSync(cache, { recursive: true });
async function load(name) {
  const file = join(cache, name + '.geojson');
  if (!existsSync(file)) {
    const r = await fetch(NE + name + '.geojson');
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}
// Polygon union and difference for India's official state shapes (dev-only, cached next to the data).
const lib = join(cache, 'lib');
if (!existsSync(join(lib, 'node_modules', 'polygon-clipping'))) {
  const r = spawnSync('npm', ['install', '--no-save', '--prefix', lib, 'polygon-clipping@0.15.7'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('npm install polygon-clipping failed');
}
const pc = createRequire(join(lib, 'package.json'))('polygon-clipping');
const countries = await load('ne_10m_admin_0_countries_ind');
const states = await load('ne_10m_admin_1_states_provinces');
const names = (await (await fetch('https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.11.0/langs/en.json')).json()).countries;

// Codes Natural Earth leaves as -99 that the map still shows.
const EXTRA = { KOS: 'XK', CYN: 'CY', SOL: 'SO' };
const codeOf = (p) => (p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : EXTRA[p.ADM0_A3]);
const polysOf = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);

// Douglas-Peucker on projected points, iterative.
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    let best = -1, far = t2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > far) { far = d; best = i; }
    }
    if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// A ring as a compact relative SVG path in whole units (scale = units per pixel kept).
function ringPath(ring, project, tol, minSize, scale = 1) {
  const pts = simplify(ring.map(project), tol);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 - x0 < minSize && y1 - y0 < minSize) return '';
  let d = '', lx = null, ly = null, n = 0;
  for (const p of pts) {
    const x = Math.round(p[0] * scale), y = Math.round(p[1] * scale);
    if (x === lx && y === ly) continue;
    d += lx === null ? `M${x} ${y}` : `l${x - lx} ${y - ly}`;
    lx = x; ly = y; n++;
  }
  return n > 2 ? d + 'z' : '';
}
const polyPath = (poly, project, tol, minSize, scale) => {
  const outer = ringPath(poly[0], project, tol, minSize, scale);
  return outer ? outer + poly.slice(1).map((r) => ringPath(r, project, tol, minSize, scale)).join('') : '';
};

// World: equirectangular, Antarctica cut off, 1000 wide, latitude 84 N to 58 S.
const W = 1000, TOP = 84, BOTTOM = -58, H = Math.round((W * (TOP - BOTTOM)) / 360);
const world = ([lon, lat]) => [((lon + 180) / 360) * W, ((TOP - lat) / (TOP - BOTTOM)) * H];
const paths = {}, shapes = {};
for (const f of countries.features) {
  const code = codeOf(f.properties);
  if (!code || code === 'AQ') continue;
  const polys = polysOf(f.geometry);
  (shapes[code] ||= []).push(...polys);
  paths[code] = (paths[code] || '') + polys.map((p) => polyPath(p, world, 0.45, 1.2)).join('');
}
for (const k of Object.keys(paths)) if (!paths[k]) delete paths[k];

// Short English names for every code (also the ones too small to draw), for labels and place search.
const label = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
Object.assign(label, { US: 'United States', GB: 'United Kingdom', RU: 'Russia', KR: 'South Korea', KP: 'North Korea', IR: 'Iran', SY: 'Syria', VN: 'Vietnam', LA: 'Laos', BO: 'Bolivia', VE: 'Venezuela', TZ: 'Tanzania', MD: 'Moldova', CZ: 'Czechia', TW: 'Taiwan', XK: 'Kosovo', CN: 'China', PS: 'Palestine', GM: 'Gambia', MK: 'North Macedonia', BN: 'Brunei', CG: 'Congo', CD: 'DR Congo', FK: 'Falkland Islands', CI: "Côte d'Ivoire", TR: 'Türkiye', SY: 'Syria', FM: 'Micronesia', VA: 'Vatican City', BS: 'Bahamas', AX: 'Åland', HM: 'Heard and McDonald Islands', GS: 'South Georgia', TF: 'French Southern Lands' });
writeFileSync(new URL('../data/world.json', import.meta.url), JSON.stringify({ w: W, h: H, names: label, paths }));

// Close ups. The view frames the country's main landmass and what lies near it (far islands and
// territories, such as Alaska or French Guiana, stay on the world map), corrected for latitude.
const geoDir = new URL('../data/geo/', import.meta.url);
rmSync(geoDir, { recursive: true, force: true });
mkdirSync(geoDir, { recursive: true });
const bboxOf = (rings, shift) => {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) for (const [lon, lat] of r) {
    const x = shift && lon < 0 ? lon + 360 : lon;
    b = [Math.min(b[0], x), Math.min(b[1], lat), Math.max(b[2], x), Math.max(b[3], lat)];
  }
  return b;
};
const byCountry = {};
for (const f of states.features) {
  const c = f.properties.iso_a2;
  if (c && c !== '-99') (byCountry[c] ||= []).push(f);
}
// India's official map (Survey of India): the Union Territory of Jammu and Kashmir includes the area
// Pakistan administers as Azad Kashmir; Ladakh includes Gilgit-Baltistan, Aksai Chin and the Shaksgam
// valley. Natural Earth's states follow the lines of control, so those areas are merged in here; the
// country outline (India's point of view) already covers them.
{
  const nameOf = (f) => f.properties.name_en || f.properties.name;
  const take = (cc, n) => {
    const i = byCountry[cc].findIndex((f) => nameOf(f) === n);
    if (i < 0) throw new Error(`${cc} ${n} missing from Natural Earth admin 1`);
    return byCountry[cc].splice(i, 1)[0];
  };
  const jk = take('IN', 'Jammu and Kashmir'), la = take('IN', 'Ladakh');
  const ajk = take('PK', 'Azad Kashmir'), gb = take('PK', 'Gilgit-Baltistan');
  const g = (f) => polysOf(f.geometry);
  // What India's outline holds beyond its states and those two areas, in the north (Aksai Chin, Shaksgam).
  const covered = pc.union(g(jk), g(la), g(ajk), g(gb), ...byCountry.IN.map(g));
  const rest = pc.difference(shapes.IN, covered).filter((poly) => {
    const b = bboxOf([poly[0]], false);
    return b[0] >= 72 && b[2] <= 81 && b[1] >= 32 && b[3] <= 37.5;
  });
  // Outer rings only: the slivers between two datasets would otherwise show as holes.
  const solid = (mp) => ({ type: 'MultiPolygon', coordinates: mp.map((poly) => [poly[0]]) });
  byCountry.IN.push(
    { properties: jk.properties, geometry: solid(pc.union(g(jk), g(ajk))) },
    { properties: la.properties, geometry: solid(pc.union(g(la), g(gb), ...rest.map((poly) => [poly]))) },
  );
}
const area = (b) => (b[2] - b[0]) * (b[3] - b[1]);
const VIEW = 640;
let files = 0, bytes = 0;
for (const [code, polys] of Object.entries(shapes)) {
  // Across the antimeridian (Russia, Fiji, New Zealand's islands): count west longitudes as east.
  const raw = bboxOf(polys.map((p) => p[0]), false);
  const shift = raw[2] - raw[0] > 180;
  const boxes = polys.map((p) => bboxOf([p[0]], shift));
  const main = boxes.reduce((m, b) => (area(b) > area(m) ? b : m));
  const reach = Math.max(6, (main[2] - main[0]) * 0.6, (main[3] - main[1]) * 0.6);
  const near = (b) => b[2] >= main[0] - reach && b[0] <= main[2] + reach && b[3] >= main[1] - reach && b[1] <= main[3] + reach;
  const kept = polys.filter((_, i) => near(boxes[i]));
  const box = bboxOf(kept.map((p) => p[0]), shift);
  const k = Math.cos((((box[1] + box[3]) / 2) * Math.PI) / 180);
  const gw = Math.max((box[2] - box[0]) * k, 0.05), gh = Math.max(box[3] - box[1], 0.05);
  const s = VIEW / Math.max(gw, gh), w = Math.round(gw * s), h = Math.round(gh * s);
  const proj = ([lon, lat]) => [((shift && lon < 0 ? lon + 360 : lon) - box[0]) * k * s, (box[3] - lat) * s];
  // Paths in tenths of a unit so small countries keep their shape.
  const outline = kept.map((p) => polyPath(p, proj, 0.5, 0.6, 10)).join('');
  if (!outline) continue;
  const parts = (byCountry[code] || [])
    .map((f) => {
      const ps = polysOf(f.geometry).filter((p) => near(bboxOf([p[0]], shift)));
      const d = ps.map((p) => polyPath(p, proj, 0.6, 0.8, 10)).join('');
      return d && [f.properties.name_en || f.properties.name, d];
    })
    .filter(Boolean);
  const json = JSON.stringify({ w, h, s: 10, o: outline, p: parts.length > 1 ? parts : [] });
  writeFileSync(new URL(code + '.json', geoDir), json);
  files++; bytes += json.length;
}
console.log(`world.json: ${Object.keys(paths).length} countries, ${W}x${H}; geo/: ${files} close ups, ${Math.round(bytes / 1024)} KB`);
