/* Delivery date estimate (app: Boosters → Delivery estimate). Same maths as estimate() in
   app/lib/delivery-design.ts: cut-off in the shop's time zone, processing and shipping days that skip
   days off and holidays, shipping days per country zone. Updates the countdown every minute. */
(function () {
  var ICONS = {
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg>'
  };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  var offset = function (tz) { var m = /([+-])(\d\d):?(\d\d)/.exec(tz || ''); return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000 : 0; };

  function estimate(r, now, country) {
    var off = {}; (r.daysOff || []).forEach(function (d) { off[d] = true; });
    var hol = {}; String(r.holidays || '').split(/[\s,]+/).forEach(function (d) { if (d) hol[d] = true; });
    var working = function (d) { return !off[d.getUTCDay()] && !hol[ymd(d)]; };
    var zone = (r.zones || []).filter(function (z) { return z.countries.split(/,\s*/).indexOf(String(country || '').toUpperCase()) > -1; })[0];
    var hm = String(r.cutoff || '14:00').split(':').map(Number);
    var day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    var cut = new Date(day.getTime() + (hm[0] * 60 + hm[1]) * 60000);
    var start = new Date(day.getTime()), today = working(day) && now < cut;
    if (!today) { do { start = new Date(start.getTime() + 86400000); } while (!working(start)); }
    var add = function (from, n) { var d = new Date(from.getTime()); for (var i = 0; i < n;) { d = new Date(d.getTime() + 86400000); if (working(d)) i++; } return d; };
    var ships = add(start, r.processing || 0);
    var min = zone ? zone.min : r.min, max = zone ? zone.max : r.max;
    var deadline = new Date(start.getTime() + (hm[0] * 60 + hm[1]) * 60000);
    return { from: add(ships, min), to: add(ships, max), today: today, msLeft: deadline.getTime() - now.getTime() };
  }

  function setup(host) {
    if (host.hasAttribute('data-ready')) return;
    host.setAttribute('data-ready', '');
    var d;
    try { d = JSON.parse(host.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    if (!d || !d.r) return;
    var page = host.getAttribute('data-page');
    if ((page === 'product' && d.w && !d.w.product) || (page === 'cart' && d.w && !d.w.cart)) { host.hidden = true; return; }
    var off = offset(host.getAttribute('data-tz')), locale = host.getAttribute('data-locale') || undefined, country = host.getAttribute('data-country');
    var fmt = function (date) { try { return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch (e) { return ymd(date); } };
    var draw = function () {
      var e = estimate(d.r, new Date(Date.now() + off), country);
      var mins = Math.max(0, Math.ceil(e.msLeft / 60000)), h = Math.floor(mins / 60), m = mins % 60;
      var left = (h ? h + 'h ' : '') + m + 'm';
      var dates = ymd(e.from) === ymd(e.to) ? fmt(e.from) : d.t.range.replace('{from}', fmt(e.from)).replace('{to}', fmt(e.to));
      var countdown = e.today || !d.t.hideAfterCutoff ? esc(d.t.countdown).replace('{time}', '<b class="ucs-dl__time">' + esc(left) + '</b>') : '';
      var arrives = esc(d.t.arrives).replace('{dates}', '<b>' + esc(dates) + '</b>');
      var line = esc(d.t.line).replace('{countdown}', countdown).replace('{arrives}', arrives).replace(/^\s+/, '');
      host.innerHTML = (d.ic && ICONS[d.ic] ? '<span class="ucs-dl__icon">' + ICONS[d.ic] + '</span>' : '') + '<p class="ucs-dl__text">' + line.charAt(0).toUpperCase() + line.slice(1) + '</p>';
      host.hidden = false;
    };
    draw();
    setInterval(draw, 30000);
  }
  function scan() { document.querySelectorAll('[data-ucs-delivery]').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
