// Tool pages: the input form writes the call. Each change rebuilds the input (only fields that
// differ from the tool's defaults), the curl / Python / JavaScript code and the cost line.
// #in=<base64 JSON> in the address loads an input (the "what data" box and share links use it).
(function () {
  var form = document.getElementById('tform');
  if (!form || !window.TC) return;
  var TC = window.TC, name = form.dataset.actor, start = JSON.parse(form.dataset.start || '{}');
  var fields = [].slice.call(form.querySelectorAll('.f'));
  var pres = [].slice.call(document.querySelectorAll('.tcode .panel pre'));
  var cost = document.getElementById('tf-cost');
  var unit = parseFloat(form.dataset.unit || '0'), what = form.dataset.what || 'result';

  function def(f) { try { return f.dataset.def ? JSON.parse(f.dataset.def) : undefined; } catch (e) { return undefined; } }
  function read(f) {
    var kind = f.dataset.kind;
    if (kind === 'bool') return f.querySelector('input').checked;
    if (kind === 'multi') {
      var sel = f.querySelector('select');
      return sel ? [].slice.call(sel.selectedOptions).map(function (o) { return o.value; })
        : [].slice.call(f.querySelectorAll('input:checked')).map(function (i) { return i.value; });
    }
    var v = f.querySelector('input, textarea, select').value;
    if (kind === 'list') return v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (kind === 'int' || kind === 'num') return v === '' || isNaN(Number(v)) ? undefined : Number(v);
    return v;
  }
  function write(f, val) {
    var kind = f.dataset.kind, d = def(f);
    if (val === undefined) val = d;
    if (kind === 'bool') { f.querySelector('input').checked = !!val; return; }
    if (kind === 'multi') {
      var set = Array.isArray(val) ? val.map(String) : val ? [String(val)] : [];
      var sel = f.querySelector('select');
      if (sel) [].slice.call(sel.options).forEach(function (o) { o.selected = set.indexOf(o.value) !== -1; });
      else [].slice.call(f.querySelectorAll('input')).forEach(function (i) { i.checked = set.indexOf(i.value) !== -1; });
      return;
    }
    var el = f.querySelector('input, textarea, select');
    el.value = kind === 'list' ? (Array.isArray(val) ? val : val ? [val] : []).join('\n') : val == null ? '' : val;
  }
  function empty(v) { return v === undefined || v === '' || (Array.isArray(v) && !v.length); }
  function input() {
    var x = {};
    fields.forEach(function (f) {
      var v = read(f), d = def(f);
      if (f.dataset.kind === 'bool' ? v === (d === true) : empty(v) || JSON.stringify(v) === JSON.stringify(d)) return;
      x[f.dataset.k] = v;
    });
    return x;
  }
  function load(x) { fields.forEach(function (f) { write(f, x[f.dataset.k]); }); update(); }
  function money(v) { return v >= 0.01 ? '$' + v.toFixed(2) : '$' + v.toFixed(4).replace(/0+$/, ''); }
  function update() {
    var x = input();
    if (pres[0]) pres[0].textContent = TC.curl(name, x);
    if (pres[1]) pres[1].textContent = TC.python(name, x);
    if (pres[2]) pres[2].textContent = TC.js(name, x);
    if (cost && unit) {
      var mk = form.dataset.max, mf = mk && form.querySelector('.f[data-k="' + mk + '"]'), n = mf ? read(mf) || def(mf) : null;
      cost.textContent = n ? 'Up to ' + Number(n).toLocaleString('en-US') + ' ' + what + 's: at most ' + money(unit * n) + ' on Apify\'s free plan. Nothing found, nothing charged.'
        : money(unit * 1000) + ' per 1,000 ' + what + 's on Apify\'s free plan.';
    }
  }
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  document.getElementById('tf-reset').addEventListener('click', function () { load(start); if (history.replaceState) history.replaceState(null, '', location.pathname); });
  document.getElementById('tf-share').addEventListener('click', function (e) { TC.copy(location.origin + location.pathname + '#in=' + TC.enc(input()), e.target); });
  var m = /#in=([\w-]+)/.exec(location.hash), given = m && TC.dec(m[1]);
  if (given) { load(given); var t = document.getElementById('try'); if (t) t.scrollIntoView(); } else update();
})();
