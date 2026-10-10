/* Back in stock & pre-order (app: Boosters → Back in stock & pre-order).
   Follows the variant chosen in the product form: sold out → "Notify me" form (sent to the app);
   out of stock but still sellable → the Add to cart button says "Pre-order" and the line gets a property. */
(function () {
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };

  function setup(host) {
    if (host.hasAttribute('data-ready')) return;
    host.setAttribute('data-ready', '');
    var data;
    try { data = JSON.parse(host.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    var c = data.c || { n: { on: true, heading: 'Sold out', text: '', placeholder: 'Your email', button: 'Notify me', thanks: 'Thanks!', privacy: '' }, p: { on: false } };
    var section = host.closest('.shopify-section') || document;
    var form = section.querySelector('form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add"]');
    var button = form && form.querySelector('[type="submit"], button[name="add"]');
    var original = button ? button.innerHTML : '';
    var prop = null;

    var current = function () {
      var input = form && form.querySelector('[name="id"]');
      var id = Number(input && input.value) || Number(new URLSearchParams(location.search).get('variant')) || data.sel;
      return data.v.filter(function (v) { return v.id === id; })[0] || data.v[0];
    };

    var notifyHtml = function () {
      var n = c.n;
      return '<form class="ucs-st__form" novalidate>' +
        (n.heading ? '<p class="ucs-st__h">' + esc(n.heading) + '</p>' : '') + (n.text ? '<p class="ucs-st__t">' + esc(n.text) + '</p>' : '') +
        '<div class="ucs-st__field"><input type="email" name="email" required autocomplete="email" placeholder="' + esc(n.placeholder) + '" aria-label="' + esc(n.placeholder) + '">' +
        '<button type="submit" class="ucs-btn">' + esc(n.button) + '</button></div>' +
        '<label class="ucs-st__hp" aria-hidden="true">Company<input name="company" tabindex="-1" autocomplete="off"></label>' +
        '<p class="ucs-st__msg" role="status"></p>' + (n.privacy ? '<p class="ucs-st__small">' + esc(n.privacy) + '</p>' : '') + '</form>';
    };

    var render = function () {
      var v = current();
      if (!v) return;
      // Pre-order: out of stock (tracked) but Shopify still sells it.
      var pre = c.p && c.p.on && v.a && v.q !== null && v.q <= 0 && v.p === 'continue';
      if (button) {
        if (pre) button.innerHTML = '<span>' + esc(c.p.button) + '</span>';
        else if (button.hasAttribute('data-ucs-pre')) button.innerHTML = original;
        button.toggleAttribute('data-ucs-pre', !!pre);
      }
      if (form) {
        if (pre && !prop) {
          prop = document.createElement('input');
          prop.type = 'hidden';
          form.appendChild(prop);
        }
        if (prop) {
          prop.name = pre ? 'properties[' + (c.p.label || 'Pre-order') + ']' : '';
          prop.value = pre ? c.p.value || 'Yes' : '';
          prop.disabled = !pre;
        }
      }
      if (pre) {
        host.innerHTML = c.p.note ? '<p class="ucs-st__note">' + esc(c.p.note) + '</p>' : '';
        host.hidden = !c.p.note;
        host.removeAttribute('data-mode');
        return;
      }
      if (!v.a && c.n && c.n.on) {
        if (host.getAttribute('data-mode') !== 'notify:' + v.id) {
          host.innerHTML = notifyHtml();
          host.setAttribute('data-mode', 'notify:' + v.id);
          wire(host.querySelector('form'), v);
        }
        host.hidden = false;
        return;
      }
      host.hidden = true;
      host.removeAttribute('data-mode');
    };

    var wire = function (f, v) {
      var msg = f.querySelector('.ucs-st__msg'), send = f.querySelector('[type="submit"]');
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = String(f.email.value || '').trim();
        var say = function (t, bad) { msg.textContent = t; msg.classList.toggle('is-error', !!bad); };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('Please enter a valid email.', true);
        send.disabled = true;
        var root = (host.getAttribute('data-root') || '/').replace(/\/$/, '');
        fetch(root + '/apps/ucro/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ product: host.getAttribute('data-product'), variant: v.id, title: data.t, variantTitle: v.t, email: email, company: f.company.value })
        }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); }).then(function (d) {
          if (d && d.ok) f.innerHTML = '<p class="ucs-st__thanks" role="status">' + esc(c.n.thanks) + '</p>';
          else { say((d && d.error) || 'Could not be sent. Please try again.', true); send.disabled = false; }
        }).catch(function () { say('Could not be sent. Please try again.', true); send.disabled = false; });
      });
    };

    render();
    // Variant changes: the form's hidden id input, option pickers, or the address (?variant=).
    document.addEventListener('change', function () { setTimeout(render, 0); });
    document.addEventListener('variant:change', function () { setTimeout(render, 0); });
    var last = location.search;
    setInterval(function () { if (location.search !== last) { last = location.search; render(); } }, 400);
  }

  function scan() { document.querySelectorAll('[data-ucs-stock]').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
