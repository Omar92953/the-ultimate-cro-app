/* CRO section: comparison table ("Us" against up to 3 others). Cells: "y" tick, "n" cross, else text. */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  var YES = '<path d="M20 6 9 17l-5-5"/>';
  var NO = '<path d="M18 6 6 18M6 6l12 12"/>';
  function cell(v) {
    if (v === 'y') return '<span class="usec-ct__y" role="img" aria-label="Yes">' + S.icon(YES) + '</span>';
    if (v === 'n') return '<span class="usec-ct__n" role="img" aria-label="No">' + S.icon(NO) + '</span>';
    return '<span class="usec-ct__v">' + S.esc(v) + '</span>';
  }
  S.def('compare_table', function (el, c) {
    var d = c.d, cols = [d.us].concat(d.them || []);
    var body;
    if (c.l.style === 'cards') {
      body = '<div class="usec-ct__cards">' + cols.map(function (name, i) {
        return '<div class="usec-ct__card' + (i === 0 ? ' is-us' : '') + '"><p class="usec-ct__name">' + S.esc(name) + '</p><ul>' + d.rows.map(function (r) {
          return '<li><span>' + S.esc(r.label) + '</span>' + cell(i === 0 ? r.us : r.them[i - 1]) + '</li>';
        }).join('') + '</ul></div>';
      }).join('') + '</div>';
    } else {
      body = '<div class="usec-ct__scroll"><table class="usec-ct"><thead><tr><th scope="col"><span class="usec-ct__sr">Feature</span></th>' + cols.map(function (name, i) {
        return '<th scope="col"' + (i === 0 ? ' class="is-us"' : '') + '>' + S.esc(name) + '</th>';
      }).join('') + '</tr></thead><tbody>' + d.rows.map(function (r) {
        return '<tr><th scope="row">' + S.esc(r.label) + '</th><td class="is-us">' + cell(r.us) + '</td>' + r.them.map(function (v) { return '<td>' + cell(v) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
    }
    el.innerHTML = '<div class="usec__in">' + S.head(c) + body + '</div>';
  });
})();
