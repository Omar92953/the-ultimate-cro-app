/*
 * Ultimate CRO — announcement bar (app embed). Moves the bar to the top of the page, drops
 * messages outside their dates, rotates them, remembers "closed" for the visit, and keeps the
 * free-shipping message in step with the cart.
 */
(function () {
  var el = document.getElementById('ucs-ab');
  if (!el || el.__ucs) return;
  el.__ucs = true;

  var KEY = 'ucs-ab-closed';
  var store = function (fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } };
  if (el.hasAttribute('data-dismiss') && store(function (s) { return s.getItem(KEY); }) === '1') { el.remove(); return; }

  // Above the theme header (embeds are rendered at the end of <body>).
  document.body.insertBefore(el, document.body.firstChild);

  var now = Date.now() / 1000;
  Array.prototype.forEach.call(el.querySelectorAll('.ucs-ab__msg[data-start], .ucs-ab__msg[data-end]'), function (m) {
    var s = Number(m.getAttribute('data-start') || 0), e = Number(m.getAttribute('data-end') || Infinity);
    if (now < s || now > e) m.remove();
  });

  /* ---------- free shipping ---------- */
  var fs = el.querySelector('.ucs-ab__fs');
  if (fs) {
    var d = el.dataset;
    var rate = Number((window.Shopify && window.Shopify.currency && window.Shopify.currency.rate) || 1);
    var threshold = Math.round(Number(d.fsThreshold) * rate);
    var money = function (c) {
      var fmt = d.fsFmt || '{{amount}}';
      var m = fmt.match(/\{\{\s*(\w+)\s*\}\}/);
      if (!m) return fmt;
      var map = { amount_no_decimals: [0, ',', '.'], amount_with_comma_separator: [2, '.', ','], amount_no_decimals_with_comma_separator: [0, '.', ','], amount_with_apostrophe_separator: [2, "'", '.'], amount_no_decimals_with_space_separator: [0, ' ', ','], amount_with_space_separator: [2, ' ', ','] };
      var a = map[m[1]] || [2, ',', '.'];
      var parts = (c / 100).toFixed(a[0]).split('.');
      return fmt.replace(m[0], parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, a[1]) + (parts[1] ? a[2] + parts[1] : ''));
    };
    var paintFs = function (total) {
      var left = threshold - total;
      var text = total <= 0 ? d.fsEmpty : left > 0 ? d.fsLeft : d.fsDone;
      fs.querySelector('span').textContent = String(text || '').replace('{amount}', money(Math.max(left, 0))).replace('{threshold}', money(threshold));
      el.style.setProperty('--ucs-ab-p', Math.min(100, Math.max(0, (total / threshold) * 100)) + '%');
      el.classList.toggle('is-free', total > 0 && left <= 0);
    };
    paintFs(Number(d.fsTotal || 0));

    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    var realFetch = window.fetch;
    var timer;
    var refresh = function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        realFetch.call(window, root + 'cart.js', { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (c) { paintFs(Number(c.total_price || 0)); })
          .catch(function () {});
      }, 120);
    };
    var isCart = function (u) { return /\/cart\/(add|change|update|clear)/.test(String(u || '')); };
    window.fetch = function (input) {
      var p = realFetch.apply(this, arguments);
      if (isCart(input && input.url ? input.url : input)) p.then(refresh, function () {});
      return p;
    };
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, u) {
      if (isCart(u)) this.addEventListener('loadend', refresh);
      return open.apply(this, arguments);
    };
    document.addEventListener('ucs:cart:added', refresh);
    if (window.subscribe && window.PUB_SUB_EVENTS) window.subscribe(window.PUB_SUB_EVENTS.cartUpdate, refresh);
  }

  var msgs = Array.prototype.slice.call(el.querySelectorAll('.ucs-ab__msg'));
  if (!msgs.length) { el.remove(); return; }

  /* ---------- rotation ---------- */
  var i = 0, timer2 = null, paused = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ms = Math.max(2, Number(el.getAttribute('data-interval')) || 4) * 1000;
  function show(n) {
    var prev = msgs[i];
    i = (n + msgs.length) % msgs.length;
    msgs.forEach(function (m, k) {
      m.classList.toggle('is-on', k === i);
      m.classList.toggle('is-out', m === prev && k !== i);
      m.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      Array.prototype.forEach.call(m.querySelectorAll('a'), function (a) { a.tabIndex = k === i ? 0 : -1; });
    });
  }
  function play() {
    clearInterval(timer2);
    if (msgs.length > 1 && !paused && !reduce) timer2 = setInterval(function () { show(i + 1); }, ms);
  }
  show(0);
  if (msgs.length > 1) {
    Array.prototype.forEach.call(el.querySelectorAll('.ucs-ab__nav'), function (b) {
      b.hidden = false;
      b.addEventListener('click', function () { show(i + Number(b.getAttribute('data-dir'))); play(); });
    });
    el.addEventListener('mouseenter', function () { paused = true; play(); });
    el.addEventListener('mouseleave', function () { paused = false; play(); });
    el.addEventListener('focusin', function () { paused = true; play(); });
    el.addEventListener('focusout', function () { paused = false; play(); });
    play();
  }

  var close = el.querySelector('.ucs-ab__close');
  if (close) close.addEventListener('click', function () {
    store(function (s) { s.setItem(KEY, '1'); });
    clearInterval(timer2);
    el.remove();
  });

  el.classList.add('is-ready');
})();
