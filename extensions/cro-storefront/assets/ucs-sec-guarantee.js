/* CRO section: guarantee / risk reversal (a seal drawn here, or the merchant's picture, plus words). */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  function seal(s, small) {
    if (small) return '<span class="usec-gu__dot">' + S.icon(s.i) + '</span>';
    var id = S.id();
    var words = (s.a + ' • ' + s.b + ' • ').toUpperCase();
    return '<svg class="usec-gu__seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><defs><path id="' + id + '" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs>' +
      '<circle cx="60" cy="60" r="59" fill="var(--usec-ac, #111)"/><circle cx="60" cy="60" r="53" fill="none" stroke="var(--usec-act, #fff)" stroke-width="1.2" stroke-dasharray="2 3"/>' +
      '<circle cx="60" cy="60" r="33" fill="none" stroke="var(--usec-act, #fff)" stroke-width="1.2"/>' +
      '<text font-size="10" font-weight="700" fill="var(--usec-act, #fff)" font-family="inherit"><textPath href="#' + id + '" textLength="272" lengthAdjust="spacing">' + S.esc(words) + '</textPath></text>' +
      '<g transform="translate(44 44) scale(1.333)" fill="none" stroke="var(--usec-act, #fff)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + s.i + '</g></svg>';
  }
  S.def('guarantee', function (el, c) {
    var d = c.d, small = c.l.style === 'inline';
    var badge = d.im ? '<img class="usec-gu__img" src="' + S.esc(S.img(d.im.u, 240)) + '" alt="" loading="lazy">' : d.seal ? seal(d.seal, small) : '';
    el.innerHTML = '<div class="usec__in">' + S.head(c) + '<div class="usec-gu">' + (badge ? '<div class="usec-gu__badge">' + badge + '</div>' : '') +
      '<div class="usec-gu__body">' + (d.t ? '<p class="usec-gu__t">' + S.esc(d.t) + '</p>' : '') + (d.p ? '<p class="usec-gu__p">' + S.esc(d.p) + '</p>' : '') +
      (d.u && d.ut ? '<a class="usec-gu__a" href="' + S.esc(d.u) + '">' + S.esc(d.ut) + '</a>' : '') + '</div></div></div>';
  });
})();
