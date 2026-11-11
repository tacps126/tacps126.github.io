// Tells IndexNow (Bing, Yandex, Seznam, Naver and others) which pages changed today, from the
// sitemap dates that build.mjs keeps in data/lastmod.json. Run after the site is pushed and live:
//   node scripts/indexnow.mjs          (pages dated today)
//   node scripts/indexnow.mjs --all    (every page; once, after setting it up)
// The key is public by design: IndexNow checks it against /<key>.txt on the site.
import { readFileSync } from 'node:fs';

const SITE = 'https://apirows.com';
const KEY = '285363c0fb427a95175b2ab8a9bf3536';
const TODAY = new Date().toISOString().slice(0, 10);
const all = process.argv.includes('--all');
const dates = JSON.parse(readFileSync(new URL('../data/lastmod.json', import.meta.url), 'utf8'));
const urlList = Object.entries(dates).filter(([, v]) => all || v.date === TODAY).map(([p]) => SITE + p);
if (!urlList.length) {
  console.log('indexnow: no pages changed today');
  process.exit(0);
}
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'apirows.com', key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
// 200 and 202 both mean accepted; 403 means the key file is not live yet.
console.log(`indexnow: ${urlList.length} URLs, HTTP ${res.status}`);
if (res.status >= 400) process.exit(1);
