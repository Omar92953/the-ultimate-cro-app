/* CRO section: recently viewed. On a product page it notes the product in the shopper's own browser
   (localStorage "ucs-rv", last 20 handles; functional, never sent anywhere), then shows the others
   with live prices from /products/<handle>.js. Hidden until the shopper has viewed another product. */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  var KEY = 'ucs-rv';
  function read() {
    try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }) : []; } catch (e) { return []; }
  }
  function note(h) {
    if (!h) return;
    try { localStorage.setItem(KEY, JSON.stringify([h].concat(read().filter(function (x) { return x !== h; })).slice(0, 20))); } catch (e) { /* storage off */ }
  }
  function card(p, c, ctx) {
    var d = c.d, l = c.l;
    var v = (p.variants || []).filter(function (x) { return x.available; })[0] || (p.variants || [])[0];
    var url = ctx.root + 'products/' + p.handle;
    var many = (p.variants || []).length > 1;
    var src = p.featured_image || (p.images && p.images[0]);
    var btn = '';
    if (l.add && v) {
      btn = !p.available ? '<button type="button" class="usec__btn usec-rv__btn" disabled>' + S.esc(d.out) + '</button>'
        : many ? '<a class="usec__btn usec-rv__btn" href="' + S.esc(url) + '">' + S.esc(d.choose) + '</a>'
        : '<button type="button" class="usec__btn usec-rv__btn" data-add="' + v.id + '" data-href="' + S.esc(url) + '">' + S.esc(d.btn) + '</button>';
    }
    var price = l.price && v ? '<span class="usec-rv__pr">' + S.money(v.price, ctx.fmt) + (v.compare_at_price > v.price ? ' <s>' + S.money(v.compare_at_price, ctx.fmt) + '</s>' : '') + '</span>' : '';
    return '<li class="usec-rv__i"><a class="usec-rv__a" href="' + S.esc(url) + '">' + (src ? '<img src="' + S.esc(S.img(src.indexOf('//') === 0 ? 'https:' + src : src, 500)) + '" alt="" loading="lazy">' : '<span class="usec-rv__ph"></span>') +
      '<span class="usec-rv__t">' + S.esc(p.title) + '</span>' + price + '</a>' + btn + '</li>';
  }
  S.def('recently_viewed', function (el, c, ctx) {
    var list = ctx.preview ? ctx.recent || [] : read();
    if (!ctx.preview) note(ctx.p);
    if (c.l.hideCurrent && ctx.p) list = list.filter(function (h) { return h !== ctx.p; });
    list = list.slice(0, c.d.n);
    if (!list.length) { el.hidden = !ctx.design; el.innerHTML = ctx.design ? '<div class="usec__in"><p class="ucs-note">Recently viewed products show here once a shopper has looked at a few.</p></div>' : ''; return; }
    Promise.all(list.map(function (h) { return S.product(ctx, h); })).then(function (ps) {
      ps = ps.filter(Boolean);
      if (!ps.length) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = '<div class="usec__in">' + S.head(c) + '<div class="usec-rv__vp"><ul class="usec-rv" style="--n:' + Math.min(ps.length, c.l.style === 'row' ? 6 : 4) + '">' + ps.map(function (p) { return card(p, c, ctx); }).join('') + '</ul></div></div>';
    });
    S.wireAdd(el, ctx, 'recently_viewed');
  });
})();
