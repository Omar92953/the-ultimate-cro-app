/*
 * CRO Toolbox — mix & match bundles built anywhere in the store.
 *
 * - "Add to bundle" (product page block) adds the selected variant to the bundle it fits.
 * - On a step's collection page every product card gets "+ Add to bundle" (sizes and colours in a
 *   small picker), so shoppers browse the whole collection with the theme's own filters.
 * - The bundle tray follows the shopper (remembered in this browser): progress per step, picks with
 *   remove, "Browse more" links, and Add bundle to cart / Checkout once it is complete.
 *
 * The picks go into the cart as their own lines with "_bundle" = "<bundle product id>:<group>:<step>";
 * the cro-bundles Cart Transform checks them and merges them at the bundle price (see
 * ucro-bundle.js, which writes the same property). "line" mode: one bundle product line instead.
 */
(function () {
  var U = window.UCRO;
  var dataEl = document.getElementById('ucro-bt-data');
  if (!U || !dataEl || window.__ucroBundleTray) return;
  window.__ucroBundleTray = true;

  var D;
  try {
    D = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }
  var KEY = 'ucro-bundle-tray';
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var state = load();
  var tray, toastTimer;

  /* ---- state ---------------------------------------------------------------- */
  function bundleOf(id) {
    return D.b.find(function (b) { return String(b.id) === String(id); }) || null;
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && bundleOf(s.b) && Array.isArray(s.picks)) return s;
    } catch (e) {
      // storage unavailable: the tray lives for this page only
    }
    return null;
  }
  function save() {
    try {
      if (state) localStorage.setItem(KEY, JSON.stringify(state));
      else localStorage.removeItem(KEY);
    } catch (e) {
      // storage unavailable
    }
  }
  function counts(b) {
    return b.s.map(function (s, i) { return state ? state.picks.filter(function (p) { return p.s === i; }).length : 0; });
  }
  function maxOf(step) {
    return Math.max(step.x || 0, step.n || 0, 1);
  }
  function remaining(b) {
    var c = counts(b);
    return b.s.reduce(function (n, s, i) { return n + Math.max(0, s.n - c[i]); }, 0);
  }
  function money(cents) {
    return U.money(cents, D.fmt);
  }
  function fill(text, map) {
    return String(text || '').replace(/\[(\w+)\]/g, function (m, k) { return k in map ? map[k] : m; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function bundlePrice(b, value) {
    if (b.k === 'percent') return Math.round(value * (1 - (Number(b.pc) || 0) / 100));
    return Math.min(b.pr, value || b.pr);
  }

  /** Adds one variant to a bundle step; returns false (with a message) when it can't. */
  function addPick(b, stepIndex, item) {
    if (state && String(state.b) !== String(b.id)) {
      if (!window.confirm('Start a new “' + b.n + '” bundle? Your current bundle will be cleared.')) return false;
      state = null;
    }
    if (!state) state = { b: b.id, g: Math.random().toString(36).slice(2, 10), picks: [] };
    var step = b.s[stepIndex];
    if (counts(b)[stepIndex] >= maxOf(step)) {
      toast('“' + step.l + '” is full. Remove an item to swap it.');
      open(true);
      return false;
    }
    if (!b.d && state.picks.some(function (p) { return String(p.v) === String(item.v); })) {
      toast('Already in your bundle.');
      open(true);
      return false;
    }
    state.picks.push({ v: item.v, s: stepIndex, t: item.t, i: item.i, c: item.c, h: item.h });
    save();
    render();
    open(true);
    toast('Added to your bundle.');
    markCards();
    return true;
  }

  /* ---- product data ----------------------------------------------------------- */
  var cache = {};
  function product(handle) {
    if (!cache[handle]) {
      cache[handle] = fetch(root + 'products/' + encodeURIComponent(handle) + '.js', { headers: { Accept: 'application/json' } }).then(function (r) {
        if (!r.ok) throw new Error('product');
        return r.json();
      });
    }
    return cache[handle];
  }
  function itemOf(p, variant) {
    var img = (variant.featured_image && variant.featured_image.src) || p.featured_image || '';
    var title = p.title + (p.variants.length > 1 && variant.title ? ' · ' + variant.title : '');
    return { v: variant.id, t: title, i: img ? U.img(img, 160) : '', c: variant.price, h: p.handle };
  }

  /* ---- the bundle tray ----------------------------------------------------------- */
  function render() {
    var b = state && bundleOf(state.b);
    if (!b) {
      if (tray) tray.hidden = true;
      return;
    }
    if (!tray) {
      tray = document.createElement('aside');
      tray.className = 'ucro ucro-bt ucro-bt--' + (D.tp === 'right' ? 'right' : 'bottom') + (D.cls || '');
      tray.setAttribute('style', D.css || '');
      tray.setAttribute('aria-label', 'Your bundle');
      document.body.appendChild(tray);
      tray.addEventListener('click', onTrayClick);
      U.decorate(tray);
    }
    tray.hidden = false;
    var c = counts(b);
    var left = remaining(b);
    var value = state.picks.reduce(function (n, p) { return n + (Number(p.c) || 0); }, 0);
    var price = bundlePrice(b, value);
    var total = b.s.reduce(function (n, s) { return n + maxOf(s); }, 0);
    var thumbs = state.picks.slice(0, 5).map(function (p) { return p.i ? '<img src="' + esc(p.i) + '" alt="" width="36" height="36">' : '<span class="ucro-bt__ph"></span>'; }).join('');

    var steps = b.s.map(function (s, i) {
      var picks = state.picks.map(function (p, n) { return { p: p, n: n }; }).filter(function (x) { return x.p.s === i; });
      var full = c[i] >= maxOf(s);
      return '<div class="ucro-bt__step">' +
        '<div class="ucro-bt__step-head"><strong>' + esc(s.l) + '</strong><span>' + c[i] + ' / ' + maxOf(s) + (s.n === 0 ? ' · optional' : '') + '</span></div>' +
        (picks.length ? '<ul class="ucro-bt__picks" role="list">' + picks.map(function (x) {
          return '<li>' + (x.p.i ? '<img src="' + esc(x.p.i) + '" alt="" width="44" height="44">' : '<span class="ucro-bt__ph"></span>') +
            '<span class="ucro-bt__name">' + esc(x.p.t) + '<small>' + money(x.p.c) + '</small></span>' +
            '<button type="button" class="ucro-bt__remove" data-remove="' + x.n + '" aria-label="Remove ' + esc(x.p.t) + '">×</button></li>';
        }).join('') + '</ul>' : '') +
        (!full ? '<a class="ucro-bt__browse" href="' + esc(s.cu || b.u) + '">Browse more →</a>' : '') +
        '</div>';
    }).join('');

    tray.innerHTML =
      '<button type="button" class="ucro-bt__bar" data-toggle aria-expanded="' + (state.open ? 'true' : 'false') + '">' +
        '<span class="ucro-bt__thumbs">' + thumbs + '</span>' +
        '<span class="ucro-bt__title"><strong>' + esc(b.n) + '</strong><span>' + state.picks.length + ' of ' + (total || state.picks.length) + ' chosen' + (left ? '' : ' · ready') + '</span></span>' +
        '<span class="ucro-bt__chev" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="ucro-bt__panel"' + (state.open ? '' : ' hidden') + '>' +
        '<div class="ucro-bt__steps">' + steps + '</div>' +
        '<div class="ucro-bt__foot">' +
          '<p class="ucro-bt__total">' + (value > price ? '<s>' + money(value) + '</s> ' : '') + '<strong>' + money(price) + '</strong>' + (value > price ? ' <span class="ucro-bt__save">You save ' + money(value - price) + '</span>' : '') + '</p>' +
          '<div class="ucro-bt__actions">' +
            '<button type="button" class="ucro-btn ucro-bt__cart" data-cart' + (left ? ' disabled' : '') + '>' + esc(left ? fill(D.t.more, { remaining: left }) : D.t.cart) + '</button>' +
            (left ? '' : '<button type="button" class="ucro-btn ucro-bt__go" data-go>' + esc(D.t.go) + '</button>') +
          '</div>' +
          '<button type="button" class="ucro-bt__clear" data-clear>Clear bundle</button>' +
          '<p class="ucro__error" role="alert" hidden></p>' +
        '</div>' +
      '</div>' +
      '<p class="ucro-bt__toast" role="status" aria-live="polite"></p>';
    tray.querySelectorAll('.ucro-btn').forEach(function (btn) { U.styleButton(btn, document); });
  }

  function open(on) {
    if (!state) return;
    state.open = on;
    save();
    var panel = tray && tray.querySelector('.ucro-bt__panel');
    if (panel) panel.hidden = !on;
    var bar = tray && tray.querySelector('[data-toggle]');
    if (bar) bar.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function toast(text) {
    var t = tray && tray.querySelector('.ucro-bt__toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  function onTrayClick(e) {
    var b = state && bundleOf(state.b);
    if (!b) return;
    if (e.target.closest('[data-toggle]')) return open(!state.open);
    var rm = e.target.closest('[data-remove]');
    if (rm) {
      state.picks.splice(Number(rm.getAttribute('data-remove')), 1);
      if (!state.picks.length) state = null;
      save();
      render();
      markCards();
      return;
    }
    if (e.target.closest('[data-clear]')) {
      state = null;
      save();
      render();
      markCards();
      return;
    }
    var go = e.target.closest('[data-go]');
    if (go || e.target.closest('[data-cart]')) checkout(b, !!go);
  }

  /** Adds the finished bundle to the cart, then opens the cart (or checkout). */
  function checkout(b, toCheckout) {
    if (remaining(b) || tray.classList.contains('is-busy')) return;
    var items;
    if (D.mode === 'line') {
      var props = {};
      b.s.forEach(function (s, i) {
        var names = state.picks.filter(function (p) { return p.s === i; }).map(function (p) { return p.t; });
        if (names.length) props[s.l || 'Items'] = names.join(', ');
      });
      items = [{ id: b.v, quantity: 1, properties: props }];
    } else {
      items = state.picks.map(function (p) { return { id: Number(p.v), quantity: 1, properties: { _bundle: b.id + ':' + state.g + ':' + p.s } }; });
    }
    tray.classList.add('is-busy');
    U.add(items)
      .then(function () {
        // The theme's cart drawer opens (or the cart page, when there's no drawer).
        state = null;
        save();
        render();
        markCards();
        if (toCheckout) window.location.href = root + 'checkout';
      })
      .catch(function (err) {
        var box = tray.querySelector('.ucro__error');
        if (box) {
          box.textContent = (err && err.message !== 'error' && err.message) || 'Something went wrong. Please try again.';
          box.hidden = false;
        }
      })
      .finally(function () { if (tray) tray.classList.remove('is-busy'); });
  }

  /* ---- choosing: which bundle, which size ------------------------------------------- */
  var dialog;
  function choose(title, options, onPick) {
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.className = 'ucro ucro-bt-choose' + (D.cls || '');
      dialog.setAttribute('style', D.css || '');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.hidden = true;
      document.body.appendChild(dialog);
      dialog.addEventListener('click', function (e) {
        if (e.target === dialog || e.target.closest('[data-close]')) close();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dialog.hidden) close(); });
    }
    dialog.innerHTML = '<div class="ucro-bt-choose__box"><div class="ucro-bt-choose__head"><strong>' + esc(title) + '</strong><button type="button" data-close aria-label="Close">×</button></div>' +
      options.map(function (o, i) { return '<button type="button" class="ucro-bt-choose__opt" data-opt="' + i + '"' + (o.disabled ? ' disabled' : '') + '>' + o.html + '</button>'; }).join('') + '</div>';
    dialog.querySelectorAll('[data-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        close();
        onPick(options[Number(btn.getAttribute('data-opt'))]);
      });
    });
    dialog.hidden = false;
    var first = dialog.querySelector('[data-opt]:not([disabled])');
    if (first) first.focus();
  }
  function close() {
    if (dialog) dialog.hidden = true;
  }

  /** fits: [{ b, s }] places this product fits. Prefers the bundle being built; asks otherwise. */
  function pickPlace(fits, then) {
    if (state) {
      var current = fits.filter(function (f) { return String(f.b.id) === String(state.b) && counts(f.b)[f.s] < maxOf(f.b.s[f.s]); });
      if (current.length) return then(current[0]);
    }
    if (fits.length === 1) return then(fits[0]);
    choose('Add to which bundle?', fits.map(function (f) {
      return { f: f, html: '<strong>' + esc(f.b.n) + '</strong><span>' + esc(f.b.s[f.s].l) + '</span>' };
    }), function (o) { then(o.f); });
  }

  /** Adds a product card's product: straight away with one variant, else a size/colour picker. */
  function addFromCard(handle, fits) {
    product(handle).then(function (p) {
      var available = p.variants.filter(function (v) { return v.available; });
      if (!available.length) return toast('Sold out.');
      pickPlace(fits, function (f) {
        if (available.length === 1) return addPick(f.b, f.s, itemOf(p, available[0]));
        choose(p.title, p.variants.map(function (v) {
          return { v: v, disabled: !v.available, html: '<strong>' + esc(v.title) + '</strong><span>' + (v.available ? money(v.price) : 'Sold out') + '</span>' };
        }), function (o) { addPick(f.b, f.s, itemOf(p, o.v)); });
      });
    }).catch(function () { toast('Something went wrong. Please try again.'); });
  }

  /* ---- "Add to bundle" on product pages ---------------------------------------------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-ucro-atb] .ucro-atb__btn');
    if (!btn) return;
    var host = btn.closest('[data-ucro-atb]');
    var fits = String(host.getAttribute('data-fits') || '').split(',').filter(Boolean).map(function (x) {
      var parts = x.split(':');
      var b = bundleOf(parts[0]);
      return b && b.s[Number(parts[1])] ? { b: b, s: Number(parts[1]) } : null;
    }).filter(Boolean).sort(function (a, b) { return (b.b.s[b.s].h ? 1 : 0) - (a.b.s[a.s].h ? 1 : 0); }); // named steps first
    if (!fits.length) return;
    var form = U.productForm(host);
    var idInput = form && form.querySelector('[name="id"]');
    var handle = host.getAttribute('data-handle');
    product(handle).then(function (p) {
      var variant = p.variants.find(function (v) { return idInput && String(v.id) === String(idInput.value); }) || p.variants.find(function (v) { return v.available; });
      if (!variant || !variant.available) return toast('This option is sold out.');
      pickPlace(fits, function (f) { addPick(f.b, f.s, itemOf(p, variant)); });
    }).catch(function () { toast('Something went wrong. Please try again.'); });
  });

  /* ---- "+ Add to bundle" on product cards ------------------------------------------------- */
  /** The places a card's product fits on this page: the steps whose collection this is, or product lists. */
  function cardFits(handle) {
    var named = [];
    var inCollection = [];
    D.b.forEach(function (b) {
      b.s.forEach(function (s, i) {
        if (s.h && s.h.indexOf(handle) >= 0) named.push({ b: b, s: i });
        else if (s.c && D.page === 'collection' && String(s.c) === String(D.col)) inCollection.push({ b: b, s: i });
      });
    });
    return named.concat(inCollection); // a step that names the product comes first
  }
  function handleOf(a) {
    var m = /\/products\/([^/?#]+)/.exec(a.getAttribute('href') || '');
    return m ? decodeURIComponent(m[1]) : null;
  }
  var CARD = '.card-wrapper, .product-card-wrapper, .product-card, .card, .grid-product, .product-item, .product-grid-item, [class*="product-card"], li';
  /** One entry per product card: the outermost card element around a product link (themes link both the picture and the title). */
  function cards() {
    var main = document.querySelector('main, #MainContent') || document.body;
    var out = [];
    main.querySelectorAll('a[href*="/products/"]').forEach(function (a) {
      if (a.closest('.ucro, [data-ucro-atb], .ucro-bt, .ucro-bt-choose')) return;
      var handle = handleOf(a);
      var card = a.closest(CARD);
      if (!handle || !card || card === main) return;
      // Climb to the outermost card that still holds only this product.
      for (var up = card.parentElement && card.parentElement.closest(CARD); up && up !== main && main.contains(up); up = up.parentElement && up.parentElement.closest(CARD)) {
        var others = Array.prototype.some.call(up.querySelectorAll('a[href*="/products/"]'), function (x) { return handleOf(x) !== handle; });
        if (others) break;
        card = up;
      }
      if (card.hasAttribute('data-ucro-bt-card') || card.querySelector('[data-ucro-bt-card], .ucro-atb-card') || card.closest('[data-ucro-bt-card]')) return;
      if (!card.querySelector('img')) return;
      card.setAttribute('data-ucro-bt-card', handle);
      out.push({ card: card, handle: handle });
    });
    return out;
  }
  function decorateCards() {
    cards().forEach(function (x) {
      var fits = cardFits(x.handle);
      if (!fits.length) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ucro-atb-card';
      btn.setAttribute('data-handle', x.handle);
      btn.textContent = '+ ' + D.t.add;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        addFromCard(x.handle, cardFits(x.handle));
      });
      // Under the price (inside the card's text area), so it stays within the theme's card height.
      var price = x.card.querySelector('.price, [class*="price"]');
      var block = price && (price.closest('div, p') || price);
      if (block && x.card.contains(block) && block !== x.card) block.insertAdjacentElement('afterend', btn);
      else x.card.appendChild(btn);
    });
    markCards();
  }
  function markCards() {
    var picked = {};
    if (state) state.picks.forEach(function (p) { picked[p.h] = true; });
    document.querySelectorAll('.ucro-atb-card').forEach(function (btn) {
      var on = !!picked[btn.getAttribute('data-handle')];
      btn.classList.toggle('is-in', on);
      btn.textContent = on ? '✓ In your bundle' : '+ ' + D.t.add;
    });
  }

  function init() {
    // "Add to bundle" looks like the theme's own buttons (its secondary style when it has one).
    document.querySelectorAll('[data-ucro-atb] .ucro-atb__btn').forEach(function (b) {
      U.styleButton(b, b.closest('.shopify-section') || document);
      if (b.classList.contains('button')) b.classList.add('button--secondary');
    });
    // On phones the open tray would cover the page you just opened: start closed (one tap opens it).
    if (state && state.open && window.matchMedia && window.matchMedia('(max-width: 749px)').matches) state.open = false;
    render();
    decorateCards();
    // Filters, sorting and infinite scroll redraw the grid.
    var main = document.querySelector('main, #MainContent');
    if (main && window.MutationObserver) {
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          decorateCards();
        });
      }).observe(main, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
