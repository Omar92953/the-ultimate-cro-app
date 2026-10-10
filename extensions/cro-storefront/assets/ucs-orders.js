/* Track order & Returns pages (app: Header & pages → Track order / Returns).
   The shopper enters their order number and email; the app (via /apps/ucro/…) finds the order. */
(function () {
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var DEF = {
    track: { heading: 'Track your order', sub: 'Enter your order number and the email you used at checkout.', order: 'Order number (e.g. 1001)', email: 'Email', button: 'Track order', notFound: "We couldn't find an order with that number and email. Please check both.", placed: 'Placed on', shipped: 'Tracking number', trackLink: 'Track the parcel', noTracking: "Your order is being prepared. You'll get tracking details as soon as it ships.", delivered: 'Delivered', estimated: 'Expected', again: 'Track another order' },
    returns: { heading: 'Request a return', sub: 'Enter your order number and the email you used at checkout, then choose what you would like to return.', order: 'Order number (e.g. 1001)', email: 'Email', button: 'Find my order', notFound: "We couldn't find an order with that number and email. Please check both.", pick: 'Which items would you like to return?', reason: 'Reason', reasons: 'Wrong size\nNot as expected\nArrived damaged\nChanged my mind\nOther', note: 'Anything else we should know? (optional)', send: 'Send return request', thanks: "Thanks! We've received your request and will email you the next steps.", already: "You've already sent a return request for this order. We'll be in touch soon.", tooLate: 'This order is outside our return window.' }
  };
  var STATUS = { FULFILLED: 'Shipped', UNFULFILLED: 'Being prepared', PARTIALLY_FULFILLED: 'Partly shipped', IN_PROGRESS: 'Being prepared', ON_HOLD: 'On hold', SCHEDULED: 'Scheduled', RESTOCKED: 'Returned', PAID: 'Paid', PENDING: 'Payment pending', REFUNDED: 'Refunded', PARTIALLY_REFUNDED: 'Partly refunded', AUTHORIZED: 'Payment authorised', VOIDED: 'Cancelled', DELIVERED: 'Delivered', IN_TRANSIT: 'In transit', OUT_FOR_DELIVERY: 'Out for delivery', ATTEMPTED_DELIVERY: 'Delivery attempted', READY_FOR_PICKUP: 'Ready for pickup', CONFIRMED: 'Confirmed', LABEL_PRINTED: 'Label printed', LABEL_PURCHASED: 'Label created', FAILURE: 'Delivery problem', CANCELED: 'Cancelled', NOT_DELIVERED: 'Not delivered' };
  var nice = function (s) { return STATUS[String(s || '').toUpperCase().replace(/ /g, '_')] || String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); }); };
  var sized = function (u, w) { return u + (u.indexOf('?') > -1 ? '&' : '?') + 'width=' + w; };

  function setup(host) {
    if (host.hasAttribute('data-ready')) return;
    host.setAttribute('data-ready', '');
    var kind = host.getAttribute('data-ucs-orders');
    var cfg = null;
    try { cfg = JSON.parse(host.querySelector('script[type="application/json"]').textContent); } catch (e) { cfg = null; }
    var t = Object.assign({}, DEF[kind], cfg && cfg.t);
    var locale = host.getAttribute('data-locale') || undefined;
    var day = function (s) { try { return new Date(s).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return s; } };
    var root = (host.getAttribute('data-root') || '/').replace(/\/$/, '');
    var last = { order: '', email: '' };

    var post = function (path, body) {
      return fetch(root + '/apps/ucro/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .catch(function () { return { ok: false }; });
    };

    var lookupForm = function () {
      host.innerHTML = '<div class="ucs-wrap ucs-op__wrap"><div class="ucs-op__card">' +
        '<h2 class="ucs-op__h">' + esc(t.heading) + '</h2>' + (t.sub ? '<p class="ucs-op__t">' + esc(t.sub) + '</p>' : '') +
        '<form class="ucs-op__form" novalidate>' +
        '<label class="ucs-op__field"><span>' + esc(t.order) + '</span><input name="order" required autocomplete="off" inputmode="text" value="' + esc(last.order) + '"></label>' +
        '<label class="ucs-op__field"><span>' + esc(t.email) + '</span><input type="email" name="email" required autocomplete="email" value="' + esc(last.email) + '"></label>' +
        '<p class="ucs-op__msg" role="alert"></p>' +
        '<button type="submit" class="ucs-btn">' + esc(t.button) + '</button></form></div></div>';
      var f = host.querySelector('form'), msg = f.querySelector('.ucs-op__msg'), btn = f.querySelector('button');
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        last = { order: f.order.value.trim(), email: f.email.value.trim() };
        if (!last.order || !last.email) { msg.textContent = t.notFound; return; }
        btn.disabled = true;
        msg.textContent = '';
        post(kind, { intent: 'find', order: last.order, email: last.email }).then(function (d) {
          btn.disabled = false;
          if (d.ok) return kind === 'track' ? showOrder(d.order) : chooseItems(d.order);
          msg.textContent = d.notFound ? t.notFound : d.tooLate ? t.tooLate : d.error || t.notFound;
        });
      });
    };

    var items = function (list, pickable) {
      return '<ul class="ucs-op__items">' + list.map(function (i) {
        var qty = '';
        if (pickable && i.quantity > 1) {
          qty = '<select name="qty-' + esc(i.key) + '" aria-label="Quantity">' + Array.apply(null, Array(i.quantity)).map(function (_, n) { return '<option>' + (n + 1) + '</option>'; }).join('') + '</select>';
        }
        return '<li class="ucs-op__item">' + (pickable ? '<input type="checkbox" name="item" value="' + esc(i.key) + '" aria-label="' + esc(i.title) + '">' : '') +
          (i.image ? '<img src="' + esc(sized(i.image, 160)) + '" alt="" loading="lazy">' : '<span class="ucs-op__ph"></span>') +
          '<span class="ucs-op__it"><b>' + esc(i.title) + '</b>' + (i.variant ? '<small>' + esc(i.variant) + '</small>' : '') + '</span>' +
          (pickable ? qty : '<span class="ucs-op__q">× ' + i.quantity + '</span>') + '</li>';
      }).join('') + '</ul>';
    };

    var showOrder = function (o) {
      var ships = o.shipments.filter(function (s) { return s.number || s.url || s.delivered; });
      var tracking = ships.length ? ships.map(function (s) {
        return '<div class="ucs-op__ship"><span class="ucs-op__pill">' + esc(s.delivered ? t.delivered : nice(s.status)) + '</span>' +
          (s.number ? '<p class="ucs-op__t">' + esc(t.shipped) + ': <b>' + esc(s.number) + '</b>' + (s.company ? ' · ' + esc(s.company) : '') + '</p>' : '') +
          (s.delivered ? '<p class="ucs-op__t">' + esc(t.delivered) + ': ' + esc(day(s.delivered)) + '</p>' : s.estimated ? '<p class="ucs-op__t">' + esc(t.estimated) + ': ' + esc(day(s.estimated)) + '</p>' : '') +
          (s.url ? '<a class="ucs-btn ucs-btn--outline" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(t.trackLink) + '</a>' : '') + '</div>';
      }).join('') : '<p class="ucs-op__t">' + esc(t.noTracking) + '</p>';
      host.innerHTML = '<div class="ucs-wrap ucs-op__wrap"><div class="ucs-op__card">' +
        '<h2 class="ucs-op__h">' + esc(o.name) + '</h2>' +
        '<p class="ucs-op__t">' + esc(t.placed) + ' ' + esc(day(o.createdAt)) + '</p>' +
        '<p class="ucs-op__pills"><span class="ucs-op__pill">' + esc(o.cancelled ? nice('CANCELED') : nice(o.fulfillment)) + '</span><span class="ucs-op__pill ucs-op__pill--soft">' + esc(nice(o.payment)) + '</span></p>' +
        tracking + items(o.items, false) +
        '<button type="button" class="ucs-btn ucs-btn--outline ucs-op__again">' + esc(t.again) + '</button></div></div>';
      host.querySelector('.ucs-op__again').addEventListener('click', lookupForm);
    };

    var chooseItems = function (o) {
      var reasons = String(t.reasons || '').split('\n').map(function (r) { return r.trim(); }).filter(Boolean);
      host.innerHTML = '<div class="ucs-wrap ucs-op__wrap"><div class="ucs-op__card">' +
        '<h2 class="ucs-op__h">' + esc(o.name) + '</h2><p class="ucs-op__t"><b>' + esc(t.pick) + '</b></p>' +
        '<form class="ucs-op__form" novalidate>' + items(o.items, true) +
        '<label class="ucs-op__field"><span>' + esc(t.reason) + '</span><select name="reason" required><option value=""></option>' + reasons.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></label>' +
        '<label class="ucs-op__field"><span>' + esc(t.note) + '</span><textarea name="note" rows="3" maxlength="1000"></textarea></label>' +
        '<p class="ucs-op__msg" role="alert"></p><button type="submit" class="ucs-btn">' + esc(t.send) + '</button></form></div></div>';
      var f = host.querySelector('form'), msg = f.querySelector('.ucs-op__msg'), btn = f.querySelector('button');
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var chosen = Array.prototype.map.call(f.querySelectorAll('input[name="item"]:checked'), function (c) {
          var q = f.querySelector('[name="qty-' + c.value + '"]');
          return { key: c.value, qty: q ? Number(q.value) : 1 };
        });
        if (!chosen.length) { msg.textContent = t.pick; return; }
        if (!f.reason.value) { msg.textContent = t.reason; return; }
        btn.disabled = true;
        post('returns', { intent: 'send', order: last.order, email: last.email, items: chosen, reason: f.reason.value, note: f.note.value }).then(function (d) {
          if (d.ok || d.already) {
            host.querySelector('.ucs-op__card').innerHTML = '<h2 class="ucs-op__h">' + esc(o.name) + '</h2><p class="ucs-op__t" role="status">' + esc(d.ok ? t.thanks : t.already) + '</p>';
            return;
          }
          btn.disabled = false;
          msg.textContent = d.notFound ? t.notFound : d.tooLate ? t.tooLate : d.error || 'Something went wrong. Please try again.';
        });
      });
    };

    lookupForm();
  }

  function scan() { document.querySelectorAll('[data-ucs-orders]').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
