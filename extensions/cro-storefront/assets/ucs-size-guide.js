/* Size guide (app: Section library → Size guide). Two links (size chart, find my size) open a window with the
   chart (cm / in) and a size finder that answers only from what the merchant set: height and weight ranges, the
   fit question, and "your usual size" answers. The same rules as recommendSize() in app/lib/size-guide.ts
   (test/app/size-guide.test.ts keeps them equal). */
(function () {
  var used = function (r) { return r && (r[0] !== null && r[0] !== undefined || r[1] !== null && r[1] !== undefined); };
  var inR = function (v, r) { return (r[0] == null || v >= r[0]) && (r[1] == null || v <= r[1]); };
  var SHIFT = { snug: -1, regular: 0, relaxed: 1 };
  var asks = function (chart) {
    var rows = chart.rows || [], rec = chart.rec || {}, u = rec.usual || {};
    return {
      height: rec.height !== false && rows.some(function (x) { return used(x.height); }),
      weight: rec.weight !== false && rows.some(function (x) { return used(x.weight); }),
      usual: !!u.on && (u.answers || []).some(function (a) { return a.answer && a.size; })
    };
  };
  function recommend(chart, h, w, fit, usual) {
    var rows = chart.rows || [], rec = chart.rec || {}, at = -1, q = asks(chart);
    if (usual && rec.usual && rec.usual.on) {
      var a = (rec.usual.answers || []).filter(function (x) { return x.answer === usual; })[0];
      if (a) at = rows.map(function (x) { return x.size; }).indexOf(a.size);
    }
    if (at < 0) {
      var idx = function (key, v) { return v == null ? [] : rows.reduce(function (a2, x, i) { if (used(x[key]) && inR(v, x[key])) a2.push(i); return a2; }, []); };
      var H = q.height ? idx('height', h) : [], W = q.weight ? idx('weight', w) : [];
      var both = H.filter(function (i) { return W.indexOf(i) > -1; });
      if (both.length) at = both[0];
      else if (H.length && W.length) at = Math.max(H[0], W[0]);
      else if (H.length) at = H[0];
      else if (W.length) at = W[0];
    }
    if (at < 0) return null;
    var i2 = Math.min(rows.length - 1, Math.max(0, at + (rec.fit ? (SHIFT[fit] || 0) : 0)));
    return { size: rows[i2].size, index: i2 };
  }
  function convert(text, from, to) {
    if (from === to) return text;
    return String(text).replace(/\d+(?:\.\d+)?/g, function (n) { var v = Number(n); return String(from === 'cm' ? Math.round(v / 2.54 * 2) / 2 : Math.round(v * 2.54)); });
  }
  window.__ucsSgRecommend = recommend; // for the test
  window.__ucsSgConvert = convert;

  var hosts = document.querySelectorAll('[data-ucs-sg]');
  if (!hosts.length || window.__ucsHoldout) return;
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  // Its own small stylesheet, next to this script.
  var me = document.currentScript;
  if (me && me.src && !document.querySelector('link[data-ucs-css="sg"]')) {
    var lk = document.createElement('link');
    lk.rel = 'stylesheet';
    lk.href = me.src.replace(/\.js(\?|$)/, '.css$1');
    lk.setAttribute('data-ucs-css', 'sg');
    document.head.appendChild(lk);
  }

  hosts.forEach(function (host) {
    if (host.getAttribute('data-ready')) return;
    var data;
    try { data = JSON.parse(host.querySelector('script').textContent); } catch (e) { return; }
    var t = data.t, ch = data.chart;
    if (!ch) return;
    host.setAttribute('data-ready', '1');
    var hasChart = ch.rows && ch.rows.length && ch.cols;
    var fq = asks(ch), hasRec = ch.rec && ch.rec.on && (fq.height || fq.weight || fq.usual);
    if (!hasChart && !hasRec) return;
    host.innerHTML = '<span class="ucs-sg__links">' +
      (hasChart ? '<button type="button" class="ucs-sg__link" data-sg-open="chart">' + esc(t.chartLink) + '</button>' : '') +
      (hasRec ? '<button type="button" class="ucs-sg__link" data-sg-open="rec">' + esc(t.recLink) + '</button>' : '') + '</span>';
    host.hidden = false;
    // Under the size picker, when the theme has one.
    if (host.getAttribute('data-place') === 'picker') {
      var picker = document.querySelector('variant-selects, variant-radios, fieldset.product-form__input, .product-form__input--pill, [data-option-index]');
      var anchor = picker && (picker.closest('.product-form__input') && picker.tagName !== 'VARIANT-SELECTS' && picker.tagName !== 'VARIANT-RADIOS' ? picker.closest('fieldset, .product-form__input') : picker);
      if (anchor && anchor.parentNode && !anchor.contains(host)) anchor.parentNode.insertBefore(host, anchor.nextSibling);
    }
    var modal = null, opener = null, unit = ch.unit;
    function table() {
      var head = '<tr><th>' + esc(t.sizeColumn) + '</th>' + ch.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>';
      var body = ch.rows.map(function (r) { return '<tr><th scope="row">' + esc(r.size) + '</th>' + ch.cols.map(function (c, i) { return '<td>' + esc(convert(r.values[i] || '', ch.unit, unit)) + '</td>'; }).join('') + '</tr>'; }).join('');
      return '<div class="ucs-sg__scroll"><table class="ucs-sg__table">' + head + body + '</table></div>';
    }
    function art() {
      if (ch.img) return '<img class="ucs-sg__art" src="' + esc(ch.img) + '" alt="" loading="lazy">';
      if (ch.o) return '<svg class="ucs-sg__art ucs-sg__art--line" viewBox="0 0 100 100" aria-hidden="true"><path d="' + esc(ch.o) + '"/></svg>';
      return '';
    }
    function chartPanel() {
      return '<div class="ucs-sg__chart">' + art() + '<div>' +
        (ch.sw ? '<div class="ucs-sg__units" role="group"><button type="button" data-sg-unit="cm" aria-pressed="' + (unit === 'cm') + '">' + esc(t.cm) + '</button><button type="button" data-sg-unit="in" aria-pressed="' + (unit === 'in') + '">' + esc(t.inch) + '</button></div>' : '') +
        table() + (ch.note ? '<p class="ucs-sg__note">' + esc(ch.note) + '</p>' : '') + '</div></div>';
    }
    function recPanel() {
      var fits = ch.rec && ch.rec.fit ? '<fieldset class="ucs-sg__fit"><legend>' + esc(t.fit) + '</legend>' + ['snug', 'regular', 'relaxed'].map(function (f) {
        return '<label><input type="radio" name="sg-fit" value="' + f + '"' + (f === 'regular' ? ' checked' : '') + '><span>' + esc(t[f]) + '</span></label>'; }).join('') + '</fieldset>' : '';
      var q = asks(ch), u = (ch.rec && ch.rec.usual && ch.rec.usual.answers) || [];
      var usual = q.usual ? '<label class="ucs-sg__usual">' + esc(t.usual || 'Your usual size') + '<select name="u"><option value="">' + esc(t.usualPick || 'Choose') + '</option>' +
        u.filter(function (a) { return a.answer && a.size; }).map(function (a) { return '<option value="' + esc(a.answer) + '">' + esc(a.answer) + '</option>'; }).join('') + '</select></label>' : '';
      return '<form class="ucs-sg__form" novalidate>' + usual + (q.height || q.weight ? '<div class="ucs-sg__row">' +
        (q.height ? '<label>' + esc(t.height) + '<span class="ucs-sg__in"><input type="number" inputmode="decimal" min="0" step="any" name="h"><select name="hu"><option value="cm">cm</option><option value="in">in</option></select></span></label>' : '') +
        (q.weight ? '<label>' + esc(t.weight) + '<span class="ucs-sg__in"><input type="number" inputmode="decimal" min="0" step="any" name="w"><select name="wu"><option value="kg">kg</option><option value="lb">lb</option></select></span></label>' : '') + '</div>' : '') +
        fits + '<button type="submit" class="ucs-sg__go">' + esc(t.find) + '</button><div class="ucs-sg__result" role="status" aria-live="polite"></div></form>';
    }
    function close() {
      if (!modal) return;
      document.removeEventListener('keydown', onKey);
      modal.remove();
      modal = null;
      if (opener) opener.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab' || !modal) return;
      var f = modal.querySelectorAll('button, input, select, a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function open(tab) {
      if (modal) close();
      opener = document.activeElement;
      modal = document.createElement('div');
      modal.className = host.className + ' ucs-sg__veil';
      modal.style.cssText = host.style.cssText;
      var tabs = [];
      if (hasChart) tabs.push(['chart', t.chartTab]);
      if (hasRec) tabs.push(['rec', t.recTab]);
      modal.innerHTML = '<div class="ucs-sg__dlg" role="dialog" aria-modal="true" aria-label="' + esc(t.title) + '"><div class="ucs-sg__top"><h2 class="ucs-sg__h">' + esc(t.title) + '</h2><button type="button" class="ucs-sg__x" data-sg-close aria-label="' + esc(t.close) + '">&times;</button></div>' +
        (tabs.length > 1 ? '<div class="ucs-sg__tabs" role="tablist">' + tabs.map(function (x) { return '<button type="button" role="tab" data-sg-tab="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' : '') +
        '<div class="ucs-sg__panel" data-sg-panel></div></div>';
      document.body.appendChild(modal);
      document.addEventListener('keydown', onKey);
      show(tab && tabs.some(function (x) { return x[0] === tab; }) ? tab : tabs[0][0]);
      var x = modal.querySelector('[data-sg-close]');
      if (x) x.focus();
    }
    function show(tab) {
      modal.querySelectorAll('[data-sg-tab]').forEach(function (b) { var on = b.getAttribute('data-sg-tab') === tab; b.setAttribute('aria-selected', String(on)); b.classList.toggle('is-on', on); });
      modal.querySelector('[data-sg-panel]').innerHTML = tab === 'rec' ? recPanel() : chartPanel();
      modal.setAttribute('data-tab', tab);
    }
    host.addEventListener('click', function (e) { var b = e.target.closest('[data-sg-open]'); if (b) open(b.getAttribute('data-sg-open')); });
    document.addEventListener('click', function (e) {
      if (!modal || !modal.contains(e.target)) return;
      if (e.target === modal || e.target.closest('[data-sg-close]')) return close();
      var tb = e.target.closest('[data-sg-tab]');
      if (tb) return show(tb.getAttribute('data-sg-tab'));
      var u = e.target.closest('[data-sg-unit]');
      if (u) { unit = u.getAttribute('data-sg-unit'); show('chart'); }
    });
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!modal || !modal.contains(f) || !f.classList.contains('ucs-sg__form')) return;
      e.preventDefault();
      var out = f.querySelector('.ucs-sg__result');
      var q = asks(ch), el = f.elements;
      var h = el.h ? parseFloat(el.h.value) : NaN, w = el.w ? parseFloat(el.w.value) : NaN, us = el.u ? el.u.value : '';
      // A usual size answers on its own; otherwise every number asked must be filled in.
      if (!us && ((q.height && !(h > 0)) || (q.weight && !(w > 0)))) { out.className = 'ucs-sg__result is-bad'; out.textContent = t.fillIn; return; }
      var cm = el.hu && el.hu.value === 'in' ? h * 2.54 : h, kg = el.wu && el.wu.value === 'lb' ? w * 0.45359237 : w;
      var fitEl = f.querySelector('input[name="sg-fit"]:checked');
      var r = recommend(ch, q.height && h > 0 ? cm : null, q.weight && w > 0 ? kg : null, fitEl ? fitEl.value : 'regular', us || null);
      if (!r) { out.className = 'ucs-sg__result is-bad'; out.textContent = t.noMatch; return; }
      out.className = 'ucs-sg__result is-ok';
      out.innerHTML = '<strong>' + esc(t.result.replace('{size}', r.size)) + '</strong>' + (ch.fitNote ? '<span>' + esc(ch.fitNote) + '</span>' : '');
    });
  });
})();
