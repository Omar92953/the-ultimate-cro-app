/*
 * CRO Toolbox — shared storefront helpers (window.UCRO).
 * Loaded by every block with `defer`, before the feature script, so it may run more than once;
 * the guard keeps one copy. No theme is assumed: Dawn-family globals are used when present.
 */
(function () {
  if (window.UCRO) return;

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var R = window.routes || {};

  function route(key, fallback) {
    return R[key] || (root + fallback).replace(/\/+/g, '/');
  }

  /* ---- Money: Shopify's classic formatMoney, driven by shop.money_format ---------- */
  function group(cents, decimals, thousands, point) {
    if (cents == null || isNaN(cents)) return '0';
    var fixed = (cents / 100).toFixed(decimals).split('.');
    return fixed[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + thousands) + (fixed[1] ? point + fixed[1] : '');
  }

  function money(cents, format) {
    var fmt = String(format || '{{amount}}').replace(/<[^>]*>/g, '');
    var re = /\{\{\s*(\w+)\s*\}\}/;
    var m = fmt.match(re);
    if (!m) return fmt;
    var n = Number(cents);
    var v;
    switch (m[1]) {
      case 'amount_no_decimals': v = group(n, 0, ',', '.'); break;
      case 'amount_with_comma_separator': v = group(n, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': v = group(n, 0, '.', ','); break;
      case 'amount_with_apostrophe_separator': v = group(n, 2, "'", '.'); break;
      case 'amount_no_decimals_with_space_separator': v = group(n, 0, ' ', ','); break;
      case 'amount_with_space_separator': v = group(n, 2, ' ', ','); break;
      case 'amount_with_period_and_space_separator': v = group(n, 2, ' ', '.'); break;
      default: v = group(n, 2, ',', '.');
    }
    return fmt.replace(re, v);
  }

  /* ---- Look: borrow the theme's own button and price classes ------------------------ */
  // Classes not to copy: states, and width helpers (our small buttons must not stretch).
  var STATE_CLASSES = /^(loading|disabled|is-loading|is-disabled|hidden|visually-hidden|js-.*|.*full-width.*|.*--full|.*--block|btn-block|w-full)$/;

  function themeButton(scope) {
    var sel = 'form[action*="/cart/add"] [type="submit"]:not([name="checkout"])';
    return (scope && scope.querySelector(sel)) || document.querySelector(sel) ||
      document.querySelector('.shopify-section .button:not(.ucro-btn), .shopify-section .btn:not(.ucro-btn)');
  }

  function styleButton(btn, scope) {
    if (!btn || btn.dataset.ucroStyled) return;
    btn.dataset.ucroStyled = '1';
    var source = themeButton(scope);
    if (source) {
      source.className.split(/\s+/).forEach(function (c) {
        if (c && !STATE_CLASSES.test(c)) btn.classList.add(c);
      });
    } else {
      btn.classList.add('ucro-btn--fallback');
    }
  }

  function solid(color) {
    return color && color !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(color);
  }

  // Relative luminance (WCAG) of an "rgb(a)(r, g, b…)" string.
  function luminance(color) {
    var m = String(color).match(/[\d.]+/g);
    if (!m || m.length < 3) return 1;
    var c = m.slice(0, 3).map(function (v) {
      v = Number(v) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  // The accent follows the theme's real Add to cart colour unless the merchant picked one.
  // Outline-style buttons have a background equal to the page, so fall back to their text
  // colour; the tick/label on the accent is black or white, whichever is readable.
  function accent(el, scope) {
    if (!el) return;
    var page = 'rgb(255, 255, 255)';
    // A theme colour scheme picked in the app colours the block itself (ucro.css maps it).
    var scheme = el.classList.contains('ucro-scheme');
    for (var n = scheme ? el : el.parentElement; n; n = n.parentElement) {
      var bg = getComputedStyle(n).backgroundColor;
      if (solid(bg)) {
        page = bg;
        break;
      }
    }
    el.style.setProperty('--ucro-bg', page);

    var chosen = el.style.getPropertyValue('--ucro-accent').trim();
    if (!chosen && !scheme) {
      var source = themeButton(scope);
      if (source) {
        var cs = getComputedStyle(source);
        if (solid(cs.backgroundColor) && contrast(cs.backgroundColor, page) >= 1.6) chosen = cs.backgroundColor;
        else if (solid(cs.color) && contrast(cs.color, page) >= 1.6) chosen = cs.color;
      }
      if (chosen) el.style.setProperty('--ucro-accent', chosen);
    }
    if (chosen) {
      var probe = document.createElement('span');
      probe.style.color = chosen;
      el.appendChild(probe);
      var resolved = getComputedStyle(probe).color;
      probe.remove();
      el.style.setProperty('--ucro-on-text', luminance(resolved) > 0.45 ? '#111' : '#fff');
      // Text in the accent colour must stay readable on the page (e.g. a yellow button theme).
      el.style.setProperty('--ucro-accent-text', contrast(resolved, page) >= 3 ? resolved : getComputedStyle(el).color);
    }
  }

  // Most specific first: the price text element, not its wrapper.
  var PRICE_SELECTORS = ['.price-item--regular', '.price-item', '.product__price', '.product-single__price', '[data-product-price]', '.price'];

  function stylePrices(el, scope) {
    var source = null;
    for (var i = 0; i < PRICE_SELECTORS.length && !source; i++) {
      source = (scope && scope.querySelector(PRICE_SELECTORS[i])) || document.querySelector('.product ' + PRICE_SELECTORS[i]);
    }
    if (!source) return;
    var classes = source.className.split(/\s+/).filter(function (c) { return c && !STATE_CLASSES.test(c) && !/sale|compare/.test(c); });
    el.querySelectorAll('[data-ucro-price]').forEach(function (p) {
      classes.forEach(function (c) { p.classList.add(c); });
    });
  }

  // Corner radius of the theme's own option controls (variant pills, inputs), else its buttons.
  var RADIUS_SOURCES = [
    'variant-selects label', 'variant-radios label', '.product-form__input label', '[class*="swatch"] label',
    '.select__select', '.field__input', 'select', 'input[type="text"]', 'input[type="email"]'
  ];

  function themeRadius(scope) {
    for (var i = 0; i < RADIUS_SOURCES.length; i++) {
      var node = (scope && scope.querySelector(RADIUS_SOURCES[i])) || document.querySelector(RADIUS_SOURCES[i]);
      if (node && !node.closest('.ucro')) return parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
    }
    var btn = themeButton(scope);
    return btn ? parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 0 : null;
  }

  // Headings copy the theme's product title (or first heading) so they read as part of the page.
  function headingStyle(el, scope) {
    var src = (scope && scope.querySelector('.product__title h1, .product__title, .product-single__title, h1')) ||
      document.querySelector('main h1, main h2, h1');
    if (!src || src.closest('.ucro')) return;
    var cs = getComputedStyle(src);
    el.style.setProperty('--ucro-heading-font', cs.fontFamily);
    el.style.setProperty('--ucro-heading-weight', cs.fontWeight);
    el.style.setProperty('--ucro-heading-style', cs.fontStyle);
    el.style.setProperty('--ucro-heading-spacing', cs.letterSpacing);
    el.style.setProperty('--ucro-heading-transform', cs.textTransform);
  }

  function decorate(el) {
    var scope = el.closest('.shopify-section') || document;
    el.querySelectorAll('.ucro-btn').forEach(function (b) { styleButton(b, scope); });
    stylePrices(el, scope);
    accent(el, scope);
    headingStyle(el, scope);
    if (el.dataset.radius !== 'custom') {
      var r = themeRadius(scope);
      // Pill-shaped themes (999px) would turn cards into capsules; cap at a card-friendly 24px.
      if (r !== null) el.style.setProperty('--ucro-radius', Math.min(r, 24) + 'px');
    }
  }

  /* ---- The product form this block belongs to ------------------------------------- */
  function productForm(from) {
    var section = from && from.closest('.shopify-section');
    var sel = 'form[action*="/cart/add"]';
    var candidates = Array.prototype.slice.call((section || document).querySelectorAll(sel));
    if (!candidates.length && section) candidates = Array.prototype.slice.call(document.querySelectorAll(sel));
    candidates = candidates.filter(function (f) {
      return !f.closest('cart-drawer, .drawer, [id*="quick" i], [class*="quick-add" i], [class*="quickshop" i]') &&
        !/installment/i.test((f.getAttribute('id') || '') + ' ' + f.className);
    });
    // Dawn-family themes render a hidden "installment" /cart/add form before the real one.
    // The real product form is the one with an Add to cart (submit) button.
    var withSubmit = candidates.filter(function (f) {
      var id = f.getAttribute('id');
      return f.querySelector('[type="submit"], [name="add"]') ||
        (id && document.querySelector('[type="submit"][form="' + id + '"], [name="add"][form="' + id + '"]'));
    });
    return withSubmit[0] || candidates[0] || null;
  }

  /* ---- Cart --------------------------------------------------------------------- */
  function cartUI() {
    var el = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    return el && typeof el.renderContents === 'function' && typeof el.getSectionsToRender === 'function' ? el : null;
  }

  // Adds items ({id, quantity, properties}) in one request, then refreshes the theme's cart.
  // Dawn-family themes: re-render their drawer/notification. Anything else: go to /cart.
  // `source`: which widget added it (`_source` line property), so the app can credit its revenue.
  function add(items, source) {
    var ui = cartUI();
    var body = { items: items.map(function (i) { return Object.assign({}, i, { properties: Object.assign({ _source: source || 'cro' }, i.properties || {}) }); }) };
    if (ui) {
      body.sections = ui.getSectionsToRender().map(function (s) { return s.id; });
      body.sections_url = window.location.pathname;
      if (typeof ui.setActiveElement === 'function') ui.setActiveElement(document.activeElement);
    }
    return fetch(route('cart_add_url', 'cart/add') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        var data = res.data || {};
        if (!res.ok || data.status) {
          if (window.publish && window.PUB_SUB_EVENTS) window.publish(window.PUB_SUB_EVENTS.cartError, { source: 'ucro', errors: data.description || data.message });
          throw new Error(data.description || data.message || 'error');
        }
        if (window.publish && window.PUB_SUB_EVENTS) window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'ucro', cartData: data });
        document.dispatchEvent(new CustomEvent('ucro:cart:added', { detail: data }));
        if (ui) {
          var last = data.items ? data.items[data.items.length - 1] : data;
          ui.classList.remove('is-empty');
          var inner = ui.querySelector('.drawer__inner.is-empty');
          if (inner) inner.classList.remove('is-empty');
          ui.renderContents(Object.assign({}, data, { key: data.key || (last && last.key), id: last && last.id }));
        } else {
          window.location.href = route('cart_url', 'cart');
        }
        return data;
      });
  }

  function cart() {
    return fetch(route('cart_url', 'cart') + '.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
  }

  function recommendations(productId, intent, limit) {
    var url = route('product_recommendations_url', 'recommendations/products') + '.json?product_id=' +
      encodeURIComponent(productId) + '&limit=' + (limit || 4) + '&intent=' + intent;
    return fetch(url).then(function (r) { return r.ok ? r.json() : { products: [] }; })
      .then(function (d) { return d.products || []; })
      .catch(function () { return []; });
  }

  function img(url, width) {
    if (!url) return '';
    var u = url.indexOf('//') === 0 ? 'https:' + url : url;
    return u + (u.indexOf('?') > -1 ? '&' : '?') + 'width=' + width;
  }

  /*
   * Mix & match bundle price, the same way the cro-bundles Cart Transform charges it (keep in sync):
   * b = { k: 'fixed'|'percent'|'tiers'|'percent_tiers'|'amount_tiers', pr: bundle product price
   *       (cents, shopper's currency), pc: percent, tr: [[count, cents]], pt: [[min count, percent]],
   *       at: [[min count, cents off]], ex: { 'xl': cents } } (tr, at and ex in the store's currency)
   * picks = [{ cents, vt: 'XL / Red' }]. Returns { value, price, next, more } — price is null when the
   * number of items doesn't match a tier; next = the item count of the next tier; more (growing
   * discounts) = { count: items still to add, pct | cents: the next tier's discount } or null.
   */
  function bundlePrice(b, picks) {
    var rate = (window.Shopify && window.Shopify.currency && Number(window.Shopify.currency.rate)) || 1;
    var value = picks.reduce(function (t, p) { return t + (Number(p.cents) || 0); }, 0);
    var tiers = Array.isArray(b.tr) ? b.tr : [];
    var n = picks.length;
    var nextTier = tiers.filter(function (t) { return t[0] >= n; })[0];
    var next = nextTier ? nextTier[0] : null;
    if (b.k === 'percent') return { value: value, price: Math.round(value * (1 - (Number(b.pc) || 0) / 100)), next: next };
    if (b.k === 'percent_tiers' || b.k === 'amount_tiers') {
      // The highest tier reached applies; the next one tells shoppers what one more item earns.
      var pct = b.k === 'percent_tiers';
      var list = (pct ? b.pt : b.at) || [];
      var reached = null, up = null;
      list.forEach(function (t) {
        if (t[0] <= n && (!reached || t[0] >= reached[0])) reached = t;
        if (t[0] > n && (!up || t[0] < up[0])) up = t;
      });
      // % tiers: round the final price, not the discount, the way checkout does (else a cent off).
      var off = reached ? (pct ? value - Math.round(value * (100 - reached[1]) / 100) : Math.round(reached[1] * rate)) : 0;
      var more = up ? { count: up[0] - n, pct: pct ? up[1] : null, cents: pct ? null : Math.round(up[1] * rate) } : null;
      return { value: value, price: Math.max(0, value - Math.min(off, value)), next: up ? up[0] : null, more: more };
    }
    var extra = 0;
    var ex = b.ex || {};
    picks.forEach(function (p) {
      String(p.vt || '').toLowerCase().split(' / ').forEach(function (part) {
        part = part.trim();
        if (Object.prototype.hasOwnProperty.call(ex, part)) extra += Number(ex[part]) || 0;
      });
    });
    var base;
    if (b.k === 'tiers') {
      var hit = tiers.filter(function (t) { return t[0] === n; })[0];
      if (!hit) return { value: value, price: null, next: next };
      base = hit[1] * rate;
    } else {
      base = Number(b.pr) || 0;
    }
    var price = Math.round(base + extra * rate);
    return { value: value, price: value ? Math.min(price, value) : price, next: next };
  }

  window.UCRO = {
    money: money, add: add, cart: cart, recommendations: recommendations, img: img,
    decorate: decorate, styleButton: styleButton, productForm: productForm, route: route, bundlePrice: bundlePrice
  };
})();
