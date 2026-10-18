/* Wishlist (app: Boosters → Wishlist). Saved in this browser: [{ h: handle, p: price when saved }].
   Hearts on the product page and on product cards, a floating button with the count, and the wishlist
   page ([data-ucs-orders="wishlist"]) with add to cart, "price dropped" and a share link (?wl=a,b). */
(function () {
  if (window.__ucsHoldout) return; // holdout test: this shopper sees the store without the app's widgets
  if (window.__ucsWl) return;
  window.__ucsWl = true;
  // Its own small stylesheet, next to this script (the boosters embed only loads ucs-boosters.css).
  var me = document.currentScript;
  if (me && me.src && !document.querySelector('link[data-ucs-css="wl"]')) {
    var lk = document.createElement('link');
    lk.rel = 'stylesheet';
    lk.href = me.src.replace(/\.js(\?|$)/, '.css$1');
    lk.setAttribute('data-ucs-css', 'wl');
    document.head.appendChild(lk);
  }
  var el = document.getElementById('ucs-wl-data');
  if (!el) return;
  var data;
  try { data = JSON.parse(el.textContent); } catch (e) { return; }
  var c = data.c;
  if (!c || c.on === false) return;
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var KEY = 'ucs-wishlist';
  // The store's language prefix (root is '/fr/' on a French market): every link keeps it.
  var link = function (path) { return root === '/' || path.indexOf(root) === 0 ? path : root.replace(/\/$/, '') + path; };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var money = function (cents) { try { return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || data.cur || 'USD' }).format(cents / 100); } catch (e) { return (cents / 100).toFixed(2); } };
  var ICON = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/></svg>'
  };
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  var write = function (l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { /* private mode */ } paintAll(); };
  var has = function (h) { return read().some(function (x) { return x.h === h; }); };
  var toggle = function (h, price) {
    var l = read();
    if (l.some(function (x) { return x.h === h; })) l = l.filter(function (x) { return x.h !== h; });
    else {
      l.unshift({ h: h, p: price || 0, t: Date.now() });
      // Hearts on product cards don't know the price: read it now, so a later price drop can show.
      if (!price) fetch(root + 'products/' + encodeURIComponent(h) + '.js').then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
        if (!p) return;
        var cur = read();
        cur.forEach(function (x) { if (x.h === h && !x.p) x.p = p.price; });
        try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* private mode */ }
      }).catch(function () {});
    }
    write(l.slice(0, 100));
  };

  // A shared list (?wl=a,b) is added to this browser's list.
  var shared = new URLSearchParams(location.search).get('wl');
  if (shared) {
    var l0 = read();
    shared.split(',').filter(Boolean).forEach(function (h) { if (!l0.some(function (x) { return x.h === h; })) l0.push({ h: h, p: 0, t: Date.now() }); });
    try { localStorage.setItem(KEY, JSON.stringify(l0.slice(0, 100))); } catch (e) { /* private mode */ }
  }

  function heart(h, price, extra) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ucs-wl-btn' + (extra ? ' ' + extra : '');
    b.setAttribute('data-wl', h);
    b.innerHTML = ICON[c.ic] || ICON.heart;
    b.style.cssText = c.css;
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggle(h, price); });
    return b;
  }
  function paintAll() {
    var l = read();
    document.querySelectorAll('[data-wl]').forEach(function (b) {
      var on = l.some(function (x) { return x.h === b.getAttribute('data-wl'); });
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? c.t.saved : c.t.add);
      b.title = on ? c.t.saved : c.t.add;
    });
    var f = document.querySelector('.ucs-wl-float');
    if (f) { f.hidden = !l.length; f.querySelector('b').textContent = l.length; }
  }

  // Product page: next to Add to cart.
  if (c.w.product && data.ph) {
    var form = Array.prototype.filter.call(document.querySelectorAll('form[action*="/cart/add"]'), function (f) { return f.querySelector('[type="submit"], button[name="add"]') && !f.closest('.ucs, cart-drawer'); })[0];
    var submit = form && form.querySelector('[type="submit"], button[name="add"]');
    if (submit) {
      var row = document.createElement('div');
      row.className = 'ucs-wl-row';
      var b = heart(data.ph, data.pp);
      b.classList.add('ucs-wl-btn--text');
      b.insertAdjacentHTML('beforeend', '<span class="ucs-wl-label"></span>');
      row.appendChild(b);
      submit.parentNode.insertBefore(row, submit.nextSibling);
      var label = function () { b.querySelector('.ucs-wl-label').textContent = has(data.ph) ? c.t.saved : c.t.add; };
      b.addEventListener('click', function () { setTimeout(label, 0); });
      label();
    }
  }

  // Product cards: a heart in the top corner of the picture.
  var CARDS = '.card-wrapper, .product-card, .product-card-wrapper, .product-item, .grid-product, .grid-view-item, [data-product-card], .card--product, .productitem';
  function cards() {
    if (!c.w.cards) return;
    document.querySelectorAll(CARDS).forEach(function (card) {
      if (card.querySelector('[data-wl]') || card.closest('.ucs-wl-page')) return;
      var a = card.querySelector('a[href*="/products/"]');
      var m = a && /\/products\/([^/?#]+)/.exec(a.getAttribute('href'));
      if (!m) return;
      var media = card.querySelector('.card__media, .card__inner, .product-card__image, img') || card;
      var spot = media.tagName === 'IMG' ? media.parentNode : media;
      if (getComputedStyle(spot).position === 'static') spot.style.position = 'relative';
      spot.appendChild(heart(decodeURIComponent(m[1]), 0, 'ucs-wl-btn--card'));
    });
    paintAll();
  }
  cards();
  new MutationObserver(function () { clearTimeout(cards.t); cards.t = setTimeout(cards, 300); }).observe(document.body, { childList: true, subtree: true });

  // Floating button with the count, to the wishlist page.
  if (c.w.floating) {
    var f = document.createElement('a');
    f.className = 'ucs-wl-float ucs-wl-float--' + c.w.floatPos;
    f.href = link(c.p.url);
    f.style.cssText = c.css + ';bottom:' + (c.w.floatBottom == null ? 18 : c.w.floatBottom) + 'px';
    f.innerHTML = (ICON[c.ic] || ICON.heart) + '<b>0</b><span class="ucs-wl-sr">' + esc(c.p.heading) + '</span>';
    f.hidden = true;
    document.body.appendChild(f);
  }

  // The wishlist page.
  document.querySelectorAll('[data-ucs-orders="wishlist"]').forEach(function (host) {
    host.className = 'ucs ucs-wl-page';
    host.style.cssText = c.css;
    var draw = function () {
      var l = read();
      if (!l.length) { host.innerHTML = '<div class="ucs-wrap"><h2 class="ucs-wl-h">' + esc(c.p.heading) + '</h2><p>' + esc(c.p.empty) + '</p></div>'; return; }
      Promise.all(l.map(function (x) { return fetch(root + 'products/' + encodeURIComponent(x.h) + '.js').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); })).then(function (ps) {
        var rows = ps.map(function (p, i) {
          if (!p) return '';
          var v = (p.variants || []).filter(function (x) { return x.available; })[0];
          var saved = l[i].p, drop = saved && p.price < saved ? saved - p.price : 0;
          var img = p.featured_image ? (p.featured_image.indexOf('//') === 0 ? 'https:' : '') + p.featured_image + (p.featured_image.indexOf('?') > -1 ? '&' : '?') + 'width=400' : '';
          return '<li class="ucs-wl-item">' + (img ? '<a href="' + esc(link('/products/' + p.handle)) + '"><img src="' + esc(img) + '" alt="" loading="lazy"></a>' : '') +
            '<a class="ucs-wl-name" href="' + esc(link('/products/' + p.handle)) + '">' + esc(p.title) + '</a><span class="ucs-wl-price">' + money(p.price) + '</span>' +
            (drop ? '<span class="ucs-wl-drop">' + esc(c.p.priceDrop.replace('{amount}', money(drop))) + '</span>' : '') +
            (v ? '<button type="button" class="ucs-btn" data-add="' + v.id + '">' + esc(c.p.add) + '</button>' : '<span class="ucs-wl-sold">' + esc(c.p.soldOut || 'Sold out') + '</span>') +
            '<button type="button" class="ucs-wl-rm" data-rm="' + esc(l[i].h) + '">' + esc(c.p.remove) + '</button></li>';
        }).join('');
        host.innerHTML = '<div class="ucs-wrap"><h2 class="ucs-wl-h">' + esc(c.p.heading) + '</h2><ul class="ucs-wl-grid" role="list">' + rows + '</ul>' +
          '<p class="ucs-wl-foot"><button type="button" class="ucs-btn ucs-btn--outline" data-share>' + esc(c.p.share) + '</button> <span class="ucs-wl-copied" role="status" hidden>' + esc(c.p.copied) + '</span></p></div>';
      });
    };
    host.addEventListener('click', function (e) {
      var t = e.target;
      var rm = t.closest('[data-rm]');
      if (rm) { write(read().filter(function (x) { return x.h !== rm.getAttribute('data-rm'); })); return draw(); }
      var add = t.closest('[data-add]');
      if (add) {
        // The shopper sees what happened: the button says "Added to cart" (or that it failed) for a moment.
        var label = add.textContent;
        var say = function (text) { add.textContent = text; setTimeout(function () { add.textContent = label; add.disabled = false; }, 2000); };
        add.disabled = true;
        return fetch(root + 'cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: Number(add.getAttribute('data-add')), quantity: 1, properties: { _source: 'wishlist' } }] }) })
          .then(function (r) { if (!r.ok) throw new Error('add'); say(c.p.added || 'Added to cart'); document.dispatchEvent(new CustomEvent('ucs:cart:added')); })
          .catch(function () { say(c.p.failed || 'Could not add. Try again.'); });
      }
      if (t.closest('[data-share]')) {
        var shareUrl = location.origin + link(c.p.url) + '?wl=' + read().map(function (x) { return encodeURIComponent(x.h); }).join(',');
        var note = host.querySelector('.ucs-wl-copied');
        var shown = function (text) { note.textContent = text; note.hidden = false; setTimeout(function () { note.hidden = true; }, 5000); };
        // Copy the link; when the browser won't, show it so it can be copied by hand.
        var copy = function () { return (navigator.clipboard ? navigator.clipboard.writeText(shareUrl).then(function () { shown(c.p.copied); }) : Promise.reject()).catch(function () { shown(shareUrl); }); };
        if (navigator.share) return navigator.share({ url: shareUrl }).catch(function (err) { if (!err || err.name !== 'AbortError') return copy(); });
        return copy();
      }
    });
    draw();
  });
  paintAll();
})();
