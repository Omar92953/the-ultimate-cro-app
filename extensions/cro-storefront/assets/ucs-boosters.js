/*
 * Ultimate CRO — conversion boosters (app embed): sticky add to cart, stock urgency, trust badges
 * and sales pop-ups. Settings come from the app (Boosters page) via #ucs-boost. Everything shown
 * is real: stock from the store, purchases from real orders.
 */
(function () {
  if (window.__ucsBoost) return;
  window.__ucsBoost = true;
  var el = document.getElementById('ucs-boost');
  if (!el) return;
  var data = JSON.parse(el.textContent);
  var D = {
    sticky: { enabled: true, devices: 'all', position: 'bottom', showImage: true, showOptions: true, buttonText: 'Add to cart', soldOutText: 'Sold out', bg: '#ffffff', fg: '#121212', buttonBg: '', buttonFg: '' },
    urgency: { enabled: true, threshold: 10, text: 'Hurry! Only {count} left in stock', lastOneText: 'Last one in stock!', showBar: true, color: '#b42318' },
    trust: { enabled: true, heading: '', badges: [{ key: 'secure', label: 'Secure checkout' }, { key: 'shipping', label: 'Fast delivery' }, { key: 'returns', label: 'Free returns' }, { key: 'cod', label: 'Cash on delivery' }], showPayments: true, style: 'row', color: '#303030' },
    salesPop: { enabled: true, position: 'bottom-left', firstDelay: 8, gap: 20, perVisit: 5, showCity: false, text: 'Someone{city} bought {product}', maxAgeDays: 7, devices: 'all' },
  };
  var C = {};
  for (var k in D) C[k] = Object.assign({}, D[k], (data.cfg || {})[k] || {});
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var mobile = function () { return window.matchMedia('(max-width: 749px)').matches; };
  var onDevice = function (d) { return d === 'all' || (d === 'mobile') === mobile(); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var session = function (fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } };

  function money(c) {
    var fmt = String(data.fmt || '{{amount}}').replace(/<[^>]*>/g, '');
    var m = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
    if (!m) return fmt;
    var map = { amount_no_decimals: [0, ',', '.'], amount_with_comma_separator: [2, '.', ','], amount_no_decimals_with_comma_separator: [0, '.', ','], amount_with_apostrophe_separator: [2, "'", '.'], amount_no_decimals_with_space_separator: [0, ' ', ','], amount_with_space_separator: [2, ' ', ','] };
    var a = map[m[1]] || [2, ',', '.'];
    var p = (Number(c) / 100).toFixed(a[0]).split('.');
    return fmt.replace(m[0], p[0].replace(/\B(?=(\d{3})+(?!\d))/g, a[1]) + (p[1] ? a[2] + p[1] : ''));
  }

  /* ---------- the theme's main product form ---------- */
  var form = null, idInput = null, buyButton = null;
  if (data.page === 'product') {
    var forms = document.querySelectorAll('form[action*="/cart/add"]');
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      if (/installment/i.test(f.id) || f.closest('.ucs, [class*="ucro"], cart-drawer, .cart-drawer')) continue;
      if (f.querySelector('[type="submit"], button[name="add"]')) { form = f; break; }
    }
    if (form) {
      idInput = form.querySelector('[name="id"]');
      buyButton = form.querySelector('[type="submit"], button[name="add"]');
    }
  }
  var currentId = function () { return idInput ? String(idInput.value) : ''; };
  var listeners = [];
  var onVariant = function (fn) { listeners.push(fn); };
  var last = currentId();
  function checkVariant() {
    var now = currentId();
    if (now && now !== last) { last = now; listeners.forEach(function (fn) { fn(now); }); }
  }
  if (form) {
    document.addEventListener('change', function () { setTimeout(checkVariant, 0); });
    if (window.subscribe && window.PUB_SUB_EVENTS) window.subscribe(window.PUB_SUB_EVENTS.variantChange, function () { setTimeout(checkVariant, 0); });
    setInterval(checkVariant, 800); // themes that change the input without events
  }
  var productPromise = null;
  function product() {
    if (!productPromise && data.product) {
      productPromise = fetch(root + 'products/' + data.product.handle + '.js').then(function (r) { return r.json(); });
    }
    return productPromise || Promise.reject(new Error('no product'));
  }

  /* ---------- 1. stock urgency ---------- */
  if (C.urgency.enabled && form && data.product) {
    var urg = document.createElement('div');
    urg.className = 'ucs-urg';
    urg.style.setProperty('--ucs-urg', C.urgency.color);
    form.parentNode.insertBefore(urg, form);
    var paintUrgency = function (id) {
      var qty = data.product.stock[id];
      var t = Number(C.urgency.threshold) || 10;
      if (qty == null || qty <= 0 || qty > t) { urg.hidden = true; return; }
      urg.hidden = false;
      var text = qty === 1 && C.urgency.lastOneText ? C.urgency.lastOneText : String(C.urgency.text).replace('{count}', qty);
      urg.innerHTML = '<span class="ucs-urg__text"><span class="ucs-urg__dot"></span>' + esc(text) + '</span>' +
        (C.urgency.showBar ? '<span class="ucs-urg__bar"><i style="width:' + Math.max(6, Math.round((qty / t) * 100)) + '%"></i></span>' : '');
    };
    paintUrgency(currentId());
    onVariant(paintUrgency);
  }

  /* ---------- 2. trust badges ---------- */
  if (C.trust.enabled && form) {
    var trust = document.createElement('div');
    trust.className = 'ucs-trust ucs-trust--' + C.trust.style;
    trust.style.setProperty('--ucs-trust', C.trust.color);
    var pay = document.getElementById('ucs-pay');
    var badges = (C.trust.badges || []).map(function (b) {
      return '<span class="ucs-trust__b"><span class="ucs-bi ucs-bi--' + esc(b.key) + '"></span>' + esc(b.label) + '</span>';
    }).join('');
    trust.innerHTML = (C.trust.heading ? '<p class="ucs-trust__h">' + esc(C.trust.heading) + '</p>' : '') +
      (badges ? '<div class="ucs-trust__list">' + badges + '</div>' : '') +
      (C.trust.showPayments && pay && pay.innerHTML.trim() ? '<div class="ucs-trust__pay">' + pay.innerHTML + '</div>' : '');
    var after = form.closest('.product-form') || form;
    after.parentNode.insertBefore(trust, after.nextSibling);
  }

  /* ---------- 3. sticky add to cart ---------- */
  if (C.sticky.enabled && form && buyButton && data.product) {
    product().then(function (p) {
      var S = C.sticky;
      var bar = document.createElement('div');
      bar.className = 'ucs-sticky ucs-sticky--' + S.position;
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', p.title);
      bar.style.setProperty('--ucs-st-bg', S.bg);
      bar.style.setProperty('--ucs-st-fg', S.fg);
      var accent = S.buttonBg || getComputedStyle(buyButton).backgroundColor;
      if (!accent || /rgba?\(0, 0, 0, 0\)|transparent/.test(accent)) accent = '#121212';
      bar.style.setProperty('--ucs-st-btn', accent);
      if (S.buttonFg) bar.style.setProperty('--ucs-st-btn-fg', S.buttonFg);
      var options = p.variants.length > 1 && S.showOptions ? (p.options || []).map(function (o, n) {
        var name = typeof o === 'string' ? o : o.name;
        var values = typeof o === 'string' ? Array.from(new Set(p.variants.map(function (v) { return v.options[n]; }))) : o.values;
        return '<select class="ucs-sticky__opt" data-n="' + n + '" aria-label="' + esc(name) + '">' +
          values.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select>';
      }).join('') : '';
      var img = p.featured_image ? (p.featured_image.indexOf('//') === 0 ? 'https:' : '') + p.featured_image : '';
      bar.innerHTML = '<div class="ucs-sticky__in">' +
        (S.showImage && img ? '<img class="ucs-sticky__img" src="' + esc(img + (img.indexOf('?') > -1 ? '&' : '?') + 'width=120') + '" alt="" width="44" height="44">' : '') +
        '<div class="ucs-sticky__info"><b class="ucs-sticky__title">' + esc(p.title) + '</b><span class="ucs-sticky__price"></span></div>' +
        (options ? '<div class="ucs-sticky__opts">' + options + '</div>' : '') +
        '<button type="button" class="ucs-sticky__btn"></button></div>';
      document.body.appendChild(bar);
      var btn = bar.querySelector('.ucs-sticky__btn');
      var selects = bar.querySelectorAll('.ucs-sticky__opt');
      var variant = function (id) { return p.variants.find(function (v) { return String(v.id) === String(id); }) || p.variants[0]; };
      function paint(id) {
        var v = variant(id);
        bar.querySelector('.ucs-sticky__price').innerHTML = money(v.price) + (v.compare_at_price > v.price ? ' <s>' + money(v.compare_at_price) + '</s>' : '');
        btn.disabled = !v.available;
        btn.textContent = v.available ? S.buttonText : S.soldOutText;
        selects.forEach(function (sel) { sel.value = v.options[Number(sel.getAttribute('data-n'))]; });
        bar.setAttribute('data-variant', v.id);
      }
      paint(currentId());
      onVariant(paint);
      selects.forEach(function (sel) {
        sel.addEventListener('change', function () {
          var chosen = Array.prototype.map.call(selects, function (s) { return s.value; });
          var v = p.variants.find(function (x) { return x.options.every(function (o, n) { return o === chosen[n]; }); });
          if (v) paint(v.id);
        });
      });
      btn.addEventListener('click', function () {
        var id = bar.getAttribute('data-variant');
        if (String(id) !== currentId() || !buyButton) return addDirect(id, btn);
        buyButton.click(); // the theme's own button: same drawer, same discounts
      });
      // Show once the theme's button has scrolled away.
      var visible = function (show) { bar.classList.toggle('is-on', show && onDevice(S.devices)); document.body.classList.toggle('ucs-sticky-on', show && onDevice(S.devices) && S.position === 'bottom'); };
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        visible(!e.isIntersecting && e.boundingClientRect.top < 0);
      }).observe(buyButton);
    }).catch(function () {});
  }
  function addDirect(id, btn) {
    btn.setAttribute('aria-busy', 'true');
    fetch(root + 'cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: Number(id), quantity: 1 }] }) })
      .then(function (r) { if (!r.ok) throw new Error('add'); return r.json(); })
      .then(function () {
        document.dispatchEvent(new CustomEvent('ucs:cart:added'));
        window.location.href = root + 'cart';
      })
      .catch(function () { btn.removeAttribute('aria-busy'); });
  }

  /* ---------- 4. sales pop-ups (real recent purchases only) ---------- */
  var P = C.salesPop;
  var recent = (Array.isArray(data.recent) ? data.recent : []).filter(function (r) {
    return r && r.handle && Date.now() - Date.parse(r.at) < (Number(P.maxAgeDays) || 7) * 864e5;
  });
  if (P.enabled && recent.length && onDevice(P.devices) && session(function (s) { return s.getItem('ucs-pop-off'); }) !== '1') {
    // Each real purchase is shown at most once per visit, so one order never looks like several.
    var shown = Number(session(function (s) { return s.getItem('ucs-pop-n'); })) || 0;
    var limit = Math.min(Number(P.perVisit) || 5, recent.length);
    var T = data.t || {};
    var rtf = null;
    try { rtf = new Intl.RelativeTimeFormat(document.documentElement.lang || undefined, { numeric: 'always' }); } catch (e) { rtf = null; }
    var pop = document.createElement('div');
    pop.className = 'ucs-pop ucs-pop--' + P.position;
    pop.setAttribute('role', 'status');
    document.body.appendChild(pop);
    // "5 minutes ago" in the shop's language (the browser formats it).
    var ago = function (iso) {
      var m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
      var h = Math.round(m / 60), d = Math.round(h / 24);
      var v = m < 60 ? [m, 'minute'] : h < 24 ? [h, 'hour'] : [d, 'day'];
      return rtf ? rtf.format(-v[0], v[1]) : v[0] + ' ' + v[1] + (v[0] === 1 ? '' : 's') + ' ago';
    };
    var next = function () {
      if (shown >= limit) return;
      var r = recent[shown];
      var where = P.showCity && r.city ? String(T['in'] || ' in {city}').replace('{city}', r.city) : '';
      var line = String(P.text).replace('{city}', where).replace('{product}', '');
      pop.innerHTML = '<a class="ucs-pop__in" href="' + root + 'products/' + encodeURIComponent(r.handle) + '">' +
        (r.image ? '<img src="' + esc(r.image + (r.image.indexOf('?') > -1 ? '&' : '?') + 'width=120') + '" alt="" width="52" height="52">' : '') +
        '<span class="ucs-pop__txt"><span>' + esc(line.trim()) + '</span><b>' + esc(r.product) + '</b><small>' + ago(r.at) + '</small></span></a>' +
        '<button type="button" class="ucs-pop__x" aria-label="' + esc(T.close || 'Close') + '">×</button>';
      pop.classList.add('is-on');
      shown++;
      session(function (s) { s.setItem('ucs-pop-n', String(shown)); });
      setTimeout(function () { pop.classList.remove('is-on'); setTimeout(next, (Number(P.gap) || 20) * 1000); }, 6000);
    };
    pop.addEventListener('click', function (e) {
      if (!e.target.closest('.ucs-pop__x')) return;
      e.preventDefault();
      pop.remove();
      session(function (s) { s.setItem('ucs-pop-off', '1'); });
    });
    setTimeout(next, (Number(P.firstDelay) || 8) * 1000);
  }
})();
