// Generates the whole site from the public Apify Store listing of tacps126.
// Usage: node build.mjs        (no token needed; it reads public Apify pages only)
import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const USER = 'tacps126';
const SITE = 'https://tacps126.github.io';
const EMAIL = 'tacps126@gmail.com';
const OWNER = 'Tapaswai Choudhary';
// Listings added in the last few weeks get a "New" badge.
const NEW = new Set(['company-registry', 'sanctions-screener', 'recalls-radar', 'legislation-radar', 'india-district-notices', 'grants-radar', 'alerts-radar', 'tenders-radar', 'gov-radar', 'property-listings', 'remote-jobs-scraper', 'startup-jobs-scraper', 'salary-data-jobs-scraper', 'wellfound-jobs-scraper',
  'dice-jobs-scraper', 'builtin-jobs-scraper', 'reddit-lead-finder', 'shopify-store-analyzer', 'naukri-jobs-scraper',
  'events-scraper', 'luma-events-scraper', 'eventbrite-events-scraper', 'meetup-events-scraper', 'research-radar', 'innovation-radar', 'youtube-transcripts',
  'sports-data', 'nba-scores-stats', 'nfl-scores-stats', 'football-scores-stats', 'tennis-scores-rankings', 'sports-betting-odds', 'lottery-results',
  'prediction-markets', 'polymarket-markets', 'kalshi-markets', 'startup-funding', 'clinical-trials', 'fda-device-clearances', 'npi-providers',
  'podcasts', 'cve-feed']);
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

