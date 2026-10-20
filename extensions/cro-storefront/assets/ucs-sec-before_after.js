/* CRO section: before and after slider. Drag (mouse or touch) anywhere on the picture, or use the
   arrow keys on the handle (a range input, so screen readers can use it too). */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  var ARROWS = '<path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/>';
  S.def('before_after', function (el, c) {
    var d = c.d, l = c.l;
    if (!d.a || !d.b) { el.innerHTML = ''; el.hidden = true; return; }
    var ratio = l.ratio === 'auto' ? d.b.w + ' / ' + d.b.h : l.ratio === '1' ? '1 / 1' : l.ratio === '0.8' ? '4 / 5' : '3 / 2';
    var v = l.dir === 'v';
    el.innerHTML = '<div class="usec__in">' + S.head(c) + '<figure class="usec-ba" style="--pos:' + l.start + '%;aspect-ratio:' + ratio + '">' +
      '<img class="usec-ba__img" src="' + S.esc(S.img(d.b.u, 1600)) + '" alt="' + S.esc(d.bl) + '" loading="lazy" draggable="false">' +
      '<div class="usec-ba__before"><img class="usec-ba__img" src="' + S.esc(S.img(d.a.u, 1600)) + '" alt="' + S.esc(d.al) + '" loading="lazy" draggable="false"></div>' +
      (d.al ? '<span class="usec-ba__label usec-ba__label--a">' + S.esc(d.al) + '</span>' : '') + (d.bl ? '<span class="usec-ba__label usec-ba__label--b">' + S.esc(d.bl) + '</span>' : '') +
      '<span class="usec-ba__line" aria-hidden="true"><span class="usec-ba__knob">' + (l.handle === 'line' ? '' : S.icon(ARROWS)) + '</span></span>' +
      '<input class="usec-ba__range" type="range" min="0" max="100" value="' + l.start + '" aria-label="' + S.esc((d.al || 'Before') + ' / ' + (d.bl || 'After')) + '"' + (v ? ' aria-orientation="vertical"' : '') + '>' +
      '</figure>' + (d.cap ? '<p class="usec-ba__cap">' + S.esc(d.cap) + '</p>' : '') + '</div>';
    var fig = el.querySelector('.usec-ba'), range = el.querySelector('.usec-ba__range'), down = false;
    function set(p) { p = Math.max(0, Math.min(100, p)); fig.style.setProperty('--pos', p + '%'); range.value = Math.round(p); }
    function at(e) {
      var r = fig.getBoundingClientRect();
      set(v ? ((e.clientY - r.top) / r.height) * 100 : ((e.clientX - r.left) / r.width) * 100);
    }
    fig.addEventListener('pointerdown', function (e) { down = true; fig.setPointerCapture(e.pointerId); at(e); });
    fig.addEventListener('pointermove', function (e) { if (down) at(e); });
    fig.addEventListener('pointerup', function () { down = false; });
    fig.addEventListener('pointercancel', function () { down = false; });
    range.addEventListener('input', function () { set(Number(range.value)); });
  });
})();
