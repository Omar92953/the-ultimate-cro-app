/*
 * CRO Toolbox — loyalty program (Pro): the rewards launcher and panel, "Earn X points" on product pages and in
 * the cart, and a small "You earned" note. The program (rules, rewards, words, look) comes from the Conversion
 * boosters embed (#ucs-loy-data); a member's own points come from the app proxy, which Shopify signs with the
 * logged in customer, so nothing here can read or spend anyone else's points.
 */
(function () {
  var el = document.getElementById('ucs-loy-data');
  if (!el || window.__ucsLoy) return;
  window.__ucsLoy = true;
  var D;
  try { D = JSON.parse(el.textContent); } catch (e) { return; }
  var c = D.c || {}, t = c.t || {}, w = c.w || {};
  if (!c.on) return;
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var url = root + 'apps/ucro/loyalty';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var unit = function (n) { return n === 1 ? (c.u && c.u.one) || 'point' : (c.u && c.u.many) || 'points'; };
  var pts = function (n) { return Number(n).toLocaleString() + ' ' + unit(Math.abs(n)); };
  var fill = function (s, n) { return String(s || '').replace('{n}', pts(n)); };
  var perMoney = function () { return String(D.fmt || '{{amount}}').replace(/\{\{\s*\w+\s*\}\}/, '1').replace(/<[^>]*>/g, ''); };
  var post = function (body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: 'unavailable' }; });
  };

  /* ---------- launcher and panel ---------- */
  var box = document.createElement('div');
  box.className = 'ucs-loy ucs-loy--' + (w.pos === 'left' ? 'left' : 'right');
  box.style.setProperty('--ucs-loy-a', w.a || '#111');
  box.style.setProperty('--ucs-loy-oa', w.oa || '#fff');
  box.innerHTML = '<button type="button" class="ucs-loy__launch" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg><span>' + esc(t.launcher) + '</span></button>' +
    '<div class="ucs-loy__panel" role="dialog" aria-label="' + esc(t.title) + '" hidden><div class="ucs-loy__top"><b>' + esc(t.title) + '</b><button type="button" class="ucs-loy__x" aria-label="Close">×</button></div><div class="ucs-loy__body"></div></div>';
  document.body.appendChild(box);
  var launch = box.querySelector('.ucs-loy__launch'), panel = box.querySelector('.ucs-loy__panel'), body = box.querySelector('.ucs-loy__body');
  var me = null, msg = '';

  var ways = function () {
    var list = [];
    if (c.per) list.push([t.orderWay, pts(Math.round(c.per * 100) / 100) + ' / ' + perMoney()]);
    if (c.su) list.push([t.signupWay, pts(c.su)]);
    if (c.fo) list.push([t.firstWay, pts(c.fo)]);
    return '<h3>' + esc(t.earn) + '</h3><ul class="ucs-loy__list">' + list.map(function (x) { return '<li><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></li>'; }).join('') + '</ul>';
  };
  var rewards = function (have) {
    return '<h3>' + esc(t.rewards) + '</h3><ul class="ucs-loy__list">' + (c.rw || []).map(function (r) {
      var short = have == null ? 0 : r.p - have;
      var act = have == null ? '<b>' + esc(pts(r.p)) + '</b>' : short > 0 ? '<small>' + esc(fill(t.more, short)) + '</small>' : '<button type="button" class="ucs-loy__btn" data-get="' + esc(r.id) + '">' + esc(t.get) + ' · ' + esc(pts(r.p)) + '</button>';
      return '<li><span>' + esc(r.t) + '</span>' + act + '</li>';
    }).join('') + '</ul>';
  };
  var got = function (list) {
    if (!list || !list.length) return '';
    return '<h3>' + esc(t.code) + '</h3><ul class="ucs-loy__list">' + list.map(function (g) {
      return g.code ? '<li class="ucs-loy__code"><span>' + esc(g.title) + '<br><code>' + esc(g.code) + '</code></span><span><button type="button" class="ucs-loy__btn ucs-loy__btn--soft" data-copy="' + esc(g.code) + '">' + esc(t.copy) + '</button> <button type="button" class="ucs-loy__btn" data-apply="' + esc(g.code) + '">' + esc(t.apply) + '</button></span></li>' : '';
    }).join('') + '</ul>';
  };
  var draw = function () {
    var h = msg ? '<p class="ucs-loy__msg" role="status">' + esc(msg) + '</p>' : '';
    if (me && me.member) {
      var m = me.member;
      h += '<div class="ucs-loy__head"><small>' + esc(t.have) + '</small><strong>' + esc(pts(m.points)) + '</strong>' + (m.pending ? '<small>' + esc(fill(t.pending, m.pending)) + '</small>' : '') + '</div>' +
        got(m.rewards) + rewards(m.points) + ways() +
        (m.history && m.history.length ? '<h3>' + esc(t.history) + '</h3><ul class="ucs-loy__list ucs-loy__hist">' + m.history.map(function (e) { return '<li><span>' + esc(e.l) + '<br><small>' + esc(e.d) + '</small></span><b>' + (e.p > 0 ? '+' : '') + esc(Number(e.p).toLocaleString()) + '</b></li>'; }).join('') + '</ul>' : '');
    } else if (D.in && me && me.canJoin) {
      h += '<div class="ucs-loy__head"><strong>' + esc(t.guestTitle) + '</strong><small>' + esc(t.guestText) + '</small><button type="button" class="ucs-loy__btn ucs-loy__btn--wide" data-join>' + esc(t.joinNow) + '</button></div>' + ways() + rewards(null);
    } else if (D.in && !me) {
      h += '<p class="ucs-loy__wait">…</p>';
    } else {
      h += '<div class="ucs-loy__head"><strong>' + esc(t.guestTitle) + '</strong><small>' + esc(t.guestText) + '</small><a class="ucs-loy__btn ucs-loy__btn--wide" href="' + esc(D.reg) + '">' + esc(t.join) + '</a><a class="ucs-loy__link" href="' + esc(D.login) + '">' + esc(t.signIn) + '</a></div>' + ways() + rewards(null);
    }
    body.innerHTML = h;
  };
  var load = function (intent, extra) {
    var b = { intent: intent };
    for (var k in extra || {}) b[k] = extra[k];
    return post(b).then(function (r) {
      if (r && r.ok) me = r; else msg = r && r.error === 'not enough' ? fill(t.more, 0) : t.error;
      draw();
      return r;
    });
  };
  var open = function (on) {
    panel.hidden = !on;
    launch.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { msg = ''; draw(); if (D.in) load('me'); panel.querySelector('.ucs-loy__x').focus(); }
  };
  launch.addEventListener('click', function () { open(panel.hidden); });
  box.querySelector('.ucs-loy__x').addEventListener('click', function () { open(false); launch.focus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { open(false); launch.focus(); } });
  body.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-join')) { b.disabled = true; load('join'); }
    else if (b.getAttribute('data-get')) { b.disabled = true; msg = ''; load('redeem', { reward: b.getAttribute('data-get') }).then(function (r) { if (r && r.ok && r.got) { msg = r.got.code ? '' : t.credit; draw(); } }); }
    else if (b.getAttribute('data-copy')) { try { navigator.clipboard.writeText(b.getAttribute('data-copy')); b.textContent = t.copied; } catch (x) { b.textContent = b.getAttribute('data-copy'); } }
    else if (b.getAttribute('data-apply')) {
      fetch(root + 'discount/' + encodeURIComponent(b.getAttribute('data-apply')), { credentials: 'same-origin' }).then(function () { msg = t.applied; draw(); document.dispatchEvent(new CustomEvent('ucs:cart:changed')); });
    }
  });

  /* ---------- "You earned" when a member's points went up since their last visit ---------- */
  if (D.in) {
    load('me').then(function (r) {
      if (!r || !r.member) return;
      var now = r.member.points + r.member.pending, before = null;
      try { before = Number(localStorage.getItem('ucs-loy-total')); localStorage.setItem('ucs-loy-total', String(now)); } catch (e) { before = null; }
      if (before && now > before) {
        var n = document.createElement('div');
        n.className = 'ucs-loy__toast';
        n.setAttribute('role', 'status');
        n.textContent = fill(t.earned, now - before);
        box.appendChild(n);
        setTimeout(function () { n.remove(); }, 6000);
      }
    });
  }

  /* ---------- points on the product page and in the cart ---------- */
  var line = function (text) { var p = document.createElement('p'); p.className = 'ucs-loy__line'; p.style.setProperty('--ucs-loy-a', w.a || '#111'); p.textContent = text; return p; };
  if (w.pp && c.per && D.price) {
    var n = Math.floor((D.price / 100) * c.per + 1e-9);
    var form = document.querySelector('form[action*="/cart/add"]');
    if (n > 0 && form) form.parentNode.insertBefore(line(fill(t.product, n)), form.nextSibling);
  }
  if (w.cp && c.per && D.page === 'cart') {
    fetch(root + 'cart.js', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (cart) {
      var n = Math.floor((cart.items_subtotal_price / 100) * c.per + 1e-9), at = document.querySelector('form[action$="/cart"] [name="checkout"]');
      if (n > 0 && at) at.parentNode.insertBefore(line(fill(t.cart, n)), at);
    }).catch(function () {});
  }
})();
