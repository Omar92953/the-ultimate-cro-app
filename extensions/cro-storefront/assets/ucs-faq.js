/* CRO Toolbox — FAQ: search, group buttons, and "one answer at a time" for browsers without <details name>. */
(function () {
  if (window.__ucsFaq) return;
  window.__ucsFaq = true;
  var nativeExclusive = 'name' in HTMLDetailsElement.prototype;

  function setup(root) {
    if (root.__ucs) return;
    root.__ucs = true;
    var items = Array.prototype.slice.call(root.querySelectorAll('.ucs-faq__item'));
    var input = root.querySelector('.ucs-faq__search input');
    var none = root.querySelector('.ucs-faq__none');
    var list = root.querySelector('.ucs-faq__list');
    var group = '';
    var filtered = false;
    // Keep the section as tall as the full list while filtering, so the page doesn't jump.
    function lock() {
      if (!list || filtered) return;
      list.style.minHeight = '';
      var open = items.filter(function (d) { return d.open; });
      open.forEach(function (d) { d.open = false; });
      list.style.minHeight = list.offsetHeight + 'px';
      open.forEach(function (d) { d.open = true; });
    }
    lock();
    window.addEventListener('load', lock);
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(lock, 150); });

    function filter() {
      var q = input ? input.value.trim().toLowerCase() : '';
      var shown = 0;
      items.forEach(function (d) {
        var ok = (!group || d.getAttribute('data-group') === group) && (!q || d.textContent.toLowerCase().indexOf(q) > -1);
        d.hidden = !ok;
        if (ok) shown++;
      });
      if (none) none.hidden = shown > 0;
      filtered = !!(group || q);
    }
    if (input) input.addEventListener('input', filter);
    root.addEventListener('click', function (e) {
      var tab = e.target.closest('.ucs-faq__tab');
      if (!tab) return;
      group = tab.getAttribute('data-group');
      root.querySelectorAll('.ucs-faq__tab').forEach(function (t) { t.setAttribute('aria-pressed', t === tab ? 'true' : 'false'); });
      filter();
    });
    if (!nativeExclusive) {
      items.forEach(function (d) {
        d.addEventListener('toggle', function () {
          if (!d.open || !d.getAttribute('name')) return;
          items.forEach(function (o) { if (o !== d && o.getAttribute('name') === d.getAttribute('name')) o.open = false; });
        });
      });
    }
  }
  function scan() { document.querySelectorAll('.ucs-faq').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
