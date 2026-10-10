/* CRO Toolbox — keeps linked cart lines together. Add-ons (and other app-added extras) carry
   `_cro_parent`, the `_cro_pid` of the line they belong to; when that line leaves the cart, the
   extras are removed too. Runs after any cart change and on the cart page; refreshes Dawn-family
   drawers with the Section Rendering API, or reloads the cart page. */
(function () {
  if (window.__ucsCartGuard) return;
  window.__ucsCartGuard = true;
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var busy = false, timer;

  function cartUI() {
    var el = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    return el && typeof el.renderContents === 'function' && typeof el.getSectionsToRender === 'function' ? el : null;
  }

  function check() {
    if (busy) return;
    busy = true;
    nativeFetch(root + 'cart.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var parents = {};
        cart.items.forEach(function (i) { var p = i.properties && i.properties._cro_pid; if (p) parents[p] = true; });
        var updates = {}, n = 0;
        cart.items.forEach(function (i) {
          var p = i.properties && i.properties._cro_parent;
          if (p && !parents[p]) { updates[i.key] = 0; n++; }
        });
        if (!n) return;
        var ui = cartUI();
        var body = { updates: updates };
        if (ui) body.sections = ui.getSectionsToRender().map(function (s) { return s.id; });
        return nativeFetch(root + 'cart/update.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (/\/cart\/?$/.test(location.pathname)) return location.reload();
            if (ui && data.sections) {
              try { ui.renderContents(Object.assign({}, data, { id: undefined })); } catch (e) { /* the theme redraws on its next change */ }
            }
            document.dispatchEvent(new CustomEvent('ucro:cart-changed'));
          });
      })
      .catch(function () {})
      .then(function () { busy = false; });
  }
  var soon = function () { clearTimeout(timer); timer = setTimeout(check, 250); };

  var nativeFetch = window.fetch.bind(window);
  var wrapped = window.fetch;
  window.fetch = function (input) {
    var url = typeof input === 'string' ? input : input && input.url;
    var p = wrapped.apply(this, arguments);
    if (url && /\/cart\/(change|update|clear)(\.js)?(\?|$)/.test(url)) p.then(soon, function () {});
    return p;
  };
  // Forms that post to /cart/change or the cart page's update button reload the page: check on load.
  if (/\/cart\/?$/.test(location.pathname)) soon();
  document.addEventListener('ucro:cart-check', soon);
})();
