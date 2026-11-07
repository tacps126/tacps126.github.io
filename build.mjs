// Generates the whole site from the public Apify Store listing of tacps126.
// Usage: node build.mjs        (no token needed; it reads public Apify pages only)
import { writeFileSync as fsWrite, readFileSync, readdirSync, mkdirSync, existsSync, cpSync } from 'node:fs';
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
  'podcasts', 'cve-feed', 'auctions-radar', 'us-import-records']);
const TODAY = new Date().toISOString().slice(0, 10);

// Plain typing in everything the site writes (Store text included): no em or en dashes, ellipsis
// characters, curly quotes or arrows. Curly double quotes become single ones so attributes and
// JSON strings stay valid. Same rules as apify_actors/scripts/humanize_copy.py.
const PLAIN = [
  [/[ \t]*\u2014[ \t]*/g, ' - '], [/(?<=\d)[ \t]*\u2013[ \t]*(?=\d)/g, '-'], [/[ \t]+\u2013[ \t]+/g, ' - '], [/\u2013/g, '-'],
  [/\u2026/g, '...'], [/[\u2018\u2019]/g, "'"], [/[\u201c\u201d]/g, "'"], [/[ \t]*\u2192[ \t]*/g, ' > '],
];
// Search terms and use cases per tool (data/terms.json): the words people search with that do
// not fit in the Store's short title and description.
const TERMS = JSON.parse(readFileSync(new URL('./data/terms.json', import.meta.url), 'utf8'));
// Public sample files per tool (data/samples.json, copied from apify_actors/docs/marketing/samples-links.json).
const SAMPLES = existsSync(new URL('./data/samples.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('./data/samples.json', import.meta.url), 'utf8')) : {};
// Free weekly datasets on Hugging Face per tool (data/hf.json, from apify_actors/docs/marketing/hf-links.json).
const HF_DATA = existsSync(new URL('./data/hf.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('./data/hf.json', import.meta.url), 'utf8')) : {};
// Clay recipes (data/clay.json, copied from apify_actors/docs/marketing/clay/recipes.json).
const CLAY = existsSync(new URL('./data/clay.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('./data/clay.json', import.meta.url), 'utf8')) : { columns: [], sources: [] };
const CLAY_TOOLS = new Set([...CLAY.columns, ...CLAY.sources].map((r) => r.actor));
// Search engine ownership tags (data/verify.json): paste only the content value each console gives.
const VERIFY = existsSync(new URL('./data/verify.json', import.meta.url)) ? JSON.parse(readFileSync(new URL('./data/verify.json', import.meta.url), 'utf8')) : {};
const verifyTags = [['google', 'google-site-verification'], ['bing', 'msvalidate.01'], ['yandex', 'yandex-verification']]
  .filter(([k]) => VERIFY[k]).map(([k, n]) => `\n<meta name="${n}" content="${VERIFY[k]}">`).join('');
const termsOf = (name) => ({ aka: [], uses: [], ...(TERMS[name] || {}) });
const plainText = (s) => PLAIN.reduce((t, [rx, rep]) => t.replace(rx, rep), s);
const writeFileSync = (path, data, ...rest) => fsWrite(path, typeof data === 'string' ? plainText(data) : data, ...rest);

// ---------------------------------------------------------------- data
const res = await fetch(`https://api.apify.com/v2/store?username=${USER}&limit=100`);
if (!res.ok) throw new Error(`Store API ${res.status}`);
const items = (await res.json()).data.items;
// Store text can lag behind the scrubbed source copy: never repeat how a tool works.
const scrub = (s) => String(s || '').replace(/,?\s*\bno\s+brows(er)\b,?/gi, '').replace(/\s+\./g, '.').replace(/\.\s*\./g, '.').trim();
for (const i of items) i.description = scrub(i.description);
const byName = new Map(items.map((i) => [i.name, i]));
// The Store listing can lag behind edits; the Actor endpoint is always current.
// Its latest public build adds what the tool pages show: the input form (input schema),
// the example input, the README (fields and sample row) and the dataset views.
const DETAIL = new Map();
const getJson = async (url) => {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url).catch(() => null);
    if (r?.ok) return (await r.json()).data;
    if (r && r.status < 500 && r.status !== 429) return null;
    await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
  }
  return null;
};
await Promise.all(
  [...byName.keys()].map(async (name) => {
    const d = await getJson(`https://api.apify.com/v2/acts/${USER}~${name}`);
    if (!d) return;
    byName.set(name, { ...byName.get(name), title: d.title || byName.get(name).title, description: scrub(d.description) || byName.get(name).description });
    const bid = d.taggedBuilds?.latest?.buildId;
    DETAIL.set(name, { act: d, build: bid ? await getJson(`https://api.apify.com/v2/actor-builds/${bid}`) : null });
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
    'us-import-records', 'events-scraper', 'luma-events-scraper', 'eventbrite-events-scraper', 'meetup-events-scraper']],
  ['reviews', 'Reviews, news, research and social', ['trustpilot-reviews', 'app-reviews', 'google-news', 'youtube-transcripts', 'youtube-comments', 'podcasts', 'research-radar', 'innovation-radar', 'reddit-monitor']],
  ['gov', 'Government, compliance, tenders, grants, regulation and alerts', ['sanctions-screener', 'recalls-radar', 'tenders-radar', 'grants-radar', 'legislation-radar', 'gov-radar', 'india-district-notices', 'alerts-radar', 'cve-feed']],
  ['health', 'Health and life sciences', ['clinical-trials', 'fda-device-clearances', 'npi-providers']],
  ['commerce', 'E-commerce, vehicles and real estate', ['shopify-products', 'copart-auctions', 'auctions-radar', 'property-listings', 'immobilienscout24-scraper', 'rightmove-scraper', 'propertyfinder-scraper']],
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
  const cli = (path) => {
    const out = spawnSync('apify', ['api', 'GET', path], { encoding: 'utf8' }).stdout || '';
    return out.includes('{') ? JSON.parse(out.slice(out.indexOf('{'))).data : null;
  };
  for (const name of want) {
    const d = cli(`/v2/acts/${USER}~${name}`);
    if (!d) continue;
    byName.set(name, { name, title: d.title, description: d.description, stats: {}, currentPricingInfo: (d.pricingInfos || []).at(-1) });
    const bid = d.taggedBuilds?.latest?.buildId;
    DETAIL.set(name, { act: d, build: bid ? cli(`/v2/actor-builds/${bid}`) : null });
  }
  console.log(`PREVIEW: ${want.length} private listings shown as public`);
}
const CATS = ALL_CATS.map(([k, l, names]) => [k, l, names.filter((n) => byName.has(n))]).filter(([, , names]) => names.length);

const MCP_TOOLS = [
  ['search_grants', 'Open and forecast funding calls: US Grants.gov, EU Funding & Tenders (Horizon Europe...), UKRI', 'grants-radar', '$3 / 1,000 calls'],
  ['get_india_district_notices', "Tenders, recruitment and announcements from India's 748 district websites, by state and district", 'india-district-notices', '$3 / 1,000 notices'],
  ['find_companies', 'New companies and insolvencies (France, Norway, Finland, Estonia, US: New York, Colorado, Connecticut, Oregon) and company search with officers, plus the LEI index', 'company-registry', '$2.50 / 1,000 companies'],
  ['get_supplier_contracts', 'Public contracts a company won (USAspending, TED, Contracts Finder) with a summary per company', 'tenders-radar', '$4 / 1,000 awards'],
  ['screen_sanctions', 'Screen names against official OFAC, UN, EU, UK, Canada and Switzerland sanctions lists (verdict per name)', 'sanctions-screener', '$3 / 1,000 names'],
  ['search_recalls', 'Product recalls and safety alerts: FDA, CPSC, Health Canada, UK FSA/OPSS, EU Safety Gate', 'recalls-radar', '$2 / 1,000 recalls'],
  ['search_legislation', 'New laws and bills: EU regulations and directives (EUR-Lex), UK Acts and SIs, US public laws and bills, Australian and Canadian regulations', 'legislation-radar', '$3 / 1,000 laws'],
  ['get_alerts', 'Official weather and disaster warnings: US NWS, MeteoAlarm (38 countries), India NDMA, Brazil INMET, GDACS, USGS', 'alerts-radar', '$2 / 1,000 alerts'],
  ['search_tenders', 'Public tenders and contract awards: US SAM.gov, EU TED and EU institutions, Ukraine, UK, France, Spain, Germany, Netherlands, Canada, Colombia, Australia, South Africa; by sector, CPV code or value', 'tenders-radar', '$4 / 1,000 notices'],
  ['search_google_news', "Google News with the publisher's real article URL", 'google-news', '$3 / 1,000 articles'],
  ['search_gov_updates', 'Official government updates: Federal Register, GOV.UK, EU Commission, SEC, Indian regulators (RBI, SEBI, TRAI, DGFT...), any RSS feed or list page, by sector', 'gov-radar', '$3 / 1,000 updates'],
  ['get_youtube_transcripts', 'Full transcripts of YouTube videos, playlists, channels or searches, with timed captions', 'youtube-transcripts', '$2.50 / 1,000 transcripts'],
  ['search_research', 'Papers, preprints and patents from OpenAlex, arXiv, PubMed, Europe PMC and the European Patent Office (worldwide); newest or most influential first', 'research-radar', '$3 / 1,000 results'],
  ['analyze_field', "A technology field's opportunity score with reasons, growth, top companies, rising topics, patent trend and possibly free-to-use patents; several fields ranked", 'innovation-radar', '$0.03 / field'],
  ['validate_idea', 'How new or crowded an idea is, who is working on it, and the closest prior work', 'innovation-radar', '$0.03 / idea'],
  ['find_hiring_companies', 'Which companies are hiring for the roles you sell to', 'hiring-signals', '1¢ per company with a signal'],
  ['get_company_jobs', 'Every open job from company career pages or just company names (13 job-board systems)', 'jobs-harvester', '$1.60 / 1,000 jobs'],
  ['find_remote_jobs', 'Remote jobs from company career sites and remote-job feeds', 'remote-jobs-scraper', '$2 / 1,000 jobs'],
  ['search_startup_jobs', 'Startup jobs on Wellfound with salary and equity', 'wellfound-jobs-scraper', '$2 / 1,000 jobs'],
  ['search_tech_jobs', 'US tech jobs on Dice', 'dice-jobs-scraper', '$0.55 / 1,000 jobs'],
  ['search_indeed_jobs', 'Indeed listings in 9 countries', 'indeed-jobs', '$1.50 / 1,000 jobs (back to $3 on 6 Dec 2026)'],
  ['search_naukri_jobs', 'Naukri.com jobs (India) with full description and salary', 'naukri-jobs-scraper', '$1.50 / 1,000 jobs'],
  ['get_trustpilot_reviews', 'Trustpilot reviews, TrustScore and company profile', 'trustpilot-reviews', '$0.55 / 1,000 reviews'],
  ['get_app_reviews', 'App Store and Google Play reviews', 'app-reviews', '$0.40 / 1,000 reviews'],
  ['search_reddit', 'Reddit posts and comments by keyword or subreddit', 'reddit-monitor', '$1 / 1,000 items'],
  ['find_reddit_leads', 'Reddit posts asking for a tool like yours or an alternative to a competitor', 'reddit-lead-finder', '$2 / 1,000 leads'],
  ['find_website_contacts', 'Emails, phones and social profiles from websites', 'contact-details', '$1.75 / 1,000 sites with contacts'],
  ['find_local_businesses', 'Local businesses by category and city, with their contacts', 'contact-details', '$1.25 / 1,000 businesses + $1.75 / 1,000 with site contacts'],
  ['search_german_property_listings', 'Rent and buy listings in Germany and Austria', 'immobilienscout24-scraper', '$0.95 / 1,000 listings'],
  ['get_shopify_products', 'Prices, stock and variants from Shopify stores, sorted across stores (best deals first)', 'shopify-products', '$1.25 / 1,000 products'],
  ['analyze_shopify_stores', 'Shopify store location, catalog and contacts, filtered and sorted', 'shopify-store-analyzer', '$4 / 1,000 stores'],
  ['get_trade_show_exhibitors', 'Trade-show exhibitors with booths and contacts (91 shows or any supported link)', 'exhibition-scraper', '$3 / 1,000 exhibitors'],
  ['find_events', 'Upcoming events from Luma, Eventbrite and Meetup with organisers and tickets', 'events-scraper', '$1 / 1,000 events'],
  ['get_prediction_markets', 'Kalshi, Polymarket, Manifold and PredictIt odds: probability, change, volume, result, daily history', 'prediction-markets', '$3 / 1,000 markets'],
  ['get_sports_data', 'Scores, box scores, betting lines, standings and rosters for 24 leagues', 'sports-data', '$3 / 1,000 rows'],
  ['get_lottery_results', 'Powerball, Mega Millions and state lotto results with jackpots; hot and cold numbers', 'lottery-results', '$3 / 1,000 rows'],
  ['search_clinical_trials', 'ClinicalTrials.gov studies by condition, drug, sponsor, phase and site, with contacts', 'clinical-trials', '$3 / 1,000 studies'],
  ['search_vulnerabilities', 'CVEs with CVSS, affected products, CISA known-exploited status and EPSS', 'cve-feed', '$3 / 1,000 CVEs'],
  ['search_fda_device_clearances', 'FDA 510(k) clearances and PMA approvals with applicant, device and review time', 'fda-device-clearances', '$4 / 1,000 decisions'],
  ['search_healthcare_providers', 'US doctors, dentists and clinics from the NPI Registry by specialty and place', 'npi-providers', '$3 / 1,000 providers'],
  ['search_podcasts', 'Apple Podcasts search and charts with owner email and activity', 'podcasts', '$4 / 1,000 podcasts'],
  ['find_property_auctions', 'Court, bank and government auctions in Germany, Spain, Italy and India, scored against similar lots and your budget', 'auctions-radar', '$15 / 1,000 lots'],
  ['search_import_records', 'US import records for an importer or supplier: shipment trend, suppliers, HS codes, bills of lading, lookalike importers', 'us-import-records', '$4 / 1,000 profiles, $1 / 1,000 suppliers'],
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
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}...`;
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
<header class="site-header">
  <div class="wrap nav">
    <a class="brand" href="/"><img src="/favicon.svg" alt="tacps126 logo" width="30" height="30"><span>${OWNER} <span class="handle">(tacps126)</span></span></a>
    <button class="kbar" type="button" data-pal aria-label="Search tools and pages"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Search ${used} tools</span><kbd>⌘K</kbd></button>
    <button class="icon-btn menu-btn" id="menu" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">${small('menu', 20)}</button>
    <nav class="nav-links" id="nav-links" aria-label="Main">
      <a href="/tools/"${active === 'tools' ? ' aria-current="page"' : ''}>Tools</a>
      <a href="/#coverage">Coverage</a>
      <a href="/pricing.html"${active === 'pricing' ? ' aria-current="page"' : ''}>Pricing</a>
      <a href="/mcp.html"${active === 'mcp' ? ' aria-current="page"' : ''}>AI agents</a>
      <a href="/blog/"${active === 'blog' ? ' aria-current="page"' : ''}>Blog</a>
      <a href="/about.html"${active === 'about' ? ' aria-current="page"' : ''}>About</a>
      <button class="icon-btn" id="theme" aria-label="Toggle light and dark theme">${small('sun', 18)}</button>
    </nav>
  </div>
</header>`;

const footer = () => `<footer>
  <div class="wrap">
    <div class="foot">
      <div class="foot-brand">
        <a class="brand" href="/"><img src="/favicon.svg" alt="tacps126 logo" width="34" height="34"><span>${OWNER} <span class="handle">(tacps126)</span></span></a>
        <p>Web data tools that gather, clean and enrich public data: jobs, leads, research, markets and public records. Pay per result on Apify, or call them from an AI agent.</p>
        <p><a href="mailto:${EMAIL}">${EMAIL}</a><br><a href="mailto:${EMAIL}?subject=Custom%20data%20request">Ask for a custom dataset</a></p>
      </div>
      <nav aria-label="Topics"><p class="foot-h">Topics</p><ul>
${CATS.map(([k, l]) => `        <li><a href="/tools/${k}/">${esc(CAT_SHORT[k] || l)}</a></li>`).join('\n')}
      </ul></nav>
      <nav aria-label="Explore"><p class="foot-h">Explore</p><ul>
        <li><a href="/tools/">All tools</a></li>
        <li><a href="/#coverage">Coverage map</a></li>
        <li><a href="/#compose">Chain tools</a></li>
        <li><a href="/leads/">Trade show exhibitor lists</a></li>
        <li><a href="/pricing.html">Pricing</a></li>
        <li><a href="/datasets.html">Free datasets</a></li>
        <li><a href="/clay.html">Use with Clay</a></li>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/about.html">About</a></li>
      </ul></nav>
      <nav aria-label="Developers"><p class="foot-h">Developers</p><ul>
        <li><a href="https://apify.com/${USER}">Tools on Apify</a></li>
        <li><a href="/mcp.html">MCP server</a></li>
        <li><a href="https://github.com/${USER}/apify-data-recipes">Code recipes</a></li>
        <li><a href="https://github.com/${USER}/webdata-tools-mcp">GitHub</a></li>
        <li><a href="https://www.npmjs.com/package/webdata-tools-mcp">npm</a></li>
        <li><a href="https://smithery.ai/servers/${USER}/webdata-tools-mcp">Smithery</a></li>
        <li><a href="https://glama.ai/mcp/servers/${USER}/webdata-tools-mcp">Glama</a></li>
      </ul></nav>
    </div>
    <div class="foot-base">
      <p class="fine" id="data-use">The tools read publicly available pages. You are responsible for following each site's terms and the law that applies to you (GDPR, CAN-SPAM) when you use the data. Prices are per result on Apify and can change; each tool's Apify page is the source of truth.</p>
      <p class="fine">&copy; ${TODAY.slice(0, 4)} ${OWNER}</p>
    </div>
  </div>
</footer>`;

// Every page gets the same furniture: each section with a heading gets a small
// label above it (data-label sets a short one) and an id to link to. Built here,
// so no page can miss it.
const slug = (t) => t.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const plain = (t) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
function decorate(body) {
  const parts = body.split('<section');
  const seen = new Set();
  return parts.map((chunk, i) => {
    if (i === 0) return chunk;
    const tag = chunk.slice(0, chunk.indexOf('>'));
    const head = chunk.indexOf('class="sec-head');
    const h2 = head >= 0 ? chunk.indexOf('<h2', head) : -1;
    if (h2 < 0) return chunk;
    const text = plain(chunk.slice(chunk.indexOf('>', h2) + 1, chunk.indexOf('</h2>', h2)));
    let id = (tag.match(/\bid="([^"]+)"/) || [])[1];
    let label = (tag.match(/data-label="([^"]+)"/) || [])[1] || text;
    if (label.length > 24) label = label.slice(0, 22).replace(/\s+\S*$/, '') + '...';
    let newTag = tag;
    if (!id) {
      id = slug(text) || `s${i}`;
      while (seen.has(id)) id += '-x';
      newTag = `${tag} id="${id}"`;
    }
    seen.add(id);
    const rest = chunk.slice(tag.length);
    const at = rest.indexOf('<h2', rest.indexOf('class="sec-head'));
    return newTag + rest.slice(0, at) + `<span class="sec-num">${esc(label)}</span>` + rest.slice(at);
  }).join('<section');
}

const clampTitle = (t) => {
  if (t.length <= 58) return t;
  const bare = t.replace(/\s*\|\s*tacps126$/, '');
  if (bare.length <= 58) return bare;
  return bare.slice(0, 59).replace(/[\s,:;(-]+\S*$/, '').replace(/[\s,:;(-]+$/, '');
};
const clampDesc = (d) => {
  if (d.length <= 158) return d;
  const cut = d.slice(0, 159);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (stop >= 90) return cut.slice(0, stop + 1).replace(/;$/, '.');
  return cut.replace(/[\s,:;(-]+\S*$/, '').replace(/[\s,:;(-]+$/, '') + '.';
};

const page = ({ path, title, description, keywords, body, active, jsonld, scripts = [], og = OG, ogAlt = 'tacps126: clean web data for jobs, news, reviews and leads', modified }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(clampTitle(title))}</title>
<meta name="description" content="${esc(clampDesc(description))}">${keywords ? `\n<meta name="keywords" content="${esc(keywords)}">` : ''}
<link rel="canonical" href="${SITE}${path}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">${path === '/' ? verifyTags : ''}
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f7f8fb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0e1f" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" sizes="64x64" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="tacps126">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogAlt)}">${modified ? `
<meta property="og:updated_time" content="${modified}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og}">
<link rel="preload" href="/fonts/jetbrains-mono-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://apify-image-uploads-prod.s3.us-east-1.amazonaws.com">
<link rel="stylesheet" href="${CSS}">
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
${(Array.isArray(jsonld) ? jsonld : [jsonld]).filter(Boolean).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
${header(active)}
<main id="main">
${decorate(body)}
</main>
${footer()}
<script src="${JS}" defer></script>
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
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

// ---------------------------------------------------------------- shared numbers
// Honest live numbers from the Store: runs by the public in the last 30 days
// and how many succeeded. Shown only once there is enough to mean something.
const runs30 = items.reduce((a, i) => {
  const r = i.stats?.publicActorRunStats30Days || {};
  return { total: a.total + (r.TOTAL || 0), ok: a.ok + (r.SUCCEEDED || 0) };
}, { total: 0, ok: 0 });
const okShare = runs30.total >= 50 ? Math.floor((100 * runs30.ok) / runs30.total) : null;
const users30 = [...DETAIL.values()].reduce((s, d) => s + (d.act?.stats?.totalUsers30Days || 0), 0);

const CAT_SHORT = { jobs: 'Jobs', leads: 'Leads', reviews: 'Reviews and research', gov: 'Government', health: 'Health', commerce: 'Commerce', finance: 'Finance', sports: 'Sports', travel: 'Travel' };
const toolsOf = (names) => names.map((n) => byName.get(n)).filter(Boolean);
const runsOf = (a) => a.stats?.totalRuns || 0;
const runs30Of = (a) => a.stats?.publicActorRunStats30Days?.TOTAL || 0;
const fmt = (n) => n.toLocaleString('en-US');
const allTools = CATS.flatMap(([k, , names]) => toolsOf(names).map((a) => ({ a, k })));
const used = allTools.length;
const catOf = Object.fromEntries(allTools.map(({ a, k }) => [a.name, k]));
const labelOf = Object.fromEntries(CATS.map(([k, l]) => [k, l]));

// "What people use them for": one card per live topic. `parts` are [listing, phrase]; a phrase
// appears only once its listing is public, so cards never name an unreleased tool.
const USES = [
  ['jobs', 'briefcase', 'Recruiting and job boards', 'Every open role from company career pages (13 systems, or just type a company name), LinkedIn, Indeed, Glassdoor, Wellfound, Dice and remote-job feeds in one format, with only-new mode for daily feeds.'],
  ['leads', 'target', 'Sales and lead generation', 'Hiring signals show who is hiring for the roles you sell to. Reddit Lead Finder spots people asking for a tool like yours. Contact details builds local lead lists by category and city and adds emails, phones and socials to any list; the Shopify Store Analyzer does the same for stores. US Import Records shows who an importer buys from and which other brands use the same factories.'],
  ['reviews', 'star', 'Brand and reputation', 'Trustpilot and app-store reviews, Google News with real publisher links, and Reddit mentions, with alerts on new items only.'],
  ['health', 'pulse', 'Health and life sciences', [
    ['clinical-trials', 'Clinical trials by condition, drug, sponsor and phase with sites and contacts'],
    ['fda-device-clearances', 'FDA 510(k) and PMA device clearances with the applicant and review time'],
    ['npi-providers', 'US doctors, dentists and clinics from the NPI Registry by specialty and place'],
  ]],
  ['commerce', 'chart', 'Market, vehicle and property data', 'Shopify prices, discounts and stock, Copart salvage and used car auctions with bids and damage, court and bank auctions in Germany, Spain, Italy and India scored against similar lots, and property listings in Germany, Austria, the UK and the Gulf with coordinates and price per square metre.'],
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
const useText = Object.fromEntries(USES.map(([k, , title, text]) => {
  const body = Array.isArray(text) ? text.filter(([n]) => byName.has(n)).map(([, p]) => p) : [text];
  return [k, [title, body.length ? (Array.isArray(text) ? sentence(body) : body[0]) : '']];
}));
const useCards = USES.map(([k, icon, title, text]) => {
  if (!liveCats.has(k)) return '';
  const body = Array.isArray(text) ? text.filter(([n]) => byName.has(n)).map(([, p]) => p) : [text];
  if (!body.length) return '';
  const n = CATS.find(([c]) => c === k)[2].length;
  return `      <a class="card topic" href="/tools/${k}/" data-k="${k}">${ico(icon)}<h3>${title}</h3><p>${Array.isArray(text) ? sentence(body) : body[0]}</p><span class="more">${n} tool${n === 1 ? '' : 's'} > </span></a>`;
}).filter(Boolean).join('\n');

// Price range from the Store (main event, free-plan tier, per 1,000), so the
// copy follows price changes: "from $0.20 per 1,000; most $1-$3".
const per1k = items
  .map((a) => Object.values(a.currentPricingInfo?.pricingPerEvent?.actorChargeEvents || {}).find((e) => e.isPrimaryEvent))
  .map((e) => (e ? (e.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? e.eventPriceUsd) : null))
  .filter((u) => u && u < 0.01)
  .map((u) => u * 1000)
  .sort((a, b) => a - b);
const q = (f) => per1k[Math.min(per1k.length - 1, Math.floor(f * per1k.length))] || 1;
const usd = (v) => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
const PRICE_FROM = usd(per1k[0] || 1);
const PRICE_MOST = q(0.25) === q(0.75) ? usd(q(0.5)) : `${usd(q(0.25))}-${usd(q(0.75))}`;

// The social preview is drawn from these same numbers on every build
// (scripts/og.py, needs Pillow); without Pillow the last image stays.
if (!PREVIEW) writeFileSync(new URL('./data/og.json', import.meta.url), JSON.stringify({
  name: OWNER,
  topics: 'jobs, news, reviews and leads.',
  tools: used,
  okShare,
  mcpTools: N,
  from: PRICE_FROM,
  cats: CATS.map(([k, , names]) => [k, CAT_SHORT[k] || k, names.length]),
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
const TOOL_JS = `/tool.js?v=${hashOf('./tool.js')}`;

const money = (usd) => (usd >= 1 ? `$${usd.toFixed(usd % 1 ? 2 : 0)}` : usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4).replace(/0+$/, '')}`);

// ---------------------------------------------------------------- events
// Everything a tool charges, from its Store pricing: the main per-result
// event and any optional ones (AI insights, extra records). Free-plan tier,
// the highest anyone pays. The run start fee is left out (a fraction of a cent).
const eventsOf = (a) => Object.entries(a?.currentPricingInfo?.pricingPerEvent?.actorChargeEvents || {})
  .filter(([k]) => k !== 'apify-actor-start')
  .map(([k, e]) => ({ key: k, title: e.eventTitle, desc: e.eventDescription || '', unit: e.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? e.eventPriceUsd ?? 0, primary: !!e.isPrimaryEvent, once: !!e.isOneTimeEvent }))
  .sort((x, y) => Number(y.primary) - Number(x.primary));
// "each" only for whole cents: $0.015 would read as $0.01.
const evPrice = (e) => (e.unit >= 0.01 && Math.abs(e.unit * 100 - Math.round(e.unit * 100)) < 1e-9 ? `${money(e.unit)} each` : `${money(e.unit * 1000)} per 1,000`);
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
  <a class="mactor" href="/tools/${actor}/">Runs ${esc(a?.title || actor)} > </a>
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
    <div class="sec-head"><h2>Install in two minutes</h2><p>You need Node.js 18+ and a free Apify account. Copy your API token from Apify Console > Settings > API &amp; Integrations.</p></div>
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
    <div class="sec-head"><h2>The ${nWord} tools</h2><p>Every tool takes simple arguments plus an optional <code>extra_input</code> for any other field the Actor documents. Prices are Apify pay-per-result prices; extras marked + are charged only when used.</p></div>
    <div class="filters">${mcpChips}<input class="search" id="search" type="search" placeholder="Search tools  ( / )" aria-label="Search tools"><span class="count" id="count" aria-live="polite"></span></div>
    <div class="grid mtools">
${toolCards}
    </div>
    <p class="empty" id="empty">No tool matches that search.</p>
  </div>
</section>

<section id="try">
  <div class="wrap">
    <div class="sec-head"><h2>Try asking</h2></div>
    <div class="grid">
      <div class="card"><p>"Which of these companies are hiring data engineers right now? boards.greenhouse.io/stripe, jobs.lever.co/spotify"</p></div>
      <div class="card"><p>"Show the 1 and 2 star Trustpilot reviews of example.com from the last 30 days and group the complaints."</p></div>
      <div class="card"><p>"Find news from the last 7 days about open-source LLM licensing, with the real publisher links."</p></div>
      <div class="card"><p>"What does a 2-room flat in Berlin cost to rent right now? Give me the cheapest ten with coordinates."</p></div>
      <div class="card"><p>"What should a seed-stage founder build in sodium-ion batteries? Compare it with solid-state." (the <code>field-opportunity-analysis</code> prompt)</p></div>
      <div class="card"><p>"Is a drone that plants trees a new idea? Who is already working on it?" (the <code>idea-validation</code> prompt)</p></div>
    </div>
    <p style="margin-top:18px">Two ready-made prompts, <code>field-opportunity-analysis</code> and <code>idea-validation</code>, turn the research tools into an innovation analyst with the same rubric for any model. Agents that load skills can use <a href="https://github.com/tacps126/webdata-tools-mcp/tree/main/skills/innovation-analyst">skills/innovation-analyst</a>.</p>
  </div>
</section>

<section class="alt" id="safety">
  <div class="wrap">
    <div class="sec-head"><h2>Safe by design</h2></div>
    <div class="grid">
      <div class="card">${ico('coin')}<h3>Spend cap per call</h3><p>Every call is capped at $0.50 by default (<code>WEBDATA_MAX_CHARGE_USD</code>). Apify stops the run when it is reached.</p></div>
      <div class="card">${ico('shield')}<h3>Read-only tools</h3><p>All tools only read public web data and are marked read-only, so clients can run them without extra prompts.</p></div>
      <div class="card">${ico('bolt')}<h3>Short, structured results</h3><p>Results come back as text and as structured content. Long fields are shortened and one result is limited to about 60,000 characters.</p></div>
      <div class="card">${ico('target')}<h3>Your account, your token</h3><p>The server talks only to Apify. Your token stays in your own configuration and runs bill to your own Apify account.</p></div>
    </div>
  </div>
</section>

<section id="faq">
  <div class="wrap" style="max-width:820px">
    <div class="sec-head"><h2>Questions</h2></div>
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
// Up to 8 other shows for internal links: same industry first, then the biggest.
const related = (l) => [...leads.filter((o) => o.id !== l.id && o.industry === l.industry), ...leads.filter((o) => o.id !== l.id && o.industry !== l.industry)].slice(0, 8);
for (const l of leads) {
  const title = `${l.name} exhibitor list${/\b20\d\d\b/.test(l.name) ? '' : ` ${l.updated.slice(0, 4)}`}: ${n(l.total)} companies with booth, website and contacts`;
  const desc = `${l.name}${l.where ? ` (${l.where})` : ''} exhibitor list: ${n(l.total)} exhibitors${l.countriesFromSample || !l.countryCount ? '' : ` from ${l.countryCount} countries`} with booth, website, phone and email. Free sample, full list as CSV/Excel.`;
  const tiles = [
    [n(l.total), 'exhibitors'],
    ...(l.countryCount ? [[l.countryCount, l.countriesFromSample ? 'countries (in sample)' : 'countries']] : []),
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
  <div class="stats${l.countryCount ? ' five' : ''}">${tiles}</div>
  <div class="cta-row">
    <a class="btn primary" href="${ACTOR_URL}">Get the full list (run it yourself, about $2 per 1,000)</a>
    <a class="btn" href="/#build">Have it done for you</a>
  </div>
</div></section>
<section><div class="wrap">
  <h2>Sample: 20 of ${n(l.total)} exhibitors</h2>
  <p class="muted">The full list adds phone, email, address, categories, social profiles and the company description. Emails and phones are left out of this public sample.</p>
  <div class="table-wrap"><table class="sample"><thead><tr><th>Company</th><th>Country</th><th>Booth</th><th>Website</th></tr></thead><tbody>${rows}</tbody></table></div>
${countries ? `  <h2>Where exhibitors come from${l.countriesFromSample ? ` <span class="muted">(${l.sampleSize}-exhibitor sample)</span>` : ''}</h2>
  <ul class="countries">${countries}</ul>` : ''}
  <p class="fine">* Contact coverage measured on a ${l.sampleSize}-exhibitor sample with emails looked up on company websites; updated ${esc(l.updated)}. Data comes from public pages; use it within GDPR and the organiser's terms.</p>
  <h2>Get it</h2>
  <p>Run <a href="${ACTOR_URL}">Trade Show Exhibitor List Scraper</a> with the show <code>${esc(l.id)}</code> (turn on <em>Find emails on company websites</em>), export CSV or Excel, or schedule it with <em>Changes only</em> to get new exhibitors and booth moves until the show. Prefer a ready file? Email <a href="mailto:${EMAIL}?subject=${encodeURIComponent(l.name + ' exhibitor list')}">${EMAIL}</a>.</p>

  <h2>More exhibitor lists</h2>
  <p class="terms">${related(l).map((o) => `<a class="xchip" href="/leads/${o.id}.html">${esc(o.name)}</a>`).join(' ')} <a class="xchip" href="/leads/">All shows</a></p>
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
        // Terms of use for the data (Search Console asks Datasets for a license).
        license: `${SITE}/about.html#data-use`,
      },
    }),
  );
}
if (leads.length) {
  const list = leads
    .map((l) => `<a class="card" href="/leads/${l.id}.html"><h3>${esc(l.name)}</h3><p>${esc(l.industry)}${l.where ? ` · ${esc(l.where)}` : ''}</p><p class="muted">${n(l.total)} exhibitors${l.countriesFromSample || !l.countryCount ? '' : ` · ${l.countryCount} countries`}</p></a>`)
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
      <div class="calc-out" aria-live="polite"><b id="calc-usd">-</b><span id="calc-note">Choose a tool</span></div>
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
${rows.map((r) => `<tr><td data-th="Tool"><a href="/tools/${esc(r.a.name)}/">${esc(r.a.title)}</a></td><td class="num" data-th="Main price">${r.unit ? `${evPrice({ unit: r.unit })} <small>· ${esc(r.what)}</small>` : esc(priceOf(r.a.description) || 'see listing')}</td><td data-th="Optional extras">${extraChips(r.a) || '<span class="none">none</span>'}</td><td class="num" data-th="Runs, 30 days">${fmt(r.runs)}</td></tr>`).join('\n')}
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

// ---------------------------------------------------------------- free datasets
// data/samples.json (CSV/JSON samples per tool) and data/hf.json (weekly Hugging Face datasets).
const HF_INFO = {
  'company-registry': ['New company registrations', 'Companies registered in the last 7 days in official business registers (Finland, Estonia, France, Norway).'],
  'recalls-radar': ['Product recalls', 'Recalls announced in the last 7 days by US, UK, EU and Canadian safety agencies.'],
  'auctions-radar': ['Bank and court property auctions', 'Upcoming property auctions in Germany, Spain, Italy and India, with price, date and a deal score.'],
};
const toolTitle = (n) => byName.get(n)?.title || n;
const datasetsBody = `
<section class="hero" style="padding-bottom:36px">
  <div class="wrap">
    <span class="eyebrow">Free data</span>
    <h1 style="margin-top:14px">Download real results. <span class="grad">No account needed.</span></h1>
    <p class="lead">Weekly datasets on Hugging Face and sample files from recent runs, free to open in a browser, a spreadsheet or code. For fresh, filtered or scheduled data, run the tool itself.</p>
  </div>
</section>
<section data-label="Weekly datasets">
  <div class="wrap">
    <div class="sec-head"><h2>Weekly datasets on Hugging Face</h2><p>Refreshed every week; each holds the latest 7 days.</p></div>
    <div class="table-wrap"><table class="rtable"><thead><tr><th>Dataset</th><th>What is in it</th><th>Made by</th></tr></thead><tbody>
${Object.entries(HF_DATA).filter(([n]) => HF_INFO[n]).map(([n, url]) => `<tr><td data-th="Dataset"><a href="${esc(url)}" rel="noopener">${esc(HF_INFO[n][0])}</a></td><td data-th="What is in it">${esc(HF_INFO[n][1])}</td><td data-th="Made by"><a href="/tools/${esc(n)}/">${esc(toolTitle(n))}</a></td></tr>`).join('\n')}
    </tbody></table></div>
    <p class="muted">Load one in Python: <code>pandas.read_csv("https://huggingface.co/datasets/tacps126/product-recalls/resolve/main/data/latest.csv")</code></p>
  </div>
</section>
<section class="alt" data-label="Samples">
  <div class="wrap">
    <div class="sec-head"><h2>Sample files from recent runs</h2><p>A small slice of real output per tool, as CSV or JSON.</p></div>
    <div class="table-wrap"><table class="rtable"><thead><tr><th>Tool</th><th>Download</th></tr></thead><tbody>
${Object.entries(SAMPLES).map(([n, l]) => `<tr><td data-th="Tool"><a href="/tools/${esc(n)}/">${esc(toolTitle(n))}</a></td><td data-th="Download"><a href="${esc(l.csv)}" rel="noopener">CSV</a> · <a href="${esc(l.json)}" rel="noopener">JSON</a></td></tr>`).join('\n')}
    </tbody></table></div>
    <p class="muted">Samples leave out personal contact details. Data comes from public sources; each record links to its origin.</p>
  </div>
</section>`;
writeFileSync(
  OUT('./datasets.html'),
  page({
    path: '/datasets.html',
    active: 'datasets',
    title: 'Free datasets and sample data - tacps126',
    description: 'Free weekly datasets (new companies, product recalls, property auctions) and sample CSV/JSON files from real tool runs. No account needed.',
    body: datasetsBody,
    jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Free datasets and sample data', url: `${SITE}/datasets.html` },
  }),
);

// ---------------------------------------------------------------- clay
// data/clay.json: Run Apify Actor column recipes and Import-from-Apify sources.
const clayMoney = (x) => (x < 0.01 ? `${+(x * 100).toFixed(3)} cents` : `$${+x.toFixed(3)}`);
const clayCode = (o) => `<div class="code"><div class="code-top"><span>input</span><button class="copy" type="button">Copy</button></div><pre>${esc(JSON.stringify(o))}</pre></div>`;
const clayTitle = (a) => CLAY.columns.find((x) => x.actor === a)?.title || a;
const clayBody = `
<section class="hero" style="padding-bottom:36px">
  <div class="wrap">
    <span class="eyebrow">Clay</span>
    <h1 style="margin-top:14px">Our tools as Clay columns. <span class="grad">Copy, paste, run.</span></h1>
    <p class="lead">Every tool here runs inside <a href="https://clay.com?via=bec1a7" rel="noopener">Clay</a> through its Apify integration: add a column, paste the input, and each row is enriched in seconds. Billing goes to your own Apify account, at the tool's normal per-result price.</p>
  </div>
</section>
<section data-label="Setup">
  <div class="wrap">
    <div class="sec-head"><h2>One-time setup</h2></div>
    <ol>
      <li>Create a free <a href="https://apify.com/" rel="noopener">Apify</a> account (it includes monthly free credit) and copy an API token from <em>Settings, API and Integrations</em>.</li>
      <li>In Clay, open a table, <em>Add column</em>, search <strong>Apify</strong>, pick <strong>Run Apify Actor</strong> and connect the token.</li>
      <li>Pick a recipe below, paste its input, and type <code>/</code> inside the quotes to insert your own column (the recipes write it as <code>/Website</code>, <code>/Company Name</code> and so on).</li>
      <li>Turn auto-update off, save, and run one row first. On a result, <em>Add as column</em> turns any field into its own column.</li>
    </ol>
  </div>
</section>
<section class="alt" data-label="Example">
  <div class="wrap">
    <div class="sec-head"><h2>What it looks like</h2><p>Two real tables, built with the recipes on this page.</p></div>
    <h3>Trade show leads</h3>
    <p>Ten exhibitors from a trade show, imported as a source, then one column reads each exhibitor's website. Seven come back with an email, eight with a phone; sites that are down simply return nothing.</p>
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:#fff;margin-bottom:28px">
      <img src="/img/clay-trade-show.png" alt="A Clay table of ten trade show exhibitors with company, country and website, plus a website contacts column and the primary email and phone pulled out as columns" width="2000" height="484" loading="lazy" decoding="async" style="display:block;max-width:none;width:1200px;height:auto">
    </div>
    <h3>Account research</h3>
    <p>Five accounts, five columns: registry record, US imports, news, sanctions check and hiring activity, with three fields pulled out as their own columns. One of the five is a sanctions match.</p>
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:#fff">
      <img src="/img/clay-account-research.png" alt="A Clay table of five companies with Apify columns for registry record, US imports, news, sanctions check and hiring activity" width="2000" height="272" loading="lazy" decoding="async" style="display:block;max-width:none;width:1200px;height:auto">
    </div>
  </div>
</section>
<section class="alt" data-label="Columns">
  <div class="wrap">
    <div class="sec-head"><h2>Enrichment columns</h2><p>One row in, one answer out. Cost is per row on your Apify account, at free plan prices.</p></div>
${CLAY.columns.map((c) => `
    <div class="card" id="${esc(c.actor)}" style="margin-bottom:22px">
      <h3>${esc(c.title)}</h3>
      <p><strong>You need:</strong> ${esc(c.need)}. <strong>You get:</strong> ${esc(c.gives)}.</p>
      <p>Tool: <a href="/tools/${esc(c.actor)}/"><code>tacps126/${esc(c.actor)}</code></a> &middot; about ${esc(clayMoney(c.costPerRow))} per row &middot; fields to add as columns: ${c.map.map((f) => `<code>${esc(f)}</code>`).join(', ')}</p>
      ${clayCode(c.input)}
    </div>`).join('')}
  </div>
</section>
<section data-label="Sources">
  <div class="wrap">
    <div class="sec-head"><h2>Start a table from a list</h2><p>In Clay, <em>Import data from Apify actor</em>, pick the tool and paste the input. Then add an enrichment column.</p></div>
${CLAY.sources.map((c) => `
    <div class="card" id="${esc(c.actor)}-source" style="margin-bottom:22px">
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.gives[0].toUpperCase() + c.gives.slice(1))}.${c.then ? ` Good next column: <a href="#${esc(c.then)}">${esc(clayTitle(c.then))}</a>.` : ''}</p>
      <p>Tool: <a href="/tools/${esc(c.actor)}/"><code>tacps126/${esc(c.actor)}</code></a></p>
      ${clayCode(c.input)}
    </div>`).join('')}
  </div>
</section>
<section class="alt" data-label="Help">
  <div class="wrap">
    <div class="sec-head"><h2>Good to know</h2></div>
    <ul>
      <li>Clay starts one tool run per row. Keep auto-update off until one row looks right.</li>
      <li>The error <code>Cannot parse input JSON body</code> means the input is not full JSON: keep the braces, brackets and quotes around your column.</li>
      <li>Need another column, or a table built for your list? <a href="mailto:${EMAIL}?subject=Clay%20recipe">Email us</a>.</li>
    </ul>
  </div>
</section>`;
writeFileSync(
  OUT('./clay.html'),
  page({
    path: '/clay.html',
    active: 'clay',
    title: 'Use our data tools in Clay - tacps126',
    description: 'Copy-paste Clay recipes: sanctions check, company registry record, US import volumes, hiring activity, website emails, Shopify store profile and news, as Run Apify Actor columns.',
    body: clayBody,
    jsonld: { '@context': 'https://schema.org', '@type': 'HowTo', name: 'Use tacps126 data tools in Clay', url: `${SITE}/clay.html` },
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
<section class="alt"><div class="wrap"><div class="cta-band"><div><h2>Try it on your own data</h2><p>Every tool in this article runs on Apify with free monthly credit.</p></div><a class="btn primary" href="/tools/">Browse the tools</a></div></div></section>`,
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
    <ul class="about-list">${toolsOf(names).map((a) => `<li><a href="/tools/${esc(a.name)}/">${esc(a.title)}</a><span>${esc(short(stripPrice(a.description), 180))}</span></li>`).join('')}</ul>
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

// ---------------------------------------------------------------- tool pages (/tools/<name>/)
// One page per public tool, built from its latest public build: an input form generated from the
// input schema (only fields the Store shows), live code for the current input, the fields and a
// sample row from its README, the price per event and its 30-day runs.
const SKIP_FIELD = /^(proxyConfiguration|proxy|tenantId|debug|delivery|googleServiceAccountJson|monitorName|stateKey|sessionCookies|cookies|aiProvider|aiApiKey|aiModel|aiBaseUrl|openalexApiKey)$|ApiKey$|Token$|Secret$/;
const SKIP_EDITOR = new Set(['hidden', 'proxy', 'json', 'requestListSources', 'resourcePicker', 'keyValueStore', 'dataset']);
const textOf = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const schemaOf = (name) => {
  try { return JSON.parse(DETAIL.get(name)?.build?.inputSchema || '{}'); } catch { return {}; }
};
const enumOf = (v) => (v.type === 'array' ? v.items?.enum : v.enum) || null;
const enumTitlesOf = (v) => (v.type === 'array' ? v.items?.enumTitles : v.enumTitles) || null;
const fieldsOf = (schema) => Object.entries(schema.properties || {}).filter(([k, v]) =>
  !SKIP_FIELD.test(k) && !v.isSecret && !SKIP_EDITOR.has(v.editor) && v.type !== 'object' &&
  !(v.type === 'array' && v.editor === 'select' && !enumOf(v)?.length) &&
  !(v.type === 'array' && v.items && v.items.type && v.items.type !== 'string'));
const exampleOf = (name) => {
  try {
    const x = JSON.parse(DETAIL.get(name)?.act?.exampleRunInput?.body || '{}');
    return x && typeof x === 'object' && !('helloWorld' in x) ? x : {};
  } catch { return {}; }
};
// The input a visitor starts from: the Store's example input, else each field's prefill.
const startInput = (name) => {
  const ex = exampleOf(name), out = {};
  for (const [k, v] of fieldsOf(schemaOf(name))) {
    const val = k in ex ? ex[k] : v.prefill;
    if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && !val.length)) {
      out[k] = Array.isArray(val) ? val.map((x) => (x && typeof x === 'object' ? x.url || JSON.stringify(x) : x)) : val;
    }
  }
  return out;
};
const kindOf = (v) => {
  if (v.type === 'boolean') return 'bool';
  if (v.type === 'integer') return 'int';
  if (v.type === 'number') return 'num';
  if (v.type === 'array') return enumOf(v) ? 'multi' : 'list';
  return 'str';
};
function fieldHtml(k, v, val, required) {
  const id = `f-${k}`, kind = kindOf(v), en = enumOf(v), et = enumTitlesOf(v) || en;
  const def = v.default === undefined ? '' : ` data-def="${esc(JSON.stringify(v.default))}"`;
  const help = v.description ? `<p class="fh">${esc(short(textOf(v.description), 240))}</p>` : '';
  const label = `<span class="fl">${esc(v.title || k)}${required ? ' <em>required</em>' : ''}</span>`;
  let control;
  if (kind === 'bool') {
    const on = val === undefined ? v.default === true : !!val;
    return `<div class="f f-bool" data-k="${k}" data-kind="bool"${def}><label class="sw" for="${id}"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span class="sw-ui" aria-hidden="true"></span>${label}</label>${help}</div>`;
  }
  if (kind === 'int' || kind === 'num') {
    const cur = val ?? v.default ?? '';
    control = `<input id="${id}" type="number" inputmode="numeric"${v.minimum !== undefined ? ` min="${v.minimum}"` : ''}${v.maximum !== undefined ? ` max="${v.maximum}"` : ''}${kind === 'num' ? ' step="any"' : ''} value="${esc(cur)}" placeholder="${esc(v.default ?? '')}">`;
  } else if (kind === 'multi') {
    const sel = new Set(Array.isArray(val) ? val : Array.isArray(v.default) ? v.default : []);
    control = en.length <= 24
      ? `<div class="opts" role="group" aria-label="${esc(v.title || k)}">${en.map((e, i) => `<label class="opt"><input type="checkbox" value="${esc(e)}"${sel.has(e) ? ' checked' : ''}><span>${esc(short(et[i] ?? e, 48))}</span></label>`).join('')}</div>`
      : `<select id="${id}" multiple size="7">${en.map((e, i) => `<option value="${esc(e)}"${sel.has(e) ? ' selected' : ''}>${esc(short(et[i] ?? e, 70))}</option>`).join('')}</select>`;
  } else if (kind === 'list') {
    const lines = Array.isArray(val) ? val.join('\n') : val ? String(val) : '';
    control = `<textarea id="${id}" rows="${Math.min(6, Math.max(2, lines.split('\n').length + 1))}" placeholder="One per line">${esc(lines)}</textarea>`;
  } else if (en) {
    const cur = val ?? v.default ?? '';
    control = `<select id="${id}">${en.includes('') || v.default !== undefined ? '' : '<option value=""> - </option>'}${en.map((e, i) => `<option value="${esc(e)}"${e === cur ? ' selected' : ''}>${esc(short(et[i] ?? (e || 'Any'), 70))}</option>`).join('')}</select>`;
  } else if (v.editor === 'textarea') {
    control = `<textarea id="${id}" rows="3">${esc(val ?? '')}</textarea>`;
  } else {
    control = `<input id="${id}" type="text" value="${esc(val ?? '')}" placeholder="${esc(v.editor === 'datepicker' ? 'YYYY-MM-DD' : v.default ?? '')}">`;
  }
  return `<div class="f" data-k="${k}" data-kind="${kind}"${def}><label for="${id}">${label}</label>${control}${help}</div>`;
}
function formHtml(name) {
  const schema = schemaOf(name), fields = fieldsOf(schema), start = startInput(name), req = new Set(schema.required || []);
  if (!fields.length) return '';
  // Fields up to the first section caption are the main ones; later sections fold away.
  const groups = [['', []]];
  fields.forEach(([k, v], i) => {
    if (v.sectionCaption && i > 0) groups.push([v.sectionCaption, []]);
    groups.at(-1)[1].push(fieldHtml(k, v, start[k], req.has(k)));
  });
  if (groups.length === 1 && groups[0][1].length > 8) groups.push(['More options', groups[0][1].splice(7)]);
  return groups.map(([cap, fs], i) => (i === 0 ? fs.join('\n') : `<details class="more"><summary>${esc(cap)}</summary>${fs.join('\n')}</details>`)).join('\n');
}

// README: the sections about output give the field list and a sample row.
const readmeOf = (name) => DETAIL.get(name)?.build?.readme || '';
const outputSections = (md) => md.split(/^## /m).slice(1)
  .map((s) => [s.slice(0, s.indexOf('\n')).trim(), s.slice(s.indexOf('\n') + 1)])
  .filter(([h]) => /what you get|output|result|you get|fields|sample|data you get|what it returns/i.test(h) && !/input/i.test(h));
function sampleOf(name) {
  const inputKeys = new Set(Object.keys(schemaOf(name).properties || {}));
  for (const [, body] of outputSections(readmeOf(name))) {
    for (const [, blk] of body.matchAll(/```json\n([\s\S]*?)```/g)) {
      let v; try { v = JSON.parse(blk); } catch { continue; }
      if (Array.isArray(v)) v = v[0];
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const ks = Object.keys(v);
      if (ks.length < 3 || ks.filter((k) => inputKeys.has(k)).length >= ks.length / 2) continue;
      return v;
    }
  }
  return null;
}
function fieldRowsOf(name) {
  for (const [, body] of outputSections(readmeOf(name))) {
    const lines = body.split('\n'), at = lines.findIndex((l) => l.startsWith('|'));
    if (at < 0) continue;
    const rows = [];
    for (let i = at; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
    const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const body2 = rows.slice(1).filter((r) => !/^\|[\s:|-]+\|$/.test(r.trim())).map(cells).filter((c) => c.length >= 2);
    if (body2.length >= 3) return body2.map((c) => [c[0], c.slice(1).join(' ')]);
  }
  // No table in the README: the dataset view's columns.
  const views = DETAIL.get(name)?.build?.actorDefinition?.storages?.dataset?.views || {};
  const first = Object.values(views)[0];
  const props = first?.display?.properties || {};
  return Object.entries(props).map(([k, p]) => [`\`${k}\``, p.label || '']);
}
const cell = (v) => {
  if (v === null || v === undefined) return '<span class="none">-</span>';
  if (typeof v === 'object') return `<code>${esc(short(JSON.stringify(v), 120))}</code>`;
  const s = String(v);
  return /^https?:\/\//.test(s) ? `<span class="url">${esc(short(s, 70))}</span>` : esc(short(s, 160));
};

// Code for a call with a given input; tool.js renders the same text live as the form changes.
const pyVal = (v, ind = '') => {
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (Array.isArray(v)) return v.length ? `[${v.map((x) => pyVal(x, ind)).join(', ')}]` : '[]';
  if (typeof v === 'object') {
    const ks = Object.keys(v);
    if (!ks.length) return '{}';
    return `{\n${ks.map((k) => `${ind}    ${JSON.stringify(k)}: ${pyVal(v[k], ind + '    ')},`).join('\n')}\n${ind}}`;
  }
  return JSON.stringify(v);
};
const codeFor = {
  curl: (name, input) => `curl -X POST \\\n  "https://api.apify.com/v2/acts/${USER}~${name}/run-sync-get-dataset-items?token=YOUR_APIFY_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(input).replace(/'/g, "'\\''")}'`,
  python: (name, input) => `from apify_client import ApifyClient\n\nclient = ApifyClient("YOUR_APIFY_TOKEN")\nrun = client.actor("${USER}/${name}").call(run_input=${pyVal(input)})\nfor item in client.dataset(run["defaultDatasetId"]).iterate_items():\n    print(item)`,
  js: (name, input) => `import { ApifyClient } from 'apify-client';\n\nconst client = new ApifyClient({ token: 'YOUR_APIFY_TOKEN' });\nconst run = await client.actor('${USER}/${name}').call(${JSON.stringify(input, null, 2)});\nconst { items } = await client.dataset(run.defaultDatasetId).listItems();\nconsole.log(items);`,
};
const mcpOf = (name) => MCP_TOOLS.filter((t) => t[2] === name).map((t) => t[0]);
const mcpCode = (name) => {
  const ours = mcpOf(name);
  return ours.length
    ? `# webdata-tools-mcp (Claude, Cursor, any MCP client)\n${CLAUDE_CODE}\n\n# then ask your agent; it calls: ${ours.join(', ')}`
    : `# Apify's hosted MCP server, with this tool only\nhttps://mcp.apify.com?tools=${USER}/${name}`;
};
const primaryOf = (a) => eventsOf(a).find((e) => e.primary);

// Tools that feed each other: an output field of one is the input of the next.
// [from, to, what is passed, input field, Python expression over a row `r`, extra input for `from`]
const CHAINS = [
  ['exhibition-scraper', 'contact-details', 'exhibitor websites', 'startUrls', '(r.get("contact") or {}).get("website")'],
  ['company-registry', 'contact-details', 'company websites', 'startUrls', 'r.get("website")'],
  ['company-registry', 'sanctions-screener', 'company names', 'names', 'r.get("name")'],
  ['company-registry', 'tenders-radar', 'company names', 'suppliers', 'r.get("name")'],
  ['tenders-radar', 'sanctions-screener', 'winning suppliers', 'names', '[s.get("name") for s in r.get("suppliers") or []]'],
  ['tenders-radar', 'company-registry', 'winning suppliers', 'names', '[s.get("name") for s in r.get("suppliers") or []]'],
  ['events-scraper', 'contact-details', 'host websites', 'startUrls', '[h.get("website") for h in r.get("hosts") or []]'],
  ['hiring-signals', 'jobs-harvester', 'hiring companies', 'companyNames', 'r.get("company")'],
  ['jobs-harvester', 'hiring-signals', 'companies with openings', 'companies', 'r.get("company")'],
  ['startup-funding', 'hiring-signals', 'funded companies', 'companies', 'r.get("company")'],
  ['shopify-store-analyzer', 'shopify-products', 'store links', 'startUrls', 'r.get("url")'],
  ['trustpilot-reviews', 'contact-details', 'company websites', 'startUrls', 'r.get("websiteUrl")', { includeCompanyDetails: true }],
].filter(([a, b]) => byName.has(a) && byName.has(b));

// Icons: the Store's own image (it changes when the Actor's icon does), with a small local copy
// (scripts/thumbs.py, needs Pillow) as the fallback when the Store image does not load.
const remoteIcons = allTools.map(({ a }) => [a.name, DETAIL.get(a.name)?.act?.pictureUrl]).filter(([, u]) => u);
if (!PREVIEW) {
  writeFileSync(new URL('./data/icons.json', import.meta.url), JSON.stringify(remoteIcons));
  const th = spawnSync('python3', ['scripts/thumbs.py', 'data/icons.json'], { cwd: new URL('.', import.meta.url), stdio: 'inherit' });
  if (th.status !== 0) console.warn('icons not resized (python3 with Pillow needed); using the Store images');
}
const localIcon = (name) => (existsSync(new URL(`./icons/${name}.png`, import.meta.url)) ? `/icons/${name}.png` : '');
const iconOf = (name) => DETAIL.get(name)?.act?.pictureUrl || localIcon(name);
const iconImg = (name, size, cls = '', lazy = true) => {
  const src = iconOf(name), fb = localIcon(name);
  if (!src) return '';
  const onerr = fb && fb !== src ? ` onerror="this.onerror=null;this.src='${fb}'"` : '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(src)}" alt="${esc((DETAIL.get(name)?.act?.title || name) + ' icon')}" width="${size}" height="${size}"${lazy ? ' loading="lazy"' : ''} decoding="async"${onerr}>`;
};
const toolCard = (a, k) => {
  const p = priceOf(a.description);
  const num = p ? Number((p.match(/[\d.]+/) || ['0'])[0]) * (p.includes('¢') ? 10 : 1) : 999;
  return `<a class="card tool" data-tool data-cat="${k}" data-price="${num}" data-runs="${runs30Of(a)}" href="/tools/${esc(a.name)}/">
  <div class="tool-top">${iconImg(a.name, 36)}<h3>${esc(a.title)}${NEW.has(a.name) ? ' <span class="new">New</span>' : ''}</h3></div>
  <p>${esc(short(stripPrice(a.description)))}</p>
  <div class="meta"><span class="tag" data-k="${k}">${esc(CAT_SHORT[k] || k)}</span>${p ? `<span class="price">${esc(p)}</span>` : ''}</div>
</a>`;
};


// ---------------------------------------------------------------- tool page SEO
// Each tool page carries its own search title and description (the Store's SEO fields), the
// README as a readable guide, a visible FAQ (README questions plus facts from the listing) with
// matching FAQPage data, breadcrumbs and its own social image (og/<name>.jpg, scripts/og_tools.py).
const mdPlain = (t) => String(t).replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1$2').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
const README_SKIP = /^(what you get|output|results?\b|sample|support|faq|frequently|questions|changelog|feedback)/i;
const sectionsOf = (md) => md.split(/^## /m).slice(1).map((x) => [x.slice(0, x.indexOf('\n')).trim(), x.slice(x.indexOf('\n') + 1)]);
function guideOf(name) {
  const md = readmeOf(name).replace(/^# .*\n/, '').replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, '');
  const intro = md.split(/^## /m)[0].trim();
  const keep = sectionsOf(md).filter(([h, b]) => h && b.trim() && !README_SKIP.test(h) && !outputSections(`## ${h}\n`).length);
  if (!keep.length && !intro) return '';
  const demoted = [intro, ...keep.map(([h, b]) => `## ${h}\n${b.replace(/^### /gm, '#### ')}`)].join('\n\n');
  return markdown(demoted).replace(/<h2 id="/g, '<h3 id="g-').replace(/<\/h2>/g, '</h3>').replace(/<h4 id="/g, '<h4 id="g-');
}
function readmeFaq(name) {
  const sec = sectionsOf(readmeOf(name)).find(([h]) => /^(faq|frequently|questions|common questions)/i.test(h));
  if (!sec) return [];
  const out = [], body = sec[1];
  for (const m of body.matchAll(/^\*\*(.+?\?)\*\*\s*(.*(?:\n(?!\s*\n|\*\*|#).+)*)/gm)) if (m[2].trim()) out.push([m[1].trim(), m[2].replace(/\n/g, ' ').trim()]);
  for (const m of body.matchAll(/^#{3,4}\s+(.+\?)\s*\n+([^\n]+(?:\n(?!\s*\n|#).+)*)/gm)) out.push([m[1].trim(), m[2].replace(/\n/g, ' ').trim()]);
  return out;
}
const shortTitle = (t) => t.split(/ [\u2014\u2013-] |: /)[0];
function faqOf(a, main, fields) {
  const name = a.name, mcp = mcpOf(name), own = readmeFaq(name), nm = shortTitle(a.title);
  const asked = (re) => own.some(([q]) => re.test(q));
  const gen = [];
  if (main && !asked(/cost|price|pay/i)) gen.push([`How much does ${nm} cost?`, `${evPrice(main)}, charged only for ${main.title.toLowerCase()}s returned; a run that finds nothing costs nothing. It runs on Apify, whose free plan includes monthly credit, so you can try it without paying.`]);
  if (!asked(/code|program|developer/i)) gen.push(['Do I need to write code?', 'No. Fill in the form on Apify and press Start, schedule it, or send the results to Google Sheets, Slack or a webhook. For code, the input builder on this page writes the API call in curl, Python or JavaScript.']);
  if (fields.length && !asked(/field|return|output|get back/i)) gen.push([`What does ${nm} return?`, `Every row has the same fields, including ${fields.slice(0, 8).map(([f]) => mdPlain(f)).join(', ')}. Download as JSON, CSV, Excel or XML.`]);
  if (mcp.length && !asked(/agent|mcp|claude|chatgpt/i)) gen.push(['Can an AI agent use it?', `Yes. The webdata-tools-mcp server exposes it to Claude, Cursor and other MCP clients as ${mcp.map((m) => `\`${m}\``).join(' and ')}.`]);
  if (!asked(/schedul|monitor|daily|new only|only new/i) && /only.?new|onlyNew|onlyChanged|monitor/i.test(JSON.stringify(schemaOf(name).properties || {}))) gen.push(['Can it run on a schedule and return only new results?', 'Yes. Schedule it on Apify (hourly, daily, weekly) and turn on the only-new option: each run then returns only what appeared since the last run with the same input.']);
  return [...own, ...gen].slice(0, 10);
}
const ogTools = allTools.map(({ a, k }) => {
  const m = primaryOf(a);
  return { n: a.name, t: a.title, d: short(stripPrice(a.description), 220), p: m ? evPrice(m) : priceOf(a.description) || '', cat: k, topic: CAT_SHORT[k] || k, icon: DETAIL.get(a.name)?.act?.pictureUrl || '', local: localIcon(a.name) ? `icons/${a.name}.png` : '' };
});
if (!PREVIEW) {
  writeFileSync(new URL('./data/og-tools.json', import.meta.url), JSON.stringify(ogTools));
  const ot = spawnSync('python3', ['scripts/og_tools.py', 'data/og-tools.json'], { cwd: new URL('.', import.meta.url), stdio: 'inherit' });
  if (ot.status !== 0) console.warn('tool preview images not drawn (python3 with Pillow needed); tool pages use the site image');
}
const ogOf = (name) => {
  const f = new URL(`./og/${name}.jpg`, import.meta.url);
  return existsSync(f) ? `${SITE}/og/${name}.jpg?v=${createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10)}` : OG;
};
const seoTitle = (a, act) => {
  const st = scrub(act.seoTitle);
  const t = st && st.length <= 62 ? st : a.title;
  return t.length <= 52 ? `${t} | tacps126` : t;
};

mkdirSync(OUT('./tools/'), { recursive: true });
for (const { a, k } of allTools) {
  const name = a.name, d = DETAIL.get(name) || {}, act = d.act || {};
  const evs = eventsOf(a), main = evs.find((e) => e.primary);
  const r30 = a.stats?.publicActorRunStats30Days || {};
  const ok = (r30.TOTAL || 0) >= 20 ? Math.floor((100 * (r30.SUCCEEDED || 0)) / r30.TOTAL) : null;
  const start = startInput(name), form = formHtml(name), sample = sampleOf(name), fields = fieldRowsOf(name);
  const maxKey = ['maxItems', 'maxResults', 'maxRows', 'maxJobs', 'maxReviews'].find((x) => schemaOf(name).properties?.[x]);
  const maxDef = maxKey ? (start[maxKey] ?? schemaOf(name).properties[maxKey].default ?? null) : null;
  const updated = act.taggedBuilds?.latest?.finishedAt?.slice(0, 10);
  const guide = guideOf(name), faq = faqOf(a, main, fields);
  const next = CHAINS.filter((c) => c[0] === name), prev = CHAINS.filter((c) => c[1] === name);
  const peers = toolsOf(CATS.find(([c]) => c === k)[2]).filter((x) => x.name !== name).sort((x, y) => runs30Of(y) - runs30Of(x)).slice(0, 3);
  const facts = [
    main ? `<span class="pchip"><b>${evPrice(main)}</b> ${esc(main.title.toLowerCase())}</span>` : (priceOf(a.description) ? `<span class="pchip"><b>${esc(priceOf(a.description))}</b></span>` : ''),
    extraChips(a),
    r30.TOTAL ? `<span class="fact">${fmt(r30.TOTAL)} public runs in 30 days${ok !== null ? `, ${ok}% succeeded` : ''}</span>` : '',
    updated ? `<span class="fact">updated ${updated}</span>` : '',
  ].join('');
  const tabs = [['curl', 'curl'], ['python', 'Python'], ['js', 'JavaScript'], ['mcp', 'AI agent']];
  const terms = termsOf(name);
  const storeCats = (act.categories || []).map((c) => c.toLowerCase().replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()));
  const body = `
<section class="tool-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/tools/">Tools</a><span>/</span><a href="/tools/${k}/">${esc(labelOf[k])}</a></nav>
    <div class="th">
      ${iconImg(name, 64, 'th-ico', false)}
      <div>
        <h1>${esc(a.title)}</h1>
        <p class="lead">${esc(stripPrice(a.description))}</p>
      </div>
    </div>
    <div class="facts">${facts}</div>
    <div class="cta-row">
      <a class="btn primary" href="https://apify.com/${USER}/${esc(name)}" rel="noopener">Run it on Apify</a>
      ${form ? '<a class="btn" href="#try">Build the input</a>' : ''}
      ${sample || fields.length ? '<a class="btn ghost" href="#output">See the output</a>' : ''}
      ${SAMPLES[name]?.csv ? `<a class="btn ghost" href="${esc(SAMPLES[name].csv)}" rel="noopener" download>Download sample data (CSV)</a>` : ''}
      ${HF_DATA[name] ? `<a class="btn ghost" href="${esc(HF_DATA[name])}" rel="noopener">Free weekly dataset</a>` : ''}
      ${CLAY_TOOLS.has(name) ? `<a class="btn ghost" href="/clay.html#${esc(name)}">Use it in Clay</a>` : ''}
    </div>
  </div>
</section>
${form ? `
<section id="try" data-label="Try it">
  <div class="wrap">
    <div class="sec-head"><h2>Build the input, get the call</h2><p>Change any field; the code on the right follows. Copy it, or run the same input on Apify.</p></div>
    <div class="tool-grid">
      <form class="tform" id="tform" data-actor="${esc(name)}" data-unit="${main ? main.unit : ''}" data-what="${esc(main ? main.title.toLowerCase() : 'result')}"${maxKey ? ` data-max="${maxKey}"` : ''} data-start="${esc(JSON.stringify(start))}" autocomplete="off">
${form}
        <div class="tf-actions"><button class="btn small" type="button" id="tf-reset">Back to the example</button><button class="btn small ghost" type="button" id="tf-share">Copy link to this input</button></div>
      </form>
      <aside class="tcode">
        <div class="tabs" role="tablist" data-tabs>${tabs.map(([id, l], i) => `<button class="tab" role="tab" type="button" data-lang="${id}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
${tabs.map(([id], i) => `        <div class="panel"${i ? ' hidden' : ''}>${code(id === 'mcp' ? 'MCP' : id === 'curl' ? 'terminal' : id === 'python' ? 'Python · pip install apify-client' : 'JavaScript · npm i apify-client', id === 'mcp' ? mcpCode(name) : codeFor[id](name, start))}</div>`).join('\n')}
        <p class="cost" id="tf-cost">${main && maxDef ? `Up to ${fmt(maxDef)} ${esc(main.title.toLowerCase())}s: at most ${money(main.unit * maxDef)}, on Apify's free plan.` : main ? `${evPrice(main)}, ${esc(main.title.toLowerCase())}.` : ''}</p>
      </aside>
    </div>
  </div>
</section>` : ''}
${sample || fields.length ? `
<section class="alt" id="output" data-label="Output">
  <div class="wrap">
    <div class="sec-head"><h2>What you get back</h2><p>${sample ? 'A real row from the README, and the fields every row has.' : 'The fields every row has.'}</p></div>
    <div class="out-grid${sample ? '' : ' one'}">
      ${sample ? `<div class="sample-box">
        <div class="tabs" role="tablist" data-tabs><button class="tab" role="tab" type="button" aria-selected="true">Row</button><button class="tab" role="tab" type="button" aria-selected="false">JSON</button></div>
        <div class="panel"><div class="table-wrap"><table class="kv"><tbody>${Object.entries(sample).slice(0, 18).map(([kk, vv]) => `<tr><th>${esc(kk)}</th><td>${cell(vv)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="panel" hidden>${code('one row', JSON.stringify(sample, null, 2))}</div>
      </div>` : ''}
      ${fields.length ? `<div class="table-wrap fields"><table><thead><tr><th>Field</th><th>What it holds</th></tr></thead><tbody>${fields.slice(0, 30).map(([f, dsc]) => `<tr><td>${inline(f)}</td><td>${inline(dsc)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>
    <p class="note">Download as JSON, CSV, Excel or XML from the run, or have it sent to Google Sheets, Slack or a webhook.</p>
  </div>
</section>` : ''}
${guide ? `
<section id="guide" data-label="Guide">
  <div class="wrap">
    <div class="sec-head"><h2>How ${esc(shortTitle(a.title))} works</h2><p>Inputs, options and tips, from the tool's own documentation.</p></div>
    <article class="post guide" id="guide-body">${guide}</article>
    <button class="btn small guide-more" type="button" hidden>Read the whole guide</button>
  </div>
</section>` : ''}
${faq.length ? `
<section class="alt" id="faq" data-label="Questions">
  <div class="wrap narrow">
    <div class="sec-head"><h2>Questions about ${esc(shortTitle(a.title))}</h2></div>
    <div class="faq">${faq.map(([q, ans], i) => `<details${i ? '' : ' open'}><summary>${inline(q)}</summary><p>${inline(ans)}</p></details>`).join('')}</div>
  </div>
</section>` : ''}
<section id="pairs" data-label="Pairs well">
  <div class="wrap">
    <div class="sec-head"><h2>Pairs well with</h2>${next.length || prev.length ? '<p>Tools whose rows feed this one, or that take its rows further.</p>' : ''}</div>
    <div class="grid">
${[...next.map((c) => [c[1], `Send its ${c[2]} into`]), ...prev.map((c) => [c[0], `Feeds ${c[2]} into this tool`])].map(([n, why]) => {
    const t = byName.get(n);
    return `      <a class="card link" href="/tools/${n}/"><span class="why">${esc(why)}</span><h3>${esc(t.title)}</h3><p>${esc(short(stripPrice(t.description), 110))}</p></a>`;
  }).join('\n')}
${peers.map((t) => `      <a class="card link" href="/tools/${t.name}/"><span class="why">Also in ${esc((CAT_SHORT[k] || k).toLowerCase())}</span><h3>${esc(t.title)}</h3><p>${esc(short(stripPrice(t.description), 110))}</p></a>`).join('\n')}
    </div>
  </div>
</section>
${name === 'exhibition-scraper' && leads.length ? `
<section id="shows" data-label="Shows">
  <div class="wrap">
    <div class="sec-head"><h2>Exhibitor lists by show</h2><p>Size, contact coverage and a free sample for each show.</p></div>
    <p class="terms">${leads.map((l) => `<a class="xchip" href="/leads/${l.id}.html">${esc(l.name)}</a>`).join(' ')}</p>
  </div>
</section>` : ''}
${terms.uses.length || terms.aka.length ? `
<section class="alt" id="uses" data-label="Use cases">
  <div class="wrap">
    <div class="sec-head"><h2>What people use ${esc(shortTitle(a.title))} for</h2></div>
    <div class="uses-grid">
      ${terms.uses.length ? `<ul class="uses">${terms.uses.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
      <div>
        ${terms.aka.length ? `<h3 class="terms-h">Also searched as</h3><p class="terms">${terms.aka.map((t) => `<a class="xchip" href="/tools/?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join(' ')}</p>` : ''}
        <h3 class="terms-h">Categories</h3><p class="terms"><a class="xchip" href="/tools/${k}/">${esc(labelOf[k])}</a> ${storeCats.map((c) => `<span class="xchip">${esc(c)}</span>`).join(' ')}</p>
      </div>
    </div>
  </div>
</section>` : ''}`;
  mkdirSync(OUT(`./tools/${name}/`), { recursive: true });
  const url = `${SITE}/tools/${name}/`, store = `https://apify.com/${USER}/${name}`;
  const rc = a.stats?.actorReviewCount || act.stats?.actorReviewCount || 0, rr = a.stats?.actorReviewRating || act.stats?.actorReviewRating || 0;
  writeFileSync(OUT(`./tools/${name}/index.html`), page({
    path: `/tools/${name}/`,
    active: 'tools',
    title: seoTitle(a, act),
    keywords: [...terms.aka, labelOf[k]].join(', '),
    description: short(scrub(act.seoDescription) || `${stripPrice(a.description)} ${main ? `${evPrice(main)}.` : ''}`, 300),
    og: ogOf(name),
    ogAlt: `${a.title}: ${short(stripPrice(a.description), 120)}`,
    modified: updated,
    body,
    scripts: form ? [TOOL_JS] : [],
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: a.title, alternateName: name, applicationCategory: 'DeveloperApplication', applicationSubCategory: labelOf[k], operatingSystem: 'Web, API (Apify)',
        ...(terms.aka.length ? { keywords: terms.aka.join(', ') } : {}),
        url, sameAs: store, installUrl: store, image: iconOf(name), screenshot: ogOf(name), description: stripPrice(a.description), author: { '@type': 'Person', name: OWNER, url: `${SITE}/about.html` },
        ...(updated ? { dateModified: updated } : {}),
        ...(main ? { offers: { '@type': 'Offer', price: String(main.unit), priceCurrency: 'USD', url: store, description: `${evPrice(main)}, pay per ${main.title.toLowerCase()}` } } : {}),
        ...(rc > 0 && rr > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rr.toFixed(1), reviewCount: rc, bestRating: 5 } } : {}),
        ...(fields.length ? { featureList: fields.slice(0, 12).map(([f, dsc]) => `${mdPlain(f)}: ${mdPlain(dsc)}`) } : {}),
      },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', `${SITE}/`], ['Tools', `${SITE}/tools/`], [labelOf[k], `${SITE}/tools/${k}/`], [a.title, url]].map(([nm, u], i) => ({ '@type': 'ListItem', position: i + 1, name: nm, item: u })) },
      faq.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, ans]) => ({ '@type': 'Question', name: mdPlain(q), acceptedAnswer: { '@type': 'Answer', text: mdPlain(ans) } })) } : null,
    ],
  }));
}

// ---------------------------------------------------------------- topic pages (/tools/<topic>/)
for (const [k, label, names] of CATS) {
  const [, useBody] = useText[k] || [label, ''];
  const ts = toolsOf(names).sort((x, y) => runs30Of(y) - runs30Of(x));
  mkdirSync(OUT(`./tools/${k}/`), { recursive: true });
  writeFileSync(OUT(`./tools/${k}/index.html`), page({
    path: `/tools/${k}/`,
    active: 'tools',
    keywords: ts.flatMap((t) => termsOf(t.name).aka.slice(0, 2)).join(', '),
    title: `${CAT_SHORT[k] || label} data tools and APIs (${ts.length}): ${label.toLowerCase()} | tacps126`.replace(/: (.{60}).*? \| /, ': $1... | '),
    description: short(`${useBody || label}. ${ts.slice(0, 4).map((t) => t.title).join(', ')} and more, with price, input builder and sample output for each.`, 300),
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: label, url: `${SITE}/tools/${k}/`, description: useBody || label,
        mainEntity: { '@type': 'ItemList', numberOfItems: ts.length, itemListElement: ts.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/tools/${t.name}/`, name: t.title })) } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', `${SITE}/`], ['Tools', `${SITE}/tools/`], [label, `${SITE}/tools/${k}/`]].map(([nm, u], i) => ({ '@type': 'ListItem', position: i + 1, name: nm, item: u })) },
    ],
    body: `
<section class="page-hero">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/tools/">Tools</a><span>/</span><span>${esc(CAT_SHORT[k] || label)}</span></nav>
    <h1>${esc(CAT_SHORT[k] || label)} data tools</h1>
    <p class="lead">${esc(useBody || `${ts.length} tools for ${label.toLowerCase()}, each with its price, an input builder and sample output.`)}</p>
  </div>
</section>
<section>
  <div class="wrap">
    <div class="sec-head"><h2>${ts.length} tool${ts.length === 1 ? '' : 's'}: ${esc(label.toLowerCase())}</h2><p>Most used first. Each page has the price, an input builder that writes the API call, and sample output.</p></div>
    <div class="grid">
${ts.map((t) => toolCard(t, k)).join('\n')}
    </div>
    <h3 class="terms-h">Popular searches</h3>
    <p class="terms">${ts.flatMap((t) => termsOf(t.name).aka.slice(0, 3).map((x) => `<a class="xchip" href="/tools/${t.name}/">${esc(x)}</a>`)).join(' ')}</p>
    <p class="note">Other topics: ${CATS.filter(([c]) => c !== k).map(([c, l]) => `<a href="/tools/${c}/">${esc(l)}</a>`).join(' · ')}</p>
  </div>
</section>`,
  }));
}

// ---------------------------------------------------------------- tools index (/tools/)
const chipsFor = (prefix) => [['all', 'All', used], ...CATS.map(([k, , names]) => [k, CAT_SHORT[k] || k, names.length])]
  .map(([k, l, n], i) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${i === 0}"${prefix}>${esc(l)} <span class="n">${n}</span></button>`).join('');
writeFileSync(OUT('./tools/index.html'), page({
  path: '/tools/',
  active: 'tools',
  title: `All ${used} web data tools and APIs: jobs, leads, tenders, research | tacps126`,
  description: `${used} web data tools: jobs, leads and contacts, reviews and news, research, government and compliance, health, commerce, markets, sports and transit. Price, input and output for each.`,
  jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'All tools', url: `${SITE}/tools/` },
  body: `
<section class="page-hero">
  <div class="wrap">
    <h1>All ${used} tools</h1>
    <p class="lead">Each one has a page with its price, an input builder that writes the API call for you, and the fields it returns.</p>
    <p class="topic-links">By topic: ${CATS.map(([c, l, ns]) => `<a href="/tools/${c}/">${esc(CAT_SHORT[c] || l)} <span>${ns.length}</span></a>`).join('')}</p>
  </div>
</section>
<section class="tight" id="tools">
  <div class="wrap">
    <div class="filters">${chipsFor('')}<div class="filter-row"><input class="search" id="search" type="search" placeholder="Filter tools" aria-label="Filter tools"><select class="sort" id="sort" aria-label="Sort tools"><option value="cat">By topic</option><option value="runs">Most used</option><option value="price">Price: low to high</option><option value="name">Name</option></select><span class="count" id="count" aria-live="polite"></span></div></div>
    <div class="grid">
${allTools.map(({ a, k }) => toolCard(a, k)).join('\n')}
    </div>
    <p class="empty" id="empty">No tool matches. <a href="mailto:${EMAIL}?subject=Custom%20data%20request">Ask for a custom one</a>.</p>
  </div>
</section>`,
}));

// ---------------------------------------------------------------- coverage (countries per tool)
// Countries each tool reads official or local sources for; worldwide tools are listed apart.
const EU27 = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const METEOALARM = [...EU27.filter((c) => c !== 'BG'), 'BG', 'BA', 'IS', 'IL', 'MD', 'ME', 'MK', 'NO', 'RS', 'CH', 'GB', 'UA'];
const COVERAGE = {
  'tenders-radar': ['US', 'GB', 'FR', 'DE', 'NL', 'CA', 'CO', 'ES', 'AU', 'ZA', 'UA', 'BR', 'IN', ...EU27, 'NO', 'IS', 'LI'],
  'legislation-radar': ['US', 'GB', 'AU', 'CA', ...EU27],
  'gov-radar': ['US', 'GB', 'IN', ...EU27],
  'grants-radar': ['US', 'GB', 'AU', ...EU27],
  'recalls-radar': ['US', 'CA', 'GB', ...EU27],
  'sanctions-screener': ['US', 'GB', 'CA', 'CH', ...EU27],
  'alerts-radar': ['US', 'IN', 'BR', ...METEOALARM],
  'company-registry': ['FR', 'NO', 'FI', 'EE', 'CZ', 'US', 'DE', 'GB', 'ES', 'IT', 'NL', 'SE', 'DK', 'IE', 'CH', 'IN', 'SG', 'AE'],
  'india-district-notices': ['IN'],
  'property-listings': ['DE', 'AT', 'GB', 'AE', 'SA', 'QA', 'BH', 'EG'],
  'immobilienscout24-scraper': ['DE', 'AT'],
  'rightmove-scraper': ['GB'],
  'propertyfinder-scraper': ['AE', 'SA', 'QA', 'BH', 'EG'],
  'indeed-jobs': ['US', 'GB', 'CA', 'AU', 'IE', 'DE', 'FR', 'NL', 'SG'],
  'naukri-jobs-scraper': ['IN'],
  'dice-jobs-scraper': ['US'],
  'builtin-jobs-scraper': ['US'],
  'short-interest': ['US'],
  'copart-auctions': ['US'],
  'auctions-radar': ['DE', 'ES', 'IT', 'IN'],
  'startup-funding': ['US'],
  'npi-providers': ['US'],
  'fda-device-clearances': ['US'],
  'kalshi-markets': ['US'],
  'lottery-results': ['US'],
};
const WORLDWIDE = ['jobs-harvester', 'linkedin-jobs-scraper', 'glassdoor-jobs-scraper', 'remote-jobs-scraper', 'google-news', 'contact-details', 'exhibition-scraper', 'events-scraper', 'trustpilot-reviews', 'app-reviews', 'research-radar', 'innovation-radar', 'youtube-transcripts', 'transit-timetables', 'clinical-trials', 'cve-feed', 'sports-data', 'prediction-markets', 'shopify-products', 'podcasts']
  .filter((n) => byName.has(n));
const WORLD = JSON.parse(readFileSync(new URL('./data/world.json', import.meta.url), 'utf8'));
// Small countries the simplified outline leaves out get a dot instead: [lon, lat].
const DOTS = { SG: [103.8, 1.35], BH: [50.55, 26.07], MT: [14.4, 35.9], LU: [6.13, 49.6], LI: [9.55, 47.15], CY: [33.2, 35.0] };
const byCountry = {};
for (const [n, cs] of Object.entries(COVERAGE)) {
  if (!byName.has(n)) continue;
  for (const c of new Set(cs)) (byCountry[c] ||= []).push(n);
}
const covered = Object.keys(byCountry);
const level = (c) => { const n = byCountry[c]?.length || 0; return n >= 8 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : n ? 1 : 0; };
const mapX = ([lon, lat]) => [((lon + 180) / 360) * WORLD.w, ((84 - lat) / 142) * WORLD.h];
const mapSvg = `<svg class="world" viewBox="0 0 ${WORLD.w} ${WORLD.h}" role="img" aria-label="World map: countries shaded by how many tools cover them">
${Object.entries(WORLD.paths).map(([c, d]) => `<path d="${d}" data-c="${c}" class="l${level(c)}"${byCountry[c] ? ` tabindex="0" role="button" aria-label="${esc(WORLD.names[c] || c)}: ${byCountry[c].length} tools"` : ''}><title>${esc(WORLD.names[c] || c)}</title></path>`).join('')}
${Object.entries(DOTS).filter(([c]) => byCountry[c] && !WORLD.paths[c]).map(([c, ll]) => { const [x, y] = mapX(ll); return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="5" data-c="${c}" class="l${level(c)}" tabindex="0" role="button" aria-label="${esc(WORLD.names[c] || c)}: ${byCountry[c].length} tools"/>`; }).join('')}
</svg>`;
const covData = {
  names: Object.fromEntries([...new Set([...covered, ...Object.keys(WORLD.paths)])].map((c) => [c, WORLD.names[c] || c])),
  tools: Object.fromEntries(Object.entries(byCountry).map(([c, ns]) => [c, ns])),
  meta: Object.fromEntries([...new Set(Object.values(byCountry).flat())].map((n) => [n, [byName.get(n).title, catOf[n]]])),
  cats: CAT_SHORT,
};
const topCountries = covered.sort((x, y) => byCountry[y].length - byCountry[x].length);

// Where free text from the "what data" box goes: a keyword field, a names field (after "at", "of"),
// or a links field (when the text is a link). Example subjects give way to what was asked.
const SUBJECT = /url|link|sites|names|compan|apps|videos|quer|keyword|search|fields|ideas|terms|stores|shows|boards|subreddit|channels|symbols|titleIncludes/i;
const textFields = (name) => fieldsOf(schemaOf(name)).filter(([, v]) => kindOf(v) === 'list' || (kindOf(v) === 'str' && !enumOf(v) && v.editor !== 'datepicker'));
const textTargets = (name) => {
  const f = textFields(name), as = (x) => (x ? [x[0], kindOf(x[1])] : null);
  return {
    kw: as(f.find(([k]) => /quer|keyword|search|terms|ideas|fields|titleIncludes|symbols/i.test(k) && !/exclude/i.test(k))),
    nm: as(f.find(([k]) => /names|compan|apps|stores|shows|channels|subreddit/i.test(k) && !/exclude/i.test(k))),
    url: as(f.find(([k]) => /url|link|videos/i.test(k))),
    any: as(f.find(([k, v]) => kindOf(v) === 'list' && SUBJECT.test(k) && !/exclude|url|link|sites/i.test(k))),
  };
};
// ---------------------------------------------------------------- composer (chain tools)
const chainData = {
  tools: Object.fromEntries([...new Set(CHAINS.flatMap((c) => [c[0], c[1]]))].map((n) => {
    const a = byName.get(n), m = primaryOf(a);
    return [n, { t: a.title, p: m ? evPrice(m) : priceOf(a.description) || '', w: m ? m.title.toLowerCase() : 'result', x: startInput(n), sf: textFields(n).map(([fk]) => fk).filter((fk) => SUBJECT.test(fk) && !/exclude|^role/i.test(fk)) }];
  })),
  edges: CHAINS,
};

// ---------------------------------------------------------------- search index (/search.json)
// What the command palette and the "what data do you need?" box search: every tool with its
// words, the options of its select fields (countries, sources, topics...) and its main text field.
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'your', 'any', 'all', 'per', 'one', 'each', 'into', 'that', 'this', 'are', 'its', 'you', 'get', 'data', 'scraper', 'tool', 'only', 'new', 'more', 'than', 'list', 'every', 'clean']);
const wordsOf = (s) => [...new Set(String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
const COUNTRY_FIELD = /^(country|countries|countryCode|jurisdictions)$/;
// Distinctive words from each README (source names such as EPO, USPTO, TED; data terms), so a search
// for a source finds the tool that reads it. Words in many READMEs (boilerplate) are left out.
// Agency names also searched by their short forms.
const ACRONYMS = [[/european patent office/i, 'epo espacenet'], [/patent and trademark office/i, 'uspto'], [/world intellectual property/i, 'wipo'],
  [/securities and exchange commission/i, 'sec edgar'], [/food and drug administration/i, 'fda'], [/consumer product safety/i, 'cpsc'],
  [/tenders electronic daily/i, 'ted'], [/office of foreign assets control/i, 'ofac'], [/national weather service/i, 'nws noaa'],
  [/companies house/i, 'ukch'], [/government e-?marketplace/i, 'gem'], [/system for award management/i, 'sam'], [/clinicaltrials\.gov/i, 'nct'],
  [/national provider identifier/i, 'npi'], [/common vulnerabilities/i, 'cve nvd'], [/worker adjustment and retraining/i, 'warn layoffs']];
const withAcronyms = (txt) => txt + ' ' + ACRONYMS.filter(([re]) => re.test(txt)).map(([, a]) => a).join(' ');
const readmeWords = new Map(allTools.map(({ a }) => [a.name, wordsOf(withAcronyms(readmeOf(a.name)).replace(/```[\s\S]*?```/g, ' ').replace(/https?:\/\/\S+/g, ' ')).filter((w) => !/^\d+$/.test(w) && w.length < 24)]));
const docFreq = new Map();
for (const ws of readmeWords.values()) for (const w of ws) docFreq.set(w, (docFreq.get(w) || 0) + 1);
const keywordsOf = (name, own) => {
  const mine = new Set(own.split(' '));
  return (readmeWords.get(name) || []).filter((w) => !mine.has(w) && docFreq.get(w) <= 6).slice(0, 260).join(' ');
};
const searchIndex = {
  tools: allTools.map(({ a, k }) => {
    const n = a.name, fs = fieldsOf(schemaOf(n)), m = primaryOf(a), smp = sampleOf(n);
    const opts = [];
    for (const [fk, v] of fs) {
      const en = enumOf(v), et = enumTitlesOf(v) || en;
      if (!en || en.length > 160 || fk === 'aiProvider') continue;
      en.forEach((e, i) => { if (e) opts.push([fk, e, short(textOf(et[i] ?? e), 50), kindOf(v) === 'multi' ? 1 : 0]); });
    }
    const cf = fs.find(([fk, v]) => COUNTRY_FIELD.test(fk) && !enumOf(v));
    return {
      n, t: a.title, c: k, d: short(stripPrice(a.description), 150), r: runs30Of(a),
      p: m ? evPrice(m) : priceOf(a.description) || '', w: wordsOf(`${n.replace(/-/g, ' ')} ${a.title} ${stripPrice(a.description)} ${termsOf(n).aka.join(' ')}`).join(' '),
      k: `${keywordsOf(n, wordsOf(`${n.replace(/-/g, ' ')} ${a.title} ${stripPrice(a.description)}`).join(' '))} ${wordsOf(termsOf(n).uses.join(' ')).join(' ')}`.trim(),
      f: textTargets(n), sf: textFields(n).map(([fk]) => fk).filter((fk) => SUBJECT.test(fk) && !/exclude/i.test(fk)), so: fieldsOf(schemaOf(n)).map(([fk]) => fk).filter((fk) => /^(sources|source|lists|portals|jurisdictions)$/.test(fk)), cf: cf ? [cf[0], kindOf(cf[1])] : null, o: opts, x: startInput(n), m: mcpOf(n),
      s: smp ? Object.entries(smp).filter(([, v]) => v !== null && typeof v !== 'object').slice(0, 4).map(([kk, v]) => [kk, short(String(v), 60)]) : [],
    };
  }),
  cats: Object.fromEntries(CATS.map(([k, l]) => [k, l])),
  pages: [['Home', '/'], ['All tools', '/tools/'], ['Coverage map', '/#coverage'], ['Chain tools together', '/#compose'], ['Pricing and cost estimate', '/pricing.html'], ['Free datasets and samples', '/datasets.html'], ['Use the tools in Clay', '/clay.html'], ['MCP server for AI agents', '/mcp.html'], ['Blog', '/blog/'], ['About', '/about.html'], ['Trade show exhibitor lists', '/leads/'], ['Custom data request', `mailto:${EMAIL}?subject=Custom%20data%20request`]],
  posts: POSTS.map((p) => [p.title, `/blog/${p.id}.html`]),
  countries: Object.fromEntries(Object.entries(WORLD.names).map(([c, nm]) => [nm.toLowerCase(), c])),
};
writeFileSync(OUT('./search.json'), JSON.stringify(searchIndex));

// ---------------------------------------------------------------- home
const popular = allTools.slice().sort((x, y) => runs30Of(y.a) - runs30Of(x.a)).slice(0, 6);
const topicRuns = CATS.map(([k, , names]) => [k, toolsOf(names).reduce((s, a) => s + runs30Of(a), 0)]);
const topicTotal = Math.max(1, topicRuns.reduce((s, [, r]) => s + r, 0));
const EXAMPLES = ['jobs at stripe', 'tenders for solar in germany', 'trustpilot reviews of a competitor', 'new companies in norway', 'flats to rent in berlin', 'polymarket election odds', 'earthquake alerts', 'exhibitors at ism cologne'];
const homeBody = `
<section class="hero">
  <div class="wrap">
    <h1>Web data for the job you have in mind</h1>
    <p class="lead">${used} tools that turn public pages, registers and feeds into clean rows. Say what you need; get the tool, its price and a ready call.</p>
    <div class="intent" id="intent">
      <form class="intent-box" role="search" action="/tools/" onsubmit="return false">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="intent-q" type="search" placeholder="What data do you need?" aria-label="What data do you need?" autocomplete="off" enterkeyhint="search">
        <kbd>↵</kbd>
      </form>
      <div class="intent-ex">Try: ${EXAMPLES.map((e) => `<button type="button" class="ex" data-ex="${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <div class="intent-out" id="intent-out" hidden aria-live="polite"></div>
    </div>
    <ul class="proof" aria-label="In numbers">
      <li><b>${used}</b> tools</li>${okShare ? `
      <li><b>${okShare}%</b> of ${fmt(runs30.total)} public runs succeeded, last 30 days</li>` : ''}
      <li><b>${covered.length}</b> countries with local sources</li>
      <li>from <b>${PRICE_FROM}</b> per 1,000 results</li>
      <li><b>${N}</b> tools for AI agents</li>
    </ul>
    <div class="topic-bar" aria-hidden="true">${topicRuns.filter(([, r]) => r).map(([k, r]) => `<i data-k="${k}" style="flex:${r}" title="${esc(CAT_SHORT[k] || k)}: ${fmt(r)} runs in 30 days"></i>`).join('')}</div>
    <p class="topic-cap">Public runs in the last 30 days, by topic: ${topicRuns.filter(([, r]) => r).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, r]) => `${esc((CAT_SHORT[k] || k).toLowerCase())} ${Math.round((100 * r) / topicTotal)}%`).join(', ')}.</p>
  </div>
</section>

<section class="tight" data-label="Start here">
  <div class="wrap bento">
    <button class="tile t-search" type="button" data-pal><span class="t-kick">Search everything</span><b>Press <kbd>⌘K</kbd> or <kbd>/</kbd></b><span>Every tool, page and AI-agent tool by name or by need; Enter opens it, Shift+Enter copies its API call.</span></button>
    <a class="tile t-map" href="#coverage"><span class="t-kick">Coverage</span><b>${covered.length} countries</b><span>Tenders, laws, registers, recalls, alerts, jobs and property, country by country.</span></a>
    <a class="tile t-agent" href="/mcp.html"><span class="t-kick">For AI agents</span><b>${N} MCP tools</b><code>npx -y webdata-tools-mcp</code></a>
    <a class="tile t-price" href="/pricing.html"><span class="t-kick">Pricing</span><b>${PRICE_FROM}-${usd(q(0.9))} / 1k</b><span>Pay per result; empty searches are free; cap every run.</span></a>
    <a class="tile t-chain" href="#compose"><span class="t-kick">Chain tools</span><b>Exhibitors > emails</b><span>Pass one tool's rows to the next and get the script.</span></a>
  </div>
</section>

<section class="alt" id="uses" data-label="Topics">
  <div class="wrap">
    <div class="sec-head"><h2>Pick a topic</h2><p>The same clean fields every run, with only-new mode for daily feeds.</p></div>
    <div class="grid">
${useCards}
    </div>
  </div>
</section>

<section id="popular" data-label="Most used">
  <div class="wrap">
    <div class="sec-head row"><div><h2>Most used this month</h2><p>Each page has an input builder that writes the call for you.</p></div><a class="btn" href="/tools/">All ${used} tools > </a></div>
    <div class="grid">
${popular.map(({ a, k }) => toolCard(a, k)).join('\n')}
    </div>
  </div>
</section>

<section class="alt" id="coverage" data-label="Coverage">
  <div class="wrap">
    <div class="sec-head"><h2>Where the data comes from</h2><p>Countries shade by how many tools read their official or local sources. Hover for the tools; click or tap for a close-up with state and province lines.</p></div>
    <div class="map-grid">
      <div class="map-col">
        <div class="map-box">${mapSvg}
          <div class="map-key" aria-hidden="true"><span class="l1">1</span><span class="l2">2-4</span><span class="l3">5-7</span><span class="l4">8+</span> tools</div>
        </div>
        <div class="ww-box"><p class="t-kick">Worldwide: ${WORLDWIDE.length} tools that work for any country</p>
          <p class="ww">${WORLDWIDE.map((n) => `<a href="/tools/${n}/">${esc(shortTitle(byName.get(n).title))}</a>`).join(' · ')}</p></div>
      </div>
      <div class="map-panel" id="map-panel" aria-live="polite">
        <p class="t-kick">Most covered</p>
        <ul class="map-top">${topCountries.slice(0, 10).map((c) => `<li><button type="button" data-goto="${c}">${esc(WORLD.names[c] || c)}</button><span>${byCountry[c].length}</span></li>`).join('')}</ul>
      </div>
    </div>
    <script type="application/json" id="cov-data">${JSON.stringify(covData).replace(/</g, '\\u003c')}</script>
  </div>
</section>

<section id="compose" data-label="Chain tools">
  <div class="wrap">
    <div class="sec-head"><h2>Chain tools together</h2><p>Pick a start, then add steps: each step takes a field from the rows before it. You get one Python script that runs the whole chain.</p></div>
    <div class="composer" id="composer">
      <div class="chain" id="chain"><p class="muted">Start with: ${[...new Set(CHAINS.map((c) => c[0]))].map((n) => `<button class="chip" type="button" data-start="${n}">${esc(byName.get(n).title)}</button>`).join(' ')}</p></div>
      <div class="chain-code" id="chain-code" hidden>${code('chain.py · pip install apify-client', '')}</div>
    </div>
    <noscript><p>Examples: exhibitors of a trade show > their websites > emails; new companies in a register > sanctions screening.</p></noscript>
    <script type="application/json" id="chain-data">${JSON.stringify(chainData).replace(/</g, '\\u003c')}</script>
  </div>
</section>

<section class="alt" id="faq" data-label="FAQ">
  <div class="wrap">
    <div class="sec-head"><h2>Before you start</h2></div>
    <div class="faq">
      <details><summary>How do I try a tool?</summary><p>Open its page here to see the input and output, then press Run it on Apify. Apify's free plan includes monthly credit, enough to try every tool on real data.</p></details>
      <details><summary>What does it cost?</summary><p>You pay per result: from ${PRICE_FROM} per 1,000, most tools ${PRICE_MOST}, and a few optional extras such as AI insights (see <a href="/pricing.html">pricing</a>). Searches that find nothing are not charged, and every run can be capped at a spend limit you set.</p></details>
      <details><summary>How do I call it from code?</summary><p>Every tool is an HTTP endpoint: send the input, get the rows back as JSON, CSV, Excel or XML. Each tool page writes the call for the input you build, in curl, Python and JavaScript. Ready-made scripts are in the <a href="https://github.com/${USER}/apify-data-recipes">recipes</a>.</p></details>
      <details><summary>What happens when a website changes?</summary><p>The tools are run against their live sources on a schedule. When a site changes, the tool is fixed and a note goes into its changelog.</p></details>
      <details><summary>Can it read pages behind a login or a captcha?</summary><p>No. The tools read public pages only and never solve captchas. A few accept your own sign-in for pages your account can see, and say plainly when a source is closed.</p></details>
    </div>
  </div>
</section>

<section id="build" data-label="Custom work">
  <div class="wrap">
    <div class="cta-band">
      <div><h2>Need a source that isn't here?</h2><p>Custom scrapers and daily feeds for niche boards, registers and catalogs. Send the source, three examples and where the data should go; get a free sample.</p></div>
      <a class="btn primary" href="mailto:${EMAIL}?subject=Custom%20data%20request">Email ${EMAIL}</a>
    </div>
    <div class="grid two" style="margin-top:20px">
      <a class="card link" href="https://github.com/${USER}/webdata-tools-mcp" rel="noopener"><span class="why">Open source</span><h3>webdata-tools-mcp</h3><p>The MCP server: MIT licensed, in the official MCP Registry, on npm, Smithery and Glama.</p></a>
      <a class="card link" href="https://github.com/${USER}/apify-data-recipes" rel="noopener"><span class="why">Open source</span><h3>apify-data-recipes</h3><p>Copy-paste scripts: hiring signals, news alerts, review monitoring, exhibitor leads, sanctions checks, market movers and more.</p></a>
    </div>
  </div>
</section>`;

writeFileSync(
  OUT('./index.html'),
  page({
    path: '/',
    active: 'home',
    title: `${OWNER} (tacps126) - web data tools for jobs, leads, research and public records`,
    description: `${used} fast, low-cost web data tools: jobs and hiring signals, contacts, trade shows and events, tenders, laws, registers and recalls, research, reviews and news, property, markets and sports. Pay per result, plus an MCP server for AI agents.`,
    body: homeBody,
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: `${OWNER} (tacps126)`, alternateName: 'tacps126', url: `${SITE}/`, description: 'Web data tools for jobs, leads, research and public records', author: { '@type': 'Person', name: OWNER, alternateName: 'tacps126', email: EMAIL, url: `${SITE}/about.html`, sameAs: [`https://github.com/${USER}`, `https://apify.com/${USER}`] } },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Web data tools', numberOfItems: allTools.length, itemListElement: allTools.map(({ a }, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/tools/${a.name}/`, name: a.title })) },
    ],
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

// Sitemap dates move only when a page's HTML changes (data/lastmod.json keeps a hash per page), so search
// engines can trust them; a daily refresh that changes nothing keeps the old date. scripts/indexnow.mjs
// sends the pages dated today to IndexNow (Bing, Yandex and others) after a push.
const LASTMOD_FILE = new URL('./data/lastmod.json', import.meta.url);
const LASTMOD = existsSync(LASTMOD_FILE) ? JSON.parse(readFileSync(LASTMOD_FILE, 'utf8')) : {};
const seen = new Set();
const lastmod = (path) => {
  seen.add(path);
  const hash = createHash('sha1').update(readFileSync(OUT('.' + (path.endsWith('/') ? path + 'index.html' : path)))).digest('hex').slice(0, 16);
  if (LASTMOD[path]?.hash !== hash) LASTMOD[path] = { hash, date: TODAY };
  return LASTMOD[path].date;
};
const entry = (path, extra = '') => `  <url><loc>${SITE}${path}</loc><lastmod>${lastmod(path)}</lastmod>${extra}</url>`;
writeFileSync(
  OUT('./sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[
  ...['/', '/mcp.html', '/about.html', '/pricing.html', '/datasets.html', '/clay.html', '/blog/', '/tools/'].map((p) => entry(p)),
  ...CATS.map(([k]) => entry(`/tools/${k}/`)),
  ...allTools.map(({ a }) => entry(`/tools/${a.name}/`, ogOf(a.name) !== OG ? `<image:image><image:loc>${esc(ogOf(a.name))}</image:loc></image:image>` : '')),
  ...POSTS.map((p) => entry(`/blog/${p.id}.html`)),
  ...(leads.length ? [entry('/leads/')] : []),
  ...leads.map((l) => entry(`/leads/${l.id}.html`)),
].join('\n')}
</urlset>
`,
);
if (!PREVIEW) {
  const kept = Object.fromEntries(Object.keys(LASTMOD).filter((k) => seen.has(k)).sort().map((k) => [k, LASTMOD[k]]));
  fsWrite(LASTMOD_FILE, JSON.stringify(kept, null, 1) + '\n');
}

const lines = CATS.flatMap(([k, label, names]) => [
  `## [${label}](${SITE}/tools/${k}/)`,
  ...names
    .map((n) => byName.get(n))
    .filter(Boolean)
    .map((a) => `- [${a.title}](${SITE}/tools/${a.name}/): ${short(stripPrice(a.description), 120)}${priceOf(a.description) ? ` (${priceOf(a.description)})` : ''}. Run: https://apify.com/${USER}/${a.name}`),
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

console.log(`site built: ${used} tools, ${used} tool pages, ${CHAINS.length} chains, ${covered.length} countries`);

if (PREVIEW) {
  for (const f of ['style.css', 'app.js', 'tool.js', 'fonts', 'icons', 'og', 'data', 'og.png', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'robots.txt']) {
    cpSync(new URL(`./${f}`, import.meta.url), OUT(`./${f}`), { recursive: true });
  }
  console.log('PREVIEW: open with  python3 -m http.server -d _preview');
}
