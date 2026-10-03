/*
 * Ultimate CRO — countdown timers (block and bar). Modes: a fixed date (store time zone),
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

  /* ---------- the bar: place it, leave room for it, let customers close it ---------- */
  var KEY = 'ucs-cdb-closed';
  function bar() {
    var el = document.getElementById('ucs-cdb');
    if (!el) return;
    var bottom = el.classList.contains('ucs-cdb--bottom');
    if (bottom) document.body.style.paddingBottom = el.hidden ? '' : el.offsetHeight + 'px';
  }
  function setupBar() {
    var el = document.getElementById('ucs-cdb');
    if (!el || el.__ucs) return;
    el.__ucs = true;
    var session = function (fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } };
    if (el.hasAttribute('data-dismiss') && session(function (s) { return s.getItem(KEY); }) === '1') { el.remove(); return; }
    if (el.classList.contains('ucs-cdb--top')) {
      var ab = document.getElementById('ucs-ab');
      if (ab && ab.__ucs) ab.after(el); // the announcement bar already moved itself to the top
      else document.body.insertBefore(el, document.body.firstChild);
    }
    el.classList.add('is-ready');
    var close = el.querySelector('.ucs-cdb__close');
    if (close) close.addEventListener('click', function () {
      session(function (s) { s.setItem(KEY, '1'); });
      el.hidden = true;
      bar();
    });
    bar();
    window.addEventListener('resize', bar);
  }
  setupBar();
})();
