/* Track order & Returns pages (app: Tracking & Returns).
   The shopper enters their order number and email; the app (via /apps/ucro/…) finds the order. */
(function () {
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var DEF = {
    track: { heading: 'Track your order', sub: 'Enter your order number and the email you used at checkout.', order: 'Order number (e.g. 1001)', email: 'Email', button: 'Track order', notFound: "We couldn't find an order with that number and email. Please check both.", placed: 'Placed on', shipped: 'Tracking number', trackLink: 'Track the parcel', noTracking: "Your order is being prepared. You'll get tracking details as soon as it ships.", delivered: 'Delivered', estimated: 'Expected', again: 'Track another order', unavailable: "Order lookup isn't available right now. Please try again in a moment.", carrierOnly: "Live updates are on the carrier's page. Open the tracking link.", statusInfo: 'Info received', statusTransit: 'In transit', statusOut: 'Out for delivery', statusDelivered: 'Delivered', statusProblem: 'Delivery problem', where: 'Latest update', history: 'Tracking history' },
    returns: { heading: 'Request a return', sub: 'Enter your order number and the email you used at checkout, then choose what you would like to return.', unavailable: "Order lookup isn't available right now. Please try again in a moment.", order: 'Order number (e.g. 1001)', email: 'Email', button: 'Find my order', notFound: "We couldn't find an order with that number and email. Please check both.", pick: 'Which items would you like to return?', reason: 'Reason', reasons: 'Wrong size\nNot as expected\nArrived damaged\nChanged my mind\nOther', note: 'Anything else we should know? (optional)', send: 'Send return request', thanks: "Thanks! We've received your request and will email you the next steps.", already: "You've already sent a return request for this order. We'll be in touch soon.", tooLate: 'This order is outside our return window.', thanksApproved: 'Your return is approved. Here is how to send it back.', yourReturns: 'Your returns for this order', sendTo: 'Send the items to', shopperPays: 'You pay for the return shipping.', merchantPays: 'We will email you a return label.', nothing: 'Nothing in this order can be returned.' }
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
        .then(function (r) {
          // An answer that is not the app's JSON (the proxy is not set up, the server is down) is not "order not found".
          return r.json().catch(function () { console.error('[CRO Toolbox] ' + path + ': HTTP ' + r.status + ' without a JSON answer'); return { ok: false, error: t.unavailable }; });
        })
        .catch(function (e) { console.error('[CRO Toolbox] ' + path + ': request failed', e); return { ok: false, error: t.unavailable }; });
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
          if (d.ok) return kind === 'track' ? showOrder(d.order) : chooseItems(d.order, d);
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
      var STEP = { info: t.statusInfo, transit: t.statusTransit, out: t.statusOut, delivered: t.statusDelivered, problem: t.statusProblem };
      var when = function (s) { try { return new Date(s).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return s; } };
      var place = function (e) { return [e.city, e.province, e.country].filter(Boolean).join(', '); };
      // The timeline: the newest update first, where it happened and what the carrier said.
      var timeline = function (k) {
        if (!k || !k.events || !k.events.length) return '';
        return '<p class="ucs-op__t"><b>' + esc(t.history) + '</b></p><ol class="ucs-op__tl">' + k.events.map(function (e) {
          return '<li class="ucs-op__ev ucs-op__ev--' + esc(e.status) + '"><span class="ucs-op__evh">' + esc(STEP[e.status] || '') + ' <small>' + esc(when(e.at)) + '</small></span>' +
            (e.message || place(e) ? '<span class="ucs-op__evt">' + esc([e.message, place(e)].filter(Boolean).join(' · ')) + '</span>' : '') + '</li>';
        }).join('') + '</ol>';
      };
      var tracking = ships.length ? ships.map(function (s) {
        var k = s.tracking;
        var delivered = (k && k.delivered) || s.delivered, estimated = (k && k.estimated) || s.estimated;
        var label = k ? STEP[k.status] : (s.delivered ? t.delivered : nice(s.status));
        return '<div class="ucs-op__ship"><span class="ucs-op__pill">' + esc(delivered ? t.delivered : label) + '</span>' +
          (s.number ? '<p class="ucs-op__t">' + esc(t.shipped) + ': <b>' + esc(s.number) + '</b>' + (s.company ? ' · ' + esc(s.company) : '') + '</p>' : '') +
          (delivered ? '<p class="ucs-op__t">' + esc(t.delivered) + ': ' + esc(day(delivered)) + '</p>' : estimated ? '<p class="ucs-op__t">' + esc(t.estimated) + ': ' + esc(day(estimated)) + '</p>' : '') +
          (k && k.place && !delivered ? '<p class="ucs-op__t">' + esc(t.where) + ': <b>' + esc(k.place) + '</b></p>' : '') +
          timeline(k) +
          (s.url && !delivered && !(k && k.events && k.events.length) && /^(shipped|fulfilled)$/i.test(nice(s.status)) ? '<p class="ucs-op__t">' + esc(t.carrierOnly) + '</p>' : '') +
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

    var afterText = function (a) {
      if (!a) return '';
      return '<div class="ucs-op__after">' +
        (a.address ? '<p class="ucs-op__t"><b>' + esc(t.sendTo) + '</b><br>' + esc(a.address).replace(/\n/g, '<br>') + '</p>' : '') +
        '<p class="ucs-op__t">' + esc(a.shipping === 'merchant' ? t.merchantPays : t.shopperPays) + '</p>' +
        (a.instructions ? '<p class="ucs-op__t">' + esc(a.instructions) + '</p>' : '') + '</div>';
    };

    var chooseItems = function (o, d) {
      d = d || {};
      var reasons = String(t.reasons || '').split('\n').map(function (r) { return r.trim(); }).filter(Boolean);
      var mine = (d.returns || []).length ? '<p class="ucs-op__t"><b>' + esc(t.yourReturns) + '</b></p><ul class="ucs-op__rets">' + d.returns.map(function (r) { return '<li>' + esc(r.name) + ': ' + esc(r.say) + '</li>'; }).join('') + '</ul>' + afterText(d.after) : '';
      var form = !o.items.length ? '<p class="ucs-op__t">' + esc(t.nothing) + '</p>' :
        '<p class="ucs-op__t"><b>' + esc(t.pick) + '</b></p><form class="ucs-op__form" novalidate>' + items(o.items, true) +
        '<label class="ucs-op__field"><span>' + esc(t.reason) + '</span><select name="reason" required><option value=""></option>' + reasons.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></label>' +
        '<label class="ucs-op__field"><span>' + esc(t.note) + '</span><textarea name="note" rows="3" maxlength="1000"></textarea></label>' +
        '<p class="ucs-op__msg" role="alert"></p><button type="submit" class="ucs-btn">' + esc(t.send) + '</button></form>';
      host.innerHTML = '<div class="ucs-wrap ucs-op__wrap"><div class="ucs-op__card"><h2 class="ucs-op__h">' + esc(o.name) + '</h2>' + mine + form + '</div></div>';
      var f = host.querySelector('form');
      if (!f) return;
      var msg = f.querySelector('.ucs-op__msg'), btn = f.querySelector('button');
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var chosen = Array.prototype.map.call(f.querySelectorAll('input[name="item"]:checked'), function (c) {
          var q = f.querySelector('[name="qty-' + c.value + '"]');
          return { key: c.value, qty: q ? Number(q.value) : 1 };
        });
        if (!chosen.length) { msg.textContent = t.pick; return; }
        if (!f.reason.value) { msg.textContent = t.reason; return; }
        btn.disabled = true;
        post('returns', { intent: 'send', order: last.order, email: last.email, items: chosen, reason: f.reason.value, note: f.note.value }).then(function (r) {
          if (r.ok || r.already) {
            host.querySelector('.ucs-op__card').innerHTML = '<h2 class="ucs-op__h">' + esc(o.name) + '</h2><p class="ucs-op__t" role="status">' + esc(r.ok ? (r.approved ? t.thanksApproved : t.thanks) : t.already) + '</p>' + (r.approved ? afterText(r.after) : '');
            return;
          }
          btn.disabled = false;
          msg.textContent = r.notFound ? t.notFound : r.tooLate ? t.tooLate : r.error || 'Something went wrong. Please try again.';
        });
      });
    };

    lookupForm();
  }

  function scan() { document.querySelectorAll('[data-ucs-orders="track"], [data-ucs-orders="returns"]').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
