// Generates the whole site from the public Apify Store listing of tacps126.
// Usage: node build.mjs        (no token needed; it reads public Apify pages only)
import { writeFileSync } from 'node:fs';

const USER = 'tacps126';
const SITE = 'https://tacps126.github.io';
const EMAIL = 'tacps126@gmail.com';
const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- data
const res = await fetch(`https://api.apify.com/v2/store?username=${USER}&limit=100`);
if (!res.ok) throw new Error(`Store API ${res.status}`);
const items = (await res.json()).data.items;
const byName = new Map(items.map((i) => [i.name, i]));
// The Store listing can lag behind edits; the Actor endpoint is always current.
await Promise.all(
  [...byName.keys()].map(async (name) => {
    const r = await fetch(`https://api.apify.com/v2/acts/${USER}~${name}`);
    if (!r.ok) return;
    const d = (await r.json()).data;
    byName.set(name, { ...byName.get(name), title: d.title || byName.get(name).title, description: d.description || byName.get(name).description });
  }),
);

const CATS = [
  ['jobs', 'Jobs and hiring', [
    'jobs-harvester', 'hiring-signals', 'linkedin-jobs-scraper', 'indeed-jobs', 'glassdoor-jobs-scraper',
    'greenhouse-jobs-scraper', 'lever-jobs-scraper', 'ashby-jobs-scraper', 'workday-jobs-scraper',
    'smartrecruiters-jobs-scraper', 'recruitee-jobs-scraper', 'personio-jobs-scraper',
    'teamtailor-jobs-scraper', 'himalayas-remote-jobs-scraper', 'ai-training-jobs-scraper']],
  ['leads', 'Leads and contacts', ['contact-details', 'exhibition-scraper']],
  ['reviews', 'Reviews, news and social', ['trustpilot-reviews', 'app-reviews', 'google-news', 'reddit-monitor']],
  ['commerce', 'E-commerce and real estate', ['shopify-products', 'immobilienscout24-scraper', 'rightmove-scraper']],
];

const MCP_TOOLS = [
  ['search_google_news', "Google News with the publisher's real article URL", 'google-news', '$2 / 1,000 articles'],
  ['find_hiring_companies', 'Which companies are hiring for the roles you sell to', 'hiring-signals', '1¢ per company with a signal'],
  ['get_company_jobs', 'Every open job from company career pages', 'jobs-harvester', '$1 / 1,000 jobs'],
  ['search_indeed_jobs', 'Indeed listings in 9 countries', 'indeed-jobs', '$3 / 1,000 jobs'],
  ['get_trustpilot_reviews', 'Trustpilot reviews, TrustScore and company profile', 'trustpilot-reviews', '$0.50 / 1,000 reviews'],
  ['get_app_reviews', 'App Store and Google Play reviews', 'app-reviews', '$0.20 / 1,000 reviews'],
  ['search_reddit', 'Reddit posts and comments by keyword or subreddit', 'reddit-monitor', '$1 / 1,000 items'],
  ['find_website_contacts', 'Emails, phones and social profiles from websites', 'contact-details', '$2 / 1,000 sites with contacts'],
  ['search_german_property_listings', 'Rent and buy listings in Germany and Austria', 'immobilienscout24-scraper', '$1 / 1,000 listings'],
  ['get_shopify_products', 'Prices, stock and variants from Shopify stores', 'shopify-products', '$1 / 1,000 products'],
];

// ---------------------------------------------------------------- helpers
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
const N = MCP_TOOLS.length;
const nWord = WORDS[N] ?? String(N);
const NWord = nWord[0].toUpperCase() + nWord.slice(1);

