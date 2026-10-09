/*
 * CRO Toolbox — contact form layout (Pages → Contact page in the app). The block renders Shopify's
 * contact form and its messages; this adds the fields, texts, contact details and design from the
 * app's settings (JSON next to the form). Same markup as the app's live preview.
 */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
  var lines = function (s) { return esc(s).replace(/\n/g, '<br>'); };
  var ICON = function (name) { return '<span class="ucs-ct__ic ucs-ct__ic--' + name + '" aria-hidden="true"></span>'; };

  function build(root) {
    if (root.__ucs) return;
    root.__ucs = true;
    var data = root.querySelector('script[type="application/json"]');
    var form = root.querySelector('form');
    if (!data || !form) return;
    var c;
    try { c = JSON.parse(data.textContent); } catch (e) { return; }
    var L = c.layout || {}, K = c.look || {}, I = c.info || {};

    root.className = ['ucs-ct', 'ucs-ct--' + L.style, 'ucs-ct--' + L.align, 'ucs-ct--f-' + K.fieldStyle,
      L.labels === 'inside' ? 'ucs-ct--inside' : '', I.show ? 'ucs-ct--info ucs-ct--info-' + I.side : ''].join(' ');
    if (c.css) root.setAttribute('style', c.css);

    var info = '';
    if (I.show) {
      info = '<aside class="ucs-ct__info">' + (I.title ? '<h3>' + esc(I.title) + '</h3>' : '') + (I.text ? '<p>' + lines(I.text) + '</p>' : '') + '<ul role="list">' +
        (I.email ? '<li>' + ICON('mail') + '<a href="mailto:' + esc(I.email) + '">' + esc(I.email) + '</a></li>' : '') +
        (c.tel ? '<li>' + ICON('phone') + '<a href="tel:' + esc(c.tel) + '">' + esc(I.phone) + '</a></li>' : '') +
        (c.wa ? '<li>' + ICON('wa') + '<a href="' + esc(c.wa) + '" target="_blank" rel="noopener">WhatsApp</a></li>' : '') +
        (I.address ? '<li>' + ICON('pin') + '<span>' + lines(I.address) + '</span></li>' : '') +
        (I.hours ? '<li>' + ICON('clock') + '<span>' + lines(I.hours) + '</span></li>' : '') + '</ul></aside>';
    }
    var uid = 'ct' + Math.random().toString(36).slice(2, 7);
    var fields = (c.fields || []).filter(function (f) { return f.on; }).map(function (f) {
      var id = uid + '-' + f.key;
      var attrs = ' id="' + id + '" name="contact[' + esc(f.name) + ']" placeholder="' + esc(f.ph) + '"' + (f.required ? ' required' : '');
      var input = f.type === 'textarea'
        ? '<textarea' + attrs + ' rows="5"></textarea>'
        : '<input' + attrs + ' type="' + esc(f.type) + '" autocomplete="' + esc(f.auto) + '">';
      return '<div class="ucs-ct__f' + (f.half ? ' is-half' : '') + '"><label for="' + id + '">' + esc(f.label) + (f.required ? '<span aria-hidden="true"> *</span>' : '') + '</label>' + input + '</div>';
    }).join('');

    form.insertAdjacentHTML('beforeend', '<div class="ucs-ct__grid">' + fields + '</div>' +
      (c.privacy ? '<p class="ucs-ct__note">' + lines(c.privacy) + '</p>' : '') +
      '<button type="submit" class="ucs-ct__btn">' + esc(c.button) + '</button>');
    var main = document.createElement('div');
    main.className = 'ucs-ct__main';
    main.innerHTML = (c.heading ? '<h2 class="ucs-ct__h">' + esc(c.heading) + '</h2>' : '') + (c.text ? '<p class="ucs-ct__t">' + lines(c.text) + '</p>' : '');
    var inner = document.createElement('div');
    inner.className = 'ucs-ct__in';
    inner.innerHTML = info;
    form.parentNode.insertBefore(inner, form);
    inner.appendChild(main);
    main.appendChild(form);
  }

  function scan() { document.querySelectorAll('[data-ucs-ct]').forEach(build); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
