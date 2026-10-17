/* Gift note & delivery date (app: Offers & bundles → Gift note & delivery date). Saved on the cart as
   attributes (and the gift message as the cart note), so they arrive on the order. Shown in the
   cart page block ([data-ucs-ce]) and inside Dawn-family cart drawers (#ucs-ce-data from the
   Conversion boosters embed); re-inserted whenever the drawer redraws. */
(function () {
  if (window.__ucsHoldout) return; // holdout test: this shopper sees the store without the app's widgets
  if (window.__ucsCe) return;
  window.__ucsCe = true;
  // Its own small stylesheet, next to this script (the boosters embed only loads ucs-boosters.css).
  var me = document.currentScript;
  if (me && me.src && !document.querySelector('link[data-ucs-css="ce"]')) {
    var lk = document.createElement('link');
    lk.rel = 'stylesheet';
    lk.href = me.src.replace(/\.js(\?|$)/, '.css$1');
    lk.setAttribute('data-ucs-css', 'ce');
    document.head.appendChild(lk);
  }
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var state = null; // { attributes, note }
  var loading = null;

  function load() {
    if (!loading) loading = fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (c) { state = { attributes: c.attributes || {}, note: c.note || '' }; return state; });
    return loading;
  }
  var timer, pending = {};
  // Changes made close together are sent together.
  function save(patch) {
    state.attributes = Object.assign({}, state.attributes, patch.attributes || {});
    pending = Object.assign(pending, patch.attributes || {});
    if ('note' in patch) state.note = patch.note;
    clearTimeout(timer);
    timer = setTimeout(function () {
      var attrs = pending;
      pending = {};
      fetch(root + 'cart/update.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ attributes: attrs, note: state.note }) }).catch(function () {});
    }, 350);
  }

  function dates(d) {
    var off = {}; (d.daysOff || []).forEach(function (x) { off[x] = true; });
    var out = [], day = new Date();
    day.setHours(12, 0, 0, 0);
    for (var i = 0; i <= d.maxDays && out.length < 60; i++) {
      var x = new Date(day.getTime() + i * 86400000);
      if (i >= d.minDays && !off[x.getDay()]) out.push(x);
    }
    return out;
  }

  function render(host, c) {
    var a = state.attributes, uid = 'ucs-ce-' + Math.random().toString(36).slice(2, 7);
    var isGift = c.g && a[c.g.attr] === 'Yes';
    var html = (c.h ? '<p class="ucs-ce__h">' + esc(c.h) + '</p>' : '');
    if (c.g) html += '<label class="ucs-ce__check"><input type="checkbox" data-ce="gift"' + (isGift ? ' checked' : '') + '> <span>' + esc(c.g.label) + '</span></label>';
    if (c.n) html += '<label class="ucs-ce__field" data-ce-note' + (c.n.onlyGift && c.g && !isGift ? ' hidden' : '') + '><span>' + esc(c.n.label) + '</span><textarea data-ce="note" rows="3" maxlength="' + c.n.max + '" placeholder="' + esc(c.n.placeholder) + '">' + esc(state.note) + '</textarea></label>';
    if (c.d) {
      var chosen = a[c.d.attr] || '';
      html += '<div class="ucs-ce__row"><label class="ucs-ce__field" for="' + uid + '-d"><span>' + esc(c.d.label) + (c.d.required ? ' *' : '') + '</span><select id="' + uid + '-d" data-ce="date"><option value=""></option>' +
        dates(c.d).map(function (x) {
          var v = x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
          var label = x.toLocaleDateString(document.documentElement.lang || undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          return '<option value="' + v + '"' + (v === chosen ? ' selected' : '') + '>' + esc(label) + '</option>';
        }).join('') + '</select></label>';
      if (c.d.slots && c.d.slots.length) {
        html += '<label class="ucs-ce__field" for="' + uid + '-t"><span>' + esc(c.d.slotLabel) + '</span><select id="' + uid + '-t" data-ce="slot"><option value=""></option>' +
          c.d.slots.map(function (s) { return '<option' + (s === a[c.d.slotAttr] ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></label>';
      }
      html += '</div><p class="ucs-ce__msg" role="alert" hidden>' + esc(c.d.requiredText) + '</p>';
    }
    host.className = c.cls + (host.getAttribute('data-where') === 'drawer' ? ' ucs-ce--drawer' : '');
    host.style.cssText = c.css;
    host.innerHTML = html;
    host.hidden = false;

    host.addEventListener('change', function (e) {
      var t = e.target, kind = t.getAttribute('data-ce'), attrs = {};
      if (kind === 'gift') {
        attrs[c.g.attr] = t.checked ? 'Yes' : '';
        var note = host.querySelector('[data-ce-note]');
        if (note && c.n.onlyGift) note.hidden = !t.checked;
        save({ attributes: attrs });
      } else if (kind === 'date') { attrs[c.d.attr] = t.value; save({ attributes: attrs }); guard(); }
      else if (kind === 'slot') { attrs[c.d.slotAttr] = t.value; save({ attributes: attrs }); }
    });
    host.addEventListener('input', function (e) { if (e.target.getAttribute('data-ce') === 'note') save({ note: e.target.value }); });
  }

  // A required delivery date: checkout waits until one is chosen.
  var cfgRequired = null;
  function guard() {
    if (!cfgRequired) return;
    var missing = !state.attributes[cfgRequired.attr];
    document.querySelectorAll('.ucs-ce__msg').forEach(function (m) { if (!missing) m.hidden = true; });
    return missing;
  }
  document.addEventListener('click', function (e) {
    var go = e.target.closest && e.target.closest('[name="checkout"], a[href*="/checkout"], button[form="cart"][name="checkout"]');
    if (!go || !cfgRequired || !state || !guard()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    document.querySelectorAll('.ucs-ce__msg').forEach(function (m) { m.hidden = false; });
    var sel = document.querySelector('[data-ce="date"]');
    if (sel) sel.focus();
  }, true);

  function mountDrawer(c) {
    var drawer = document.querySelector('cart-drawer');
    if (!drawer) return;
    var place = function () {
      var footer = drawer.querySelector('.drawer__footer');
      if (!footer || footer.querySelector('[data-ucs-ce-drawer]')) return;
      var box = document.createElement('div');
      box.setAttribute('data-ucs-ce-drawer', '');
      box.setAttribute('data-where', 'drawer');
      var anchor = footer.querySelector('.cart__ctas') || footer.firstChild;
      footer.insertBefore(box, anchor);
      load().then(function () { render(box, c); });
    };
    place();
    new MutationObserver(function () { requestAnimationFrame(place); }).observe(drawer, { childList: true, subtree: true });
  }

  function init() {
    var page = document.querySelector('[data-ucs-ce]');
    var dataEl = document.getElementById('ucs-ce-data');
    var cfg = null;
    try { cfg = JSON.parse((page ? page.querySelector('script[type="application/json"]') : dataEl).textContent); } catch (e) { cfg = null; }
    if (!cfg) return;
    if (cfg.d && cfg.d.required) cfgRequired = cfg.d;
    if (page && cfg.page) load().then(function () { render(page, cfg); });
    if (cfg.drawer) mountDrawer(cfg);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
