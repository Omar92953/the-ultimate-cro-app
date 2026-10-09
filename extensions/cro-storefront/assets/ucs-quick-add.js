/*
 * CRO Toolbox — quick add to cart on product cards (app embed). Works on any theme:
 * finds product cards (Dawn's .card-wrapper and common patterns, or a custom selector), puts a
 * floating button on the image, adds single-variant products instantly and opens a small option
 * picker for the rest. After adding: the theme's own cart drawer/notification (Dawn family), our
 * "Added to cart" popup, or the cart page.
 */
(function () {
  if (window.__ucsQuickAdd) return;
  window.__ucsQuickAdd = true;

  var cfgEl = document.getElementById('ucs-qa-config');
  if (!cfgEl) return;
  var cfg = JSON.parse(cfgEl.textContent);
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var R = window.routes || {};
  var url = function (key, path) { return R[key] || (root + path).replace(/\/+/g, '/'); };
  var T = cfg.text;
  var stroke = function (w, d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ICONS = {
    // The Backrooms theme's quick-add bag.
    bag: stroke(1.5, '<path d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"/>'),
    plus: stroke(2.2, '<path d="M12 5v14M5 12h14"/>'),
    cart: stroke(1.8, '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2l1.7-7.3H6.2"/>'),
  };
  var CHECK = stroke(2.4, '<path d="M5 12.5l4.5 4.5L19 7.5"/>').replace('<svg ', '<svg width="18" height="18" ');
  var products = {};

  /* ---------- money (Shopify formatMoney) ---------- */
  function group(c, d, t, p) {
    var f = (c / 100).toFixed(d).split('.');
    return f[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + t) + (f[1] ? p + f[1] : '');
  }
  function money(c) {
    var fmt = String(cfg.fmt || '{{amount}}').replace(/<[^>]*>/g, '');
    var m = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    if (!m) return fmt;
    var map = { amount_no_decimals: [0, ',', '.'], amount_with_comma_separator: [2, '.', ','], amount_no_decimals_with_comma_separator: [0, '.', ','], amount_with_apostrophe_separator: [2, "'", '.'], amount_no_decimals_with_space_separator: [0, ' ', ','], amount_with_space_separator: [2, ' ', ','] };
    var a = map[m[1]] || [2, ',', '.'];
    return fmt.replace(m[0], group(Number(c), a[0], a[1], a[2]));
  }
  function img(src, w) {
    if (!src) return '';
    var s = src.indexOf('//') === 0 ? 'https:' + src : src;
    return s + (s.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }

  /* ---------- popup button colours (theme editor: Popup buttons) ---------- */
  // [view cart bg, text, border, checkout bg, text, border, border width, corner radius]
  var POP = cfg.pop || ['#ffffff', '#121212', '#121212', '#121212', '#ffffff', '#121212', 1, 4];
  function paint(el) {
    var names = ['vc-bg', 'vc-text', 'vc-border', 'co-bg', 'co-text', 'co-border'];
    names.forEach(function (n, i) { if (POP[i]) el.style.setProperty('--ucs-' + n, POP[i]); });
    el.style.setProperty('--ucs-btn-bw', (Number(POP[6]) || 0) + 'px');
    el.style.setProperty('--ucs-btn-radius', (Number(POP[7]) || 0) + 'px');
    // The size picker's buttons use the Checkout colours.
    el.style.setProperty('--ucs-accent', POP[3] || '#121212');
    el.style.setProperty('--ucs-on-accent', POP[4] || '#ffffff');
  }

  /* ---------- find product cards and add the button ---------- */
  var CARDS = cfg.selector || '.card-wrapper, .product-card, .product-card-wrapper, .product-item, .grid-product, .grid-view-item, .product-grid-item, [data-product-card], .card--product, .productitem';
  // Not inside the app's own sections (reviews, bundles, offers…): they have their own buttons.
  var SKIP = '.ucs, .ucro, .ucs-pop, .ucs-toast, cart-drawer, .cart-drawer, #CartDrawer, cart-notification, header, .header, predictive-search, .predictive-search, .product__media-wrapper, .product-media-modal';
  var MEDIA_ORDER = ['.card__media', '.card__inner', '.product-card__image', '.product-card__media', '.product-item__image', '.grid-product__image-wrap', '.media'];

  function handleOf(href) {
    var m = String(href).match(/\/products\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function scan(scope) {
    var links = (scope || document).querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.closest(SKIP)) continue;
      var card = link.closest(CARDS) || (link.querySelector('img') ? link : null);
      if (!card || card.__ucs) continue;
      var image = card.querySelector('img');
      var handle = handleOf(link.getAttribute('href'));
      if (!image || !handle) continue;
      card.__ucs = true;
      // The outer media box, like the Backrooms theme: Dawn's inner ".media" stretches every child
      // to fill it, which would turn the button into a giant oval.
      var host = null;
      for (var k = 0; k < MEDIA_ORDER.length && !host; k++) host = image.closest(MEDIA_ORDER[k]);
      host = host || image.parentElement;
      if (host.matches('.media') && host.parentElement) host = host.parentElement;
      if (host.tagName === 'A' && host !== link) host = host.parentElement;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.classList.add('ucs-qa-host');
      if (cfg.show === 'hover') host.classList.add('ucs-qa-host--hover');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ucs-qa ucs-qa--' + cfg.position;
      btn.setAttribute('data-handle', handle);
      btn.setAttribute('aria-label', T.add + ': ' + (link.textContent || '').trim().slice(0, 80));
      btn.innerHTML = '<span class="ucs-qa__icon">' + (ICONS[cfg.icon] || ICONS.bag) + '</span><span class="ucs-qa__done">' + CHECK + '</span>';
      var size = (Number(cfg.size) || 40) + 'px';
      btn.style.setProperty('--ucs-qa-size', size);
      // Theme rules can't resize or stretch it (some make every child of the image box full-size).
      ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'].forEach(function (p) { btn.style.setProperty(p, size, 'important'); });
      btn.style.setProperty('--ucs-qa-bg', cfg.bg);
      btn.style.setProperty('--ucs-qa-fg', cfg.fg);
      btn.style.setProperty('--ucs-qa-radius', cfg.shape === 'square' ? '8px' : '50%');
      host.appendChild(btn);
    }
  }

  function product(handle) {
    if (!products[handle]) {
      products[handle] = fetch(root + 'products/' + encodeURIComponent(handle) + '.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('product'); return r.json(); });
      products[handle].catch(function () { delete products[handle]; });
    }
    return products[handle];
  }

  /* ---------- add to cart ---------- */
  function cartUI() {
    var el = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    return el && typeof el.renderContents === 'function' && typeof el.getSectionsToRender === 'function' ? el : null;
  }

  function add(variant, p) {
    var ui = cfg.after === 'theme' ? cartUI() : null;
    var body = { items: [{ id: variant.id, quantity: 1 }] };
    var bubble = document.getElementById('cart-icon-bubble');
    if (ui) {
      body.sections = ui.getSectionsToRender().map(function (s) { return s.id; });
      body.sections_url = window.location.pathname;
    } else if (bubble) {
      body.sections = ['cart-icon-bubble'];
    }
    return fetch(url('cart_add_url', 'cart/add') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (!res.ok || d.status) throw new Error(d.description || d.message || T.error);
        if (window.publish && window.PUB_SUB_EVENTS) window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'ucs-quick-add', productVariantId: variant.id, cartData: d });
        document.dispatchEvent(new CustomEvent('ucs:cart:added', { detail: d }));
        if (ui) {
          var last = d.items ? d.items[d.items.length - 1] : d;
          ui.classList.remove('is-empty');
          var inner = ui.querySelector('.drawer__inner.is-empty');
          if (inner) inner.classList.remove('is-empty');
          ui.renderContents(Object.assign({}, d, { key: d.key || (last && last.key), id: last && last.id }));
          return;
        }
        if (bubble && d.sections && d.sections['cart-icon-bubble']) {
          var tmp = document.createElement('div');
          tmp.innerHTML = d.sections['cart-icon-bubble'];
          var fresh = tmp.querySelector('#cart-icon-bubble') || tmp.firstElementChild;
          if (fresh) bubble.innerHTML = fresh.innerHTML;
        }
        if (cfg.after === 'cart') { window.location.href = url('cart_url', 'cart'); return; }
        toast(variant, p);
      });
  }

  /* ---------- "added" popup ---------- */
  var toastEl, hideTimer;
  function toast(variant, p) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ucs-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
      toastEl.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
      toastEl.addEventListener('mouseleave', schedule);
      toastEl.addEventListener('click', function (e) { if (e.target.closest('.ucs-toast__close')) closeToast(); });
    }
    paint(toastEl);
    var src = (variant.featured_image && variant.featured_image.src) || p.featured_image;
    var title = variant.title && variant.title !== 'Default Title' ? variant.title : '';
    // Same layout as the Backrooms theme's cart popup: round close button above the box, green
    // "Added" banner, photo with name and price, then View cart + Checkout side by side.
    toastEl.innerHTML =
      '<button type="button" class="ucs-toast__close" aria-label="' + esc(T.close) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="ucs-toast__head"><span class="ucs-toast__tick">' + CHECK + '</span>' + esc(T.added) + '</div>' +
      '<div class="ucs-toast__item">' + (src ? '<img src="' + img(src, 160) + '" alt="">' : '') +
      '<div><p class="ucs-toast__name">' + esc(p.title) + '</p>' + (title ? '<p class="ucs-toast__meta">' + esc(title) + '</p>' : '') +
      '<p class="ucs-toast__price">' + money(variant.price) + '</p></div></div>' +
      '<div class="ucs-toast__actions' + (cfg.checkout ? '' : ' is-one') + '"><a class="ucs-toast__vc" href="' + url('cart_url', 'cart') + '">' + esc(T.view_cart) + '</a>' +
      (cfg.checkout ? '<a class="ucs-toast__co" href="' + root + 'checkout">' + esc(T.checkout) + '</a>' : '') + '</div>';
    requestAnimationFrame(function () { toastEl.classList.add('is-open'); });
    schedule();
  }
  function schedule() {
    clearTimeout(hideTimer);
    if (cfg.autohide > 0) hideTimer = setTimeout(closeToast, cfg.autohide * 1000);
  }
  function closeToast() { if (toastEl) toastEl.classList.remove('is-open'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- option picker ---------- */
  var popEl, lastTrigger;
  function picker(p, trigger) {
    lastTrigger = trigger;
    var chosen = (p.variants.find(function (v) { return v.available; }) || p.variants[0]).options.slice();
    popEl = document.createElement('div');
    popEl.className = 'ucs-pop';
    popEl.innerHTML = '<div class="ucs-pop__box" role="dialog" aria-modal="true" aria-label="' + esc(T.choose) + '"></div>';
    paint(popEl);
    document.body.appendChild(popEl);
    var box = popEl.firstChild;

    function current() {
      return p.variants.find(function (v) { return v.options.every(function (o, i) { return o === chosen[i]; }); });
    }
    function render() {
      var v = current();
      var src = (v && v.featured_image && v.featured_image.src) || p.featured_image;
      var opts = (p.options || []).map(function (o, i) {
        var name = typeof o === 'string' ? o : o.name;
        var values = typeof o === 'string' ? Array.from(new Set(p.variants.map(function (x) { return x.options[i]; }))) : o.values;
        return '<fieldset class="ucs-pop__opt"><legend>' + esc(name) + '</legend><div class="ucs-pop__vals">' + values.map(function (val) {
          var test = chosen.slice(); test[i] = val;
          var match = p.variants.find(function (x) { return x.options.every(function (o2, j) { return o2 === test[j]; }); });
          var out = !match || !match.available;
          return '<button type="button" class="ucs-pop__val' + (out ? ' is-out' : '') + '" data-i="' + i + '" data-v="' + esc(val) + '" aria-pressed="' + (chosen[i] === val) + '">' + esc(val) + '</button>';
        }).join('') + '</div></fieldset>';
      }).join('');
      var ok = v && v.available;
      box.innerHTML =
        '<div class="ucs-pop__head">' + (src ? '<img class="ucs-pop__img" src="' + img(src, 160) + '" alt="">' : '') +
        '<div><p class="ucs-pop__title">' + esc(p.title) + '</p><div class="ucs-pop__price">' + (v ? money(v.price) + (v.compare_at_price > v.price ? '<s>' + money(v.compare_at_price) + '</s>' : '') : '') + '</div></div>' +
        '<button type="button" class="ucs-pop__close" aria-label="' + esc(T.close) + '">✕</button></div>' + opts +
        '<button type="button" class="ucs-btn ucs-pop__add"' + (ok ? '' : ' disabled') + '>' + esc(ok ? T.add : T.sold_out) + '</button><p class="ucs-pop__err" hidden></p>';
    }
    render();
    var first = box.querySelector('.ucs-pop__val[aria-pressed="true"]') || box.querySelector('button');
    if (first) first.focus();

    popEl.addEventListener('click', function (e) {
      if (e.target === popEl || e.target.closest('.ucs-pop__close')) return closePicker();
      var val = e.target.closest('.ucs-pop__val');
      if (val) {
        chosen[Number(val.getAttribute('data-i'))] = val.getAttribute('data-v');
        render();
        var again = box.querySelector('.ucs-pop__val[data-i="' + val.getAttribute('data-i') + '"][aria-pressed="true"]');
        if (again) again.focus();
        return;
      }
      var addBtn = e.target.closest('.ucs-pop__add');
      if (addBtn) {
        var v = current();
        if (!v || !v.available) return;
        addBtn.setAttribute('aria-busy', 'true');
        add(v, p).then(function () { closePicker(); mark(trigger); }).catch(function (err) {
          addBtn.removeAttribute('aria-busy');
          var msg = box.querySelector('.ucs-pop__err');
          msg.hidden = false;
          msg.textContent = err.message || T.error;
        });
      }
    });
  }
  function closePicker() {
    if (!popEl) return;
    popEl.remove();
    popEl = null;
    if (lastTrigger) lastTrigger.focus();
  }
  function mark(btn) {
    if (!cfg.addedState || !btn) return;
    btn.classList.add('is-added');
    setTimeout(function () { btn.classList.remove('is-added'); }, 2000);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closePicker(); closeToast(); }
    if (e.key === 'Tab' && popEl) {
      var f = popEl.querySelectorAll('button:not([disabled])');
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.ucs-qa');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled || btn.getAttribute('aria-busy') === 'true') return;
    btn.setAttribute('aria-busy', 'true');
    product(btn.getAttribute('data-handle'))
      .then(function (p) {
        var available = p.variants.filter(function (v) { return v.available; });
        if (!available.length) {
          btn.disabled = true;
          btn.setAttribute('aria-label', T.sold_out);
          return;
        }
        if (p.variants.length === 1) return add(p.variants[0], p).then(function () { mark(btn); });
        picker(p, btn);
      })
      .catch(function (err) { console.error('[ucs quick add]', err); window.location.href = root + 'products/' + btn.getAttribute('data-handle'); })
      .then(function () { btn.removeAttribute('aria-busy'); });
  }, true);

  /* ---------- run now and for cards loaded later (filters, infinite scroll, recommendations) ---------- */
  function start() {
    scan(document);
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; scan(document); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