// Warn about public Actors that no category lists (they would be missing from the site).
{
  const listed = new Set(CATS.flatMap(([, , names]) => names));
  const missing = [...byName.keys()].filter((n) => !listed.has(n));
  if (missing.length) console.warn(`WARNING: public Actors not on the site, add them to CATS: ${missing.join(', ')}`);
  const gone = [...listed].filter((n) => !byName.has(n));
  if (gone.length) console.warn(`WARNING: listed Actors that are no longer public: ${gone.join(', ')}`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (s, n = 140) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}…`;
};
const priceOf = (d) => (String(d || '').match(/(From \$[\d.,]+ per [\d,]+ [a-z ]+|\$[\d.,]+ per [\d,]+ [a-z ]+|[\d.]+¢ per [a-z ]+)/i) || [])[0];
const stripPrice = (d) => String(d || '').replace(/\s*(From )?\$[\d.,]+ per [\d,]+ [a-z ]+\.?$/i, '').replace(/\s*\d+¢ per [^.]+\.?.*$/i, '');

const ICONS = {
  briefcase: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.5 2 0 0 1 9.5 15M12 6v2M12 16v2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};
const ico = (name) => `<div class="ico">${ICONS[name]}</div>`;
const small = (name, size) => ICONS[name].replace('<svg', `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`);

const header = (active) => `<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/"><img src="/icon-192.png" alt="" width="30" height="30">tacps126</a>
    <button class="icon-btn menu-btn" id="menu" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">${small('menu', 20)}</button>
    <nav class="nav-links" id="nav-links" aria-label="Main">
      <a href="/#tools">Tools</a>
      <a href="/mcp.html"${active === 'mcp' ? ' aria-current="page"' : ''}>MCP server</a>
      <a href="/#build">Custom work</a>
      <a href="https://github.com/${USER}">GitHub</a>
      <button class="icon-btn" id="theme" aria-label="Toggle light and dark theme">${small('sun', 18)}</button>
    </nav>
  </div>
</header>`;

const footer = () => `<footer>
  <div class="wrap">
    <div class="foot">
      <div><strong style="color:var(--text)">tacps126</strong><br>Web data tools, built in Rust.<br><a href="mailto:${EMAIL}">${EMAIL}</a></div>
      <ul>
        <li><a href="https://apify.com/${USER}">Tools on Apify</a></li>
        <li><a href="/mcp.html">MCP server</a></li>
        <li><a href="https://github.com/${USER}/apify-data-recipes">Code recipes</a></li>
      </ul>
      <ul>
        <li><a href="https://github.com/${USER}/webdata-tools-mcp">GitHub</a></li>
        <li><a href="https://www.npmjs.com/package/webdata-tools-mcp">npm</a></li>
        <li><a href="https://smithery.ai/servers/${USER}/webdata-tools-mcp">Smithery</a></li>
        <li><a href="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp">Glama</a></li>
      </ul>
    </div>
    <p class="fine">The tools read publicly available pages. You are responsible for following each site's terms and the law that applies to you (GDPR, CAN-SPAM) when you use the data. Prices are per result on Apify and can change; each tool's Apify page is the source of truth.</p>
  </div>
</footer>`;

const page = ({ path, title, description, body, active, jsonld }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta name="theme-color" content="#080c1c">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" sizes="64x64" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="tacps126">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og.png">
<link rel="stylesheet" href="/style.css">
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
${header(active)}
<main>
${body}
</main>
${footer()}
<script src="/app.js" defer></script>
</body>
</html>
`;

const code = (label, text) => `<div class="code">
  <div class="code-top"><span>${esc(label)}</span><button class="copy" type="button">Copy</button></div>
  <pre>${esc(text)}</pre>
</div>`;

const CLAUDE_CODE = 'claude mcp add webdata -e APIFY_TOKEN=<your Apify token> -- npx -y webdata-tools-mcp';
const JSON_CFG = `{
  "mcpServers": {
    "webdata": {
      "command": "npx",
      "args": ["-y", "webdata-tools-mcp"],
      "env": { "APIFY_TOKEN": "<your Apify token>" }
    }
  }
}`;

// ---------------------------------------------------------------- index
const HERO_SAMPLE = `{
  "company": "Databricks",
  "board": "greenhouse",
  "signalScore": 100,
  "totalOpenRoles": 898,
  "matchingRoles": 19,
  "rolesPostedLast7Days": 7,
  "remoteShare": 26
}`;
let used = 0;
const cards = CATS.flatMap(([key, label, names]) =>
  names
    .map((n) => byName.get(n))
    .filter(Boolean)
    .map((a) => {
      used += 1;
      const p = priceOf(a.description);
      return `<a class="card reveal" data-tool data-cat="${key}" href="https://apify.com/${USER}/${esc(a.name)}" rel="noopener">
  <h3>${esc(a.title)}</h3>
  <p>${esc(short(stripPrice(a.description)))}</p>
  <div class="meta"><span class="tag">${esc(label)}</span>${p ? `<span class="price">${esc(p)}</span>` : ''}</div>
</a>`;
    }),
);

const chips = [['all', 'All'], ...CATS.map(([k, l]) => [k, l])]
  .map(([k, l], i) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${i === 0}">${esc(l)}</button>`)
  .join('');

const indexBody = `
<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="eyebrow">Web data, built in Rust</span>
        <h1>Clean web data for <span class="grad">jobs, news, reviews and leads</span></h1>
        <p class="lead">${used} ready-made tools that turn public web pages into consistent, spreadsheet-ready data. Fast, cheap to run, pay per result, no subscription. Use them from Apify, from code, or from your AI agent.</p>
        <div class="cta-row">
          <a class="btn primary" href="https://apify.com/${USER}" rel="noopener">Browse the tools on Apify</a>
          <a class="btn" href="/mcp.html">Connect to your AI agent</a>
        </div>
      </div>
      <div class="hero-visual">
        ${code('hiring-signals · real output, 2026-10-17', HERO_SAMPLE)}
        <p class="caption">Which AI companies are hiring security and data roles: one row per company, scored.</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><b>${used}</b><span>tools on Apify</span></div>
      <div class="stat"><b>$0.20+</b><span>per 1,000 results</span></div>
      <div class="stat"><b>${N}</b><span>tools in the MCP server</span></div>
      <div class="stat"><b>0</b><span>subscriptions</span></div>
    </div>
  </div>
</section>

<section id="uses">
  <div class="wrap">
    <div class="sec-head reveal"><h2>What people use them for</h2><p>Pick a job; the tools return the same clean fields every run.</p></div>
    <div class="grid">
      <a class="card reveal" href="#tools" data-filter="jobs">${ico('briefcase')}<h3>Recruiting and job boards</h3><p>Every open role from company career pages, LinkedIn, Indeed and Glassdoor in one format, with only-new mode for daily feeds.</p></a>
      <a class="card reveal" href="#tools" data-filter="leads">${ico('target')}<h3>Sales and lead generation</h3><p>Hiring signals show who is hiring for the roles you sell to. Contact details add emails, phones and socials for any website list.</p></a>
      <a class="card reveal" href="#tools" data-filter="reviews">${ico('star')}<h3>Brand and reputation</h3><p>Trustpilot and app-store reviews, Google News with real publisher links, and Reddit mentions, with alerts on new items only.</p></a>
      <a class="card reveal" href="#tools" data-filter="commerce">${ico('chart')}<h3>Market and property data</h3><p>Shopify prices, discounts and stock, plus German rent and buy listings with coordinates and price per square metre.</p></a>
    </div>
  </div>
</section>

<section class="alt" id="tools">
  <div class="wrap">
    <div class="sec-head reveal"><h2>All tools</h2><p>Each one opens its Apify page, where you can try it free with Apify's monthly credit.</p></div>
    <div class="filters">${chips}<input class="search" id="search" type="search" placeholder="Search tools" aria-label="Search tools"></div>
    <div class="grid">
${cards.join('\n')}
    </div>
    <p class="empty" id="empty">No tool matches that search.</p>
  </div>
</section>

<section id="why">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Built to be fast and cheap to run</h2><p>The tools are small native programs, not heavy browser scripts. A typical run costs a fraction of a cent in platform usage, so the price you see is the price you pay.</p></div>
    <div class="grid">
      <div class="card reveal">${ico('bolt')}<h3>Rust, no browser by default</h3><p>Single static binaries that start instantly and run in 256 MB. A browser is used only where a site needs one.</p></div>
      <div class="card reveal">${ico('coin')}<h3>Pay per result</h3><p>About $1 per 1,000 results for most tools. Where nothing is found you are not charged, and you can cap spend per run.</p></div>
      <div class="card reveal">${ico('refresh')}<h3>Only new, on a schedule</h3><p>Turn on only-new mode and each scheduled run returns just what changed, so alerts and feeds stay cheap.</p></div>
      <div class="card reveal">${ico('shield')}<h3>Careful with limits</h3><p>Rate limits are respected, failed requests are retried, and runs resume without charging twice.</p></div>
    </div>
  </div>
</section>

<section class="alt" id="agents">
  <div class="wrap split">
    <div class="reveal">
      <span class="eyebrow">For AI agents</span>
      <div class="sec-head" style="margin-top:14px"><h2>One MCP server, ${nWord} tools</h2><p>Give Claude, Cursor or any MCP client typed tools for jobs, hiring signals, news, reviews, Reddit, contacts, property and Shopify. They run on your own Apify account with a spend cap on every call.</p></div>
      <div class="cta-row"><a class="btn primary" href="/mcp.html">Setup guide</a><a class="btn" href="https://smithery.ai/servers/${USER}/webdata-tools-mcp" rel="noopener">View on Smithery</a></div>
      <div class="pills">${MCP_TOOLS.slice(0, 6).map((t) => `<span class="pill">${t[0]}</span>`).join('')}<span class="pill">+4 more</span></div>
    </div>
    <div class="reveal">
      <div class="tabs" role="tablist" data-tabs>
        <button class="tab" role="tab" aria-selected="true">Claude Code</button>
        <button class="tab" role="tab" aria-selected="false">Claude Desktop, Cursor</button>
      </div>
      <div class="panel">${code('terminal', CLAUDE_CODE)}</div>
      <div class="panel" hidden>${code('mcpServers config', JSON_CFG)}</div>
    </div>
  </div>
</section>

<section id="build">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Need something that is not here?</h2><p>Custom scrapers and daily data feeds for niche job boards, recruiters and sales teams.</p></div>
    <div class="steps">
      <div class="step reveal"><h3>Tell me the source</h3><p>Which sites or fields you need and how often.</p></div>
      <div class="step reveal"><h3>Get a free sample</h3><p>A real file in your format within a couple of working days.</p></div>
      <div class="step reveal"><h3>It runs every day</h3><p>CSV, Google Sheet, webhook or Slack, new items only.</p></div>
    </div>
    <div class="cta-band reveal" style="margin-top:36px">
      <div><h2>Start with a sample</h2><p>Send the niche, three example employers or sites, and where the data should go.</p></div>
      <a class="btn primary" href="mailto:${EMAIL}?subject=Custom%20data%20request">Email ${EMAIL}</a>
    </div>
  </div>
</section>

<section class="alt" id="open">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Open source and code</h2><p>Small things I publish openly.</p></div>
    <div class="grid two">
      <a class="card reveal" href="https://github.com/${USER}/webdata-tools-mcp" rel="noopener"><h3>webdata-tools-mcp</h3><p>The MCP server. MIT licensed, listed in the official MCP Registry, on npm, Smithery and Glama.</p><div class="badges"><img alt="npm version" src="https://img.shields.io/npm/v/webdata-tools-mcp" height="20"><img alt="license MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" height="20"></div></a>
      <a class="card reveal" href="https://github.com/${USER}/apify-data-recipes" rel="noopener"><h3>apify-data-recipes</h3><p>Copy-paste scripts for hiring signals, news alerts, review monitoring, contact enrichment and job feeds.</p></a>
    </div>
  </div>
</section>`;

writeFileSync(
  new URL('./index.html', import.meta.url),
  page({
    path: '/',
    active: 'home',
    title: 'tacps126 - web data tools for jobs, news, reviews and leads',
    description: `${used} fast, low-cost web data tools on Apify: jobs from career pages, LinkedIn and Indeed, hiring signals, Google News, Trustpilot and app reviews, Reddit, contacts, real estate and Shopify. About $1 per 1,000 results, plus an MCP server for AI agents.`,
    body: indexBody,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'tacps126', url: `${SITE}/`, description: 'Web data tools for jobs, news, reviews and leads, built in Rust.' },
  }),
);

// ---------------------------------------------------------------- mcp page
const toolRows = MCP_TOOLS.map(
  ([name, what, actor, price]) =>
    `<tr><td><code>${name}</code></td><td>${esc(what)}</td><td>${esc(price)}</td><td><a href="https://apify.com/${USER}/${actor}" rel="noopener">${actor}</a></td></tr>`,
).join('\n');

const mcpBody = `
<section class="hero" style="padding-bottom:24px">
  <div class="wrap">
    <span class="eyebrow">MCP server</span>
    <h1>Web data tools for <span class="grad">your AI agent</span></h1>
    <p class="lead">webdata-tools-mcp gives Claude, Cursor and any MCP client ${nWord} typed tools for jobs, hiring signals, news, reviews, Reddit, contacts, German property and Shopify. They run ready-made Apify Actors on your own Apify account and return clean, short results.</p>
    <div class="cta-row">
      <a class="btn primary" href="#install">Install</a>
      <a class="btn" href="https://github.com/${USER}/webdata-tools-mcp" rel="noopener">View on GitHub</a>
    </div>
    <div class="badges">
      <a href="https://www.npmjs.com/package/webdata-tools-mcp"><img alt="npm" src="https://img.shields.io/npm/v/webdata-tools-mcp" height="20"></a>
      <a class="pill" href="https://smithery.ai/servers/${USER}/webdata-tools-mcp" rel="noopener">Smithery</a>
      <a href="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp"><img alt="Glama score" src="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp/badges/score.svg" height="20"></a>
    </div>
  </div>
</section>

<section id="install">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Install in two minutes</h2><p>You need Node.js 18+ and a free Apify account. Copy your API token from Apify Console → Settings → API &amp; Integrations.</p></div>
    <div class="tabs" role="tablist" data-tabs>
      <button class="tab" role="tab" aria-selected="true">Claude Code</button>
      <button class="tab" role="tab" aria-selected="false">Claude Desktop</button>
      <button class="tab" role="tab" aria-selected="false">Cursor, Windsurf</button>
    </div>
    <div class="panel">${code('terminal', CLAUDE_CODE)}</div>
    <div class="panel" hidden>${code('claude_desktop_config.json', JSON_CFG)}</div>
    <div class="panel" hidden>${code('mcp.json', JSON_CFG)}</div>
    <p style="margin-top:16px;color:var(--muted)">Prefer no install? Apify's hosted server works too: <code>https://mcp.apify.com?tools=${USER}/google-news,${USER}/hiring-signals</code> (it signs in with OAuth; its tools take each Actor's raw input fields).</p>
  </div>
</section>

<section class="alt" id="tools">
  <div class="wrap">
    <div class="sec-head reveal"><h2>The ${nWord} tools</h2><p>Every tool takes simple arguments plus an optional <code>extra_input</code> for any other field the Actor documents. Costs are Apify pay-per-result prices.</p></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Tool</th><th>What it returns</th><th>Cost</th><th>Actor</th></tr></thead>
      <tbody>
${toolRows}
      </tbody>
    </table></div>
  </div>
</section>

<section id="try">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Try asking</h2></div>
    <div class="grid">
      <div class="card reveal"><p>"Which of these companies are hiring data engineers right now? boards.greenhouse.io/stripe, jobs.lever.co/spotify"</p></div>
      <div class="card reveal"><p>"Show the 1 and 2 star Trustpilot reviews of example.com from the last 30 days and group the complaints."</p></div>
      <div class="card reveal"><p>"Find news from the last 7 days about open-source LLM licensing, with the real publisher links."</p></div>
      <div class="card reveal"><p>"What does a 2-room flat in Berlin cost to rent right now? Give me the cheapest ten with coordinates."</p></div>
    </div>
  </div>
</section>

<section class="alt" id="safety">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Safe by design</h2></div>
    <div class="grid">
      <div class="card reveal">${ico('coin')}<h3>Spend cap per call</h3><p>Every call is capped at $0.50 by default (<code>WEBDATA_MAX_CHARGE_USD</code>). Apify stops the run when it is reached.</p></div>
      <div class="card reveal">${ico('shield')}<h3>Read-only tools</h3><p>All tools only read public web data and are marked read-only, so clients can run them without extra prompts.</p></div>
      <div class="card reveal">${ico('bolt')}<h3>Short, structured results</h3><p>Results come back as text and as structured content. Long fields are shortened and one result is limited to about 60,000 characters.</p></div>
      <div class="card reveal">${ico('target')}<h3>Your account, your token</h3><p>The server talks only to Apify. Your token stays in your own configuration and runs bill to your own Apify account.</p></div>
    </div>
  </div>
</section>

<section id="faq">
  <div class="wrap" style="max-width:820px">
    <div class="sec-head reveal"><h2>Questions</h2></div>
    <details><summary>What does it cost?</summary><p>The server is free and MIT licensed. Each tool bills the Apify pay-per-result price shown above to your own Apify account (about $1 to $3 per 1,000 results). Apify's free plan includes monthly credit to try it.</p></details>
    <details><summary>Where does my API token go?</summary><p>Into the environment of the server process on your machine. It is sent only to Apify's API to run the Actors. It is not logged or sent anywhere else.</p></details>
    <details><summary>Can I change the limits?</summary><p>Yes: <code>WEBDATA_MAX_CHARGE_USD</code> (spend cap per call, default 0.5) and <code>WEBDATA_TIMEOUT_SECS</code> (how long one call may run, default 150, from 30 to 300).</p></details>
    <details><summary>Is it legal to use the data?</summary><p>The Actors read publicly available pages. You are responsible for following each site's terms and the law that applies to you (for example GDPR and CAN-SPAM), especially for contact details.</p></details>
    <details><summary>Where is it listed?</summary><p>On <a href="https://www.npmjs.com/package/webdata-tools-mcp">npm</a>, in the official MCP Registry as <code>io.github.${USER}/webdata-tools-mcp</code>, on <a href="https://smithery.ai/servers/${USER}/webdata-tools-mcp">Smithery</a> and on <a href="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp">Glama</a>.</p></details>
  </div>
</section>`;

writeFileSync(
  new URL('./mcp.html', import.meta.url),
  page({
    path: '/mcp.html',
    active: 'mcp',
    title: 'webdata-tools-mcp - MCP server for jobs, news, reviews and leads',
    description: `${NWord} web-data tools for AI agents: job postings, hiring signals, Google News, Trustpilot and app reviews, Reddit, contacts, German property and Shopify. Runs Apify Actors on your own token with a spend cap.`,
    body: mcpBody,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'webdata-tools-mcp',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Windows, Linux (Node.js 18+)',
      url: `${SITE}/mcp.html`,
      downloadUrl: 'https://www.npmjs.com/package/webdata-tools-mcp',
      license: 'https://opensource.org/licenses/MIT',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: `MCP server with ${nWord} web-data tools that run Apify Actors on your own account.`,
    },
  }),
);

