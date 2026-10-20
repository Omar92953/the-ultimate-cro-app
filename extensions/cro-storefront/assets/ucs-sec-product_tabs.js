/* CRO section: product details as tabs or an accordion. Tab 1 can be the product description; a tab
   can read a product metafield (printed by the block as a template), else shows the app's text. */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  S.def('product_tabs', function (el, c, ctx) {
    var d = c.d, t = ctx.t || {};
    var list = [];
    if (d.desc && t.desc && t.desc.trim()) list.push({ t: d.dt || 'Details', html: t.desc });
    (d.tabs || []).forEach(function (x) {
      var html = x.mf && t[x.mf] && t[x.mf].trim() ? t[x.mf] : S.paras(x.p);
      if (html) list.push({ t: x.t, html: html });
    });
    if (!list.length) { el.innerHTML = ''; el.hidden = true; return; }
    var id = S.id(), body;
    if (c.l.style === 'tabs') {
      body = '<div class="usec-pt__tabs" role="tablist">' + list.map(function (x, i) {
        return '<button type="button" role="tab" id="' + id + 't' + i + '" aria-controls="' + id + 'p' + i + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + S.esc(x.t) + '</button>';
      }).join('') + '</div>' + list.map(function (x, i) {
        return '<div class="usec-pt__panel rte" role="tabpanel" id="' + id + 'p' + i + '" aria-labelledby="' + id + 't' + i + '"' + (i ? ' hidden' : '') + '>' + x.html + '</div>';
      }).join('');
    } else {
      body = list.map(function (x, i) {
        return '<details class="usec-pt__item"' + (i === 0 && c.l.firstOpen ? ' open' : '') + '><summary>' + S.esc(x.t) + '<span class="usec-pt__mark" aria-hidden="true"></span></summary><div class="usec-pt__panel rte">' + x.html + '</div></details>';
      }).join('');
    }
    el.innerHTML = '<div class="usec__in">' + S.head(c) + '<div class="usec-pt">' + body + '</div></div>';
    var tabs = el.querySelectorAll('[role="tab"]');
    function go(i) {
      for (var j = 0; j < tabs.length; j++) {
        var on = j === i;
        tabs[j].setAttribute('aria-selected', on);
        tabs[j].tabIndex = on ? 0 : -1;
        el.querySelector('#' + tabs[j].getAttribute('aria-controls')).hidden = !on;
      }
      tabs[i].focus();
    }
    for (var i = 0; i < tabs.length; i++) {
      (function (i) {
        tabs[i].addEventListener('click', function () { go(i); });
        tabs[i].addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight') go((i + 1) % tabs.length);
          if (e.key === 'ArrowLeft') go((i - 1 + tabs.length) % tabs.length);
        });
      })(i);
    }
  });
})();
