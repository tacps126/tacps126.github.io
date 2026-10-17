// Regenerates index.html from the public Apify Store listing of tacps126.
// Usage: node build.mjs        (no token needed; reads the public Store API)
import { writeFileSync } from 'node:fs';

const USER = 'tacps126';
const res = await fetch(`https://api.apify.com/v2/store?username=${USER}&limit=100`);
if (!res.ok) throw new Error(`Store API ${res.status}`);
const items = (await res.json()).data.items;
const byName = new Map(items.map((i) => [i.name, i]));

const GROUPS = [
  ['Jobs and hiring data', 'One clean format across career pages, LinkedIn, Indeed and Glassdoor.',
    ['jobs-harvester', 'hiring-signals', 'linkedin-jobs-scraper', 'indeed-jobs', 'glassdoor-jobs-scraper',
     'greenhouse-jobs-scraper', 'lever-jobs-scraper', 'ashby-jobs-scraper', 'workday-jobs-scraper',
     'smartrecruiters-jobs-scraper', 'recruitee-jobs-scraper', 'personio-jobs-scraper',
     'teamtailor-jobs-scraper', 'himalayas-remote-jobs-scraper', 'ai-training-jobs-scraper']],
  ['Leads and contacts', 'Company contact details and trade-show exhibitor lists.',
    ['contact-details', 'exhibition-scraper']],
  ['Reviews, news and social', 'Monitoring with an "only new" mode for scheduled runs.',
    ['trustpilot-reviews', 'app-reviews', 'google-news', 'reddit-monitor']],
  ['E-commerce and real estate', 'Prices, stock and listings in a consistent format.',
    ['shopify-products', 'immobilienscout24-scraper']],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (s, n = 150) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}…`;
};
const price = (d) => (String(d || '').match(/(From \$[\d.,]+ per [\d,]+ [a-z ]+|\$[\d.,]+ per [\d,]+ [a-z ]+|[\d.]+¢ per [a-z ]+)/i) || [])[0];

let used = 0;
const sections = GROUPS.map(([title, blurb, names]) => {
  const cards = names
    .map((n) => byName.get(n))
    .filter(Boolean)
    .map((a) => {
      used += 1;
      const p = price(a.description);
      return `<a class="card" href="https://apify.com/${USER}/${esc(a.name)}">
  <h3>${esc(a.title)}</h3>
  <p>${esc(short(a.description.replace(/\s*(From )?\$[\d.,]+ per [\d,]+ [a-z ]+\.?$/i, '').replace(/\s*\d+¢ per [^.]+\.?.*$/i, '')))}</p>
  ${p ? `<span class="price">${esc(p)}</span>` : ''}
</a>`;
    })
    .join('\n');
  return `<section>
<h2>${esc(title)}</h2>
<p class="muted">${esc(blurb)}</p>
<div class="grid">
${cards}
</div>
</section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tacps126 - web data tools for jobs, news, reviews and leads</title>
<meta name="description" content="Fast, low-cost web data tools on Apify: jobs from career pages, LinkedIn and Indeed, hiring signals, Google News, Trustpilot and app reviews, Reddit, contact details, real estate and Shopify. About $1 per 1,000 results.">
<link rel="canonical" href="https://tacps126.github.io/">
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<header>
  <h1>Web data tools that cost about $1 per 1,000 results</h1>
  <p class="lead">${used} ready-made tools on Apify for jobs, hiring signals, news, reviews, contacts, real estate and e-commerce. Clean, consistent fields; pay per result; no subscription.</p>
  <p><a class="cta" href="https://apify.com/${USER}">Browse all tools on Apify</a></p>
</header>

${sections}

<section>
<h2>For AI agents: one MCP server</h2>
<p>Give Claude, Cursor or any MCP client ten of these tools with typed arguments, a spend cap per call and short results. It runs the tools on your own Apify account.</p>
<pre><code>claude mcp add webdata -e APIFY_TOKEN=&lt;your Apify token&gt; -- npx -y webdata-tools-mcp</code></pre>
<p><a href="https://github.com/tacps126/webdata-tools-mcp">webdata-tools-mcp on GitHub</a> · <a href="https://www.npmjs.com/package/webdata-tools-mcp">npm</a></p>
</section>

<section>
<h2>Copy-paste recipes</h2>
<p>Small scripts for hiring signals, news alerts, review monitoring, contact enrichment and job feeds: <a href="https://github.com/tacps126/apify-data-recipes">apify-data-recipes</a>.</p>
</section>

<section>
<h2>Need a source that is not here?</h2>
<p>Custom scrapers and daily data feeds for niche job boards, recruiters and sales teams. Tell me what you need and I will reply with what is possible and how long it takes.</p>
<p><a class="cta" href="mailto:tacps126@gmail.com?subject=Custom%20data%20request">Email tacps126@gmail.com</a></p>
</section>

<footer>
  <p>The tools read publicly available pages. You are responsible for following each site's terms and the law that applies to you (GDPR, CAN-SPAM) when you use the data.</p>
  <p>Prices are per result on Apify and can change; the Apify page of each tool is the source of truth.</p>
</footer>
</main>
</body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`index.html written with ${used} tools (of ${items.length} public)`);
