/* CRO section: shoppable image. Dots on the picture; a tap opens a small card with the product's
   picture, live price and Add to cart (products with options link to their page). */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  var PLUS = '<path d="M12 5v14M5 12h14"/>';
  S.def('shoppable', function (el, c, ctx) {
    var d = c.d, l = c.l;
    if (!d.im) { el.innerHTML = ''; el.hidden = true; return; }
    var ratio = l.ratio === 'auto' ? d.im.w + ' / ' + d.im.h : l.ratio === '1' ? '1 / 1' : l.ratio === '0.8' ? '4 / 5' : '3 / 2';
    el.innerHTML = '<div class="usec__in">' + S.head(c) + '<div class="usec-sh" style="aspect-ratio:' + ratio + '"><img class="usec-sh__img" src="' + S.esc(S.img(d.im.u, 1800)) + '" alt="" loading="lazy">' +
      (d.spots || []).map(function (s, i) {
        var mark = l.marker === 'number' ? '<span>' + (i + 1) + '</span>' : l.marker === 'plus' ? S.icon(PLUS) : '';
        return '<button type="button" class="usec-sh__dot" style="left:' + s.x + '%;top:' + s.y + '%" data-i="' + i + '" aria-expanded="false" aria-label="' + S.esc(s.t) + '">' + mark + '</button>';
      }).join('') + '<div class="usec-sh__card" role="dialog" hidden></div></div></div>';
    var card = el.querySelector('.usec-sh__card'), open = -1;
    function close() {
      card.hidden = true;
      var b = el.querySelector('.usec-sh__dot[aria-expanded="true"]');
      if (b) b.setAttribute('aria-expanded', 'false');
      open = -1;
    }
    function show(i, btn) {
      var s = d.spots[i];
      open = i;
      btn.setAttribute('aria-expanded', 'true');
      var url = ctx.root + 'products/' + s.h;
      card.style.left = s.x + '%';
      card.style.top = s.y + '%';
      card.classList.toggle('is-left', s.x > 55);
      card.classList.toggle('is-up', s.y > 55);
      card.setAttribute('aria-label', s.t);
      function draw(price, variant, avail, many) {
        card.innerHTML = '<a class="usec-sh__p" href="' + S.esc(url) + '">' + (s.im ? '<img src="' + S.esc(S.img(s.im, 200)) + '" alt="" width="64" height="64">' : '') +
          '<span><span class="usec-sh__t">' + S.esc(s.t) + '</span><span class="usec-sh__pr">' + S.money(price, ctx.fmt) + '</span></span></a>' +
          (many || !variant ? '<a class="usec__btn" href="' + S.esc(url) + '">' + S.esc(d.view) + '</a>' : '<button type="button" class="usec__btn" data-add="' + variant + '" data-href="' + S.esc(url) + '"' + (avail ? '' : ' disabled') + '>' + S.esc(d.btn) + '</button>') +
          '<button type="button" class="usec-sh__x" aria-label="Close">✕</button>';
      }
      draw(s.pr, s.v, true, s.n > 1);
      card.hidden = false;
      S.product(ctx, s.h).then(function (p) {
        if (!p || open !== i) return;
        var v = (p.variants || []).filter(function (x) { return x.available; })[0] || (p.variants || [])[0];
        if (v) draw(v.price, v.id, v.available, (p.variants || []).length > 1);
      });
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.usec-sh__dot');
      if (b) { var i = Number(b.getAttribute('data-i')); if (open === i) close(); else { close(); show(i, b); } return; }
      if (e.target.closest('.usec-sh__x')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open > -1) close(); });
    S.wireAdd(card, ctx, 'shoppable_image');
  });
})();
