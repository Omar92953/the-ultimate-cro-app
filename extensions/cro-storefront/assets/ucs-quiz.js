/* Product finder quiz (app: Sections → Product quiz). Each answer carries product tags; the products
   (from a collection's products.json) with the most matching tags are recommended. The answers are
   saved on the cart as "Quiz" so they arrive on the order. */
(function () {
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var money = function (v) { try { return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD' }).format(Number(v)); } catch (e) { return v; } };

  function setup(host) {
    if (host.hasAttribute('data-ready')) return;
    host.setAttribute('data-ready', '');
    var c;
    try { c = JSON.parse(host.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    var t = c.t, root = (host.getAttribute('data-root') || '/').replace(/\/$/, '');
    var picks = [], step = -1, products = null;

    var load = function () {
      if (!products) products = fetch(root + '/collections/' + encodeURIComponent(c.col || 'all') + '/products.json?limit=250').then(function (r) { return r.json(); }).then(function (d) { return d.products || []; }).catch(function () { return []; });
      return products;
    };
    var frame = function (inner) { host.innerHTML = '<div class="ucs-wrap ucs-qz__wrap">' + inner + '</div>'; };

    var start = function () {
      step = -1; picks = [];
      frame('<h2 class="ucs-qz__h">' + esc(t.heading) + '</h2>' + (t.intro ? '<p class="ucs-qz__intro">' + esc(t.intro) + '</p>' : '') + '<button type="button" class="ucs-btn" data-go>' + esc(t.start) + '</button>');
      load();
    };
    var ask = function () {
      var q = c.q[step];
      frame('<p class="ucs-qz__progress">' + esc(t.progress.replace('{n}', step + 1).replace('{total}', c.q.length)) + '</p>' +
        '<span class="ucs-qz__bar"><i style="width:' + Math.round((step / c.q.length) * 100) + '%"></i></span>' +
        '<h2 class="ucs-qz__q" tabindex="-1">' + esc(q.t) + '</h2><div class="ucs-qz__answers" role="group" aria-label="' + esc(q.t) + '">' +
        q.a.map(function (a, i) { return '<button type="button" class="ucs-qz__a" data-a="' + i + '">' + esc(a.l) + '</button>'; }).join('') + '</div>' +
        (step > 0 ? '<button type="button" class="ucs-qz__back" data-back>' + esc(t.back) + '</button>' : ''));
      var h = host.querySelector('.ucs-qz__q');
      if (h) h.focus();
    };
    var results = function () {
      frame('<p class="ucs-qz__progress">…</p>');
      var want = {};
      picks.forEach(function (a) { a.g.forEach(function (g) { want[g] = (want[g] || 0) + 1; }); });
      if (c.save) {
        var attrs = { Quiz: c.q.map(function (q, i) { return q.t + ': ' + picks[i].l; }).join(' | ') };
        fetch(root + '/cart/update.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ attributes: attrs }) }).catch(function () {});
      }
      load().then(function (list) {
        var scored = list.map(function (p) {
          var tags = (Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',')).map(function (x) { return String(x).trim().toLowerCase(); });
          var score = tags.reduce(function (n, g) { return n + (want[g] || 0); }, 0);
          return { p: p, score: score, ok: (p.variants || []).some(function (v) { return v.available; }) };
        }).filter(function (x) { return x.ok; });
        var hits = scored.filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; });
        var none = !hits.length;
        var show = (none ? scored : hits).slice(0, c.n);
        frame('<h2 class="ucs-qz__h">' + esc(t.resultsHeading) + '</h2>' + (none ? '<p class="ucs-qz__intro">' + esc(t.none) + '</p>' : '') +
          '<ul class="ucs-qz__grid" role="list">' + show.map(function (x) {
            var p = x.p, v = p.variants.filter(function (y) { return y.available; })[0], img = p.images && p.images[0] && p.images[0].src;
            return '<li class="ucs-qz__item"><a href="' + root + '/products/' + esc(p.handle) + '">' + (img ? '<img src="' + esc(img + (img.indexOf('?') > -1 ? '&' : '?') + 'width=400') + '" alt="" loading="lazy">' : '<span class="ucs-qz__ph"></span>') +
              '<b>' + esc(p.title) + '</b></a><span>' + money(v.price) + '</span><button type="button" class="ucs-btn" data-add="' + v.id + '">' + esc(t.add) + '</button></li>';
          }).join('') + '</ul><button type="button" class="ucs-qz__back" data-again>' + esc(t.again) + '</button>');
      });
    };

    host.addEventListener('click', function (e) {
      var el = e.target.closest('button');
      if (!el) return;
      if (el.hasAttribute('data-go')) { step = 0; return ask(); }
      if (el.hasAttribute('data-back')) { step--; picks.pop(); return ask(); }
      if (el.hasAttribute('data-again')) return start();
      if (el.hasAttribute('data-a')) {
        picks[step] = c.q[step].a[Number(el.getAttribute('data-a'))];
        step++;
        return step < c.q.length ? ask() : results();
      }
      if (el.hasAttribute('data-add')) {
        el.disabled = true;
        fetch(root + '/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: [{ id: Number(el.getAttribute('data-add')), quantity: 1, properties: { _source: 'quiz' } }] }) })
          .then(function () { el.disabled = false; document.dispatchEvent(new CustomEvent('ucs:cart:added')); });
      }
    });
    start();
  }
  function scan() { document.querySelectorAll('[data-ucs-quiz]').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
