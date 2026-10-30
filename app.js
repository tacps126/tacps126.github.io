(function () {
  var root = document.documentElement;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  // theme
  var saved = store('theme');
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  var tbtn = document.getElementById('theme');
  function current() { return root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  if (tbtn) tbtn.addEventListener('click', function () { var n = current() === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', n); store('theme', n); });
  // mobile menu
  var menu = document.getElementById('menu'), links = document.getElementById('nav-links');
  if (menu && links) {
    menu.addEventListener('click', function () { var o = links.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });
    links.addEventListener('click', function (e) { if (e.target.tagName === 'A') links.classList.remove('open'); });
  }
  // tool filter + search
  var cards = [].slice.call(document.querySelectorAll('[data-tool]')), chips = [].slice.call(document.querySelectorAll('.chip'));
  var search = document.getElementById('search'), empty = document.getElementById('empty'), cat = 'all';
  function apply() {
    var q = (search && search.value || '').trim().toLowerCase(), shown = 0;
    cards.forEach(function (c) {
      var ok = (cat === 'all' || c.dataset.cat === cat) && (!q || c.textContent.toLowerCase().indexOf(q) !== -1);
      c.hidden = !ok; if (ok) shown++;
    });
    if (empty) empty.classList.toggle('show', shown === 0);
  }
  chips.forEach(function (ch) { ch.addEventListener('click', function () { cat = ch.dataset.cat; chips.forEach(function (x) { x.setAttribute('aria-pressed', x === ch); }); apply(); }); });
  if (search) search.addEventListener('input', apply);
  document.querySelectorAll('[data-filter]').forEach(function (a) {
    a.addEventListener('click', function () { var t = document.querySelector('.chip[data-cat="' + a.dataset.filter + '"]'); if (t) t.click(); });
  });
  // tabs
  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var tabs = [].slice.call(group.querySelectorAll('.tab')), panels = [].slice.call(group.parentNode.querySelectorAll('.panel'));
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x, j) { x.setAttribute('aria-selected', i === j); }); panels.forEach(function (p, j) { p.hidden = i !== j; });
      });
    });
  });
  // copy buttons
  document.querySelectorAll('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.copy) {
        if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(function () { var o = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = o; }, 1400); }, function () {});
        return;
      }
      var pre = b.closest('.code').querySelector('pre');
      var done = function () { var o = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = o; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(pre.innerText).then(done, function () {});
    });
  });
  // sort + live count
  var sortSel = document.getElementById('sort'), count = document.getElementById('count');
  var grid = cards.length ? cards[0].parentNode : null, original = cards.slice();
  function sortCards() {
    if (!grid || !sortSel) return;
    var v = sortSel.value, list = original.slice();
    if (v === 'price') list.sort(function (a, b) { return parseFloat(a.dataset.price) - parseFloat(b.dataset.price); });
    if (v === 'name') list.sort(function (a, b) { return a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent); });
    list.forEach(function (c) { grid.appendChild(c); });
    store('sort', v);
  }
  function countShown() { if (count) { var n = cards.filter(function (c) { return !c.hidden; }).length; count.textContent = n + (n === 1 ? ' tool' : ' tools'); } }
  if (sortSel) { var sv = store('sort'); if (sv) sortSel.value = sv; sortSel.addEventListener('change', sortCards); sortCards(); }
  var baseApply = apply;
  apply = function () { baseApply(); countShown(); };
  if (search) { search.removeEventListener('input', baseApply); search.addEventListener('input', apply); }
  chips.forEach(function (ch) { ch.addEventListener('click', countShown); });
  countShown();
  // "/" focuses the search
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && search && document.activeElement !== search && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); search.focus(); }
  });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // spotlight follows the pointer
  document.querySelectorAll('.spot').forEach(function (c) {
    c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  });
  // scroll progress
  var bar = document.querySelector('.progress');
  if (bar) { var onScroll = function () { var h = document.documentElement; var max = h.scrollHeight - h.clientHeight; bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%'; }; addEventListener('scroll', onScroll, { passive: true }); onScroll(); }
  // rotating hero words
  var rot = document.getElementById('rotate');
  if (rot && !reduce) {
    var words = rot.dataset.words.split('|'), wi = 0;
    setInterval(function () { rot.classList.add('out'); setTimeout(function () { wi = (wi + 1) % words.length; rot.textContent = words[wi]; rot.classList.remove('out'); }, 350); }, 2800);
  }
  // count-up stats
  var nums = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; co.unobserve(e.target);
        var el = e.target, to = parseInt(el.dataset.count, 10), t0 = performance.now();
        (function step(t) { var k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { co.observe(n); });
  }
  // reveal on scroll
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.08 });
    items.forEach(function (i) { io.observe(i); });
  } else { items.forEach(function (i) { i.classList.add('in'); }); }

  // library: arrange dots by use or by topic
  var lib = document.getElementById('dots');
  if (lib) {
    var dots = [].slice.call(lib.children), order = ['jobs', 'leads', 'reviews', 'gov', 'commerce'];
    document.querySelectorAll('[data-arrange]').forEach(function (b) {
      b.addEventListener('click', function () {
        var byTopic = b.dataset.arrange === 'topic';
        document.querySelectorAll('[data-arrange]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        dots.slice().sort(function (x, y) {
          if (byTopic) { var d = order.indexOf(x.dataset.k) - order.indexOf(y.dataset.k); if (d) return d; }
          return x.dataset.rank - y.dataset.rank;
        }).forEach(function (d) { lib.appendChild(d); });
      });
    });
  }
  // coverage: one topic at a time
  var covs = [].slice.call(document.querySelectorAll('.cov')), panels = [].slice.call(document.querySelectorAll('.cov-panel'));
  covs.forEach(function (c) {
    c.addEventListener('click', function () {
      covs.forEach(function (x) { x.setAttribute('aria-pressed', x === c); });
      panels.forEach(function (p) { p.hidden = p.dataset.cov !== c.dataset.cov; });
    });
  });
  // side indicator: mark the section in view
  var toc = [].slice.call(document.querySelectorAll('[data-toc]'));
  if (toc.length && 'IntersectionObserver' in window) {
    var mark = function (id) { toc.forEach(function (a) { a.classList.toggle('on', a.dataset.toc === id); }); };
    var tocIo = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    toc.forEach(function (a) { var t = document.getElementById(a.dataset.toc); if (t) tocIo.observe(t); });
  }

  // depth: cards lean toward the pointer; hero layers drift with it
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches, fine = matchMedia('(pointer: fine)').matches;
  if (!still && fine) {
    document.querySelectorAll('.card, .cov-panel').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        c.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg'); c.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg'); c.classList.add('tilting');
      });
      c.addEventListener('pointerleave', function () { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); c.classList.remove('tilting'); });
    });
    var deco = document.querySelector('.hero .deco');
    if (deco) document.addEventListener('pointermove', function (e) {
      deco.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * -18).toFixed(1) + 'px');
      deco.style.setProperty('--py', ((e.clientY / innerHeight - 0.5) * -12).toFixed(1) + 'px');
    }, { passive: true });
  }

  // card light follows the pointer
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  });
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
      cu.textContent = unit ? usdText(unit * n + addons()) : '–';
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