// Every listing, public or not. Private ones are listed ahead of publishing and stay off the site
// (cards, counts, chips, MCP rows, llms.txt) until the Store shows them; a category with no public
// listing is left out entirely.
const ALL_CATS = [
  ['jobs', 'Jobs and hiring', [
    'jobs-harvester', 'hiring-signals', 'remote-jobs-scraper', 'startup-jobs-scraper', 'salary-data-jobs-scraper',
    'wellfound-jobs-scraper', 'dice-jobs-scraper', 'builtin-jobs-scraper',
    'linkedin-jobs-scraper', 'indeed-jobs', 'glassdoor-jobs-scraper', 'naukri-jobs-scraper', 'levels-fyi-salaries',
    'greenhouse-jobs-scraper', 'lever-jobs-scraper', 'ashby-jobs-scraper', 'workday-jobs-scraper',
    'smartrecruiters-jobs-scraper', 'recruitee-jobs-scraper', 'personio-jobs-scraper',
    'teamtailor-jobs-scraper', 'himalayas-remote-jobs-scraper', 'ai-training-jobs-scraper']],
  ['leads', 'Leads, events and contacts', ['company-registry', 'contact-details', 'reddit-lead-finder', 'shopify-store-analyzer', 'exhibition-scraper',
    'events-scraper', 'luma-events-scraper', 'eventbrite-events-scraper', 'meetup-events-scraper']],
  ['reviews', 'Reviews, news, research and social', ['trustpilot-reviews', 'app-reviews', 'google-news', 'youtube-transcripts', 'youtube-comments', 'podcasts', 'research-radar', 'innovation-radar', 'reddit-monitor']],
  ['gov', 'Government, compliance, tenders, grants, regulation and alerts', ['sanctions-screener', 'recalls-radar', 'tenders-radar', 'grants-radar', 'legislation-radar', 'gov-radar', 'india-district-notices', 'alerts-radar', 'cve-feed']],
  ['health', 'Health and life sciences', ['clinical-trials', 'fda-device-clearances', 'npi-providers']],
  ['commerce', 'E-commerce, vehicles and real estate', ['shopify-products', 'copart-auctions', 'property-listings', 'immobilienscout24-scraper', 'rightmove-scraper', 'propertyfinder-scraper']],
  ['finance', 'Finance and markets', ['short-interest', 'prediction-markets', 'polymarket-markets', 'kalshi-markets', 'startup-funding']],
  ['sports', 'Sports, odds and lotteries', ['sports-data', 'nba-scores-stats', 'nfl-scores-stats', 'football-scores-stats', 'tennis-scores-rankings', 'sports-betting-odds', 'lottery-results']],
  ['travel', 'Travel and transit', ['transit-timetables']],
];
// Local preview of the private listings through the signed-in Apify CLI:
//   PREVIEW_PRIVATE=1 node build.mjs   then   python3 -m http.server -d _preview
// Its pages go to _preview/ (gitignored), so the committed site never names a private listing.
const PREVIEW = !!process.env.PREVIEW_PRIVATE;
const OUT = (p) => new URL((PREVIEW ? './_preview/' : './') + p.replace(/^\.\//, ''), import.meta.url);
if (PREVIEW) mkdirSync(OUT('./'), { recursive: true });
if (PREVIEW) {
  const want = ALL_CATS.flatMap(([, , names]) => names).filter((n) => !byName.has(n));
  for (const name of want) {
    const out = spawnSync('apify', ['api', 'GET', `/v2/acts/${USER}~${name}`], { encoding: 'utf8' }).stdout || '';
    if (!out.includes('{')) continue;
    const d = JSON.parse(out.slice(out.indexOf('{'))).data;
    byName.set(name, { name, title: d.title, description: d.description, stats: {}, currentPricingInfo: (d.pricingInfos || []).at(-1) });
  }
  console.log(`PREVIEW: ${want.length} private listings shown as public`);
}
const CATS = ALL_CATS.map(([k, l, names]) => [k, l, names.filter((n) => byName.has(n))]).filter(([, , names]) => names.length);

const MCP_TOOLS = [
  ['search_grants', 'Open and forecast funding calls: US Grants.gov, EU Funding & Tenders (Horizon Europe…), UKRI', 'grants-radar', '$3 / 1,000 calls'],
  ['get_india_district_notices', "Tenders, recruitment and announcements from India's 748 district websites, by state and district", 'india-district-notices', '$3 / 1,000 notices'],
  ['find_companies', 'New companies and insolvencies (France, Norway, Finland, Estonia, US: New York, Colorado, Connecticut, Oregon) and company search with officers, plus the LEI index', 'company-registry', '$2.50 / 1,000 companies'],
  ['get_supplier_contracts', 'Public contracts a company won (USAspending, TED, Contracts Finder) with a summary per company', 'tenders-radar', '$4 / 1,000 awards'],
  ['screen_sanctions', 'Screen names against official OFAC, UN, EU, UK, Canada and Switzerland sanctions lists (verdict per name)', 'sanctions-screener', '$3 / 1,000 names'],
  ['search_recalls', 'Product recalls and safety alerts: FDA, CPSC, Health Canada, UK FSA/OPSS, EU Safety Gate', 'recalls-radar', '$2 / 1,000 recalls'],
  ['search_legislation', 'New laws and bills: EU regulations and directives (EUR-Lex), UK Acts and SIs, US public laws and bills, Australian and Canadian regulations', 'legislation-radar', '$3 / 1,000 laws'],
  ['get_alerts', 'Official weather and disaster warnings: US NWS, MeteoAlarm (38 countries), India NDMA, Brazil INMET, GDACS, USGS', 'alerts-radar', '$2 / 1,000 alerts'],
  ['search_tenders', 'Public tenders and contract awards: US SAM.gov, EU TED and EU institutions, Ukraine, UK, France, Spain, Germany, Netherlands, Canada, Colombia, Australia, South Africa; by sector, CPV code or value', 'tenders-radar', '$4 / 1,000 notices'],
  ['search_google_news', "Google News with the publisher's real article URL", 'google-news', '$2 / 1,000 articles'],
  ['search_gov_updates', 'Official government updates: Federal Register, GOV.UK, EU Commission, SEC, Indian regulators (RBI, SEBI, TRAI, DGFT…), any RSS feed or list page, by sector', 'gov-radar', '$3 / 1,000 updates'],
  ['get_youtube_transcripts', 'Full transcripts of YouTube videos, playlists, channels or searches, with timed captions', 'youtube-transcripts', '$2.50 / 1,000 transcripts'],
  ['search_research', 'Papers, preprints and patents from OpenAlex, arXiv, PubMed, Europe PMC and the European Patent Office (worldwide); newest or most influential first', 'research-radar', '$3 / 1,000 results'],
  ['analyze_field', "A technology field's opportunity score with reasons, growth, top companies, rising topics, patent trend and possibly free-to-use patents; several fields ranked", 'innovation-radar', '$0.03 / field'],
  ['validate_idea', 'How new or crowded an idea is, who is working on it, and the closest prior work', 'innovation-radar', '$0.03 / idea'],
  ['find_hiring_companies', 'Which companies are hiring for the roles you sell to', 'hiring-signals', '1¢ per company with a signal'],
  ['get_company_jobs', 'Every open job from company career pages or just company names (13 job-board systems)', 'jobs-harvester', '$1 / 1,000 jobs'],
  ['find_remote_jobs', 'Remote jobs from company career sites and remote-job feeds', 'remote-jobs-scraper', '$2 / 1,000 jobs'],
  ['search_startup_jobs', 'Startup jobs on Wellfound with salary and equity', 'wellfound-jobs-scraper', '$2 / 1,000 jobs'],
  ['search_tech_jobs', 'US tech jobs on Dice', 'dice-jobs-scraper', '$0.55 / 1,000 jobs'],
  ['search_indeed_jobs', 'Indeed listings in 9 countries', 'indeed-jobs', '$3 / 1,000 jobs'],
  ['search_naukri_jobs', 'Naukri.com jobs (India) with full description and salary', 'naukri-jobs-scraper', '$1.50 / 1,000 jobs'],
  ['get_trustpilot_reviews', 'Trustpilot reviews, TrustScore and company profile', 'trustpilot-reviews', '$0.50 / 1,000 reviews'],
  ['get_app_reviews', 'App Store and Google Play reviews', 'app-reviews', '$0.20 / 1,000 reviews'],
  ['search_reddit', 'Reddit posts and comments by keyword or subreddit', 'reddit-monitor', '$1 / 1,000 items'],
  ['find_reddit_leads', 'Reddit posts asking for a tool like yours or an alternative to a competitor', 'reddit-lead-finder', '$2 / 1,000 leads'],
  ['find_website_contacts', 'Emails, phones and social profiles from websites', 'contact-details', '$2 / 1,000 sites with contacts'],
  ['search_german_property_listings', 'Rent and buy listings in Germany and Austria', 'immobilienscout24-scraper', '$1 / 1,000 listings'],
  ['get_shopify_products', 'Prices, stock and variants from Shopify stores', 'shopify-products', '$1 / 1,000 products'],
  ['analyze_shopify_stores', 'Shopify store location, catalog and contacts', 'shopify-store-analyzer', '$4 / 1,000 stores'],
  ['get_trade_show_exhibitors', 'Trade-show exhibitors with booths and contacts (91 shows or any supported link)', 'exhibition-scraper', '$2 / 1,000 exhibitors'],
  ['find_events', 'Upcoming events from Luma, Eventbrite and Meetup with organisers and tickets', 'events-scraper', '$1 / 1,000 events'],
  ['get_prediction_markets', 'Kalshi, Polymarket, Manifold and PredictIt odds: probability, change, volume, result, daily history', 'prediction-markets', '$3 / 1,000 markets'],
  ['get_sports_data', 'Scores, box scores, betting lines, standings and rosters for 24 leagues', 'sports-data', '$3 / 1,000 rows'],
  ['get_lottery_results', 'Powerball, Mega Millions and state lotto results with jackpots; hot and cold numbers', 'lottery-results', '$3 / 1,000 rows'],
  ['search_clinical_trials', 'ClinicalTrials.gov studies by condition, drug, sponsor, phase and site, with contacts', 'clinical-trials', '$3 / 1,000 studies'],
  ['search_vulnerabilities', 'CVEs with CVSS, affected products, CISA known-exploited status and EPSS', 'cve-feed', '$3 / 1,000 CVEs'],
  ['search_fda_device_clearances', 'FDA 510(k) clearances and PMA approvals with applicant, device and review time', 'fda-device-clearances', '$4 / 1,000 decisions'],
  ['search_healthcare_providers', 'US doctors, dentists and clinics from the NPI Registry by specialty and place', 'npi-providers', '$3 / 1,000 providers'],
  ['search_podcasts', 'Apple Podcasts search and charts with owner email and activity', 'podcasts', '$4 / 1,000 podcasts'],
  ['search_startup_funding', 'New startup raises from SEC Form D with founders and amounts', 'startup-funding', '$5 / 1,000 filings'],
].filter(([, , actor]) => byName.has(actor)); // tools whose Actor is not public yet stay off the site

// ---------------------------------------------------------------- helpers
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five'];
const N = MCP_TOOLS.length;
const nWord = WORDS[N] ?? String(N);
const NWord = nWord[0].toUpperCase() + nWord.slice(1);

// Warn about public Actors that no category lists (they would be missing from the site).
{
  const listed = new Set(ALL_CATS.flatMap(([, , names]) => names));
  const missing = [...byName.keys()].filter((n) => !listed.has(n));
  if (missing.length) console.warn(`WARNING: public Actors not on the site, add them to ALL_CATS: ${missing.join(', ')}`);
  const hidden = [...listed].filter((n) => !byName.has(n));
  if (hidden.length) console.log(`hidden until public (${hidden.length}): ${hidden.join(', ')}`);
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
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 7v6l-4 2v-8z"/></svg>',
  table: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  train: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-4M15 21l-2-4"/><circle cx="9" cy="14" r=".5"/><circle cx="15" cy="14" r=".5"/></svg>',
  trend: '<svg viewBox="0 0 24 24"><path d="M3 6l7 7 4-4 7 7M21 10v6h-6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.5 2 0 0 1 9.5 15M12 6v2M12 16v2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  pulse: '<svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  ball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10zM12 3v4M16 10l4.5-1.5M14.5 14.5 17 19M9.5 14.5 7 19M8 10 3.5 8.5"/></svg>',
};
const ico = (name) => `<div class="ico">${ICONS[name]}</div>`;
const small = (name, size) => ICONS[name].replace('<svg', `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`);

const header = (active) => `<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/"><img src="/icon-192.png" alt="" width="30" height="30"><span>${OWNER} <span class="handle">(tacps126)</span></span></a>
    <button class="icon-btn menu-btn" id="menu" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">${small('menu', 20)}</button>
    <nav class="nav-links" id="nav-links" aria-label="Main">
      <a href="/#tools">Tools</a>
      <a href="/pricing.html"${active === 'pricing' ? ' aria-current="page"' : ''}>Pricing</a>
      <a href="/mcp.html"${active === 'mcp' ? ' aria-current="page"' : ''}>MCP server</a>
      <a href="/#build">Custom work</a>
      <a href="/blog/"${active === 'blog' ? ' aria-current="page"' : ''}>Blog</a>
      <a href="/about.html"${active === 'about' ? ' aria-current="page"' : ''}>About</a>
      <button class="icon-btn" id="theme" aria-label="Toggle light and dark theme">${small('sun', 18)}</button>
    </nav>
  </div>
</header>`;

const footer = () => `<footer>
  <div class="wrap">
    <div class="foot">
      <div><strong style="color:var(--text)">${OWNER} (tacps126)</strong><br>Web data tools for jobs, news, reviews and leads.<br><a href="mailto:${EMAIL}">${EMAIL}</a></div>
      <ul>
        <li><a href="https://apify.com/${USER}">Tools on Apify</a></li>
        <li><a href="/mcp.html">MCP server</a></li>
        <li><a href="/pricing.html">Pricing</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/about.html">About</a></li>
        <li><a href="/leads/">Trade show exhibitor lists</a></li>
        <li><a href="https://github.com/${USER}/apify-data-recipes">Code recipes</a></li>
      </ul>
      <ul>
        <li><a href="https://github.com/${USER}/webdata-tools-mcp">GitHub</a></li>
        <li><a href="https://www.npmjs.com/package/webdata-tools-mcp">npm</a></li>
        <li><a href="https://smithery.ai/servers/${USER}/webdata-tools-mcp">Smithery</a></li>
        <li><a href="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp">Glama</a></li>
        <li><a href="https://mcprush.com/to/webdata-tools-mcp?ref=badge">MCPRush</a></li>
      </ul>
    </div>
    <p class="fine">The tools read publicly available pages. You are responsible for following each site's terms and the law that applies to you (GDPR, CAN-SPAM) when you use the data. Prices are per result on Apify and can change; each tool's Apify page is the source of truth.</p>
  </div>
</footer>`;

// Every page gets the same furniture: each section with a heading is numbered
// (01, 02 …) and listed in the side indicator, and every hero carries the same
// floating layers. Built here, so no page can miss it.
const slug = (t) => t.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const plain = (t) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
const DECO = `<div class="deco" aria-hidden="true"><div class="cube c1"><i></i><i></i><i></i></div><div class="cube c2"><i></i><i></i><i></i></div><div class="cube c3"><i></i><i></i><i></i></div><span class="orb o1"></span><span class="orb o2"></span></div>`;
function decorate(body) {
  const parts = body.split('<section');
  const toc = [];
  const seen = new Set();
  const out = parts.map((chunk, i) => {
    if (i === 0) return chunk;
    const tag = chunk.slice(0, chunk.indexOf('>'));
    if (/class="[^"]*hero/.test(tag)) {
      return chunk.replace('>', '>' + DECO);
    }
    const head = chunk.indexOf('class="sec-head');
    const h2 = head >= 0 ? chunk.indexOf('<h2', head) : -1;
    if (h2 < 0) return chunk;
    const text = plain(chunk.slice(chunk.indexOf('>', h2) + 1, chunk.indexOf('</h2>', h2)));
    let id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    let label = (tag.match(/data-label="([^"]+)"/) || [])[1] || text;
    if (label.length > 24) label = label.slice(0, 22).replace(/\s+\S*$/, '') + '…';
    let newTag = tag;
    if (!id) {
      id = slug(text) || `s${i}`;
      while (seen.has(id)) id += '-x';
      newTag = `${tag} id="${id}"`;
    }
    seen.add(id);
    toc.push([id, label]);
    const rest = chunk.slice(tag.length);
    const at = rest.indexOf('<h2', rest.indexOf('class="sec-head'));
    return newTag + rest.slice(0, at) + `<span class="sec-num">${esc(label)}</span>` + rest.slice(at);
  });
  const nav = toc.length >= 3
    ? `<nav class="toc" aria-label="On this page">${toc.map(([id, l]) => `<a href="#${id}" data-toc="${id}" aria-label="${esc(l)}"><span>${esc(l)}</span></a>`).join('')}</nav>\n`
    : '';
  return nav + out.join('<section');
}

const page = ({ path, title, description, body, active, jsonld }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f6f7fb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#080c1c" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" sizes="64x64" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="tacps126">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="tacps126: clean web data for jobs, news, reviews and leads">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${OG}">
<link rel="preload" href="/fonts/jetbrains-mono-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${CSS}">
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
${header(active)}
<main id="main">
${decorate(body)}
</main>
${footer()}
<script src="${JS}" defer></script>
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
      const num = p ? Number((p.match(/[\d.]+/) || ['0'])[0]) * (p.includes('¢') ? 10 : 1) : 999;
      return `<a class="card reveal spot" data-tool data-cat="${key}" data-price="${num}" href="https://apify.com/${USER}/${esc(a.name)}" rel="noopener">
  <h3>${esc(a.title)}${NEW.has(a.name) ? ' <span class="new">New</span>' : ''}</h3>
  <p>${esc(short(stripPrice(a.description)))}</p>
  <div class="meta"><span class="tag">${esc(label)}</span>${p ? `<span class="price">${esc(p)}</span>` : ''}</div>
</a>`;
    }),
);

