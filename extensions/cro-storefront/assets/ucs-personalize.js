/* Personalization (app: Offers & bundles → Personalization). The fields join the product form
   (form="…"), so the theme's own add to cart sends them as line properties. Required fields are
   checked before the theme adds. A paid fee is added as a linked line (_cro_parent), removed with the
   item by ucs-cart-guard.js. The preview writes the text on the product picture as the shopper types. */
(function () {
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var widgets = [];

  function setup(host) {
    if (host.hasAttribute('data-ready')) return;
    host.setAttribute('data-ready', '');
    var data;
    try { data = JSON.parse(host.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    var c = data.c;
    var section = host.closest('.shopify-section') || document;
    var form = section.querySelector('form[action*="/cart/add"]') || document.querySelector('form[action*="/cart/add"]');
    if (!form) return;
    // getAttribute: the theme's form has an input named "id", which hides form.id.
    var fid = form.getAttribute('id');
    if (!fid) { fid = 'ucs-pz-form-' + Math.random().toString(36).slice(2, 7); form.setAttribute('id', fid); }

    var html = (c.h ? '<p class="ucs-pz__h">' + esc(c.h) + '</p>' : '') + '<div class="ucs-pz__fields">';
    c.f.forEach(function (f, i) {
      var name = 'properties[' + f.l + ']', id = fid + '-pz' + i;
      var attrs = ' id="' + id + '" name="' + esc(name) + '" form="' + esc(fid) + '" data-i="' + i + '"' + (f.r ? ' required' : '');
      var tag = f.t === 'color' ? 'div' : 'label';
      html += '<' + tag + ' class="ucs-pz__field"' + (f.t === 'color' ? ' role="radiogroup" aria-label="' + esc(f.l) + '"' : ' for="' + id + '"') + '><span>' + esc(f.l) + (f.r ? ' *' : '') + '</span>';
      if (f.t === 'textarea') html += '<textarea rows="3" maxlength="' + f.m + '"' + attrs + '></textarea>';
      else if (f.t === 'select') html += '<select' + attrs + '><option value=""></option>' + f.o.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select>';
      else if (f.t === 'color') html += '<span class="ucs-pz__colors">' + f.o.map(function (o, j) { return '<label class="ucs-pz__swatch" title="' + esc(o) + '"><input type="radio" aria-label="' + esc(o) + '" value="' + esc(o) + '"' + attrs.replace(' id="' + id + '"', j ? '' : ' id="' + id + '"') + '><span style="background:' + esc(o) + '"></span></label>'; }).join('') + '</span>';
      else html += '<input type="text" maxlength="' + f.m + '" autocomplete="off"' + attrs + '>';
      if (f.t === 'text' || f.t === 'textarea') html += '<small class="ucs-pz__count" data-count="' + i + '">0 / ' + f.m + '</small>';
      html += '</' + tag + '>';
    });
    html += '</div>';
    if (c.pv && data.img) html += '<div class="ucs-pz__preview"><span class="ucs-pz__plabel">' + esc(c.pv.l) + '</span><img src="' + esc(data.img) + '" alt="" loading="lazy"><span class="ucs-pz__text" aria-hidden="true"></span></div>';
    if (c.fee && c.fee.n) html += '<p class="ucs-pz__note">' + esc(c.fee.n) + '</p>';
    host.innerHTML = html;

    var overlay = host.querySelector('.ucs-pz__text');
    var update = function () {
      var lines = [];
      c.f.forEach(function (f, i) {
        var el = f.t === 'color' ? host.querySelector('[data-i="' + i + '"]:checked') : host.querySelector('[data-i="' + i + '"]');
        var v = el ? el.value : '';
        var count = host.querySelector('[data-count="' + i + '"]');
        if (count) count.textContent = v.length + ' / ' + f.m;
        if (f.t === 'color' && v && overlay) overlay.style.color = v;
        if (f.p && f.t !== 'color' && v) lines.push(v);
      });
      if (overlay) overlay.textContent = lines.join('\n');
    };
    host.addEventListener('input', update);
    host.addEventListener('change', update);

    // Required fields: stop the theme's add to cart until they're filled.
    form.addEventListener('submit', function (e) {
      var bad = Array.prototype.filter.call(host.querySelectorAll('[required]'), function (el) { return !el.checkValidity(); })[0];
      if (bad) { e.preventDefault(); e.stopImmediatePropagation(); bad.reportValidity(); }
    }, true);

    widgets.push({ form: form, fee: c.fee, filled: function () {
      return Array.prototype.some.call(host.querySelectorAll('[data-i]'), function (el) { return (el.type === 'radio' ? el.checked : el.value.trim()) ? true : false; });
    } });
  }

  /* ---- the fee: one linked line added with the item ------------------------------------------ */
  function widgetFor(variantId) {
    for (var i = 0; i < widgets.length; i++) {
      var f = widgets[i].form.querySelector('[name="id"]');
      if (f && String(f.value) === String(variantId)) return widgets[i];
    }
    return null;
  }
  var previous = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : input && input.url;
      if (url && /\/cart\/add(\.js)?(\?|$)/.test(url) && init && init.body && widgets.length) {
        var body = init.body, items = null, rest = {}, single = false;
        if (typeof FormData !== 'undefined' && body instanceof FormData && body.get('id') && !body.get('items[0][id]')) {
          var main = { id: Number(body.get('id')), quantity: Number(body.get('quantity') || 1), properties: {} };
          body.forEach(function (v, k) {
            var m = /^properties\[(.+)\]$/.exec(k);
            if (m) main.properties[m[1]] = v;
            else if (k === 'selling_plan' && v) main.selling_plan = Number(v);
            else if (['id', 'quantity', 'form_type', 'utf8', 'product-id', 'section-id'].indexOf(k) < 0 && typeof v === 'string') rest[k] = v;
          });
          items = [main];
          single = true;
        } else if (typeof body === 'string' && body.charAt(0) === '{') {
          var j = JSON.parse(body);
          if (j.items) { items = j.items; Object.keys(j).forEach(function (k) { if (k !== 'items') rest[k] = j[k]; }); }
          else if (j.id) { items = [{ id: Number(j.id), quantity: Number(j.quantity || 1), properties: j.properties || {} }]; Object.keys(j).forEach(function (k) { if (['id', 'quantity', 'properties'].indexOf(k) < 0) rest[k] = j[k]; }); single = true; }
        }
        var w = items && widgetFor(items[0].id);
        if (w && w.fee && w.filled()) {
          var props = items[0].properties = items[0].properties || {};
          var pid = props._cro_pid || (props._cro_pid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
          items.push({ id: Number(w.fee.v), quantity: items[0].quantity || 1, properties: { _cro_parent: pid, _cro_fee: 'Personalization' } });
          rest.items = items;
          var headers = new Headers(init.headers || {});
          headers.set('Content-Type', 'application/json');
          headers.set('Accept', 'application/json');
          return previous.call(this, input, Object.assign({}, init, { body: JSON.stringify(rest), headers: headers })).then(function (res) {
            if (!res.ok || !single) return res;
            return res.json().then(function (d) {
              var one = d && d.items ? Object.assign({}, d.items[0], { sections: d.sections }) : d;
              return new Response(JSON.stringify(one), { status: res.status, headers: { 'Content-Type': 'application/json' } });
            });
          });
        }
      }
    } catch (e) { /* the theme's request goes through untouched */ }
    return previous.apply(this, arguments);
  };

  function scan() { document.querySelectorAll('[data-ucs-personalize]').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
