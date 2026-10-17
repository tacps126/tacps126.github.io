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
  // reveal on scroll
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.08 });
    items.forEach(function (i) { io.observe(i); });
  } else { items.forEach(function (i) { i.classList.add('in'); }); }
})();
