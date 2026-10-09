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

  /* ---------- the bar: built from the app's design (Store sections → Countdown bar) ---------- */
  var KEY = 'ucs-cdb-closed';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
  var session = function (fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } };
  function bar() {
    var el = document.getElementById('ucs-cdb');
    if (!el) return;
    if (el.classList.contains('ucs-cdb--bottom')) document.body.style.paddingBottom = el.hidden ? '' : el.offsetHeight + 'px';
  }
  function setupBar() {
    var el = document.getElementById('ucs-cdb');
    if (!el || el.__ucs) return;
    el.__ucs = true;
    var data = el.querySelector('script[type="application/json"]');
    var c;
    try { c = JSON.parse(data.textContent); } catch (e) { return; }
    var T = c.timer || {}, W = c.where || {}, L = c.layout || {}, B = c.button || {}, X = c.text || {};

    // Where it shows
    var type = { index: 'home', product: 'product', collection: 'collection', cart: 'cart' }[el.dataset.page] || 'other';
    var design = window.Shopify && window.Shopify.designMode;
    var off = !W.all && (W.pages || []).indexOf(type) < 0;
    var handles = c.handleList || [];
    if (handles.length && (type === 'product' || type === 'collection') && handles.indexOf(String(el.dataset.handle).toLowerCase()) < 0) off = true;
    if (L.dismissible && !design && session(function (st) { return st.getItem(KEY); }) === '1') off = true;
    if (off && !design) { el.remove(); return; }

    el.className = 'ucs ucs-cd-host ucs-cdb ucs-cdb--' + L.position + (L.slim ? ' ucs-cdb--slim' : '') +
      (W.devices === 'mobile' ? ' ucs-hide-desktop' : W.devices === 'desktop' ? ' ucs-hide-mobile' : '');
    if (c.css) el.setAttribute('style', c.css);
    var units = (T.showDays === false ? ['h', 'm', 's'] : ['d', 'h', 'm', 's']).map(function (u, i) {
      return (i ? '<span class="ucs-cd__sep" data-sep="' + u + '" aria-hidden="true">:</span>' : '') +
        '<span class="ucs-cd__u" data-u="' + u + '"><span class="ucs-cd__n">00</span>' + (T.labels ? '<span class="ucs-cd__l">' + esc((T.labelText || {})[u]) + '</span>' : '') + '</span>';
    }).join('');
    var btn = '';
    if (B.show && B.text) {
      btn = B.action === 'scroll'
        ? '<button type="button" class="ucs-btn ucs-cdb__btn" data-scroll>' + esc(B.text) + '</button>'
        : '<a class="ucs-btn ucs-cdb__btn" href="' + esc(B.link || '/collections/all') + '">' + esc(B.text) + '</a>';
    }
    el.innerHTML = '<div class="ucs-cdb__inner">' +
      (X.show && X.value ? '<span class="ucs-cdb__text">' + esc(X.value) + '</span>' : '') +
      '<ucs-countdown class="ucs-cd ucs-cd--' + esc(T.style) + '" role="timer" aria-label="' + esc(X.value || 'Countdown') + '" data-mode="' + esc(T.mode) + '" data-end="' + esc(T.end) +
      '" data-hours="' + esc(T.hours) + '" data-cutoff="' + esc(T.cutoff) + '" data-tz="' + esc(el.dataset.tz) + '" data-ended="' + esc(T.ended) + '" data-key="bar">' + units + '</ucs-countdown>' +
      '<span class="ucs-cd__end" hidden>' + esc(T.endedText) + '</span>' + btn +
      (L.dismissible ? '<button type="button" class="ucs-cdb__close" aria-label="Close"><span class="ucs-i ucs-i--close" aria-hidden="true"></span></button>' : '') + '</div>';
    el.hidden = false;

    var group = el.closest('.shopify-section');
    if (group) group.classList.add('ucs-in-group'); // a block in the Header area: stays where it's placed
    if (L.position === 'top' && !group) {
      var ab = document.getElementById('ucs-ab');
      if (ab && ab.__ucs) ab.after(el); // the announcement bar already moved itself to the top
      else document.body.insertBefore(el, document.body.firstChild);
    }
    el.classList.add('is-ready');
    var scroll = el.querySelector('[data-scroll]');
    if (scroll) scroll.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: reduce ? 'auto' : 'smooth' });
    });
    var close = el.querySelector('.ucs-cdb__close');
    if (close) close.addEventListener('click', function () {
      session(function (st) { st.setItem(KEY, '1'); });
      el.hidden = true;
      bar();
    });
    bar();
    window.addEventListener('resize', bar);
  }
  setupBar();
})();
