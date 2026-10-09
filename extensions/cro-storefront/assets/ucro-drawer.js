/*
 * CRO Toolbox — cross-sell inside Dawn-family cart drawers.
 * The drawer's markup is replaced on every cart change, so the offer box is re-inserted after
 * each render (MutationObserver) and re-matched against the live cart.
 */
(function () {
  var U = window.UCRO;
  var dataEl = document.getElementById('ucro-drawer-data');
  if (!U || !dataEl || window.__ucroDrawer) return;
  window.__ucroDrawer = true;

  var data;
  try {
    data = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }
  if (!data.rules || !data.rules.length) return;
  data.rules.sort(function (a, b) { return a.p - b.p; });

  var drawer = document.querySelector('cart-drawer');
  if (!drawer) return; // not a Dawn-family drawer: stay silent

  var busy = false;
  var timer;

  function match(items) {
    var inCart = {};
    items.forEach(function (i) { inCart[i.product_id] = true; });
    for (var r = 0; r < data.rules.length; r++) {
      var rule = data.rules[r];
      var hit = rule.t === 'all' ? items.length > 0 : rule.ids.some(function (id) { return inCart[id]; });
      if (!hit) continue;
      var offers = rule.offers.filter(function (o) { return !inCart[o.id] && o.v.length; }).slice(0, Number(data.max) || 2);
      if (offers.length) return { rule: rule, offers: offers };
    }
    return null;
  }

  function build(found) {
    var box = document.createElement('div');
    box.className = 'ucro ucro-drawer';
    box.setAttribute('data-ucro-drawer', '');
    var h = document.createElement('p');
    h.className = 'ucro-drawer__heading';
    h.textContent = found.rule.h || data.heading;
    box.appendChild(h);
    var ul = document.createElement('ul');
    ul.className = 'ucro-drawer__list';
    ul.setAttribute('role', 'list');
    found.offers.forEach(function (o) {
      var li = document.createElement('li');
      li.className = 'ucro-drawer__item';
      li.innerHTML = (o.img ? '<img src="' + o.img + '" alt="" width="56" height="56" loading="lazy">' : '<span></span>') +
        '<span class="ucro-drawer__body"><a class="ucro-drawer__title"></a><span class="ucro-drawer__prices"><span data-ucro-price></span></span></span>' +
        '<button type="button" class="ucro-btn ucro-drawer__add"></button>';
      var a = li.querySelector('a');
      a.textContent = o.title;
      a.href = o.url;
      var img = li.querySelector('img');
      if (img) img.alt = o.title;
      var price = li.querySelector('[data-ucro-price]');
      var btn = li.querySelector('button');
      btn.textContent = data.add;
      btn.dataset.variant = o.v[0].id;
      function show(v) {
        price.textContent = v.price;
        var old = li.querySelector('.ucro-was');
        if (old) old.remove();
        if (v.was) {
          var s = document.createElement('s');
          s.className = 'ucro-was';
          s.textContent = v.was;
          price.parentNode.appendChild(s);
        }
      }
      show(o.v[0]);
      if (o.v.length > 1) {
        var sel = document.createElement('select');
        sel.className = 'ucro-select ucro-drawer__variant';
        sel.setAttribute('aria-label', o.title);
        o.v.forEach(function (v, i) {
          var opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = v.t;
          opt.dataset.index = i;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', function () {
          var v = o.v[Number(sel.options[sel.selectedIndex].dataset.index)];
          btn.dataset.variant = v.id;
          show(v);
        });
        li.querySelector('.ucro-drawer__body').appendChild(sel);
      }
      ul.appendChild(li);
    });
    box.appendChild(ul);
    var err = document.createElement('p');
    err.className = 'ucro__error';
    err.setAttribute('role', 'alert');
    err.hidden = true;
    box.appendChild(err);
    return box;
  }

  function place() {
    if (busy) return;
    var footer = drawer.querySelector('.drawer__footer');
    var inner = drawer.querySelector('.drawer__inner');
    var old = drawer.querySelector('[data-ucro-drawer]');
    if (!inner || inner.classList.contains('is-empty')) {
      if (old) old.remove();
      return;
    }
    U.cart().then(function (cart) {
      var found = match(cart.items || []);
      var current = drawer.querySelector('[data-ucro-drawer]');
      if (current) current.remove();
      if (!found) return;
      var box = build(found);
      if (footer && footer.parentNode) footer.parentNode.insertBefore(box, footer);
      else inner.appendChild(box);
      U.decorate(box);
    }).catch(function () {});
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(place, 80);
  }

  drawer.addEventListener('click', function (e) {
    var btn = e.target.closest('.ucro-drawer__add');
    if (!btn || busy) return;
    busy = true;
    btn.disabled = true;
    btn.classList.add('loading', 'ucro-is-busy');
    var box = btn.closest('[data-ucro-drawer]');
    var err = box && box.querySelector('.ucro__error');
    U.add([{ id: Number(btn.dataset.variant), quantity: 1 }])
      .catch(function (error) {
        if (err) {
          err.textContent = (error && error.message !== 'error' && error.message) || data.error;
          err.hidden = false;
        }
        btn.disabled = false;
        btn.classList.remove('loading', 'ucro-is-busy');
      })
      .finally(function () {
        busy = false;
        schedule();
      });
  });

  new MutationObserver(function (records) {
    // ignore our own insertions and anything happening inside our box
    var foreign = records.some(function (r) {
      var t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      if (t && t.closest('[data-ucro-drawer]')) return false;
      return Array.prototype.some.call(r.addedNodes, function (n) { return !(n.nodeType === 1 && n.hasAttribute('data-ucro-drawer')); }) || r.removedNodes.length > 0 && !Array.prototype.every.call(r.removedNodes, function (n) { return n.nodeType === 1 && n.hasAttribute('data-ucro-drawer'); });
    });
    if (foreign) schedule();
  }).observe(drawer, { childList: true, subtree: true });

  schedule();
})();