const catCount = (names) => names.filter((n) => byName.has(n)).length;
const chips = [['all', 'All', used], ...CATS.map(([k, l, names]) => [k, l, catCount(names)])]
  .map(([k, l, n], i) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${i === 0}">${esc(l)} <span class="n">${n}</span></button>`)
  .join('');

// Honest live numbers from the Store: runs by the public in the last 30 days
// and how many succeeded. Shown only once there is enough to mean something.
const runs30 = items.reduce((a, i) => {
  const r = i.stats?.publicActorRunStats30Days || {};
  return { total: a.total + (r.TOTAL || 0), ok: a.ok + (r.SUCCEEDED || 0) };
}, { total: 0, ok: 0 });
const okShare = runs30.total >= 50 ? Math.floor((100 * runs30.ok) / runs30.total) : null;

// "The library, at its real size": one dot per tool, area by runs, colour by
// topic; and "What we cover": each topic with its most-run tools.
const CAT_SHORT = { jobs: 'Jobs', leads: 'Leads', reviews: 'Reviews and research', gov: 'Government', health: 'Health', commerce: 'Commerce', finance: 'Finance', sports: 'Sports', travel: 'Travel' };
const toolsOf = (names) => names.map((n) => byName.get(n)).filter(Boolean);
const runsOf = (a) => a.stats?.totalRuns || 0;
const fmt = (n) => n.toLocaleString('en-US');
const allTools = CATS.flatMap(([k, , names]) => toolsOf(names).map((a) => ({ a, k })));
const maxRuns = Math.max(1, ...allTools.map((t) => runsOf(t.a)));
const dots = allTools
  .slice()
  .sort((x, y) => runsOf(y.a) - runsOf(x.a))
  .map(({ a, k }, i) => {
    const size = Math.round(14 + 30 * Math.sqrt(runsOf(a) / maxRuns));
    return `<a class="dot" data-k="${k}" data-rank="${i}" style="--d:${size}px" href="https://apify.com/${USER}/${esc(a.name)}" rel="noopener" title="${esc(a.title)} · ${fmt(runsOf(a))} runs"><span class="sr">${esc(a.title)}</span></a>`;
  })
  .join('');
// "What people use them for": one card per live topic. `parts` are [listing, phrase]; a phrase
// appears only once its listing is public, so cards never name an unreleased tool.
const USES = [
  ['jobs', 'briefcase', 'Recruiting and job boards', 'Every open role from company career pages (13 systems, or just type a company name), LinkedIn, Indeed, Glassdoor, Wellfound, Dice and remote-job feeds in one format, with only-new mode for daily feeds.'],
  ['leads', 'target', 'Sales and lead generation', 'Hiring signals show who is hiring for the roles you sell to. Reddit Lead Finder spots people asking for a tool like yours. Contact details and the Shopify Store Analyzer add emails, phones and socials.'],
  ['reviews', 'star', 'Brand and reputation', 'Trustpilot and app-store reviews, Google News with real publisher links, and Reddit mentions, with alerts on new items only.'],
  ['health', 'pulse', 'Health and life sciences', [
    ['clinical-trials', 'Clinical trials by condition, drug, sponsor and phase with sites and contacts'],
    ['fda-device-clearances', 'FDA 510(k) and PMA device clearances with the applicant and review time'],
    ['npi-providers', 'US doctors, dentists and clinics from the NPI Registry by specialty and place'],
  ]],
  ['commerce', 'chart', 'Market, vehicle and property data', 'Shopify prices, discounts and stock, Copart salvage and used car auctions with bids and damage, and property listings in Germany, Austria, the UK and the Gulf with coordinates and price per square metre.'],
  ['finance', 'trend', 'Markets, odds and funding', [
    ['short-interest', 'Official short interest for every US stock with days to cover and daily short-sale volume'],
    ['prediction-markets', 'Kalshi, Polymarket, Manifold and PredictIt odds with history and move alerts'],
    ['startup-funding', 'new startup raises from SEC Form D with the founders behind them'],
  ]],
  ['sports', 'ball', 'Sports, odds and lotteries', [
    ['sports-data', 'Scores, box scores, standings and rosters for 24 leagues'],
    ['tennis-scores-rankings', 'ATP and WTA results and rankings'],
    ['sports-betting-odds', 'opening, closing and settled betting lines'],
    ['lottery-results', 'Powerball, Mega Millions and state lotto results with jackpots and hot and cold numbers'],
  ]],
  ['travel', 'train', 'Transit and travel', 'Journeys, next departures, stops and routes from the official timetables of ~2,900 cities and operators, with bus and metro planned in one journey.'],
];
const liveCats = new Set(CATS.map(([k]) => k));
const sentence = (phrases) => {
  const t = phrases.length > 1 ? `${phrases.slice(0, -1).join('; ')}; and ${phrases.at(-1)}` : phrases[0];
  return `${t[0].toUpperCase()}${t.slice(1)}.`;
};
const useCards = USES.map(([k, icon, title, text]) => {
  if (!liveCats.has(k)) return '';
  const body = Array.isArray(text) ? text.filter(([n]) => byName.has(n)).map(([, p]) => p) : [text];
  if (!body.length) return '';
  return `      <a class="card reveal spot" href="#tools" data-filter="${k}">${ico(icon)}<h3>${title}</h3><p>${Array.isArray(text) ? sentence(body) : body[0]}</p></a>`;
}).filter(Boolean).join('\n');
const legend = CATS.map(([k]) => `<span class="lg" data-k="${k}">${esc(CAT_SHORT[k] || k)}</span>`).join('');
const cover = CATS.map(([k, label, names], i) => {
  const ts = toolsOf(names).sort((x, y) => runsOf(y) - runsOf(x));
  return { k, label, i, n: ts.length, top: ts.slice(0, 4) };
});
const coverList = cover
  .map((c) => `<button class="cov" type="button" data-cov="${c.k}" aria-pressed="${c.i === 0}"><span>${esc(c.label)}</span><b>${c.n}</b></button>`)
  .join('');
const coverPanels = cover
  .map((c) => `<div class="cov-panel" data-cov="${c.k}"${c.i === 0 ? '' : ' hidden'}>
  <div class="cov-total"><b>${c.n}</b><span>tools in ${esc(c.label.toLowerCase())}</span></div>
  <p class="cov-sub">Most used here</p>
  <ul>${c.top.map((a) => `<li><a href="https://apify.com/${USER}/${esc(a.name)}" rel="noopener">${esc(a.title)}</a><span>${fmt(runsOf(a))} runs</span></li>`).join('')}</ul>
  <a class="btn" href="#tools" data-filter="${c.k}">See all ${c.n}</a>
</div>`)
  .join('\n');

// Price range from the Store (main event, free-plan tier, per 1,000), so the
// copy follows price changes: "from $0.20 per 1,000; most $1–$3".
const per1k = items
  .map((a) => Object.values(a.currentPricingInfo?.pricingPerEvent?.actorChargeEvents || {}).find((e) => e.isPrimaryEvent))
  .map((e) => (e ? (e.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? e.eventPriceUsd) : null))
  .filter((u) => u && u < 0.01)
  .map((u) => u * 1000)
  .sort((a, b) => a - b);
const q = (f) => per1k[Math.min(per1k.length - 1, Math.floor(f * per1k.length))] || 1;
const usd = (v) => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
const PRICE_FROM = usd(per1k[0] || 1);
const PRICE_MOST = q(0.25) === q(0.75) ? usd(q(0.5)) : `${usd(q(0.25))}–${usd(q(0.75))}`;

// The social preview is drawn from these same numbers on every build
// (scripts/og.py, needs Pillow); without Pillow the last image stays.
if (!PREVIEW) writeFileSync(new URL('./data/og.json', import.meta.url), JSON.stringify({
  name: OWNER,
  topics: 'jobs, news, reviews and leads.',
  tools: used,
  okShare,
  mcpTools: N,
  from: PRICE_FROM,
  cats: CATS.map(([k, , names]) => [k, CAT_SHORT[k] || k, catCount(names)]),
  dots: allTools.map(({ a, k }) => ({ cat: k, runs: runsOf(a) })).sort((x, y) => y.runs - x.runs),
}));
const og = PREVIEW ? { status: 0 } : spawnSync('python3', ['scripts/og.py', 'data/og.json'], { cwd: new URL('.', import.meta.url), stdio: 'inherit' });
if (og.status !== 0) console.warn('og.png not redrawn (python3 with Pillow needed); keeping the last one');

// The share image's URL carries a hash of its bytes, so Discord, Slack and
// LinkedIn (which cache previews per URL) fetch a new image when it changes.
const OG = `${SITE}/og.png?v=${createHash('sha256').update(readFileSync(new URL('./og.png', import.meta.url))).digest('hex').slice(0, 10)}`;

// Asset URLs carry a hash of their content: an update reaches visitors at
// once instead of after their browser's cache expires.
const hashOf = (f) => createHash('sha256').update(readFileSync(new URL(f, import.meta.url))).digest('hex').slice(0, 10);
const CSS = `/style.css?v=${hashOf('./style.css')}`;
const JS = `/app.js?v=${hashOf('./app.js')}`;

// One call from any language: the run-sync endpoint returns the results.
const API_CALL = `curl -X POST \\
  "https://api.apify.com/v2/acts/${USER}~google-news/run-sync-get-dataset-items?token=YOUR_APIFY_TOKEN&format=json" \\
  -H "Content-Type: application/json" \\
  -d '{"queries": ["electric vehicles"], "maxItems": 20}'`;

const indexBody = `
<section class="hero">
  <div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="eyebrow">Web data, ready to use</span>
        <h1>Clean web data for <span class="grad" id="rotate" data-words="jobs, news, reviews and leads|remote and startup jobs|Reddit buying intent|Shopify store leads|trade-show exhibitors">jobs, news, reviews and leads</span></h1>
        <p class="lead">${used} ready-made tools that turn public web pages into consistent, spreadsheet-ready data. Fast, cheap to run, pay per result, no subscription. Use them from Apify, from code, or from your AI agent.</p>
        <div class="cta-row">
          <a class="btn primary" href="https://apify.com/${USER}" rel="noopener">Browse the tools on Apify</a>
          <a class="btn" href="/mcp.html">Connect to your AI agent</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="layers">${code('hiring-signals · real output, 2026-10-17', HERO_SAMPLE)}</div>
        <p class="caption">Which AI companies are hiring security and data roles: one row per company, scored.</p>
      </div>
    </div>
    <div class="stats${okShare ? ' five' : ''}">
      <div class="stat"><b data-count="${used}">${used}</b><span>tools on Apify</span></div>${okShare ? `
      <div class="stat"><b>${okShare}%</b><span>of ${runs30.total.toLocaleString('en-US')} public runs succeeded in the last 30 days</span></div>` : ''}
      <div class="stat"><b data-count="13">13</b><span>job-board systems in one format</span></div>
      <div class="stat"><b data-count="${N}">${N}</b><span>tools in the MCP server</span></div>
      <div class="stat"><b data-count="91">91</b><span>trade shows built in</span></div>
    </div>
  </div>
</section>

<div class="pipe" aria-label="How a tool works">
  <div class="wrap pipe-row">
    <div class="pipe-step"><span class="pipe-ico">${ico('globe')}</span><b>A public source</b><small>career pages, registers, stores, feeds</small></div>
    <div class="pipe-flow" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="pipe-step"><span class="pipe-ico">${ico('filter')}</span><b>Read and checked</b><small>same fields every run, duplicates out</small></div>
    <div class="pipe-flow" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="pipe-step"><span class="pipe-ico">${ico('table')}</span><b>Clean rows</b><small>CSV, Sheets, API, Slack, your agent</small></div>
  </div>
</div>

<section id="library" data-label="Library">
  <div class="wrap">
    <div class="sec-head reveal"><h2>The library, at its real size</h2><p>${used} dots, ${used} tools. The bigger the dot, the more it has been run; hover to name one, click to open it.</p></div>
    <div class="lib-tools reveal"><div class="legend">${legend}</div><div class="lib-sort" role="group" aria-label="Arrange"><button class="chip" type="button" data-arrange="use" aria-pressed="true">By use</button><button class="chip" type="button" data-arrange="topic" aria-pressed="false">By topic</button></div></div>
    <div class="library reveal" id="dots">${dots}</div>
  </div>
</section>

<section class="alt" id="cover" data-label="Coverage">
  <div class="wrap">
    <div class="sec-head reveal"><h2>What we cover</h2><p>Pick a topic to see what people run most in it.</p></div>
    <div class="cov-grid reveal"><div class="cov-list">${coverList}</div><div>${coverPanels}</div></div>
  </div>
</section>

<section id="uses" data-label="Use cases">
  <div class="wrap">
    <div class="sec-head reveal"><h2>What people use them for</h2><p>Pick a job; the tools return the same clean fields every run.</p></div>
    <div class="grid">
${useCards}
    </div>
  </div>
</section>

<section class="alt" id="tools" data-label="All tools">
  <div class="wrap">
    <div class="sec-head reveal"><h2>All tools</h2><p>Each one opens its Apify page, where you can try it free with Apify's monthly credit.</p></div>
    <div class="filters">${chips}<input class="search" id="search" type="search" placeholder="Search tools  ( / )" aria-label="Search tools"><select class="sort" id="sort" aria-label="Sort tools"><option value="cat">By category</option><option value="price">Price: low to high</option><option value="name">Name</option></select><span class="count" id="count" aria-live="polite"></span></div>
    <div class="grid">
${cards.join('\n')}
    </div>
    <p class="empty" id="empty">No tool matches that search.</p>
  </div>
</section>

<section id="why" data-label="Why these">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Built to be fast and cheap to run</h2><p>Runs start instantly and finish in seconds. A typical run costs a fraction of a cent in platform usage, so the price you see is the price you pay.</p></div>
    <div class="grid">
      <div class="card reveal">${ico('bolt')}<h3>Fast and low cost</h3><p>Runs start instantly and finish in seconds, so platform usage stays a fraction of a cent for a typical run.</p></div>
      <div class="card reveal">${ico('coin')}<h3>Pay per result</h3><p>From ${PRICE_FROM} per 1,000 results; most tools ${PRICE_MOST}. Where nothing is found you are not charged, and you can cap spend per run.</p></div>
      <div class="card reveal">${ico('refresh')}<h3>Only new, on a schedule</h3><p>Turn on only-new mode and each scheduled run returns just what changed, so alerts and feeds stay cheap.</p></div>
      <div class="card reveal">${ico('shield')}<h3>Careful with limits</h3><p>Rate limits are respected, failed requests are retried, and runs resume without charging twice.</p></div>
    </div>
  </div>
</section>

<section class="alt" id="code" data-label="From code">
  <div class="wrap split">
    <div class="reveal">
      <span class="eyebrow">From code</span>
      <div class="sec-head" style="margin-top:14px"><h2>One call, results back</h2><p>Every tool is an HTTP endpoint. Send the input, get the rows back as JSON, CSV, Excel or XML, or run it on a schedule and get a webhook when new items arrive. Works from any language, Make, n8n or Zapier.</p></div>
      <div class="cta-row"><a class="btn" href="https://docs.apify.com/api/v2" rel="noopener">API reference</a><a class="btn" href="https://github.com/${USER}/apify-data-recipes" rel="noopener">Ready-made recipes</a></div>
    </div>
    <div class="reveal">${code('terminal', API_CALL)}</div>
  </div>
</section>

<section id="faq" data-label="FAQ">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Before you start</h2></div>
    <div class="faq reveal">
      <details><summary>How do I try a tool?</summary><p>Open it on Apify and press Start. Apify's free plan includes monthly credit, enough to try every tool on real data.</p></details>
      <details><summary>What does it cost?</summary><p>You pay per result: from ${PRICE_FROM} per 1,000, most tools ${PRICE_MOST}, and a few optional extras such as AI insights (see <a href="/pricing.html">pricing</a>). Searches that find nothing are not charged, and every run can be capped at a spend limit you set.</p></details>
      <details><summary>What happens when a website changes?</summary><p>The tools are run against their live sources on a schedule. When a site changes, the tool is fixed and a note goes into its changelog.</p></details>
      <details><summary>Can it read pages behind a login or a captcha?</summary><p>No. The tools read public pages only and never solve captchas. A few accept your own sign-in for pages your account can see, and say plainly when a source is closed.</p></details>
      <details><summary>Which formats can I get?</summary><p>JSON, CSV, Excel, XML or HTML from the run's dataset, a Google Sheet, Slack, Discord or any webhook, and only-new results on a schedule.</p></details>
    </div>
  </div>
</section>

<section class="alt" id="agents" data-label="AI agents">
  <div class="wrap split">
    <div class="reveal">
      <span class="eyebrow">For AI agents</span>
      <div class="sec-head" style="margin-top:14px"><h2>One MCP server, ${nWord} tools</h2><p>Give Claude, Cursor or any MCP client typed tools for jobs (career sites, remote, startups, US tech), hiring signals, news, research papers and field trends, reviews, Reddit leads, contacts, property and Shopify, plus analyst prompts. They run on your own Apify account with a spend cap on every call.</p></div>
      <div class="cta-row"><a class="btn primary" href="/mcp.html">Setup guide</a><a class="btn" href="https://smithery.ai/servers/${USER}/webdata-tools-mcp" rel="noopener">View on Smithery</a></div>
      <div class="pills">${MCP_TOOLS.slice(0, 6).map((t) => `<span class="pill">${t[0]}</span>`).join('')}<span class="pill">+${N - 6} more</span></div>
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

<section id="build" data-label="Custom work">
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

<section class="alt" id="open" data-label="Open source">
  <div class="wrap">
    <div class="sec-head reveal"><h2>Open source and code</h2><p>Small things I publish openly.</p></div>
    <div class="grid two">
      <a class="card reveal spot" href="https://github.com/${USER}/webdata-tools-mcp" rel="noopener"><h3>webdata-tools-mcp</h3><p>The MCP server. MIT licensed, listed in the official MCP Registry, on npm, Smithery, Glama and MCPRush.</p><div class="badges"><img alt="npm version" src="https://img.shields.io/npm/v/webdata-tools-mcp" height="20"><img alt="license MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" height="20"></div></a>
      <a class="card reveal spot" href="https://github.com/${USER}/apify-data-recipes" rel="noopener"><h3>apify-data-recipes</h3><p>Copy-paste scripts for hiring signals, news alerts, review monitoring, contact enrichment, Reddit leads, new-company leads, sanctions checks, recall alerts, YouTube transcripts, Shopify store leads and job feeds.</p></a>
    </div>
  </div>
</section>`;

writeFileSync(
  OUT('./index.html'),
  page({
    path: '/',
    active: 'home',
    title: `${OWNER} (tacps126) - web data tools for jobs, news, reviews and leads`,
    description: `${used} fast, low-cost web data tools on Apify: jobs from career pages, LinkedIn and Indeed, hiring signals, Google News, research papers and technology trends, Trustpilot and app reviews, Reddit, contacts, trade shows and events, real estate and Shopify. About $1 per 1,000 results, plus an MCP server for AI agents.`,
    body: indexBody,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: `${OWNER} (tacps126)`, url: `${SITE}/`, description: 'Web data tools for jobs, news, reviews and leads', author: { '@type': 'Person', name: OWNER, alternateName: 'tacps126', email: EMAIL, url: `https://github.com/${USER}` } },
  }),
);

