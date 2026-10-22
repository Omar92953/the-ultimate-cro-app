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
    if (!loading) loading = fetch(root + 'cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (c) { state = { attributes: c.attributes || {}, note: c.note || '' }; keep(c); return state; });
    return loading;
  }
  // The codes that work on this cart (an unusable code stays in cart.discount_codes with applicable: false).
  function codesOf(cart) { return (cart.discount_codes || []).filter(function (x) { return x.applicable; }).map(function (x) { return x.code; }); }
  var lc = function (x) { return String(x).toLowerCase(); };
  var has = function (list, code) { return list.map(lc).indexOf(lc(code)) > -1; };
  // What each code takes off the cart, in cents: order discounts and product discounts on each line. Shipping codes count at checkout (0 here).
  function savedOf(cart) {
    var m = {}, add = function (a, n) { if (a && a.type === 'discount_code') { var k = lc(a.key || a.title); m[k] = (m[k] || 0) + (Number(n) || 0); } };
    (cart.cart_level_discount_applications || []).forEach(function (a) { add(a, a.total_allocated_amount); });
    (cart.items || []).forEach(function (i) { (i.line_level_discount_allocations || []).forEach(function (x) { add(x.discount_application, x.amount); }); });
    return m;
  }
  function keep(cart) { state.codes = codesOf(cart); state.saved = savedOf(cart); state.cur = cart.currency; }
  function money(cents) {
    try { return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: state.cur }).format(cents / 100); } catch (e) { return (cents / 100).toFixed(2); }
  }
  function cartUI() {
    var el = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    return el && typeof el.renderContents === 'function' && typeof el.getSectionsToRender === 'function' ? el : null;
  }
  // Sends the codes to the cart ('' clears them); the theme's cart then shows the new prices.
  function sendCodes(list) {
    var ui = cartUI(), body = { discount: list.join(',') };
    if (ui) body.sections = ui.getSectionsToRender().map(function (s) { return s.id; });
    return fetch(root + 'cart/update.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function refreshTheme(data) {
    if (/\/cart\/?$/.test(location.pathname)) return location.reload();
    var ui = cartUI();
    if (ui && data.sections) { try { ui.renderContents(Object.assign({}, data, { id: undefined })); } catch (e) { /* the theme redraws on its next change */ } }
    document.dispatchEvent(new CustomEvent('ucs:cart:added'));
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
    if (c.c) {
      html += '<div class="ucs-ce__code" data-ce-code><label class="ucs-ce__field" for="' + uid + '-c"><span>' + esc(c.c.label) + '</span><span class="ucs-ce__codeRow"><input id="' + uid + '-c" type="text" data-ce="code" autocomplete="off" autocapitalize="characters" placeholder="' + esc(c.c.placeholder) + '"><button type="button" class="ucs-btn" data-ce="apply">' + esc(c.c.button) + '</button></span></label>' +
        '<p class="ucs-ce__msg" data-ce-codemsg role="alert" hidden></p><ul class="ucs-ce__applied" data-ce-applied role="list"></ul></div>';
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
    if (c.c) {
      var msg = host.querySelector('[data-ce-codemsg]'), list = host.querySelector('[data-ce-applied]'), field = host.querySelector('[data-ce="code"]'), btn = host.querySelector('[data-ce="apply"]');
      var show = function (text) { msg.textContent = text || ''; msg.hidden = !text; };
      var paint = function () {
        list.innerHTML = (state.codes || []).map(function (code) {
          var off = (state.saved || {})[lc(code)];
          return '<li class="ucs-ce__tag"><span>' + esc(c.c.applied.replace('{code}', code)) + ' <small class="ucs-ce__save">' + esc(off > 0 ? c.c.saved.replace('{amount}', money(off)) : c.c.later) + '</small></span><button type="button" class="ucs-ce__rm" data-ce-remove="' + esc(code) + '">' + esc(c.c.remove) + '</button></li>';
        }).join('');
      };
      var run = function (next, typed) {
        btn.disabled = true;
        show('');
        var before = state.codes || [];
        var combine = function (others) { return c.c.combine.replace(/\{code\}/g, typed).replace(/\{other\}/g, others.join(', ')); };
        return sendCodes(next).then(function (data) {
          var ok = codesOf(data), lost = typed ? before.filter(function (x) { return !has(ok, x); }) : [];
          if (typed && !has(ok, typed)) {
            // Not usable here. If it works on its own, it just doesn't combine with the codes already on the cart.
            var alone = before.length ? sendCodes([typed]).then(function (d) { return has(codesOf(d), typed); }) : Promise.resolve(false);
            return alone.then(function (yes) { return sendCodes(before).then(function () { show(yes ? combine(before) : c.c.invalid); }); });
          }
          // It works, but Shopify dropped a code already on the cart: keep the earlier codes and say which one is in the way.
          if (lost.length) return sendCodes(before).then(function () { show(combine(lost)); });
          keep(data);
          paint();
          field.value = '';
          refreshTheme(data);
        }).catch(function () { show(c.c.error); }).then(function () { btn.disabled = false; });
      };
      host.addEventListener('click', function (e) {
        var rm = e.target.closest && e.target.closest('[data-ce-remove]');
        if (rm) { var gone = rm.getAttribute('data-ce-remove'); return run((state.codes || []).filter(function (x) { return x !== gone; }), ''); }
        if (e.target.closest && e.target.closest('[data-ce="apply"]')) {
          var typed = field.value.trim();
          if (!typed) return show(c.c.empty);
          if (has(state.codes || [], typed)) return show(c.c.already.replace(/\{code\}/g, typed));
          run((state.codes || []).concat(typed), typed);
        }
      });
      field.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
      paint();
    }
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
