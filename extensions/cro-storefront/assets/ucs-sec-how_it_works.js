/* CRO section: how it works (3 to 5 steps, numbers or icons, optional button). */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  S.def('how_it_works', function (el, c) {
    var d = c.d, steps = d.steps || [];
    el.innerHTML = '<div class="usec__in">' + S.head(c) + '<ol class="usec-hw" style="--n:' + Math.max(1, steps.length) + '">' + steps.map(function (s, i) {
      var mark = c.l.marker === 'icon' && s.i ? S.icon(s.i) : '<span>' + (i + 1) + '</span>';
      return '<li class="usec-hw__i"><span class="usec-hw__m">' + mark + '</span><div>' + (s.t ? '<p class="usec-hw__t">' + S.esc(s.t) + '</p>' : '') + (s.p ? '<p class="usec-hw__p">' + S.esc(s.p) + '</p>' : '') + '</div></li>';
    }).join('') + '</ol>' + (d.btn && d.u ? '<div class="usec__foot"><a class="usec__btn" href="' + S.esc(d.u) + '">' + S.esc(d.btn) + '</a></div>' : '') + '</div>';
  });
})();