const money = (usd) => (usd >= 1 ? `$${usd.toFixed(usd % 1 ? 2 : 0)}` : usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4).replace(/0+$/, '')}`);

// ---------------------------------------------------------------- events
// Everything a tool charges, from its Store pricing: the main per-result
// event and any optional ones (AI insights, extra records). Free-plan tier,
// the highest anyone pays. The run start fee is left out (a fraction of a cent).
const eventsOf = (a) => Object.entries(a?.currentPricingInfo?.pricingPerEvent?.actorChargeEvents || {})
  .filter(([k]) => k !== 'apify-actor-start')
  .map(([k, e]) => ({ key: k, title: e.eventTitle, desc: e.eventDescription || '', unit: e.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? e.eventPriceUsd ?? 0, primary: !!e.isPrimaryEvent, once: !!e.isOneTimeEvent }))
  .sort((x, y) => Number(y.primary) - Number(x.primary));
const evPrice = (e) => (e.unit >= 0.01 ? `${money(e.unit)} each` : `${money(e.unit * 1000)} per 1,000`);
const extrasOf = (a) => eventsOf(a).filter((e) => !e.primary);
const extraChips = (a) => extrasOf(a).map((e) => `<span class="xchip" title="${esc(e.desc)}">+ ${esc(e.title)} <b>${evPrice(e)}</b></span>`).join('');

// ---------------------------------------------------------------- mcp page
const catOfActor = Object.fromEntries(CATS.flatMap(([k, , names]) => names.map((n) => [n, k])));
const toolCards = MCP_TOOLS.map(([name, what, actor, price]) => {
  const a = byName.get(actor);
  const evs = a ? eventsOf(a) : [];
  const main = evs.find((e) => e.primary);
  const k = catOfActor[actor] || 'other';
  return `<article class="card mtool" data-tool data-cat="${k}">
  <div class="mtool-top"><code class="mname">${name.replace(/_/g, '_<wbr>')}</code><button class="copy mini" type="button" data-copy="${name}" aria-label="Copy ${name}">Copy</button></div>
  <p>${esc(what)}</p>
  <div class="prices">${main ? `<span class="pchip"><b>${evPrice(main)}</b> ${esc(main.title.toLowerCase())}</span>` : `<span class="pchip"><b>${esc(price)}</b></span>`}${a ? extraChips(a) : ''}</div>
  <a class="mactor" href="https://apify.com/${USER}/${actor}" rel="noopener">Runs ${esc(a?.title || actor)} →</a>
