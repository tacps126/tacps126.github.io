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
  // pricing estimate
  var ct = document.getElementById('calc-tool'), cn = document.getElementById('calc-n'), cu = document.getElementById('calc-usd'), cnote = document.getElementById('calc-note');
  if (ct && cn && cu) {
    var est = function () {
      var unit = parseFloat(ct.value), n = Math.max(0, parseInt(cn.value || '0', 10)), usd = unit * n;
      cu.textContent = '$' + (usd < 10 ? usd.toFixed(2) : Math.round(usd).toLocaleString('en-US'));
      cnote.textContent = n.toLocaleString('en-US') + ' ' + ct.selectedOptions[0].dataset.what + (n === 1 ? '' : 's') + ' on Apify\'s free plan; paid plans pay less';
    };
    ct.addEventListener('change', est); cn.addEventListener('input', est); est();
  }
})();
