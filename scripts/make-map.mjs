// Writes data/world.json: one SVG path per country (ISO 3166 alpha-2), for the coverage map.
// Run once (or when the outline should change): node scripts/make-map.mjs
// Source: world-atlas 2.0.2 (Natural Earth 1:110m, public domain) and the ISO code table and English
// names of i18n-iso-countries 7.11.0 (MIT).
import { writeFileSync } from 'node:fs';

const topo = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')).json();
const codes = await (await fetch('https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.11.0/codes.json')).json();
const alpha2 = Object.fromEntries(codes.map(([a2, , num]) => [num, a2]));
const names = (await (await fetch('https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.11.0/langs/en.json')).json()).countries;
const extra = { Kosovo: 'XK', 'N. Cyprus': 'CY', Somaliland: 'SO' };

// TopoJSON arcs are delta-encoded in a quantized grid.
const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
});
// Equirectangular, Antarctica cut off: 1000 wide, latitude 84 N to 58 S.
const W = 1000, TOP = 84, BOTTOM = -58, H = Math.round((W * (TOP - BOTTOM)) / 360);
const px = ([lon, lat]) => [((lon + 180) / 360) * W, ((TOP - lat) / (TOP - BOTTOM)) * H];
const ring = (ids) => {
  const pts = [];
  for (const i of ids) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  // Whole pixels, relative moves: small enough to inline in the page.
  let d = '', lx = null, ly = null, n = 0;
  for (const p of pts) {
    const [x, y] = px(p).map(Math.round);
    if (x === lx && y === ly) continue;
    d += lx === null ? `M${x} ${y}` : `l${x - lx} ${y - ly}`;
    lx = x; ly = y; n++;
  }
  return n > 2 ? d + 'z' : '';
};
const out = {};
for (const g of topo.objects.countries.geometries) {
  const code = alpha2[g.id] || extra[g.properties.name];
  if (!code || code === 'AQ' || !g.arcs) continue;
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  out[code] = (out[code] || '') + polys.map((p) => p.map(ring).join('')).join('');
}
// Short English names for every code (also the ones too small to draw), for labels and place search.
const label = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
Object.assign(label, { US: 'United States', GB: 'United Kingdom', RU: 'Russia', KR: 'South Korea', KP: 'North Korea', IR: 'Iran', SY: 'Syria', VN: 'Vietnam', LA: 'Laos', BO: 'Bolivia', VE: 'Venezuela', TZ: 'Tanzania', MD: 'Moldova', CZ: 'Czechia', TW: 'Taiwan', XK: 'Kosovo' });
writeFileSync(new URL('../data/world.json', import.meta.url), JSON.stringify({ w: W, h: H, names: label, paths: out }));
console.log(`world.json: ${Object.keys(out).length} countries, ${W}x${H}`);