</article>`;
}).join('\n');
const mcpCats = [['all', 'All', MCP_TOOLS.length], ...CATS.map(([k, l]) => [k, CAT_SHORT[k] || l, MCP_TOOLS.filter((t) => catOfActor[t[2]] === k).length])].filter((c) => c[2] > 0);
const mcpChips = mcpCats.map(([k, l, n], i) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${i === 0}">${esc(l)} <span class="n">${n}</span></button>`).join('');


const mcpBody = `
<section class="hero" style="padding-bottom:24px">
  <div class="wrap">
    <span class="eyebrow">MCP server</span>
    <h1>Web data tools for <span class="grad">your AI agent</span></h1>
    <p class="lead">webdata-tools-mcp gives Claude, Cursor and any MCP client ${nWord} typed tools for jobs, hiring signals, news, research papers and patents, field trends and idea validation, reviews, Reddit, contacts, property, Shopify, trade shows and events, plus two analyst prompts. They run ready-made Apify Actors on your own Apify account and return clean, short results.</p>
    <div class="cta-row">
      <a class="btn primary" href="#install">Install</a>
      <a class="btn" href="https://github.com/${USER}/webdata-tools-mcp" rel="noopener">View on GitHub</a>
    </div>
    <div class="badges">
      <a href="https://www.npmjs.com/package/webdata-tools-mcp"><img alt="npm" src="https://img.shields.io/npm/v/webdata-tools-mcp" height="20"></a>
      <a class="pill" href="https://smithery.ai/servers/${USER}/webdata-tools-mcp" rel="noopener">Smithery</a>
      <a href="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp"><img alt="Glama score" src="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp/badges/score.svg" height="20"></a>
      <a class="pill" href="https://mcprush.com/to/webdata-tools-mcp?ref=badge" rel="noopener">MCPRush</a>
      <a class="pill" href="https://github.com/${USER}/webdata-tools-mcp/releases/latest" rel="noopener">Claude Desktop bundle (.mcpb)</a>
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
    <div class="sec-head reveal"><h2>The ${nWord} tools</h2><p>Every tool takes simple arguments plus an optional <code>extra_input</code> for any other field the Actor documents. Prices are Apify pay-per-result prices; extras marked + are charged only when used.</p></div>
    <div class="filters">${mcpChips}<input class="search" id="search" type="search" placeholder="Search tools  ( / )" aria-label="Search tools"><span class="count" id="count" aria-live="polite"></span></div>
    <div class="grid mtools">
${toolCards}
    </div>
    <p class="empty" id="empty">No tool matches that search.</p>
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
      <div class="card reveal"><p>"What should a seed-stage founder build in sodium-ion batteries? Compare it with solid-state." (the <code>field-opportunity-analysis</code> prompt)</p></div>
      <div class="card reveal"><p>"Is a drone that plants trees a new idea? Who is already working on it?" (the <code>idea-validation</code> prompt)</p></div>
    </div>
    <p class="reveal" style="margin-top:18px">Two ready-made prompts, <code>field-opportunity-analysis</code> and <code>idea-validation</code>, turn the research tools into an innovation analyst with the same rubric for any model. Agents that load skills can use <a href="https://github.com/tacps126/webdata-tools-mcp/tree/main/skills/innovation-analyst">skills/innovation-analyst</a>.</p>
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
    <details><summary>Where is it listed?</summary><p>On <a href="https://www.npmjs.com/package/webdata-tools-mcp">npm</a>, in the official MCP Registry as <code>io.github.${USER}/webdata-tools-mcp</code>, on <a href="https://smithery.ai/servers/${USER}/webdata-tools-mcp">Smithery</a>, <a href="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp">Glama</a> and <a href="https://mcprush.com/to/webdata-tools-mcp?ref=badge">MCPRush</a>. Claude Desktop users can install the one-click bundle from the <a href="https://github.com/${USER}/webdata-tools-mcp/releases/latest">latest release</a>.</p></details>
  </div>
</section>`;

