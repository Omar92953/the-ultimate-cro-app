/*
 * Ultimate CRO — bundle deals on the storefront. Loaded by the Conversion boosters embed only when
 * the shop has active deals (written by the app to $app:cro_offers). Shows:
 *  - buy X get Y and volume-tier messages on qualifying product pages,
 *  - the fixed-bundle box with one "Add bundle to cart" button,
 *  - gift-with-purchase progress; the gift is added to the cart only once it's free and removed
 *    when the cart drops below the minimum, so a shopper is never charged for it.
 * Checkout applies the same deals through the app's discount Function.
 */
(function () {
  if (window.__ucsDeals) return;
  window.__ucsDeals = true;
  var el = document.getElementById('ucs-boost');
  if (!el) return;
  var data;
  try { data = JSON.parse(el.textContent); } catch (e) { return; }
  var offers = data.offers || {};
  var deals = offers.deals || [];
  if (!deals.length) return;
  var T = offers.t || {};
  var S = window.Shopify || {};
  var root = (S.routes && S.routes.root) || '/';
  var rate = Number(S.currency && S.currency.rate) || 1;
  var P = data.product;
  var nativeFetch = window.fetch.bind(window);
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fill = function (s, o) { return String(s || '').replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ''; }); };
  var json = function (u, body) {
    var opt = { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } };
    if (body) { opt.method = 'POST'; opt.body = JSON.stringify(body); }
    return nativeFetch(root + u, opt).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); });
  };
  function money(c) {
    var fmt = String(data.fmt || '{{amount}}').replace(/<[^>]*>/g, '');
    var m = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    if (!m) return fmt;
    var map = { amount_no_decimals: [0, ',', '.'], amount_with_comma_separator: [2, '.', ','], amount_no_decimals_with_comma_separator: [0, '.', ','], amount_with_apostrophe_separator: [2, "'", '.'], amount_no_decimals_with_space_separator: [0, ' ', ','], amount_with_space_separator: [2, ' ', ','] };
    var a = map[m[1]] || [2, ',', '.'];
    var p = (Math.max(0, Number(c)) / 100).toFixed(a[0]).split('.');
    return esc(fmt.replace(m[0], p[0].replace(/\B(?=(\d{3})+(?!\d))/g, a[1]) + (p[1] ? a[2] + p[1] : '')));
  }
  var matches = function (t, pid, cols) {
    if (!t || t.type === 'all') return true;
    if (t.type === 'products') return (t.p || []).indexOf(Number(pid)) > -1;
    if (t.type === 'collections') return (cols || []).some(function (c) { return (t.c || []).indexOf(Number(c)) > -1; });
    return false;
  };
  var reward = function (pct) { return Number(pct) >= 100 ? (T.free || 'free') : fill(T.off || '{pct}% off', { pct: pct }); };
  var img = function (src, w) { return src ? (src.indexOf('//') === 0 ? 'https:' : '') + src + (src.indexOf('?') > -1 ? '&' : '?') + 'width=' + w : ''; };

  /* ---------- where the widgets go: above the product form, or above the cart form ---------- */
  var box = null;
  function host() {
    if (box) return box;
    var anchor = null;
    if (data.page === 'product') {
      var forms = document.querySelectorAll('form[action*="/cart/add"]');
      for (var i = 0; i < forms.length; i++) {
        var f = forms[i];
        if (/installment/i.test(f.id) || f.closest('.ucs, [class*="ucro"], cart-drawer, .cart-drawer')) continue;
        if (f.querySelector('[type="submit"], button[name="add"]')) { anchor = f; break; }
      }
    } else if (data.page === 'cart') {
      anchor = document.querySelector('form[action$="/cart"], form#cart, form[action*="/cart"]:not([action*="/add"])');
    }
    if (!anchor) return null;
    box = document.createElement('div');
    box.className = 'ucs-deals';
    anchor.parentNode.insertBefore(box, anchor);
    return box;
  }
  function card(kind, html, id) {
    var h = host();
    if (!h) return null;
    var d = id && h.querySelector('[data-deal="' + id + '"]');
    if (!d) {
      d = document.createElement('div');
      d.className = 'ucs-deal ucs-deal--' + kind;
      if (id) d.setAttribute('data-deal', id);
      h.appendChild(d);
    }
    d.innerHTML = html;
    return d;
  }

  /* ---------- product page: buy X get Y, volume tiers, fixed bundle ---------- */
  if (data.page === 'product' && P) {
    var productJs = null;
    var current = function () { return productJs || (productJs = json('products/' + P.handle + '.js')); };
    deals.forEach(function (d) {
      if (d.t === 'bogo' && (matches(d.buy, P.id, P.cols) || matches(d.get, P.id, P.cols))) {
        var same = JSON.stringify(d.buy) === JSON.stringify(d.get);
        var text = same
          ? fill(T.bogo_same, { n: d.x + d.y, y: d.y, reward: reward(d.pct) })
          : fill(T.bogo, { x: d.x, y: d.y, reward: reward(d.pct) });
        card('bogo', '<span class="ucs-deal__icon" aria-hidden="true"></span><div><p class="ucs-deal__name">' + esc(d.name) + '</p><p class="ucs-deal__text">' + esc(text) + '</p></div>', d.id);
      }
      if (d.t === 'volume' && matches(d.target, P.id, P.cols) && (d.tiers || []).length) {
        current().then(function (p) {
          var rows = d.tiers.slice().sort(function (a, b) { return a.qty - b.qty; }).map(function (t) {
            return '<li><span>' + esc(fill(T.tier, { qty: t.qty })) + '</span><b>' + esc(fill(T.off, { pct: t.pct })) + '</b><small>' +
              fill(esc(T.each), { price: money(p.price * (1 - t.pct / 100)) }) + '</small></li>';
          }).join('');
          card('volume', '<p class="ucs-deal__name">' + esc(d.name) + '</p><ul class="ucs-deal__tiers" role="list">' + rows + '</ul>', d.id);
        }).catch(function () {});
      }
      if (d.t === 'fixed' && (d.items || []).some(function (i) { return Number(i.id) === Number(P.id); })) fixedBundle(d);
    });
  }

  function fixedBundle(d) {
    Promise.all(d.items.map(function (i) { return json('products/' + i.h + '.js'); })).then(function (products) {
      var picks = products.map(function (p) { return (p.variants || []).filter(function (v) { return v.available; })[0] || null; });
      if (picks.some(function (v) { return !v; })) return; // a product is sold out: no bundle offer
      var el = card('fixed', '', d.id);
      if (!el) return;
      var rows = products.map(function (p, n) {
        var q = Number(d.items[n].q) || 1;
        var avail = p.variants.filter(function (v) { return v.available; });
        var select = avail.length > 1
          ? '<select class="ucs-deal__var" data-n="' + n + '" aria-label="' + esc(p.title) + '">' + avail.map(function (v) { return '<option value="' + v.id + '">' + esc(v.title) + '</option>'; }).join('') + '</select>'
          : '';
        return '<li class="ucs-deal__item">' + (p.featured_image ? '<img src="' + esc(img(p.featured_image, 120)) + '" alt="" width="48" height="48" loading="lazy">' : '<span></span>') +
          '<span class="ucs-deal__it"><a href="' + esc(root + 'products/' + p.handle) + '">' + (q > 1 ? q + ' × ' : '') + esc(p.title) + '</a>' + select + '</span></li>';
      }).join('<li class="ucs-deal__plus" aria-hidden="true">+</li>');
      el.innerHTML = '<p class="ucs-deal__name">' + esc(d.name) + '</p><ul class="ucs-deal__items" role="list">' + rows + '</ul>' +
        '<div class="ucs-deal__total"><span>' + esc(T.bundle_total) + '</span><span class="ucs-deal__price"></span></div>' +
        '<button type="button" class="ucs-deal__add"></button><p class="ucs-deal__err" role="alert" hidden></p>';
      var btn = el.querySelector('.ucs-deal__add');
      btn.textContent = T.add_bundle || 'Add bundle to cart';
      function paint() {
        var full = picks.reduce(function (n, v, i) { return n + v.price * (Number(d.items[i].q) || 1); }, 0);
        var cut = Math.round(full * (Number(d.pct) || 0) / 100);
        el.querySelector('.ucs-deal__price').innerHTML = '<b>' + money(full - cut) + '</b> <s>' + money(full) + '</s> <em>' + fill(esc(T.save), { amount: money(cut) }) + '</em>';
      }
      paint();
      Array.prototype.forEach.call(el.querySelectorAll('.ucs-deal__var'), function (s) {
        s.addEventListener('change', function () {
          var p = products[Number(s.getAttribute('data-n'))];
          picks[Number(s.getAttribute('data-n'))] = p.variants.find(function (v) { return String(v.id) === s.value; });
          paint();
        });
      });
      btn.addEventListener('click', function () {
        btn.setAttribute('aria-busy', 'true');
        btn.disabled = true;
        json('cart/add.js', { items: picks.map(function (v, i) { return { id: v.id, quantity: Number(d.items[i].q) || 1 }; }) })
          .then(function () {
            document.dispatchEvent(new CustomEvent('ucs:cart:added'));
            window.location.href = root + 'cart';
          })
          .catch(function () {
            btn.removeAttribute('aria-busy');
            btn.disabled = false;
            var err = el.querySelector('.ucs-deal__err');
            err.textContent = T.error || '';
            err.hidden = false;
          });
      });
    }).catch(function () {});
  }

  /* ---------- gift with purchase: progress + add/remove the gift ---------- */
  var gifts = deals.filter(function (d) { return d.t === 'gift' && d.gift && d.gift.v; });
  if (!gifts.length) return;
  var isGift = function (item) { return item.properties && item.properties._cro_gift; };
  var failed = {};
  var busy = false, again = false, timer = null;

  function paintGift(g, s) {
    if (data.page === 'product' && P && g.only && !matches(g.only, P.id, P.cols)) return;
    if (data.page !== 'product' && data.page !== 'cart') return;
    var pct = s.need > 0 ? Math.min(100, Math.round((s.rest / s.need) * 100)) : 100;
    var title = esc(g.gift.title);
    var text = s.ok ? fill(esc(T.gift_ok), { gift: title }) : fill(esc(T.gift_left), { amount: money(s.need - s.rest), gift: title });
    card('gift', (g.gift.img ? '<img src="' + esc(img(g.gift.img, 120)) + '" alt="" width="44" height="44" loading="lazy">' : '<span class="ucs-deal__icon" aria-hidden="true"></span>') +
      '<div><p class="ucs-deal__text">' + text + '</p><span class="ucs-deal__bar' + (s.ok ? ' is-done' : '') + '"><i style="width:' + pct + '%"></i></span></div>', g.id);
  }

  function step(op) {
    return op.add
      ? json('cart/add.js', { items: [{ id: op.add, quantity: 1, properties: { _cro_gift: op.gift } }] }).catch(function () { failed[op.gift] = true; })
      : json('cart/change.js', { id: op.key, quantity: op.qty }).catch(function () {});
  }

  function sync() {
    if (busy) { again = true; return; }
    busy = true;
    json('cart.js').then(function (cart) {
      var items = cart.items || [];
      var paid = items.filter(function (i) { return !isGift(i); });
      // The same rule as checkout: what the rest of the cart costs (after its own discounts),
      // in the shopper's currency. Checkout uses amounts at least this high, so a gift added here
      // is always free there.
      var rest = paid.reduce(function (n, i) { return n + (i.final_line_price || 0); }, 0);
      var ops = [];
      gifts.forEach(function (g) {
        var lines = items.filter(function (i) { return isGift(i) === g.id; });
        var need = Math.round((Number(g.min) || 0) * rate * 100);
        var trig = !g.only || paid.some(function (i) { return matches(g.only, i.product_id, []); });
        var ok = paid.length > 0 && rest >= need && trig;
        paintGift(g, { rest: rest, need: need, ok: ok });
        if (ok && !lines.length && !failed[g.id]) ops.push({ add: g.gift.v, gift: g.id });
        lines.forEach(function (l, n) {
          if (!ok || n > 0) ops.push({ key: l.key, qty: 0 });
          else if (l.quantity > 1) ops.push({ key: l.key, qty: 1 });
        });
      });
      return ops.reduce(function (p, op) { return p.then(function () { return step(op); }); }, Promise.resolve()).then(function () {
        if (!ops.length) return;
        if (data.page === 'cart') { window.location.reload(); return; }
        if (window.publish && window.PUB_SUB_EVENTS) window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'ucs-deals' });
        document.dispatchEvent(new CustomEvent('ucs:cart:added'));
      });
    }).catch(function () {}).then(function () {
      busy = false;
      if (again) { again = false; schedule(); }
    });
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(sync, 500); }

  // Re-check whenever the theme (or another app) changes the cart.
  window.fetch = function (input, init) {
    var res = nativeFetch(input, init);
    var u = String((input && input.url) || input);
    if (/\/cart\/(add|change|update|clear)/.test(u)) res.then(schedule, function () {});
    return res;
  };
  document.addEventListener('ucs:cart:added', schedule);
  window.addEventListener('pageshow', function (e) { if (e.persisted) schedule(); });
  sync();
})();
