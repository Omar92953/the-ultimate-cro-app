/*
 * CRO Toolbox — countdown timers (block and bar). Modes: a fixed date (store time zone),
 * a per-visitor "evergreen" timer kept in localStorage, or a daily cut-off.
 */
(function () {
  if (window.__ucsCountdown) return;
  window.__ucsCountdown = true;

  var HOUR = 3600000, DAY = 24 * HOUR;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var local = function (fn) { try { return fn(window.localStorage); } catch (e) { return null; } };

  // "+0300" → minutes east of UTC
  function offset(tz) {
    var m = /([+-])(\d\d):?(\d\d)/.exec(tz || '');
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : -new Date().getTimezoneOffset();
  }
  // A wall-clock time in the store's zone → epoch ms
  function at(y, mo, d, h, mi, off) { return Date.UTC(y, mo, d, h, mi) - off * 60000; }

  function deadline(d) {
    var now = Date.now(), off = offset(d.tz);
    if (d.mode === 'evergreen') {
      var span = Math.max(1, Number(d.hours) || 24) * HOUR;
      var key = 'ucs-cd-' + d.key + '-' + span;
      var end = Number(local(function (s) { return s.getItem(key); })) || 0;
      if (!end) end = now + span;
      else if (end <= now && d.ended === 'restart') end += Math.ceil((now - end) / span) * span;
      local(function (s) { s.setItem(key, String(end)); });
      return end;
    }
    if (d.mode === 'daily') {
      var p = String(d.cutoff || '17:00').split(':');
      var shop = new Date(now + off * 60000);
      var t = at(shop.getUTCFullYear(), shop.getUTCMonth(), shop.getUTCDate(), Number(p[0]) || 0, Number(p[1]) || 0, off);
      return t <= now ? t + DAY : t;
    }
    var m = /(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/.exec(d.end || '');
    if (!m) return 0;
    return at(Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4] ? Number(m[4]) : 23, m[5] ? Number(m[5]) : 59, off);
  }

  class Countdown extends HTMLElement {
    connectedCallback() {
      if (this._t) return;
      this.n = {};
      this.querySelectorAll('[data-u]').forEach((u) => { this.n[u.getAttribute('data-u')] = u; });
      this.end = deadline(this.dataset);
      this.tick();
      this._t = setInterval(() => this.tick(), 1000);
    }
    disconnectedCallback() { clearInterval(this._t); this._t = null; }
    tick() {
      var d = this.dataset, left = this.end - Date.now();
      if (left <= 0 && (d.mode === 'daily' || (d.mode === 'evergreen' && d.ended === 'restart'))) {
        this.end = deadline(d);
        left = this.end - Date.now();
      }
      if (left <= 0) return this.finish();
      var s = Math.floor(left / 1000);
      var v = { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
      if (!this.n.d) v.h = Math.floor(s / 3600); // no days shown: hours run past 24
      for (var k in v) if (this.n[k]) this.n[k].firstChild.textContent = pad(v[k]);
      this.classList.toggle('is-nodays', v.d === 0);
      this.classList.add('is-live');
    }
    finish() {
      clearInterval(this._t);
      var host = this.closest('.ucs-cd-host') || this;
      var msg = host.querySelector('.ucs-cd__end');
      if (this.dataset.ended === 'message' && msg) {
        this.hidden = true;
        msg.hidden = false;
        host.classList.add('is-ended');
      } else if (window.Shopify && window.Shopify.designMode) {
        for (var k in this.n) this.n[k].firstChild.textContent = '00'; // keep it visible while editing
      } else {
        host.hidden = true;
        bar();
      }
    }
  }
  if (!customElements.get('ucs-countdown')) customElements.define('ucs-countdown', Countdown);

  /* ---------- countdowns designed in the app (Countdown timers: header, footer, home, product) ----------
     One theme block holds the four designs; each copy picks the one for where it's placed. */
  var KEY = 'ucs-cdb-closed-';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
  var session = function (fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } };
  function bar() {
    // a bar fixed to the bottom of the screen keeps the page's last line visible
    var b = document.querySelector('.ucs-cdb--bottom:not([hidden])');
    document.body.style.paddingBottom = b ? b.offsetHeight + 'px' : '';
  }
  function placeOf(el) {
    var sec = el.closest('.shopify-section');
    var cls = sec ? sec.className : '';
    if (/group-footer/.test(cls)) return 'footer';
    if (/group-header/.test(cls) || !sec) return 'header';
    return el.dataset.page === 'product' ? 'product' : 'home';
  }
  function setup(el) {
    if (el.__ucs) return;
    el.__ucs = true;
    var all;
    try { all = JSON.parse(el.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    var place = placeOf(el);
    var c = all[place];
    var design = window.Shopify && window.Shopify.designMode;
    if (!c || !c.on) {
      if (design) { el.hidden = false; el.innerHTML = '<p class="ucs-note">Countdown (' + place + '): design and switch it on in the app → Countdown timers.</p>'; }
      else el.remove();
      return;
    }
    var T = c.timer || {}, W = c.where || {}, L = c.layout || {}, B = c.button || {}, X = c.text || {}, S = c.section || {};
    var kind = c.kind || 'bar';

    // Where it shows
    var type = { index: 'home', product: 'product', collection: 'collection', cart: 'cart' }[el.dataset.page] || 'other';
    var off = !W.all && (W.pages || []).indexOf(type) < 0;
    var handles = c.handleList || [];
    if (handles.length && (type === 'product' || type === 'collection') && handles.indexOf(String(el.dataset.handle).toLowerCase()) < 0) off = true;
    if (L.dismissible && kind === 'bar' && !design && session(function (st) { return st.getItem(KEY + place); }) === '1') off = true;
    if (off && !design) { el.remove(); return; }

    var units = (T.showDays === false ? ['h', 'm', 's'] : ['d', 'h', 'm', 's']).map(function (u, i) {
      return (i ? '<span class="ucs-cd__sep" data-sep="' + u + '" aria-hidden="true">:</span>' : '') +
        '<span class="ucs-cd__u" data-u="' + u + '"><span class="ucs-cd__n">00</span>' + (T.labels ? '<span class="ucs-cd__l">' + esc((T.labelText || {})[u]) + '</span>' : '') + '</span>';
    }).join('');
    var timer = '<ucs-countdown class="ucs-cd ucs-cd--' + esc(T.style) + '" role="timer" aria-label="' + esc(X.value || S.heading || 'Countdown') + '" data-mode="' + esc(T.mode) + '" data-end="' + esc(T.end) +
      '" data-hours="' + esc(T.hours) + '" data-cutoff="' + esc(T.cutoff) + '" data-tz="' + esc(el.dataset.tz) + '" data-ended="' + esc(T.ended) + '" data-key="' + place + '">' + units + '</ucs-countdown>' +
      '<span class="ucs-cd__end" hidden>' + esc(T.endedText) + '</span>';
    var btn = '';
    if (B.show && B.text) {
      btn = B.action === 'scroll'
        ? '<button type="button" class="ucs-btn ucs-cdb__btn" data-scroll>' + esc(B.text) + '</button>'
        : '<a class="ucs-btn ucs-cdb__btn" href="' + esc(B.link || '/collections/all') + '">' + esc(B.text) + '</a>';
    }
    var text = X.show && X.value ? '<span class="ucs-cdb__text">' + esc(X.value) + '</span>' : '';
    var devices = W.devices === 'mobile' ? ' ucs-hide-desktop' : W.devices === 'desktop' ? ' ucs-hide-mobile' : '';

    if (kind === 'section') {
      el.className = 'ucs ucs-cd-host ucs-cdb ucs-cdk ucs-cdh ucs-cdh--' + (S.layout || 'stack') + (c.xcls || '') + devices;
      el.innerHTML = '<div class="ucs-wrap ucs-cdh__wrap">' +
        (S.heading || S.sub ? '<div class="ucs-cdh__text">' + (S.heading ? '<h2 class="ucs-cdh__title">' + esc(S.heading) + '</h2>' : '') + (S.sub ? '<p class="ucs-cdh__sub">' + esc(S.sub) + '</p>' : '') + '</div>' : '') +
        '<div class="ucs-cdh__timer">' + timer + '</div>' + btn + '</div>';
    } else if (kind === 'inline') {
      el.className = 'ucs ucs-cd-host ucs-cdb ucs-cdi' + (c.xcls || '') + devices;
      el.innerHTML = '<div class="ucs-cdi__inner">' + text + timer + btn + '</div>';
    } else {
      el.className = 'ucs ucs-cd-host ucs-cdb ucs-cdb--' + (place === 'footer' ? 'bottom-in' : L.position) + (L.slim ? ' ucs-cdb--slim' : '') + (c.xcls || '') + devices;
      el.innerHTML = '<div class="ucs-cdb__inner">' + text + timer + btn +
        (L.dismissible ? '<button type="button" class="ucs-cdb__close" aria-label="Close"><span class="ucs-i ucs-i--close" aria-hidden="true"></span></button>' : '') + '</div>';
    }
    if (c.css) el.setAttribute('style', c.css);
    el.hidden = false;

    var group = el.closest('.shopify-section');
    if (group && kind === 'bar') group.classList.add('ucs-in-group'); // a block in the Header/Footer area stays where it's placed
    el.classList.add('is-ready');
    var scroll = el.querySelector('[data-scroll]');
    if (scroll) scroll.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: reduce ? 'auto' : 'smooth' });
    });
    var close = el.querySelector('.ucs-cdb__close');
    if (close) close.addEventListener('click', function () {
      session(function (st) { st.setItem(KEY + place, '1'); });
      el.hidden = true;
      bar();
    });
  }
  function setupAll() {
    document.querySelectorAll('[data-ucs-cdb]').forEach(setup);
    bar();
  }
  setupAll();
  window.addEventListener('resize', bar);
  document.addEventListener('shopify:section:load', setupAll);
})();
