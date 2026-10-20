/* CRO section: benefits row (icon or picture, title, one line). */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  S.def('benefits', function (el, c) {
    var items = c.d.items || [];
    el.innerHTML = '<div class="usec__in">' + S.head(c) + '<ul class="usec-bn" style="--n:' + Math.max(1, items.length) + '">' + items.map(function (i) {
      var pic = i.im ? '<img src="' + S.esc(S.img(i.im.u, 120)) + '" alt="" width="40" height="40" loading="lazy">' : S.icon(i.i);
      return '<li class="usec-bn__i">' + (pic ? '<span class="usec-bn__ic">' + pic + '</span>' : '') + '<div>' + (i.t ? '<p class="usec-bn__t">' + S.esc(i.t) + '</p>' : '') + (i.p ? '<p class="usec-bn__p">' + S.esc(i.p) + '</p>' : '') + '</div></li>';
    }).join('') + '</ul></div>';
  });
})();