// ---------------------------------------------------------------- 404, sitemap, llms.txt
writeFileSync(
  new URL('./404.html', import.meta.url),
  page({
    path: '/404.html',
    title: 'Page not found - tacps126',
    description: 'This page does not exist.',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Page not found' },
    body: '<section class="hero"><div class="wrap"><h1>Page not found</h1><p class="lead">That address does not exist.</p><a class="btn primary" href="/">Back to the tools</a></div></section>',
  }),
);

writeFileSync(
  new URL('./sitemap.xml', import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${TODAY}</lastmod></url>
  <url><loc>${SITE}/mcp.html</loc><lastmod>${TODAY}</lastmod></url>
</urlset>
`,
);

const lines = CATS.flatMap(([, label, names]) => [
  `## ${label}`,
  ...names
    .map((n) => byName.get(n))
    .filter(Boolean)
    .map((a) => `- [${a.title}](https://apify.com/${USER}/${a.name}): ${short(stripPrice(a.description), 120)}${priceOf(a.description) ? ` (${priceOf(a.description)})` : ''}`),
  '',
]);
writeFileSync(
  new URL('./llms.txt', import.meta.url),
  `# tacps126

> Fast, low-cost web data tools built in Rust and published on Apify: jobs and hiring data, contact details, reviews, news, Reddit, real estate and Shopify. Pay per result (about $1 per 1,000). Also an MCP server for AI agents.

- [MCP server (webdata-tools-mcp)](${SITE}/mcp.html): ${nWord} tools for AI agents, MIT licensed, on npm and the official MCP Registry
- [All tools on Apify](https://apify.com/${USER})
- [Code recipes](https://github.com/${USER}/apify-data-recipes)
- Contact: ${EMAIL}

${lines.join('\n')}`,
);

console.log(`site built: ${used} tools, 3 pages`);
