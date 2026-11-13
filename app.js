(function () {
  var root = document.documentElement, USER = 'tacps126';
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return [].slice.call((el || document).querySelectorAll(s)); }
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function flash(b, text) { var o = b.textContent; b.textContent = text || 'Copied'; setTimeout(function () { b.textContent = o; }, 1400); }
  function copyText(t, b) { if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { if (b) flash(b); }, function () {}); }

  // ---- code for a call: shared with tool.js (window.TC)
  function py(v, ind) {
    ind = ind || '';
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (Array.isArray(v)) return v.length ? '[' + v.map(function (x) { return py(x, ind); }).join(', ') + ']' : '[]';
    if (typeof v === 'object') {
      var ks = Object.keys(v);
      if (!ks.length) return '{}';
      return '{\n' + ks.map(function (k) { return ind + '    ' + JSON.stringify(k) + ': ' + py(v[k], ind + '    ') + ','; }).join('\n') + '\n' + ind + '}';
    }
    return JSON.stringify(v);
  }
  var TC = window.TC = {
    py: py,
    curl: function (n, x) { return 'curl -X POST \\\n  "https://api.apify.com/v2/acts/' + USER + '~' + n + '/run-sync-get-dataset-items?token=YOUR_APIFY_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d \'' + JSON.stringify(x).replace(/'/g, "'\\''") + '\''; },
    python: function (n, x) { return 'from apify_client import ApifyClient\n\nclient = ApifyClient("YOUR_APIFY_TOKEN")\nrun = client.actor("' + USER + '/' + n + '").call(run_input=' + py(x) + ')\nfor item in client.dataset(run["defaultDatasetId"]).iterate_items():\n    print(item)'; },
    js: function (n, x) { return "import { ApifyClient } from 'apify-client';\n\nconst client = new ApifyClient({ token: 'YOUR_APIFY_TOKEN' });\nconst run = await client.actor('" + USER + '/' + n + "').call(" + JSON.stringify(x, null, 2) + ');\nconst { items } = await client.dataset(run.defaultDatasetId).listItems();\nconsole.log(items);'; },
    enc: function (x) { return btoa(unescape(encodeURIComponent(JSON.stringify(x)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec: function (s) { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; } },
    copy: copyText,
  };

  // ---- theme and menu
  var tbtn = document.getElementById('theme');
  function current() { return root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  if (tbtn) tbtn.addEventListener('click', function () { var n = current() === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', n); store('theme', n); });
  var menu = document.getElementById('menu'), links = document.getElementById('nav-links');
  if (menu && links) {
    menu.addEventListener('click', function () { var o = links.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });
    links.addEventListener('click', function (e) { if (e.target.tagName === 'A') links.classList.remove('open'); });
  }

  // ---- tabs and copy buttons
  function wireTabs(scope) {
    $$('[data-tabs]', scope).forEach(function (group) {
      var tabs = $$('.tab', group), panels = $$(':scope > .panel', group.parentNode);
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () {
          tabs.forEach(function (x, j) { x.setAttribute('aria-selected', i === j); }); panels.forEach(function (p, j) { p.hidden = i !== j; });
        });
      });
    });
  }
  wireTabs(document);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.copy');
    if (!b) return;
    if (b.dataset.copy) return copyText(b.dataset.copy, b);
    var pre = b.closest('.code').querySelector('pre');
    copyText(pre.innerText, b);
  });

  // ---- tools index: topic chips, filter, sort, count (?cat=jobs preselects)
  var cards = $$('[data-tool]'), chips = $$('.chip[data-cat]'), search = document.getElementById('search');
  var empty = document.getElementById('empty'), count = document.getElementById('count'), sortSel = document.getElementById('sort'), cat = 'all';
  function apply() {
    var q = (search && search.value || '').trim().toLowerCase(), shown = 0;
    cards.forEach(function (c) {
      var ok = (cat === 'all' || c.dataset.cat === cat) && (!q || c.textContent.toLowerCase().indexOf(q) !== -1 || deep(c, q));
      c.hidden = !ok; if (ok) shown++;
    });
    if (empty) empty.classList.toggle('show', shown === 0);
    if (count) count.textContent = shown + (shown === 1 ? ' tool' : ' tools');
  }
  // Beyond the card text: each tool's README words from search.json ("epo", "cpv", "vin").
  function deep(c, q) {
    if (!IDX) return false;
    var t = IDX.byName[(c.getAttribute('href') || '').split('/')[2]];
    if (!t) return false;
    var text = ' ' + t.w + ' ' + (t.k || '') + ' ';
    return q.split(/\s+/).every(function (w) { return text.indexOf(' ' + w) !== -1 || SYN[w] === t.n; });
  }
  function pick(k) { cat = k; chips.forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.cat === k); }); apply(); }
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      pick(ch.dataset.cat);
      if (history.replaceState) history.replaceState(null, '', ch.dataset.cat === 'all' ? location.pathname : '?cat=' + ch.dataset.cat);
    });
  });
  if (search) {
    search.addEventListener('input', apply);
    search.addEventListener('focus', function () { index().then(apply); }, { once: true });
    var qm = /[?&]q=([^&]+)/.exec(location.search);
    if (qm) { search.value = decodeURIComponent(qm[1].replace(/\+/g, ' ')); index().then(apply); }
  }
  if (sortSel && cards.length) {
    var grid = cards[0].parentNode, original = cards.slice();
    var sortCards = function () {
      var v = sortSel.value, list = original.slice();
      if (v === 'price') list.sort(function (a, b) { return parseFloat(a.dataset.price) - parseFloat(b.dataset.price); });
      if (v === 'runs') list.sort(function (a, b) { return b.dataset.runs - a.dataset.runs; });
      if (v === 'name') list.sort(function (a, b) { return a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent); });
      list.forEach(function (c) { grid.appendChild(c); });
      store('sort', v);
    };
    var sv = store('sort'); if (sv && sortSel.querySelector('option[value="' + sv + '"]')) sortSel.value = sv;
    sortSel.addEventListener('change', sortCards); sortCards();
  }
  if (chips.length) { var m = /[?&]cat=([a-z]+)/.exec(location.search); pick(m && $('.chip[data-cat="' + m[1] + '"]') ? m[1] : 'all'); }

  // ---- search index, loaded on first use
  var IDX = null, idxWait = null;
  function index() {
    if (IDX) return Promise.resolve(IDX);
    if (!idxWait) idxWait = fetch('/search.json').then(function (r) { return r.json(); }).then(function (j) {
      IDX = j;
      IDX.byName = {}; IDX.df = {};
      j.tools.forEach(function (t) { IDX.byName[t.n] = t; t.ws = t.w.split(' '); t.tl = t.t.toLowerCase(); t.kw = t.k ? t.k.split(' ') : []; t.kw.concat(t.ws).forEach(function (w) { IDX.df[w] = (IDX.df[w] || 0) + 1; }); });
      IDX.cnames = Object.keys(j.countries).filter(function (n) { return n.length > 3 || n === 'usa' || n === 'uk'; }).sort(function (a, b) { return b.length - a.length; });
      IDX.countries.eu = 'EU'; IDX.countries.europe = 'EU'; IDX.countries['european union'] = 'EU'; IDX.countries.usa = 'US'; IDX.countries.uk = 'GB'; IDX.countries.us = 'US'; IDX.countries.america = 'US'; IDX.countries.britain = 'GB'; IDX.countries.england = 'GB';
      IDX.cnames.push('usa', 'uk', 'america', 'britain', 'england', 'european union', 'europe', 'eu');
      IDX.cnames.sort(function (a, b) { return b.length - a.length; });
      return IDX;
    });
    return idxWait;
  }

  // ---- "what data do you need?": a deterministic matcher, no server and no AI call
  var SYN = {
    job: 'jobs-harvester', jobs: 'jobs-harvester', vacancies: 'jobs-harvester', careers: 'jobs-harvester', openings: 'jobs-harvester', roles: 'jobs-harvester', hiring: 'hiring-signals',
    tender: 'tenders-radar', tenders: 'tenders-radar', rfp: 'tenders-radar', procurement: 'tenders-radar', bids: 'tenders-radar', contracts: 'tenders-radar', awards: 'tenders-radar',
    law: 'legislation-radar', laws: 'legislation-radar', bill: 'legislation-radar', bills: 'legislation-radar', legislation: 'legislation-radar', regulations: 'legislation-radar',
    grant: 'grants-radar', grants: 'grants-radar', recall: 'recalls-radar', recalls: 'recalls-radar', sanction: 'sanctions-screener', sanctions: 'sanctions-screener', ofac: 'sanctions-screener',
    companies: 'company-registry', company: 'company-registry', registered: 'company-registry', incorporated: 'company-registry', insolvencies: 'company-registry', registry: 'company-registry',
    alert: 'alerts-radar', alerts: 'alerts-radar', earthquake: 'alerts-radar', earthquakes: 'alerts-radar', flood: 'alerts-radar', storm: 'alerts-radar', weather: 'alerts-radar', cyclone: 'alerts-radar', wildfire: 'alerts-radar',
    news: 'google-news', headlines: 'google-news', articles: 'google-news', review: 'trustpilot-reviews', reviews: 'trustpilot-reviews', trustpilot: 'trustpilot-reviews', complaints: 'trustpilot-reviews',
    app: 'app-reviews', apps: 'app-reviews', reddit: 'reddit-monitor', subreddit: 'reddit-monitor', email: 'contact-details', emails: 'contact-details', contacts: 'contact-details', phones: 'contact-details',
    exhibitor: 'exhibition-scraper', exhibitors: 'exhibition-scraper', expo: 'exhibition-scraper', fair: 'exhibition-scraper', booth: 'exhibition-scraper',
    event: 'events-scraper', events: 'events-scraper', meetup: 'events-scraper', meetups: 'events-scraper', conference: 'events-scraper', conferences: 'events-scraper',
    shopify: 'shopify-products', store: 'shopify-store-analyzer', stores: 'shopify-store-analyzer',
    flat: 'property-listings', flats: 'property-listings', apartment: 'property-listings', apartments: 'property-listings', rent: 'property-listings', house: 'property-listings', houses: 'property-listings', property: 'property-listings', homes: 'property-listings',
    odds: 'sports-betting-odds', betting: 'sports-betting-odds', moneyline: 'sports-betting-odds', spread: 'sports-betting-odds', scores: 'sports-data', score: 'sports-data', nba: 'sports-data', nfl: 'sports-data', soccer: 'sports-data', football: 'sports-data', standings: 'sports-data', tennis: 'tennis-scores-rankings',
    lottery: 'lottery-results', powerball: 'lottery-results', lotto: 'lottery-results', jackpot: 'lottery-results',
    polymarket: 'prediction-markets', kalshi: 'prediction-markets', prediction: 'prediction-markets', election: 'prediction-markets',
    short: 'short-interest', shorted: 'short-interest', squeeze: 'short-interest', car: 'copart-auctions', cars: 'copart-auctions', salvage: 'copart-auctions', auction: 'copart-auctions', auctions: 'copart-auctions',
    bus: 'transit-timetables', train: 'transit-timetables', trains: 'transit-timetables', metro: 'transit-timetables', transit: 'transit-timetables', timetable: 'transit-timetables', departures: 'transit-timetables',
    paper: 'research-radar', papers: 'research-radar', patent: 'research-radar', epo: 'research-radar', uspto: 'research-radar', wipo: 'research-radar', espacenet: 'research-radar', patents: 'research-radar', research: 'research-radar', arxiv: 'research-radar', pubmed: 'research-radar',
    idea: 'innovation-radar', ideas: 'innovation-radar', landscape: 'innovation-radar', salary: 'levels-fyi-salaries', salaries: 'levels-fyi-salaries', compensation: 'levels-fyi-salaries', remote: 'remote-jobs-scraper',
    youtube: 'youtube-transcripts', transcript: 'youtube-transcripts', transcripts: 'youtube-transcripts', comments: 'youtube-comments', podcast: 'podcasts', podcasts: 'podcasts',
    trial: 'clinical-trials', trials: 'clinical-trials', clinical: 'clinical-trials', cve: 'cve-feed', vulnerabilities: 'cve-feed', vulnerability: 'cve-feed',
    doctor: 'npi-providers', doctors: 'npi-providers', dentist: 'npi-providers', dentists: 'npi-providers', clinics: 'npi-providers', physicians: 'npi-providers',
    asking: 'reddit-lead-finder', alternative: 'reddit-lead-finder', alternatives: 'reddit-lead-finder', recommend: 'reddit-lead-finder', recommendations: 'reddit-lead-finder',
    funding: 'startup-funding', raised: 'startup-funding', raises: 'startup-funding', district: 'india-district-notices', regulator: 'gov-radar', regulators: 'gov-radar', circulars: 'gov-radar',
  };
  var FILLER = /^(find|show|get|list|me|all|in|at|of|to|near|about|on|by|from|for|the|a|an|with|top|best|every|latest|new|recent|data|scrape|scraper|i|need|want|who|what|which|are|is|and|or|my|our|some|any|please|give|lookup|look|up|selling|sell|sells|sold|check|posts|results|people|someone|via|using|how|much|many|does|cost)$/;
  function wordsOf(s) { return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean); }
  function match(q, I) {
    var raw = ' ' + q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' ', toks = wordsOf(q), country = null;
    for (var i = 0; i < I.cnames.length; i++) { if (raw.indexOf(' ' + I.cnames[i] + ' ') !== -1) { country = [I.cnames[i], I.countries[I.cnames[i]]]; break; } }
    var cw = country ? wordsOf(country[0]) : [];
    var firstSyn = toks.filter(function (w) { return SYN[w] && I.byName[SYN[w]]; })[0];
    var ranked = I.tools.map(function (t) {
      var s = 0, fill = {}, usedTok = {};
      toks.forEach(function (w) {
        if (SYN[w] === t.n) { s += w === firstSyn ? 11 : 9; if (t.ws.indexOf(w) !== -1 || t.tl.indexOf(w) !== -1) usedTok[w] = 1; else usedTok[w] = 'subject'; }
        else if (SYN[w] && I.byName[SYN[w]] && t.n.indexOf(SYN[w].split('-')[0]) === 0) s += 2;
        if (w.length > 2 && !FILLER.test(w)) {
          if (t.ws.indexOf(w) !== -1) { s += t.tl.indexOf(w) !== -1 ? 4 : 2; usedTok[w] = usedTok[w] || 2; }
          else if (t.kw.indexOf(w) !== -1) { s += (I.df[w] || 9) <= 2 ? 3.5 : (I.df[w] || 9) <= 4 ? 2 : 1; usedTok[w] = usedTok[w] || 2; }
          else if (w.length >= 5 && t.ws.some(function (x) { return x.indexOf(w.slice(0, 5)) === 0; })) s += 1;
        }
      });
      // Select options (sources, countries, topics...): per field keep the options that match the most
      // words, and let one field add at most a few points, so long option lists cannot drown the rest.
      var best = {};
      t.o.forEach(function (o) {
        var tl = ' ' + o[2].toLowerCase().replace(/[^a-z0-9 ]+/g, ' ') + ' ', n = 0, hitWords = [];
        toks.forEach(function (w) {
          // A word that picked this tool only matches options when it is not the tool's own word
          // ("earthquake" picks a hazard; "tenders" does not pick every tender source).
          if (FILLER.test(w) || (SYN[w] && usedTok[w] !== 'subject')) return;
          var stem = w.length > 4 ? w.replace(/(es|s)$/, '') : w;
          if ((w.length > 2 && (tl.indexOf(' ' + w + ' ') !== -1 || tl.indexOf(' ' + stem + ' ') !== -1)) || String(o[1]).toLowerCase() === w) { n++; hitWords.push(w); }
        });
        if (country && tl.indexOf(' ' + country[0] + ' ') !== -1) { n += 0.5; hitWords = hitWords.concat(cw); }
        if (!n) return;
        var b = best[o[0]] || (best[o[0]] = { n: 0, opts: [], words: [], multi: o[3] });
        if (n > b.n) { b.n = n; b.opts = [o[1]]; b.words = hitWords; } else if (n === b.n) { b.opts.push(o[1]); b.words = b.words.concat(hitWords); }
      });
      Object.keys(best).forEach(function (k) {
        var b = best[k];
        if (!b.multi && b.opts.length > 1) return;
        if (b.multi && b.opts.length > 8) return;
        s += Math.min(3, 1 + b.n);
        b.words.forEach(function (w) { usedTok[w] = 1; });
        fill[k] = b.multi ? b.opts : b.opts[0];
      });
      if (country && t.cf && !(t.cf[0] in fill)) { var code = /^[a-z]/.test(JSON.stringify(t.x[t.cf[0]] || '')) ? country[1].toLowerCase() : country[1]; fill[t.cf[0]] = t.cf[1] === 'list' ? [code] : code; cw.forEach(function (w) { usedTok[w] = 1; }); s += 1; }
      if (s > 0) s += Math.log(1 + t.r) * 0.25;
      return { t: t, s: s, fill: fill, used: usedTok };
    }).filter(function (r) { return r.s >= 3; }).sort(function (a, b) { return b.s - a.s; });
    if (!ranked.length) return { country: country, list: [] };
    var best = ranked[0], t = best.t, input = JSON.parse(JSON.stringify(t.x || {}));
    Object.keys(best.fill).forEach(function (k) { input[k] = best.fill[k]; });
    // A place was named: the example's own source list would fight it.
    if (country) (t.so || []).forEach(function (k) { if (!(k in best.fill)) delete input[k]; });
    var rest = toks.filter(function (w) { return (best.used[w] === 'subject' || (!best.used[w] && !SYN[w])) && !FILLER.test(w) && cw.indexOf(w) === -1; }).join(' ');
    var link = (q.match(/https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|io|ai|co|org|net|de|uk|in|app|dev|so|fr|nl|es|it|eu)\b\S*/i) || [])[0];
    var isLink = !!link, named = /\b(at|of|from|by)\s+(a\s+|an\s+|the\s+)?(\S+\s*){1,3}$/i.test(q.trim());
    var f = t.f || {}, target = isLink ? f.url : named ? f.nm || f.kw || f.any : f.kw || f.nm || f.any;
    if (isLink) rest = /^https?:/i.test(link) ? link : 'https://' + link;
    // The example's own subjects (its sample companies, links, queries) give way to what was asked.
    if ((rest && target) || Object.keys(best.fill).length) (t.sf || []).forEach(function (k) { if (!(k in best.fill)) delete input[k]; });
    if (rest && target) input[target[0]] = target[1] === 'list' ? [rest] : rest;
    return { country: country, list: ranked.slice(0, 4), input: input, rest: rest };
  }
  var intentQ = document.getElementById('intent-q'), intentOut = document.getElementById('intent-out');
  if (intentQ && intentOut) {
    var timer = null;
    var render = function () {
      var q = intentQ.value.trim();
      if (q.length < 3) { intentOut.hidden = true; return; }
      index().then(function (I) {
        var r = match(q, I);
        intentOut.hidden = false;
        if (!r.list.length) {
          intentOut.innerHTML = '<div class="io-none"><b>No tool for that yet.</b> <a class="btn small primary" href="mailto:tacps126@gmail.com?subject=' + encodeURIComponent('Custom data request: ' + q) + '&body=' + encodeURIComponent('I need: ' + q + '\n\nSources or example sites:\nHow often:\nWhere the data should go:') + '">Ask for a custom tool</a> <button type="button" class="btn small ghost" data-pal>Browse all tools</button></div>';
          return;
        }
        var t = r.list[0].t, x = r.input, link = '/tools/' + t.n + '/#in=' + TC.enc(x);
        intentOut.innerHTML =
          '<div class="io-main"><div class="io-head"><div><span class="tag" data-k="' + t.c + '">' + h(I.cats[t.c]) + '</span><h3><a href="' + link + '">' + h(t.t) + '</a></h3><p>' + h(t.d) + '</p></div>' + (t.p ? '<span class="pchip"><b>' + h(t.p) + '</b></span>' : '') + '</div>' +
          (t.s.length ? '<div class="io-sample" aria-label="A real row">' + t.s.map(function (kv) { return '<span><i>' + h(kv[0]) + '</i>' + h(kv[1]) + '</span>'; }).join('') + '</div>' : '') +
          '<label class="io-l" for="io-json">Input (edit it)</label><textarea id="io-json" class="io-json" spellcheck="false" rows="' + Math.min(10, JSON.stringify(x, null, 2).split('\n').length) + '">' + h(JSON.stringify(x, null, 2)) + '</textarea>' +
          '<div class="io-act"><a class="btn small primary" id="io-open" href="' + link + '">Open the input builder</a><button class="btn small" type="button" id="io-curl">Copy API call</button><button class="btn small" type="button" id="io-py">Copy Python</button>' + (t.m.length ? '<a class="btn small ghost" href="/mcp.html">AI agent tool: ' + h(t.m[0]) + '</a>' : '') + '<a class="btn small ghost" href="https://apify.com/' + USER + '/' + t.n + '" rel="noopener">Run on Apify</a></div></div>' +
          (r.list.length > 1 ? '<p class="io-also">Also: ' + r.list.slice(1).map(function (o) { return '<a href="/tools/' + o.t.n + '/">' + h(o.t.t) + '</a>'; }).join(' · ') + '</p>' : '');
        var ta = $('#io-json', intentOut), cur = function () { try { return JSON.parse(ta.value); } catch (e) { return null; } };
        ta.addEventListener('input', function () { var v = cur(); ta.classList.toggle('bad', !v); if (v) $('#io-open', intentOut).href = '/tools/' + t.n + '/#in=' + TC.enc(v); });
        $('#io-curl', intentOut).addEventListener('click', function (e) { var v = cur(); if (v) copyText(TC.curl(t.n, v), e.target); });
        $('#io-py', intentOut).addEventListener('click', function (e) { var v = cur(); if (v) copyText(TC.python(t.n, v), e.target); });
      });
    };
    intentQ.addEventListener('focus', function () { index(); });
    intentQ.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(render, 140); });
    intentQ.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); render(); } });
    $$('[data-ex]').forEach(function (b) { b.addEventListener('click', function () { intentQ.value = b.dataset.ex; render(); intentQ.focus(); }); });
  }

  // ---- command palette: Cmd/Ctrl+K or "/"
  var pal = null, palIn, palList, palItems = [], palAt = 0, lastFocus = null;
  function palBuild() {
    pal = document.createElement('div');
    pal.className = 'pal'; pal.hidden = true;
    pal.innerHTML = '<div class="pal-back" data-close></div><div class="pal-box" role="dialog" aria-modal="true" aria-label="Search"><div class="pal-top"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="text" placeholder="Search tools, pages and agent tools" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="pal-list" autocomplete="off" spellcheck="false"><kbd data-close>esc</kbd></div><ul id="pal-list" role="listbox"></ul><div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>⇧</kbd><kbd>↵</kbd> copy API call</span></div></div>';
    document.body.appendChild(pal);
    palIn = $('input', pal); palList = $('ul', pal);
    pal.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) palClose(); });
    palIn.addEventListener('input', palRender);
    palIn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); palGo(palItems[palAt], e.shiftKey); }
      else if (e.key === 'Escape') palClose();
      else if (e.key === 'Tab') e.preventDefault();
    });
    palList.addEventListener('click', function (e) { var li = e.target.closest('li[data-i]'); if (li) palGo(palItems[+li.dataset.i], e.shiftKey); });
    palList.addEventListener('mousemove', function (e) { var li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== palAt) { palAt = +li.dataset.i; palMark(); } });
  }
  function palOpen() {
    if (!pal) palBuild();
    lastFocus = document.activeElement;
    pal.hidden = false; root.classList.add('pal-on'); palIn.value = ''; palIn.focus();
    palList.innerHTML = '<li class="pal-empty">Loading...</li>';
    index().then(palRender);
  }
  function palClose() { if (!pal) return; pal.hidden = true; root.classList.remove('pal-on'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function palRender() {
    if (!IDX) return;
    var q = palIn.value.trim().toLowerCase(), ws = wordsOf(q), out = [];
    var score = function (text) {
      if (!q) return 1;
      var t = ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' '), s = 0;
      // Short words match at word starts only ("epo" is not in "repo").
      var has = function (w) { return t.indexOf(w.length < 4 ? ' ' + w : w) !== -1; };
      if (t.indexOf(' ' + q) === 0) s += 6; else if (has(q)) s += 4;
      ws.forEach(function (w) { if (has(w)) s += 1.5; });
      return ws.every(has) ? s + 1 : s >= 4 ? s : 0;
    };
    var kscore = function (t) {
      if (!q) return 0;
      var hits = ws.filter(function (w) { return SYN[w] === t.n || t.kw.indexOf(w) !== -1 || t.ws.indexOf(w) !== -1; });
      var rare = hits.filter(function (w) { return SYN[w] === t.n || (IDX.df[w] || 9) <= 3; }).length;
      return hits.length === ws.length ? 3 + rare * 2 + (hits.length - rare) * 0.5 : rare * 2.5;
    };
    IDX.tools.forEach(function (t) { var s = score(t.t + ' ' + t.n) * 2 + (q ? score(t.w) * 0.6 : 0) + kscore(t); if (s > 0) out.push({ k: 'tool', s: s + Math.log(1 + t.r) * (q ? 0.15 : 1), t: t }); });
    IDX.tools.forEach(function (t) { t.m.forEach(function (m) { var s = q ? score(m.replace(/_/g, ' ')) : 0; if (s > 2) out.push({ k: 'mcp', s: s, t: t, m: m }); }); });
    IDX.pages.forEach(function (p) { var s = score(p[0]); if (s > 0) out.push({ k: 'page', s: q ? s + 1 : 0.5, p: p }); });
    IDX.posts.forEach(function (p) { var s = q ? score(p[0]) : 0; if (s > 2) out.push({ k: 'post', s: s, p: p }); });
    out.sort(function (a, b) { return b.s - a.s; });
    palItems = q ? out.slice(0, 12) : out.filter(function (x) { return x.k === 'tool'; }).slice(0, 7).concat(out.filter(function (x) { return x.k === 'page'; }).slice(0, 5));
    palAt = 0;
    if (!palItems.length) { palList.innerHTML = '<li class="pal-empty">Nothing for "' + h(q) + '". <a href="mailto:tacps126@gmail.com?subject=' + encodeURIComponent('Custom data request: ' + q) + '">Ask for a custom tool</a></li>'; return; }
    var lastK = null;
    palList.innerHTML = palItems.map(function (x, i) {
      var head = x.k !== lastK ? '<li class="pal-group" role="presentation">' + { tool: q ? 'Tools' : 'Most used tools', mcp: 'AI agent tools', page: 'Pages', post: 'Articles' }[x.k] + '</li>' : '';
      lastK = x.k;
      var body = x.k === 'tool' ? '<span class="pi-t">' + h(x.t.t) + '</span><span class="pi-m"><i data-k="' + x.t.c + '"></i>' + h(IDX.cats[x.t.c]) + (x.t.p ? ' · ' + h(x.t.p) : '') + '</span>'
        : x.k === 'mcp' ? '<span class="pi-t"><code>' + h(x.m) + '</code></span><span class="pi-m">runs ' + h(x.t.t) + '</span>'
        : '<span class="pi-t">' + h(x.p[0]) + '</span><span class="pi-m">' + (x.k === 'post' ? 'Article' : 'Page') + '</span>';
      return head + '<li role="option" data-i="' + i + '" id="pi-' + i + '">' + body + '</li>';
    }).join('');
    palMark();
  }
  function palMark() { $$('li[data-i]', palList).forEach(function (li) { var on = +li.dataset.i === palAt; li.setAttribute('aria-selected', on); if (on) li.scrollIntoView({ block: 'nearest' }); }); palIn.setAttribute('aria-activedescendant', 'pi-' + palAt); }
  function palMove(d) { if (!palItems.length) return; palAt = (palAt + d + palItems.length) % palItems.length; palMark(); }
  function palGo(x, shift) {
    if (!x) return;
    if (shift && x.t) { copyText(TC.curl(x.t.n, x.t.x || {})); var f = $('.pal-foot', pal); f.classList.add('done'); setTimeout(function () { f.classList.remove('done'); }, 1200); return; }
    palClose();
    location.href = x.t ? (x.k === 'mcp' ? '/mcp.html' : '/tools/' + x.t.n + '/') : x.p[1];
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-pal]'); if (b) { e.preventDefault(); palOpen(); } });
  document.addEventListener('keydown', function (e) {
    var typing = /input|textarea|select/i.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal && !pal.hidden ? palClose() : palOpen(); }
    else if (e.key === '/' && !typing && !(pal && !pal.hidden)) { e.preventDefault(); if (search) search.focus(); else palOpen(); }
  });
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $$('kbd').forEach(function (k) { if (k.textContent === '⌘K') k.textContent = 'Ctrl K'; });

  // ---- tool page guide: fold long READMEs, one click opens the rest
  var guideBody = document.getElementById('guide-body'), guideMore = $('.guide-more');
  if (guideBody && guideMore && guideBody.scrollHeight > 960 && location.hash.indexOf('#g-') !== 0) {
    guideBody.classList.add('folded'); guideMore.hidden = false;
    guideMore.addEventListener('click', function () { guideBody.classList.remove('folded'); guideMore.hidden = true; });
  }

  // ---- coverage map: hover or focus a country for its tools; click, tap or Enter pins it and
  // opens a close-up with state and province lines (data/geo/<CC>.json, loaded on demand).
  var cov = document.getElementById('cov-data'), mapPanel = document.getElementById('map-panel');
  if (cov && mapPanel) {
    var C = JSON.parse(cov.textContent), defaultPanel = mapPanel.innerHTML, svg = $('.world'), pinned = null;
    var mapBox = svg.parentNode, zoom = document.createElement('div'), geo = {};
    zoom.className = 'map-zoom'; zoom.hidden = true; mapBox.appendChild(zoom);
    var mark = function (c) {
      $$('[data-c].on', svg).forEach(function (p) { p.classList.remove('on'); });
      if (c) $$('[data-c="' + c + '"]', svg).forEach(function (p) { p.classList.add('on'); });
    };
    var reset = function () { pinned = null; mark(null); zoom.hidden = true; mapPanel.innerHTML = defaultPanel; wireGoto(); };
    var show = function (c) {
      var ns = C.tools[c] || [];
      if (!ns.length && !pinned) return;
      mark(c);
      var by = {};
      ns.forEach(function (n) { var m = C.meta[n]; (by[m[1]] = by[m[1]] || []).push('<a href="/tools/' + n + '/">' + h(m[0]) + '</a>'); });
      mapPanel.innerHTML = '<p class="t-kick">' + (ns.length ? ns.length + ' tool' + (ns.length === 1 ? '' : 's') + ' with local sources' : 'No local sources yet') + '</p><h3>' + h(C.names[c] || c) + '</h3>' +
        (ns.length ? Object.keys(by).map(function (k) { return '<div class="mp-group"><span class="tag" data-k="' + k + '">' + h(C.cats[k] || k) + '</span>' + by[k].join('') + '</div>'; }).join('')
          : '<p class="muted small">The worldwide tools (jobs, news, reviews, events, research) still cover it. <a href="mailto:tacps126@gmail.com?subject=' + encodeURIComponent('Data source request: ' + (C.names[c] || c)) + '">Ask for a local source</a>.</p>') +
        '<button type="button" class="btn small ghost" id="map-back">All countries</button>';
      $('#map-back', mapPanel).addEventListener('click', reset);
    };
    var drawZoom = function (c, g) {
      var vb = '0 0 ' + g.w * g.s + ' ' + g.h * g.s, id = 'mz-' + c;
      zoom.innerHTML = '<div class="mz-head"><strong>' + h(C.names[c] || c) + '</strong><span class="mz-name" aria-live="polite"></span>' +
        '<button type="button" class="mz-x" aria-label="Close the close-up">×</button></div>' +
        '<svg viewBox="' + vb + '" role="img" aria-label="' + h(C.names[c] || c) + (g.p.length ? ' with ' + g.p.length + ' states and provinces' : '') + '">' +
        '<defs><clipPath id="' + id + '"><path d="' + g.o + '"/></clipPath></defs>' +
        '<path class="mz-land' + ((C.tools[c] || []).length ? ' has' : '') + '" d="' + g.o + '"/>' +
        '<g clip-path="url(#' + id + ')">' + g.p.map(function (p) { return '<path class="mz-st" d="' + p[1] + '" data-n="' + h(p[0]) + '"><title>' + h(p[0]) + '</title></path>'; }).join('') + '</g>' +
        '<path class="mz-edge" d="' + g.o + '"/></svg>' +
        (g.p.length ? '<p class="mz-foot">' + g.p.length + ' states and provinces · hover or tap one</p>' : '');
      zoom.hidden = false;
      var label = $('.mz-name', zoom);
      $('svg', zoom).addEventListener('mouseover', function (e) { var n = e.target.getAttribute('data-n'); label.textContent = n ? '· ' + n : ''; });
      $('svg', zoom).addEventListener('click', function (e) { var n = e.target.getAttribute('data-n'); label.textContent = n ? '· ' + n : ''; });
      $('.mz-x', zoom).addEventListener('click', reset);
    };
    var openZoom = function (c) {
      if (geo[c]) return drawZoom(c, geo[c]);
      fetch('/data/geo/' + c + '.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (g) {
        if (!g) return;
        geo[c] = g;
        if (pinned === c) drawZoom(c, g);
      }).catch(function () {});
    };
    var pin = function (c) { pinned = c; show(c); openZoom(c); };
    var wireGoto = function () { $$('[data-goto]', mapPanel).forEach(function (b) { b.addEventListener('click', function () { pin(b.dataset.goto); }); }); };
    wireGoto();
    var codeAt = function (e) { return e.target.getAttribute && e.target.getAttribute('data-c'); };
    svg.addEventListener('mouseover', function (e) { var c = codeAt(e); if (c && C.tools[c] && !pinned) show(c); });
    svg.addEventListener('click', function (e) { var c = codeAt(e); if (c) pin(c); });
    svg.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { var c = codeAt(e); if (c) { e.preventDefault(); pin(c); } } });
    svg.addEventListener('focusin', function (e) { var c = codeAt(e); if (c && !pinned) show(c); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !zoom.hidden) reset(); });
  }

  // ---- composer: chain tools, get one script
  var cd = document.getElementById('chain-data'), chainEl = document.getElementById('chain'), chainCode = document.getElementById('chain-code');
  if (cd && chainEl) {
    var G = JSON.parse(cd.textContent), steps = [], startHtml = chainEl.innerHTML;
    var nexts = function (n) { return G.edges.filter(function (e) { return e[0] === n && steps.map(function (s) { return s.n; }).indexOf(e[1]) === -1; }); };
    var script = function () {
      var L = ['from apify_client import ApifyClient', '', 'client = ApifyClient("YOUR_APIFY_TOKEN")', '', '',
        'def run(actor, run_input):', '    r = client.actor(actor).call(run_input=run_input)', '    return list(client.dataset(r["defaultDatasetId"]).iterate_items())', '', '',
        'def values(rows, pick):', '    out = []', '    for r in rows:', '        v = pick(r)', '        for x in v if isinstance(v, list) else [v]:', '            if x and x not in out:', '                out.append(x)', '    return out', ''];
      steps.forEach(function (s, i) {
        var t = G.tools[s.n], x = JSON.parse(JSON.stringify(t.x || {})), after = steps[i + 1];
        if (after && after.e[5]) Object.keys(after.e[5]).forEach(function (k) { x[k] = after.e[5][k]; });
        L.push('', '# ' + (i + 1) + '. ' + t.t + (s.e ? ': the ' + s.e[2] + ' from step ' + i : '') + ' (' + t.p + ')');
        if (!s.e) { L.push('step1 = run("' + USER + '/' + s.n + '", ' + py(x) + ')'); return; }
        delete x[s.e[3]];
        (t.sf || []).forEach(function (k) { delete x[k]; });
        var lines = Object.keys(x).map(function (k) { return '    ' + JSON.stringify(k) + ': ' + py(x[k], '    ') + ','; });
        lines.push('    ' + JSON.stringify(s.e[3]) + ': values(step' + i + ', lambda r: ' + s.e[4] + '),');
        L.push('step' + (i + 1) + ' = run("' + USER + '/' + s.n + '", {', lines.join('\n'), '})');
      });
      L.push('print(len(step' + steps.length + '), "rows")');
      return L.join('\n');
    };
    var draw = function () {
      if (!steps.length) { chainEl.innerHTML = startHtml; wire(); chainCode.hidden = true; return; }
      var html = steps.map(function (s, i) {
        var t = G.tools[s.n];
        return (s.e ? '<div class="link-arrow"><span>' + h(s.e[2]) + ' > <code>' + h(s.e[3]) + '</code></span></div>' : '') +
          '<div class="step-card"><span class="step-n">' + (i + 1) + '</span><div><a href="/tools/' + s.n + '/">' + h(t.t) + '</a><small>' + h(t.p) + '</small></div></div>';
      }).join('');
      var nx = nexts(steps[steps.length - 1].n);
      html += '<div class="chain-next">' + (nx.length ? '<span class="muted">Add a step:</span> ' + nx.map(function (e, i) { return '<button class="chip" type="button" data-next="' + i + '">+ ' + h(G.tools[e[1]].t) + '</button>'; }).join(' ') : '<span class="muted">End of the chain.</span>') +
        ' <button class="btn small ghost" type="button" data-undo>Remove last</button> <button class="btn small ghost" type="button" data-reset>Start over</button></div>';
      chainEl.innerHTML = html;
      $$('[data-next]', chainEl).forEach(function (b) { b.addEventListener('click', function () { var e = nx[+b.dataset.next]; steps.push({ n: e[1], e: e }); draw(); }); });
      $('[data-undo]', chainEl).addEventListener('click', function () { steps.pop(); draw(); });
      $('[data-reset]', chainEl).addEventListener('click', function () { steps = []; draw(); });
      chainCode.hidden = false; $('pre', chainCode).textContent = script();
    };
    var wire = function () { $$('[data-start]', chainEl).forEach(function (b) { b.addEventListener('click', function () { steps = [{ n: b.dataset.start }]; var nx = nexts(b.dataset.start); if (nx.length) steps.push({ n: nx[0][1], e: nx[0] }); draw(); }); }); };
    wire();
  }

  // pricing estimate: a searchable tool picker, a stepper and presets
  var combo = document.getElementById('calc-tool'), cn = document.getElementById('calc-n'), cu = document.getElementById('calc-usd'), cnote = document.getElementById('calc-note');
  if (combo && cn && cu) {
    var MAX = 10000000, btn = combo.querySelector('.combo-btn'), pop = combo.querySelector('.combo-pop'), q = combo.querySelector('.combo-search');
    var opts = [].slice.call(combo.querySelectorAll('[role=option]')), groups = [].slice.call(combo.querySelectorAll('.combo-group'));
    var num = function () { return Math.min(MAX, Math.max(0, parseInt(String(cn.value).replace(/[^0-9]/g, '') || '0', 10))); };
    var usdText = function (v) {
      if (v < 10) return '$' + v.toFixed(2);
      if (v < 100000) return '$' + Math.round(v).toLocaleString('en-US');
      return '$' + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
    };
    var addBox = document.getElementById('calc-addons'), addList = document.getElementById('calc-addon-list');
    var addons = function () {
      var t = 0;
      if (addList) addList.querySelectorAll('.addon').forEach(function (r) {
        if (r.querySelector('input[type=checkbox]').checked) t += parseFloat(r.dataset.u) * Math.max(0, parseInt(String(r.querySelector('.aq').value).replace(/[^0-9]/g, '') || '0', 10));
      });
      return t;
    };
    var renderAddons = function (o) {
      if (!addBox) return;
      var ex = []; try { ex = JSON.parse(o.dataset.extras || '[]'); } catch (e) {}
      addBox.hidden = !ex.length; addList.innerHTML = '';
      ex.forEach(function (x) {
        var r = document.createElement('label'); r.className = 'addon'; r.dataset.u = x.u;
        var per = x.u >= 0.01 ? '$' + x.u.toFixed(2) + ' each' : '$' + (x.u * 1000).toFixed(2) + ' per 1,000';
        r.innerHTML = '<input type="checkbox"><span class="at"></span><span class="ap"></span><input class="aq" type="text" inputmode="numeric" aria-label="How many">';
        r.querySelector('.at').textContent = x.t; r.querySelector('.ap').textContent = per; r.title = x.d || '';
        r.querySelector('.aq').value = num().toLocaleString('en-US');
        r.addEventListener('input', est); r.addEventListener('change', est);
        addList.appendChild(r);
      });
    };
    var est = function () {
      var unit = parseFloat(combo.dataset.value || '0'), n = num(), what = combo.dataset.what || 'result';
      cu.textContent = unit ? usdText(unit * n + addons()) : '-';
      var x = addons();
      cnote.textContent = unit ? n.toLocaleString('en-US') + ' × ' + what + (x ? ' + extras ' + usdText(x) : '') + ' on Apify\'s free plan; paid plans pay less' : 'Choose a tool';
    };
    var choose = function (o) {
      opts.forEach(function (x) { x.setAttribute('aria-selected', x === o); });
      combo.dataset.value = o.dataset.value; combo.dataset.what = o.dataset.what;
      combo.querySelector('.combo-val').textContent = o.querySelector('span').textContent;
      renderAddons(o); close(); est();
    };
    var visible = function () { return opts.filter(function (o) { return !o.hidden; }); };
    var open = function () { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); q.value = ''; filter(); q.focus(); };
    var close = function () { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    var filter = function () {
      var t = q.value.trim().toLowerCase();
      opts.forEach(function (o) { o.hidden = !!t && o.textContent.toLowerCase().indexOf(t) === -1; });
      groups.forEach(function (g) { var n = g.nextElementSibling, any = false; while (n && !n.classList.contains('combo-group')) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
    };
    btn.addEventListener('click', function () { pop.hidden ? open() : close(); });
    q.addEventListener('input', filter);
    opts.forEach(function (o) { o.addEventListener('click', function () { choose(o); btn.focus(); }); });
    combo.addEventListener('keydown', function (e) {
      var v = visible(), i = v.indexOf(document.activeElement);
      if (e.key === 'Escape') { close(); btn.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (pop.hidden) open(); else (v[i + 1] || v[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (v[i - 1] || q).focus(); }
      else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); choose(v[i]); btn.focus(); }
    });
    document.addEventListener('click', function (e) { if (!combo.contains(e.target)) close(); });
    var setN = function (n) { cn.value = Math.min(MAX, Math.max(1, n)).toLocaleString('en-US'); est(); };
    document.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = num(), up = b.dataset.step === '1', step = Math.pow(10, Math.max(2, String(Math.max(1, up ? n : n - 1)).length - 1));
        setN(up ? n + step : n - step);
      });
    });
    document.querySelectorAll('.preset').forEach(function (b) { b.addEventListener('click', function () { setN(parseInt(b.dataset.n, 10)); }); });
    cn.addEventListener('input', function () { var n = num(); if (String(cn.value).replace(/[^0-9]/g, '').length > 8) cn.value = n.toLocaleString('en-US'); est(); });
    cn.addEventListener('blur', function () { setN(num() || 1); });
    choose(opts[0]);
  }
})();
