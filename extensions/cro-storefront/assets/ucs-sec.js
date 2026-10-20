/* CRO sections, shared part (loaded once per page, before the section's own ucs-sec-<kind>.js).
   Finds every [data-ucs-sec] block, reads its JSON (and product templates), and hands it to the
   renderer its kind registered with UCSsec.def(). The app's previews call UCSsec.mount() directly
   with sample data (ctx.preview), so the store and the preview draw the same markup. */
(function () {
  if (window.UCSsec) return;
  var R = {};
  var cache = {};
  var uid = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function money(cents, fmt) {
    var n = (Number(cents) || 0) / 100;
    var f = fmt || '${{amount}}';
    function fix(d, t, s) {
      var p = n.toFixed(d).split('.');
      return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, t) + (p[1] ? s + p[1] : '');
    }
    return f.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, k) {
      if (k === 'amount_no_decimals') return fix(0, ',', '.');
      if (k === 'amount_with_comma_separator') return fix(2, '.', ',');
      if (k === 'amount_no_decimals_with_comma_separator') return fix(0, '.', ',');
      if (k === 'amount_with_apostrophe_separator') return fix(2, "'", '.');
      return fix(2, ',', '.');
    }).replace(/<[^>]*>/g, '');
  }
  function img(u, w) {
    if (!u) return '';
    return u.indexOf('cdn.shopify.com') > -1 || u.indexOf('/cdn/shop/') > -1 ? u + (u.indexOf('?') > -1 ? '&' : '?') + 'width=' + w : u;
  }
  function icon(svg, cls) {
    return svg ? '<svg class="' + (cls || 'usec__icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + svg + '</svg>' : '';
  }
  function head(c) {
    if (!c.h && !c.s) return '';
    return '<div class="usec__head">' + (c.h ? '<h2 class="usec__h">' + esc(c.h) + '</h2>' : '') + (c.s ? '<p class="usec__s">' + esc(c.s) + '</p>' : '') + '</div>';
  }
  function paras(t) {
    return String(t || '').split(/\n{2,}|\n/).filter(Boolean).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  }
  /** A product's live data (/products/<handle>.js); previews answer from their samples. */
  function product(ctx, h) {
    if (ctx.products) return Promise.resolve(ctx.products[h] || null);
    var key = ctx.root + h;
    return cache[key] || (cache[key] = fetch(ctx.root + 'products/' + encodeURIComponent(h) + '.js').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }));
  }

  function cartUI() {
    var el = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    return el && typeof el.renderContents === 'function' && typeof el.getSectionsToRender === 'function' ? el : null;
  }
  /** Adds one variant and refreshes the theme's cart (drawer or bubble), else opens the cart page. */
  function add(ctx, id, source) {
    if (ctx.preview) return new Promise(function (ok) { setTimeout(ok, 400); });
    var ui = cartUI();
    var bubble = document.getElementById('cart-icon-bubble');
    var body = { items: [{ id: Number(id), quantity: 1, properties: { _source: source } }] };
    if (ui) {
      body.sections = ui.getSectionsToRender().map(function (s) { return s.id; });
      body.sections_url = window.location.pathname;
    } else if (bubble) body.sections = ['cart-icon-bubble'];
    return fetch(ctx.root + 'cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || d.status) throw new Error(d.description || d.message || 'Error'); return d; }); })
      .then(function (d) {
        if (window.publish && window.PUB_SUB_EVENTS) window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: source, productVariantId: id, cartData: d });
        document.dispatchEvent(new CustomEvent('ucs:cart:added', { detail: d }));
        if (ui) {
          var last = d.items ? d.items[d.items.length - 1] : d;
          ui.classList.remove('is-empty');
          ui.renderContents(Object.assign({}, d, { key: d.key || (last && last.key), id: last && last.id }));
          return;
        }
        if (bubble && d.sections && d.sections['cart-icon-bubble']) {
          var tmp = document.createElement('div');
          tmp.innerHTML = d.sections['cart-icon-bubble'];
          var fresh = tmp.querySelector('#cart-icon-bubble') || tmp.firstElementChild;
          if (fresh) { bubble.innerHTML = fresh.innerHTML; return; }
        }
        window.location.href = ctx.root + 'cart';
      });
  }
  /** Wires [data-add] buttons inside el: busy state, then a tick. */
  function wireAdd(el, ctx, source) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]');
      if (!b || b.disabled) return;
      e.preventDefault();
      b.setAttribute('aria-busy', 'true');
      add(ctx, b.getAttribute('data-add'), source).then(function () {
        b.removeAttribute('aria-busy');
        b.classList.add('is-added');
        setTimeout(function () { b.classList.remove('is-added'); }, 2000);
      }).catch(function () { b.removeAttribute('aria-busy'); window.location.href = b.getAttribute('data-href') || ctx.root + 'cart'; });
    });
  }

  function mount(el, c, ctx) {
    var f = R[c.k];
    if (!f) return;
    el.className = 'ucs ' + c.cls;
    el.style.cssText = c.css;
    f(el, c, ctx);
  }
  function boot() {
    var els = document.querySelectorAll('[data-ucs-sec]:not([data-ready])');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!R[el.getAttribute('data-ucs-sec')]) continue;
      el.setAttribute('data-ready', '');
      var c;
      try { c = JSON.parse(el.querySelector('script[type="application/json"]').textContent); } catch (e) { continue; }
      var t = {};
      var tpl = el.querySelectorAll('template[data-t]');
      for (var j = 0; j < tpl.length; j++) t[tpl[j].getAttribute('data-t')] = tpl[j].innerHTML;
      var root = (el.getAttribute('data-root') || '/').replace(/\/?$/, '/');
      mount(el, c, { root: root, fmt: el.getAttribute('data-money'), p: el.getAttribute('data-p'), page: el.getAttribute('data-page'), design: el.hasAttribute('data-design'), t: t });
    }
  }

  window.UCSsec = {
    def: function (k, f) { R[k] = f; if (document.readyState !== 'loading') boot(); },
    mount: mount, boot: boot, esc: esc, money: money, img: img, icon: icon, head: head, paras: paras, product: product, add: add, wireAdd: wireAdd,
    id: function () { return 'usec' + ++uid; }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('shopify:section:load', boot);
})();