writeFileSync(
  OUT('./mcp.html'),
  page({
    path: '/mcp.html',
    active: 'mcp',
    title: 'webdata-tools-mcp - MCP server for jobs, news, reviews and leads',
    description: `${NWord} web-data tools for AI agents: job postings, hiring signals, Google News, research and field trends, Trustpilot and app reviews, Reddit, contacts, property, Shopify, exhibitors and events. Runs Apify Actors on your own token with a spend cap.`,
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

// ---------------------------------------------------------------- lead pages (one per show)
// Data: data/leads/<show>.json, written by apify_actors/scripts/lead_stats.py.
const LEADS_DIR = new URL('./data/leads/', import.meta.url);
const leads = existsSync(LEADS_DIR)
  ? readdirSync(LEADS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(new URL(f, LEADS_DIR), 'utf8')))
      .sort((a, b) => b.total - a.total)
  : [];
const ACTOR_URL = `https://apify.com/${USER}/exhibition-scraper`;
const n = (x) => Number(x).toLocaleString('en-US');
mkdirSync(OUT('./leads/'), { recursive: true });
for (const l of leads) {
  const title = `${l.name} exhibitor list ${l.updated.slice(0, 4)}: ${n(l.total)} companies with booth, website and contacts`;
  const desc = `${l.name}${l.where ? ` (${l.where})` : ''} exhibitor list: ${n(l.total)} exhibitors${l.countriesFromSample ? '' : ` from ${l.countryCount} countries`} with booth, website, phone and email. Free sample, full list as CSV/Excel.`;
  const tiles = [
    [n(l.total), 'exhibitors'],
    [l.countryCount, l.countriesFromSample ? 'countries (in sample)' : 'countries'],
    [`${l.coverage.booth}%`, 'with booth'],
    [`${l.coverage.website}%`, 'with website'],
    [`${l.coverage.email}%`, 'with email*'],
  ]
    .map(([v, k]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`)
    .join('');
  const rows = l.sample
    .map((r) => `<tr><td>${esc(r.company)}</td><td>${esc(r.country)}</td><td>${esc(r.booth)}</td><td>${esc(r.website)}</td></tr>`)
    .join('');
  const countries = l.countries.map(([c, k]) => `<li>${esc(c)} <span class="muted">${n(k)}</span></li>`).join('');
  const body = `
<section class="hero"><div class="wrap">
  <p class="eyebrow">${esc(l.industry)}${l.where ? ` · ${esc(l.where)}` : ''}</p>
  <h1>${esc(l.name)} exhibitor list</h1>
  <p class="lead">Every exhibitor at ${esc(l.name)} as a clean spreadsheet: company, booth and hall, website, phone, address, categories and email. Read from the organiser's <a href="${esc(l.listUrl)}">official exhibitor list</a>${l.listUrl ? '' : ''}; emails missing there are looked up on each company's own website.</p>
  <div class="stats five">${tiles}</div>
  <div class="cta-row">
    <a class="btn primary" href="${ACTOR_URL}">Get the full list (run it yourself, about $2 per 1,000)</a>
    <a class="btn" href="/#build">Have it done for you</a>
  </div>
</div></section>
<section><div class="wrap">
  <h2>Sample: 20 of ${n(l.total)} exhibitors</h2>
  <p class="muted">The full list adds phone, email, address, categories, social profiles and the company description. Emails and phones are left out of this public sample.</p>
  <div class="table-wrap"><table class="sample"><thead><tr><th>Company</th><th>Country</th><th>Booth</th><th>Website</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2>Where exhibitors come from${l.countriesFromSample ? ` <span class="muted">(${l.sampleSize}-exhibitor sample)</span>` : ''}</h2>
  <ul class="countries">${countries}</ul>
  <p class="fine">* Contact coverage measured on a ${l.sampleSize}-exhibitor sample with emails looked up on company websites; updated ${esc(l.updated)}. Data comes from public pages; use it within GDPR and the organiser's terms.</p>
  <h2>Get it</h2>
  <p>Run <a href="${ACTOR_URL}">Trade Show Exhibitor List Scraper</a> with the show <code>${esc(l.id)}</code> (turn on <em>Find emails on company websites</em>), export CSV or Excel, or schedule it with <em>Changes only</em> to get new exhibitors and booth moves until the show. Prefer a ready file? Email <a href="mailto:${EMAIL}?subject=${encodeURIComponent(l.name + ' exhibitor list')}">${EMAIL}</a>.</p>
</div></section>`;
  writeFileSync(
    OUT(`./leads/${l.id}.html`),
    page({
      path: `/leads/${l.id}.html`,
      title,
      description: desc,
      body,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `${l.name} exhibitor list`,
        description: desc,
        url: `${SITE}/leads/${l.id}.html`,
        dateModified: l.updated,
        creator: { '@type': 'Organization', name: 'tacps126' },
        isAccessibleForFree: false,
      },
    }),
  );
}
if (leads.length) {
  const list = leads
    .map((l) => `<a class="card" href="/leads/${l.id}.html"><h3>${esc(l.name)}</h3><p>${esc(l.industry)}${l.where ? ` · ${esc(l.where)}` : ''}</p><p class="muted">${n(l.total)} exhibitors${l.countriesFromSample ? '' : ` · ${l.countryCount} countries`}</p></a>`)
    .join('');
  writeFileSync(
    OUT('./leads/index.html'),
    page({
      path: '/leads/',
      title: 'Trade show exhibitor lists with booth, website and email',
      description: `Exhibitor lists of ${leads.length}+ trade shows (and 90+ more on request) with booth, website, phone and email, as CSV or Excel.`,
      body: `<section class="hero"><div class="wrap"><h1>Trade show exhibitor lists</h1><p class="lead">Ready exhibitor lists with booth, website, phone and email. These are the shows with a page; <a href="${ACTOR_URL}">90+ shows</a> (and any show by link) are supported.</p><div class="grid">${list}</div></div></section>`,
      jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Trade show exhibitor lists' },
    }),
  );
}



// ---------------------------------------------------------------- pricing
// Each tool's price per result (Apify free-plan tier: paid plans pay less)
// and its public runs in the last 30 days, straight from the Store.
const priceRow = (a) => {
  const ev = Object.values(a.currentPricingInfo?.pricingPerEvent?.actorChargeEvents || {}).find((e) => e.isPrimaryEvent);
  const unit = ev ? (ev.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? ev.eventPriceUsd) : null;
  return { a, unit, what: ev ? ev.eventTitle.toLowerCase() : 'result', runs: a.stats?.publicActorRunStats30Days?.TOTAL || 0 };
};
const pricingBody = `
<section class="hero" style="padding-bottom:36px">
  <div class="wrap">
    <span class="eyebrow">Pricing</span>
    <h1 style="margin-top:14px">Pay per result. <span class="grad">Nothing else.</span></h1>
    <p class="lead">No subscription and no seats. Each tool charges per result it delivers, billed by Apify; searches that find nothing are not charged, and every run can be capped at a spend limit. Apify's free plan includes monthly credit to try any of them.</p>
  </div>
</section>

<section data-label="Estimate">
  <div class="wrap">
    <div class="sec-head"><h2>What would it cost?</h2><p>Pick a tool and how many results you need.</p></div>
    <div class="calc">
      <div class="field"><span class="flabel" id="calc-tool-l">Tool</span>
        <div class="combo" id="calc-tool" data-value="" data-what="">
          <button class="combo-btn" type="button" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="calc-tool-l"><span class="combo-val">Choose a tool</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
          <div class="combo-pop" hidden>
            <input class="combo-search" type="search" placeholder="Search ${used} tools" aria-label="Search tools" autocomplete="off">
            <ul role="listbox" aria-labelledby="calc-tool-l">
${CATS.map(([k, label, names]) => {
  const rows = toolsOf(names).map(priceRow).filter((r) => r.unit);
  return rows.length ? `<li class="combo-group" role="presentation">${esc(CAT_SHORT[k] || label)}</li>
` + rows.map((r) => `<li role="option" tabindex="-1" data-value="${r.unit}" data-what="${esc(r.what)}" data-extras="${esc(JSON.stringify(extrasOf(r.a).map((e) => ({ t: e.title, u: e.unit, d: e.desc }))))}"><span>${esc(r.a.title)}</span><small>${money(r.unit * 1000)} / 1k</small></li>`).join('\n') : '';
}).join('\n')}
            </ul>
          </div>
        </div>
      </div>
      <div class="field"><label class="flabel" for="calc-n">Results</label>
        <div class="stepper"><button type="button" data-step="-1" aria-label="Fewer">−</button><input id="calc-n" type="text" inputmode="numeric" value="1,000" maxlength="11"><button type="button" data-step="1" aria-label="More">+</button></div>
        <div class="presets">${[100, 1000, 10000, 100000].map((n) => `<button type="button" class="preset" data-n="${n}">${n >= 1000 ? n / 1000 + 'k' : n}</button>`).join('')}</div>
      </div>
      <div class="calc-out" aria-live="polite"><b id="calc-usd">–</b><span id="calc-note">Choose a tool</span></div>
      <div class="addons" id="calc-addons" hidden><span class="flabel">Optional extras this tool can charge</span><div id="calc-addon-list"></div></div>
    </div>
  </div>
</section>

${CATS.map(([k, label, names], i) => {
  const rows = toolsOf(names).map(priceRow).sort((x, y) => y.runs - x.runs);
  return `<section${i % 2 ? '' : ' class="alt"'} data-label="${esc(CAT_SHORT[k] || label)}">
  <div class="wrap">
    <div class="sec-head"><h2>${esc(label)}</h2></div>
    <div class="table-wrap"><table class="rtable"><thead><tr><th>Tool</th><th>Main price</th><th>Optional extras</th><th>Runs, last 30 days</th></tr></thead><tbody>
${rows.map((r) => `<tr><td data-th="Tool"><a href="https://apify.com/${USER}/${esc(r.a.name)}" rel="noopener">${esc(r.a.title)}</a></td><td class="num" data-th="Main price">${r.unit ? `${evPrice({ unit: r.unit })} <small>· ${esc(r.what)}</small>` : esc(priceOf(r.a.description) || 'see listing')}</td><td data-th="Optional extras">${extraChips(r.a) || '<span class="none">none</span>'}</td><td class="num" data-th="Runs, 30 days">${fmt(r.runs)}</td></tr>`).join('\n')}
    </tbody></table></div>
  </div>
</section>`;
}).join('\n')}

<section data-label="Questions">
  <div class="wrap">
    <div class="sec-head"><h2>Billing questions</h2></div>
    <details><summary>Who bills me?</summary><p>Apify. Prices, invoices and your spending limit live in your Apify account; each tool's Apify page is the source of truth if a number here differs.</p></details>
    <details><summary>Why do prices differ by plan?</summary><p>Apify gives its paid plans a lower price per result. The figures here are the free-plan price, the highest you would pay.</p></details>
    <details><summary>Is anything charged besides results?</summary><p>A tiny start fee per run (a fraction of a cent). A few tools also have optional extras, listed in their row: an AI insight on each item, every list entry checked, or each post read while looking for leads. Extras are charged only when you turn them on or they happen, and your spending cap covers them too. Nothing is charged for searches that come back empty.</p></details>
  </div>
</section>`;

writeFileSync(
  OUT('./pricing.html'),
  page({
    path: '/pricing.html',
    active: 'pricing',
    title: `Pricing - ${OWNER} (tacps126), web data tools`,
    description: `Per-result prices of ${used} web data tools on Apify, with their public runs in the last 30 days and a cost estimate. No subscription.`,
    body: pricingBody,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Pricing', url: `${SITE}/pricing.html` },
  }),
);

// ---------------------------------------------------------------- blog
// posts/*.md (front matter: title, tags, date). The site is the canonical
// home of each article; reposts on Medium or dev.to point their canonical
// URL here, so search engines credit this site.
const inline = (t) => esc(t)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => `<a href="${url}"${url.startsWith('http') ? ' rel="noopener"' : ''}>${txt}</a>`);
function markdown(md) {
  const out = []; const lines = md.split('\n'); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++; out.push(`<div class="code"><div class="code-top"><span>${esc(l.slice(3).trim() || 'code')}</span><button class="copy" type="button">Copy</button></div><pre>${esc(buf.join('\n'))}</pre></div>`); continue;
    }
    const h = l.match(/^(#{2,4})\s+(.*)$/);
    if (h) { const n = h[1].length; out.push(`<h${n} id="${slug(h[2])}">${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^---+$/.test(l.trim())) { out.push('<hr>'); i++; continue; }
    if (l.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r, k) => k !== 1 || !/^\|[\s:|-]+\|$/.test(r.trim()));
      out.push(`<div class="table-wrap"><table><thead><tr>${cells(body[0]).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.slice(1).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const li = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]); const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) { items.push(m[3]); i++; continue; }
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }
        break;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (l.startsWith('> ')) { const buf = []; while (i < lines.length && lines[i].startsWith('> ')) buf.push(lines[i++].slice(2)); out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{2,4}\s|\||\s*([-*]|\d+\.)\s|> |---+$)/.test(lines[i])) buf.push(lines[i++].trim());
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}
const POSTS = existsSync(new URL('./posts/', import.meta.url))
  ? readdirSync(new URL('./posts/', import.meta.url)).filter((f) => f.endsWith('.md')).map((f) => {
      const raw = readFileSync(new URL(`./posts/${f}`, import.meta.url), 'utf8');
      const end = raw.indexOf('\n---\n', 4);
      const fm = Object.fromEntries(raw.slice(4, end).split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
      const body = raw.slice(end + 5);
      const first = (body.split('\n\n').find((x) => x.trim() && !x.startsWith('#') && !x.startsWith('|')) || '').replace(/\s+/g, ' ').replace(/\*\*|`/g, '').trim();
      const words = body.split(/\s+/).length;
      return { id: f.replace(/\.md$/, ''), title: fm.title, tags: (fm.tags || '').split(',').map((t) => t.trim()).filter(Boolean), date: fm.date || TODAY, body, summary: short(first, 190), mins: Math.max(1, Math.round(words / 220)) };
    }).sort((a, b) => b.date.localeCompare(a.date))
  : [];
mkdirSync(OUT('./blog/'), { recursive: true });
for (const p of POSTS) {
  writeFileSync(
    OUT(`./blog/${p.id}.html`),
    page({
      path: `/blog/${p.id}.html`,
      active: 'blog',
      title: p.title,
      description: p.summary,
      body: `<section class="hero" style="padding-bottom:20px"><div class="wrap narrow">
  <a class="back" href="/blog/">← All articles</a>
  <h1 style="margin-top:14px;max-width:none">${esc(p.title)}</h1>
  <p class="post-meta">${p.date} · ${p.mins} min read${p.tags.length ? ' · ' + p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ') : ''}</p>
</div></section>
<article class="post"><div class="wrap narrow">${markdown(p.body)}</div></article>
<section class="alt"><div class="wrap"><div class="cta-band"><div><h2>Try it on your own data</h2><p>Every tool in this article runs on Apify with free monthly credit.</p></div><a class="btn primary" href="https://apify.com/${USER}" rel="noopener">Browse the tools</a></div></div></section>`,
      jsonld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date, author: { '@type': 'Person', name: OWNER }, url: `${SITE}/blog/${p.id}.html` },
    }),
  );
}
writeFileSync(
  OUT('./blog/index.html'),
  page({
    path: '/blog/',
    active: 'blog',
    title: `Blog - ${OWNER} (tacps126), web data how-tos`,
    description: 'How-tos and comparisons for getting clean web data: exhibitor lists, hiring signals, news alerts, property listings.',
    body: `<section class="hero" style="padding-bottom:30px"><div class="wrap">
  <span class="eyebrow">Blog</span>
  <h1 style="margin-top:14px">Guides from <span class="grad">real runs</span></h1>
  <p class="lead">Short how-tos for getting a clean list out of the web, with the exact input to copy.</p>
</div></section>
<section><div class="wrap"><div class="grid two">
${POSTS.map((p) => `<a class="card post-card" href="/blog/${p.id}.html"><span class="post-meta">${p.date} · ${p.mins} min read</span><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><div class="meta">${p.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></a>`).join('\n')}
</div></div></section>`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Blog', name: 'tacps126 blog', url: `${SITE}/blog/` },
  }),
);

// ---------------------------------------------------------------- about
const aboutBody = `
<section class="hero" style="padding-bottom:40px">
  <div class="wrap">
    <span class="eyebrow">About</span>
    <h1 style="margin-top:14px">Clean web data, <span class="grad">fast and cheap to run</span></h1>
    <p class="lead">I'm ${OWNER}. I build tools on Apify that hand you ready-to-use, consistent data, not raw HTML: ${used} of them for jobs, leads, research, government updates, real estate, reviews and news. ${okShare ? `${okShare}% of the ${fmt(runs30.total)} public runs in the last 30 days succeeded.` : ''}</p>
    <div class="cta-row"><a class="btn primary" href="https://apify.com/${USER}" rel="noopener">See them on Apify</a><a class="btn" href="mailto:${EMAIL}?subject=Custom%20data%20request">Ask for a custom tool</a></div>
  </div>
</section>

<section class="alt">
  <div class="wrap">
    <div class="sec-head"><h2>Every tool gives you</h2></div>
    <div class="grid">
      <div class="card">${ico('refresh')}<h3>The same fields every run</h3><p>CSV, Excel or JSON, and only-new or changes-only modes for scheduled monitoring.</p></div>
      <div class="card">${ico('coin')}<h3>Pay only for results</h3><p>Clear per-result prices, nothing charged when nothing is found, and your spending cap is always respected.</p></div>
      <div class="card">${ico('bolt')}<h3>Plugs in anywhere</h3><p>An instant API, an MCP endpoint for AI agents, and delivery to Slack, Discord, Google Sheets or any webhook.</p></div>
      <div class="card">${ico('shield')}<h3>Public data, done carefully</h3><p>Rate limits respected, retries and resume without double-charging. No captcha solving and no logins for you.</p></div>
    </div>
  </div>
</section>

${CATS.map(([k, label, names], i) => `<section${i % 2 ? ' class="alt"' : ''}>
  <div class="wrap">
    <div class="sec-head"><h2>${esc(label)}</h2><p>${toolsOf(names).length} tools</p></div>
    <ul class="about-list">${toolsOf(names).map((a) => `<li><a href="https://apify.com/${USER}/${esc(a.name)}" rel="noopener">${esc(a.title)}</a><span>${esc(short(stripPrice(a.description), 180))}</span></li>`).join('')}</ul>
  </div>
</section>`).join('\n')}

<section class="alt">
  <div class="wrap">
    <div class="cta-band">
      <div><h2>Need a source that isn't here?</h2><p>Custom scrapers, daily data feeds, and private deployments of any of these tools. Requests decide what I build next.</p></div>
      <a class="btn primary" href="mailto:${EMAIL}?subject=Custom%20data%20request">Email ${EMAIL}</a>
    </div>
  </div>
</section>`;

writeFileSync(
  OUT('./about.html'),
  page({
    path: '/about.html',
    active: 'about',
    title: `About - ${OWNER} (tacps126), web data tools`,
    description: `${OWNER} builds ${used} web data tools on Apify for jobs, leads, research, government updates, real estate, reviews and news. Clean fields, pay per result.`,
    body: aboutBody,
    jsonld: { '@context': 'https://schema.org', '@type': 'AboutPage', name: `About ${OWNER}`, url: `${SITE}/about.html` },
  }),
);

// ---------------------------------------------------------------- 404, sitemap, llms.txt
writeFileSync(
  OUT('./404.html'),
  page({
    path: '/404.html',
    title: 'Page not found - tacps126',
    description: 'This page does not exist.',
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Page not found' },
    body: '<section class="hero"><div class="wrap"><h1>Page not found</h1><p class="lead">That address does not exist.</p><a class="btn primary" href="/">Back to the tools</a></div></section>',
  }),
);

writeFileSync(
  OUT('./sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${TODAY}</lastmod></url>
  <url><loc>${SITE}/mcp.html</loc><lastmod>${TODAY}</lastmod></url>
  <url><loc>${SITE}/about.html</loc><lastmod>${TODAY}</lastmod></url>
  <url><loc>${SITE}/pricing.html</loc><lastmod>${TODAY}</lastmod></url>
  <url><loc>${SITE}/blog/</loc><lastmod>${TODAY}</lastmod></url>
${POSTS.map((p) => `  <url><loc>${SITE}/blog/${p.id}.html</loc><lastmod>${p.date}</lastmod></url>`).join('\n')}
${leads.length ? `  <url><loc>${SITE}/leads/</loc><lastmod>${TODAY}</lastmod></url>\n` : ''}${leads.map((l) => `  <url><loc>${SITE}/leads/${l.id}.html</loc><lastmod>${l.updated}</lastmod></url>`).join('\n')}
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
  OUT('./llms.txt'),
  `# tacps126

> Fast, low-cost web data tools published on Apify: jobs and hiring data, contact details, trade-show exhibitors and events, research papers and technology trends, reviews, news, Reddit, real estate and Shopify. Pay per result (about $1 per 1,000). Also an MCP server for AI agents.

- [MCP server (webdata-tools-mcp)](${SITE}/mcp.html): ${nWord} tools for AI agents, MIT licensed, on npm and the official MCP Registry
- [All tools on Apify](https://apify.com/${USER})
- [Code recipes](https://github.com/${USER}/apify-data-recipes)
- Contact: ${EMAIL}

${lines.join('\n')}`,
);

console.log(`site built: ${used} tools, 3 pages`);

if (PREVIEW) {
  for (const f of ['style.css', 'app.js', 'fonts', 'og.png', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'robots.txt']) {
    cpSync(new URL(`./${f}`, import.meta.url), OUT(`./${f}`), { recursive: true });
  }
  console.log('PREVIEW: open with  python3 -m http.server -d _preview');
}
