/* Cart drawer & checkout (app: Boosters → Cart drawer & checkout).
   - The app's slide-out cart: opens after add to cart and from the cart icon, with quantity buttons,
     subtotal, express checkout buttons (Shop Pay, Apple Pay…) and the checkout button.
   - Best discount: tries the listed codes on the cart and keeps the one with the lowest total.
   - Shareable cart: a link that rebuilds this cart anywhere (/cart/variant:qty,…?storefront=true),
     and the last cart is remembered on this device to offer it back when the cart is empty. */
(function () {
  if (window.__ucsCart) return;
  window.__ucsCart = true;
  var el = document.getElementById('ucs-cart-data');
  if (!el) return;
  var data;
  try { data = JSON.parse(el.textContent); } catch (e) { return; }
  var c = data.c || {};
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var nativeFetch = window.fetch.bind(window);
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  var money = function (cents, cur) {
    try { return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: cur || data.cur || 'USD' }).format(cents / 100); } catch (e) { return (cents / 100).toFixed(2); }
  };
  var json = function (path, body) {
    return nativeFetch(root + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) } : { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
  };

  // Changes the shopper makes go through window.fetch, so other scripts (cart guard, bars, deals) see them.
  var post = function (path, body) {
    return window.fetch(root + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  };

  /* ---------- best discount ---------- */
  var lastSig = '', bestNote = '';
  function bestDiscount(cart) {
    if (!c.dc || !cart.items.length) return Promise.resolve(cart);
    var sig = cart.items.map(function (i) { return i.key + ':' + i.quantity; }).join('|');
    if (sig === lastSig) return Promise.resolve(cart);
    lastSig = sig;
    // The code already on the cart (if one of ours and it applies) is the one to beat.
    var now = (cart.discount_codes || []).filter(function (d) { return d.applicable && c.dc.codes.indexOf(String(d.code).toUpperCase()) > -1; })[0];
    var best = { code: now ? String(now.code).toUpperCase() : '', total: cart.total_price, cart: cart };
    return c.dc.codes.reduce(function (p, code) {
      return p.then(function () {
        return json('cart/update.js', { discount: code }).then(function (k) {
          var ok = (k.discount_codes || []).some(function (d) { return d.code.toUpperCase() === code && d.applicable; });
          if (ok && k.total_price < best.total) best = { code: code, total: k.total_price, cart: k };
        }).catch(function () {});
      });
    }, Promise.resolve()).then(function () {
      return json('cart/update.js', { discount: best.code }).then(function (k) {
        bestNote = best.code ? c.dc.t.replace('{code}', best.code) : '';
        return k;
      }).catch(function () { return best.cart; });
    });
  }

  /* ---------- share + remember ---------- */
  var permalink = function (cart) { return location.origin + root + 'cart/' + cart.items.map(function (i) { return i.variant_id + ':' + i.quantity; }).join(',') + '?storefront=true'; };
  function remember(cart) {
    if (cart.items.length) store.set('ucs-cart-saved', JSON.stringify(cart.items.map(function (i) { return { id: i.variant_id, quantity: i.quantity }; })));
  }

  if (!c.dr) {
    // No drawer: still remember carts and apply the best discount when the cart changes.
    var plain = function () { json('cart.js').then(function (k) { remember(k); return bestDiscount(k); }).catch(function () {}); };
    window.fetch = function (input, init) {
      var p = nativeFetch(input, init), u = String((input && input.url) || input);
      if (/\/cart\/(add|change|update|clear)/.test(u) && !(init && init.body && /"discount"/.test(String(init.body)))) p.then(function () { setTimeout(plain, 300); });
      return p;
    };
    return;
  }

  /* ---------- the drawer ---------- */
  var d = c.dr;
  var wrap = document.createElement('div');
  wrap.className = 'ucs-cd ucs-cd--' + d.side;
  wrap.style.cssText = c.css || '';
  wrap.hidden = true;
  wrap.innerHTML = '<div class="ucs-cd__overlay" data-close></div>' +
    '<aside class="ucs-cd__panel" role="dialog" aria-modal="true" aria-labelledby="ucs-cd-title" tabindex="-1">' +
    '<header class="ucs-cd__head"><h2 id="ucs-cd-title" class="ucs-cd__title">' + esc(d.title) + '</h2><button type="button" class="ucs-cd__x" data-close aria-label="Close">×</button></header>' +
    '<div class="ucs-cd__body"></div><footer class="ucs-cd__foot"></footer></aside>';
  document.body.appendChild(wrap);
  var panel = wrap.querySelector('.ucs-cd__panel'), body = wrap.querySelector('.ucs-cd__body'), foot = wrap.querySelector('.ucs-cd__foot');
  var express = document.getElementById('ucs-cart-express');
  var opener = null;

  function draw(cart) {
    if (!cart.items.length) {
      var saved = store.get('ucs-cart-saved');
      body.innerHTML = '<div class="ucs-cd__empty"><p>' + esc(d.empty) + '</p>' +
        (c.sh && saved ? '<p class="ucs-cd__restore">' + esc(c.sh.restore) + '</p><button type="button" class="ucs-btn" data-restore>' + esc(d.title) + '</button>' : '') +
        '<button type="button" class="ucs-btn ucs-btn--outline" data-close>' + esc(d.continueText) + '</button></div>';
      foot.innerHTML = '';
      return;
    }
    body.innerHTML = '<ul class="ucs-cd__items" role="list">' + cart.items.map(function (i) {
      var img = i.image ? i.image + (i.image.indexOf('?') > -1 ? '&' : '?') + 'width=160' : '';
      var opts = (i.options_with_values || []).filter(function (o) { return o.value !== 'Default Title'; }).map(function (o) { return o.value; }).join(' / ');
      var props = Object.keys(i.properties || {}).filter(function (k) { return k.charAt(0) !== '_' && i.properties[k]; }).map(function (k) { return esc(k) + ': ' + esc(i.properties[k]); }).join('<br>');
      return '<li class="ucs-cd__item" data-key="' + esc(i.key) + '">' +
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="ucs-cd__ph"></span>') +
        '<div class="ucs-cd__info"><a href="' + esc(i.url) + '">' + esc(i.product_title) + '</a>' + (opts ? '<small>' + esc(opts) + '</small>' : '') + (props ? '<small>' + props + '</small>' : '') +
        '<span class="ucs-cd__qty"><button type="button" data-q="-1" aria-label="Fewer">−</button><span aria-live="polite">' + i.quantity + '</span><button type="button" data-q="1" aria-label="More">+</button>' +
        '<button type="button" class="ucs-cd__rm" data-q="0">Remove</button></span></div>' +
        '<span class="ucs-cd__price">' + (i.original_line_price > i.final_line_price ? '<s>' + money(i.original_line_price, cart.currency) + '</s> ' : '') + money(i.final_line_price, cart.currency) + '</span></li>';
    }).join('') + '</ul>';
    var discounts = (cart.cart_level_discount_applications || []).map(function (a) { return esc(a.title) + ' −' + money(a.total_allocated_amount, cart.currency); }).join('<br>');
    foot.innerHTML = (bestNote ? '<p class="ucs-cd__note">' + esc(bestNote) + '</p>' : '') + (discounts ? '<p class="ucs-cd__disc">' + discounts + '</p>' : '') +
      '<p class="ucs-cd__sub"><span>' + esc(d.subtotal) + '</span><b>' + money(cart.total_price, cart.currency) + '</b></p>' +
      '<p class="ucs-cd__tax">' + esc(d.taxes) + '</p>' +
      '<a class="ucs-btn ucs-cd__go" href="' + root + 'checkout">' + esc(d.checkout) + '</a>' +
      '<div class="ucs-cd__express"></div>' +
      (c.sh ? '<button type="button" class="ucs-cd__share" data-share>' + esc(c.sh.button) + '</button><p class="ucs-cd__copied" role="status" hidden>' + esc(c.sh.copied) + '</p>' : '');
    if (express && c.ex) { express.hidden = false; foot.querySelector('.ucs-cd__express').appendChild(express); }
    wrap._cart = cart;
  }

  function refresh() {
    return json('cart.js').then(function (cart) {
      remember(cart);
      return bestDiscount(cart);
    }).then(function (cart) { draw(cart); updateCount(cart.item_count); return cart; });
  }
  function updateCount(n) {
    document.querySelectorAll('.cart-count-bubble span[aria-hidden], [data-cart-count], .cart-count').forEach(function (b) { b.textContent = n; });
  }

  function open() {
    opener = document.activeElement;
    wrap.hidden = false;
    document.documentElement.classList.add('ucs-cd-open');
    requestAnimationFrame(function () { wrap.classList.add('is-open'); panel.focus(); });
    // The theme's own drawer or notification stays closed.
    var td = document.querySelector('cart-drawer');
    if (td && typeof td.close === 'function') try { td.close(); } catch (e) { /* not open */ }
    var tn = document.querySelector('cart-notification');
    if (tn && typeof tn.close === 'function') try { tn.close(); } catch (e) { /* not open */ }
    return refresh();
  }
  function close() {
    wrap.classList.remove('is-open');
    document.documentElement.classList.remove('ucs-cd-open');
    setTimeout(function () { wrap.hidden = true; }, 250);
    if (opener && opener.focus) opener.focus();
  }

  wrap.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-close]')) return close();
    var q = t.closest('[data-q]');
    if (q) {
      var li = q.closest('[data-key]'), item = (wrap._cart.items || []).filter(function (i) { return i.key === li.getAttribute('data-key'); })[0];
      var n = Number(q.getAttribute('data-q')), qty = n === 0 ? 0 : Math.max(0, item.quantity + n);
      li.classList.add('is-busy');
      return post('cart/change.js', { id: item.key, quantity: qty }).then(refresh).catch(refresh);
    }
    if (t.closest('[data-share]')) {
      var link = permalink(wrap._cart);
      var shown = function () { var m = wrap.querySelector('.ucs-cd__copied'); if (m) m.hidden = false; };
      if (navigator.share) return navigator.share({ url: link }).catch(function () {});
      if (navigator.clipboard) return navigator.clipboard.writeText(link).then(shown, function () { window.prompt('', link); });
      return window.prompt('', link);
    }
    if (t.closest('[data-restore]')) {
      var items = [];
      try { items = JSON.parse(store.get('ucs-cart-saved') || '[]'); } catch (err) { items = []; }
      if (items.length) post('cart/add.js', { items: items }).then(refresh).catch(refresh);
    }
  });
  wrap.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    var f = panel.querySelectorAll('a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // The cart icon opens the drawer instead of the cart page.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="/cart"], a[href$="/cart/"], #cart-icon-bubble');
    if (!a || a.closest('.ucs-cd') || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    open();
  }, true);

  // After any add to cart (the theme, quick add, app widgets): open the drawer.
  window.fetch = function (input, init) {
    var p = nativeFetch(input, init), u = String((input && input.url) || input);
    if (/\/cart\/add(\.js)?(\?|$)/.test(u)) p.then(function (r) { if (r.ok && d.openOnAdd) setTimeout(wrap.hidden ? open : refresh, 150); });
    else if (/\/cart\/(change|update|clear)/.test(u) && !wrap.hidden && !(init && init.body && /"discount"/.test(String(init.body)))) p.then(function () { setTimeout(refresh, 200); });
    return p;
  };
  document.addEventListener('ucs:cart:open', open);
})();
