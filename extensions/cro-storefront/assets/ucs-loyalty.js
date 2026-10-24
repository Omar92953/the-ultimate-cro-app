/*
 * CRO Toolbox — loyalty program (Pro): the rewards launcher and panel, "Earn X points" on product pages and in
 * the cart, a small "You earned" note, and Refer a friend (the member's link, and a banner for the friend who
 * lands on ?ref=CODE). The program (rules, rewards, words, look) comes from the Conversion
 * boosters embed (#ucs-loy-data); a member's own points come from the app proxy, which Shopify signs with the
 * logged in customer, so nothing here can read or spend anyone else's points.
 */
(function () {
  var el = document.getElementById('ucs-loy-data');
  if (!el || window.__ucsLoy) return;
  window.__ucsLoy = true;
  var D;
  try { D = JSON.parse(el.textContent); } catch (e) { return; }
  var c = D.c || {};
  // The page's language when the store added it (Loyalty, Languages): its words over the main ones.
  var lc = String((window.Shopify && window.Shopify.locale) || document.documentElement.lang || '').toLowerCase(), lg = c.lg || {};
  var L = lg[lc] || lg[lc.split('-')[0]];
  if (L) {
    c.t = Object.assign({}, c.t, L.t);
    if (L.u) c.u = L.u;
    if (L.pg) c.pg = Object.assign({}, c.pg, L.pg);
    if (L.rw) (c.rw || []).forEach(function (r) { if (L.rw[r.id]) r.t = L.rw[r.id]; });
  }
  var t = c.t || {}, w = c.w || {};
  if (!c.on) return;
  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var url = root + 'apps/ucro/loyalty';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var unit = function (n) { return n === 1 ? (c.u && c.u.one) || 'point' : (c.u && c.u.many) || 'points'; };
  var pts = function (n) { return Number(n).toLocaleString() + ' ' + unit(Math.abs(n)); };
  var fill = function (s, n) { return String(s || '').replace('{n}', pts(n)); };
  var fmtMoney = function (n) { return String(D.fmt || '{{amount}}').replace(/\{\{\s*\w+\s*\}\}/, Number(n).toFixed(n % 1 ? 2 : 0)).replace(/<[^>]*>/g, ''); };
  var perMoney = function () { return fmtMoney(1); };
  var NET = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', x: 'X', youtube: 'YouTube' };
  var today = new Date().toISOString().slice(0, 10);
  var camp = (c.ca || []).filter(function (x) { return x.f <= today && today <= x.t; })[0];
  var tierName = function (id) { var l = (c.ti && c.ti.l) || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].n; return ''; };
  var rf = c.rf;
  var offer = function (k, v) { return k === 'percent' ? String(t.offPercent).replace('{x}', v) : k === 'amount' ? String(t.offAmount).replace('{x}', fmtMoney(v)) : t.freeShip; };
  var gift = function () { return rf.g === 'credit' ? String(t.creditGift).replace('{x}', fmtMoney(rf.gv)) : pts(rf.gv); };
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
  box.style.setProperty('--ucs-loy-r', (w.r == null ? 18 : w.r) + 'px');
  box.innerHTML = '<button type="button" class="ucs-loy__launch' + (w.l === 'icon' ? ' ucs-loy__launch--icon' : '') + '" aria-expanded="false" aria-label="' + esc(t.launcher) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg><span>' + esc(t.launcher) + '</span></button>' +
    '<div class="ucs-loy__panel" role="dialog" aria-label="' + esc(t.title) + '" hidden><div class="ucs-loy__top"><b>' + esc(t.title) + '</b><button type="button" class="ucs-loy__x" aria-label="Close">×</button></div><div class="ucs-loy__body"></div></div>';
  // Right to left languages read the widget and the Rewards page that way, whatever the theme does.
  var rtl = /^(ar|he|fa|ur)(-|$)/.test(lc);
  if (rtl) box.dir = 'rtl';
  document.body.appendChild(box);
  var launch = box.querySelector('.ucs-loy__launch'), panel = box.querySelector('.ucs-loy__panel'), body = box.querySelector('.ucs-loy__body');
  var me = null, msg = '';
  var pageEl = document.querySelector('[data-ucs-loy-page]'), pg = c.pg || {};
  if (pageEl && rtl) pageEl.dir = 'rtl';

  var ways = function () {
    var list = [];
    if (c.per) list.push([t.orderWay, pts(Math.round(c.per * 100) / 100) + ' / ' + perMoney()]);
    if (c.su) list.push([t.signupWay, pts(c.su)]);
    if (c.fo) list.push([t.firstWay, pts(c.fo)]);
    if (rf) list.push([t.referWay, gift()]);
    if (c.rv) list.push([t.reviewWay, pts(c.rv)]);
    var m = me && me.member, extra = '';
    if (c.bd) extra += '<li><span>' + esc(t.birthdayWay) + '</span>' + (m && !m.bday ? '<span class="ucs-loy__bd"><input type="date" aria-label="' + esc(t.birthdayAsk) + '"><button type="button" class="ucs-loy__btn" data-bday>' + esc(t.birthdaySave) + '</button></span>' : '<b>' + esc(pts(c.bd)) + '</b>') + '</li>';
    if (c.so) (c.so.l || []).forEach(function (l) {
      var done = m && (m.followed || []).indexOf(l.network) > -1;
      extra += '<li><span>' + esc(String(t.followWay).replace('{network}', NET[l.network] || l.network)) + '</span>' + (m && !done ? '<a class="ucs-loy__btn" href="' + esc(l.url) + '" target="_blank" rel="noopener" data-follow="' + esc(l.network) + '">' + esc(t.follow) + ' · ' + esc(pts(c.so.p)) + '</a>' : '<b>' + (done ? '✓' : esc(pts(c.so.p))) + '</b>') + '</li>';
    });
    return '<h3>' + esc(t.earn) + '</h3>' + (camp ? '<p class="ucs-loy__camp">' + esc(String(t.campaign).replace('{x}', camp.x + 'x').replace('{date}', camp.t)) + '</p>' : '') + '<ul class="ucs-loy__list">' + list.map(function (x) { return '<li><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></li>'; }).join('') + extra + '</ul>';
  };
  var rewards = function (have) {
    return '<h3>' + esc(t.rewards) + '</h3><ul class="ucs-loy__list">' + (c.rw || []).map(function (r) {
      var short = have == null ? 0 : r.p - have;
      var mt = me && me.member && me.member.tier ? me.member.tier.id : '';
      var locked = c.ti && r.tr && r.tr.length && r.tr.indexOf(mt) < 0;
      var act = locked ? '<small>' + esc(String(t.tierOnly).replace('{tiers}', r.tr.map(tierName).join(', '))) + '</small>' : have == null ? '<b>' + esc(pts(r.p)) + '</b>' : short > 0 ? '<small>' + esc(fill(t.more, short)) + '</small>' : '<button type="button" class="ucs-loy__btn" data-get="' + esc(r.id) + '">' + esc(t.get) + ' · ' + esc(pts(r.p)) + '</button>';
      return '<li><span>' + esc(r.t) + '</span>' + act + '</li>';
    }).join('') + '</ul>';
  };
  var got = function (list) {
    if (!list || !list.length) return '';
    return '<h3>' + esc(t.code) + '</h3><ul class="ucs-loy__list">' + list.map(function (g) {
      return g.code ? '<li class="ucs-loy__code"><span>' + esc(g.title) + '<br><code>' + esc(g.code) + '</code></span><span><button type="button" class="ucs-loy__btn ucs-loy__btn--soft" data-copy="' + esc(g.code) + '">' + esc(t.copy) + '</button> <button type="button" class="ucs-loy__btn" data-apply="' + esc(g.code) + '">' + esc(t.apply) + '</button></span></li>' : '';
    }).join('') + '</ul>';
  };
  /* The member's link and share buttons (only once their code works). */
  var refer = function (m) {
    if (!rf || !m || !m.ref) return '';
    var e = encodeURIComponent, link = location.origin + root + '?ref=' + e(m.ref);
    var msgText = String(t.shareText).replace('{friend}', offer(rf.k, rf.v)) + ' ' + link;
    var share = [['WhatsApp', 'https://wa.me/?text=' + e(msgText)], ['X', 'https://x.com/intent/post?text=' + e(msgText)], ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + e(link)], [t.email, 'mailto:?body=' + e(msgText)]];
    return '<h3>' + esc(t.referTitle) + '</h3><p class="ucs-loy__ref-x">' + esc(String(t.referText).replace('{friend}', offer(rf.k, rf.v)).replace('{gift}', gift())) + '</p>' +
      '<div class="ucs-loy__ref"><input readonly value="' + esc(link) + '" aria-label="' + esc(t.referLink) + '"><button type="button" class="ucs-loy__btn" data-copy="' + esc(link) + '">' + esc(t.copy) + '</button></div>' +
      '<p class="ucs-loy__share">' + share.map(function (x) { return '<a href="' + esc(x[1]) + '" target="_blank" rel="noopener">' + esc(x[0]) + '</a>'; }).join('') + '</p>';
  };
  var draw = function () {
    var h = msg ? '<p class="ucs-loy__msg" role="status">' + esc(msg) + '</p>' : '';
    if (me && me.member) {
      var m = me.member;
      h += '<div class="ucs-loy__head"><small>' + esc(t.have) + '</small><strong>' + esc(pts(m.points)) + '</strong>' + (m.pending ? '<small>' + esc(fill(t.pending, m.pending)) + '</small>' : '') +
        (m.tier ? '<span class="ucs-loy__tier">' + esc(String(t.tier).replace('{tier}', m.tier.n)) + '</span>' : '') +
        (m.next ? '<small>' + esc(String(t.nextTier).replace('{n}', m.next.spent ? fmtMoney(m.next.need) : pts(m.next.need)).replace('{tier}', m.next.n)) + '</small>' : '') + '</div>' +
        got(m.rewards) + rewards(m.points) + refer(m) + ways() +
        (m.history && m.history.length ? '<h3>' + esc(t.history) + '</h3><ul class="ucs-loy__list ucs-loy__hist">' + m.history.map(function (e) { return '<li><span>' + esc(e.l) + '<br><small>' + esc(e.d) + '</small></span><b>' + (!e.p && e.cr ? (e.cr > 0 ? '+' : '') + esc(fmtMoney(e.cr)) : (e.p > 0 ? '+' : '') + esc(Number(e.p).toLocaleString())) + '</b></li>'; }).join('') + '</ul>' : '');
    } else if (D.in && me && me.canJoin) {
      h += '<div class="ucs-loy__head"><strong>' + esc(t.guestTitle) + '</strong><small>' + esc(t.guestText) + '</small><button type="button" class="ucs-loy__btn ucs-loy__btn--wide" data-join>' + esc(t.joinNow) + '</button></div>' + ways() + rewards(null);
    } else if (D.in && !me) {
      h += '<p class="ucs-loy__wait">…</p>';
    } else {
      h += '<div class="ucs-loy__head"><strong>' + esc(t.guestTitle) + '</strong><small>' + esc(t.guestText) + '</small>' + (c.gu && t.guestPast ? '<small>' + esc(t.guestPast) + '</small>' : '') + '<a class="ucs-loy__btn ucs-loy__btn--wide" href="' + esc(D.reg) + '">' + esc(t.join) + '</a><a class="ucs-loy__link" href="' + esc(D.login) + '">' + esc(t.signIn) + '</a></div>' + ways() + rewards(null);
    }
    body.innerHTML = h;
    if (pageEl) drawPage();
  };
  /* The Rewards page (Order & wishlist pages block on the page the app made): the same program, laid out wide. */
  var drawPage = function () {
    var m = me && me.member;
    var top = m
      ? '<p class="ucs-loyp__pts"><small>' + esc(t.have) + '</small><strong>' + esc(pts(m.points)) + '</strong>' + (m.pending ? '<small>' + esc(fill(t.pending, m.pending)) + '</small>' : '') + '</p>'
      : D.in && me && me.canJoin
        ? '<button type="button" class="ucs-loy__btn" data-join>' + esc(t.joinNow) + '</button>'
        : D.in ? '' : '<p class="ucs-loyp__cta"><a class="ucs-loy__btn" href="' + esc(D.reg) + '">' + esc(t.join) + '</a> <a class="ucs-loy__link" href="' + esc(D.login) + '">' + esc(t.signIn) + '</a></p>';
    pageEl.innerHTML = '<div class="ucs-loyp" style="--ucs-loy-a:' + esc(w.a || '#111') + ';--ucs-loy-oa:' + esc(w.oa || '#fff') + ';--ucs-loy-r:' + (w.r == null ? 18 : w.r) + 'px">' +
      '<section class="ucs-loyp__hero"><h1>' + esc(pg.title || t.title) + '</h1>' + (pg.sub ? '<p>' + esc(pg.sub) + '</p>' : '') + (msg ? '<p class="ucs-loy__msg" role="status">' + esc(msg) + '</p>' : '') + top + '</section>' +
      ((pg.how || []).length ? '<ol class="ucs-loyp__how">' + pg.how.map(function (x, i) { return '<li><span>' + (i + 1) + '</span><b>' + esc(x.t) + '</b><small>' + esc(x.x) + '</small></li>'; }).join('') + '</ol>' : '') +
      (m && m.ref && rf ? '<section class="ucs-loyp__refer">' + refer(m) + '</section>' : '') +
      '<div class="ucs-loyp__cols"><section>' + ways() + '</section><section>' + (m ? got(m.rewards) : '') + rewards(m ? m.points : null) + '</section></div>' +
      ((pg.faq || []).length ? '<section class="ucs-loyp__faq">' + pg.faq.map(function (x) { return '<details><summary>' + esc(x.q) + '</summary><p>' + esc(x.a) + '</p></details>'; }).join('') + '</section>' : '') + '</div>';
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
  var act = function (e) {
    var f = e.target.closest('[data-follow]');
    if (f) { load('social', { network: f.getAttribute('data-follow') }); return; }
    var b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-bday')) {
      var v = (b.previousElementSibling && b.previousElementSibling.value) || '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { b.disabled = true; load('birthday', { date: v.slice(5) }).then(function () { msg = t.birthdayDone; draw(); }); }
      return;
    }
    if (b.hasAttribute('data-join')) { b.disabled = true; load('join'); }
    else if (b.getAttribute('data-get')) { b.disabled = true; msg = ''; load('redeem', { reward: b.getAttribute('data-get') }).then(function (r) { if (r && r.ok && r.got) { msg = r.got.code ? '' : t.credit; draw(); } }); }
    else if (b.getAttribute('data-copy')) { try { navigator.clipboard.writeText(b.getAttribute('data-copy')); b.textContent = t.copied; } catch (x) { b.textContent = b.getAttribute('data-copy'); } }
    else if (b.getAttribute('data-apply')) {
      fetch(root + 'discount/' + encodeURIComponent(b.getAttribute('data-apply')), { credentials: 'same-origin' }).then(function () { msg = t.applied; draw(); document.dispatchEvent(new CustomEvent('ucs:cart:changed')); });
    }
  };
  body.addEventListener('click', act);
  if (pageEl) { pageEl.addEventListener('click', act); drawPage(); }

  /* ---------- A friend arrives on ?ref=CODE: the discount goes on the cart and a banner says so ---------- */
  var toast = function (text, wide) {
    var n = document.createElement('div');
    n.className = 'ucs-loy__toast' + (wide ? ' ucs-loy__toast--wide' : '');
    n.setAttribute('role', 'status');
    n.textContent = text;
    box.appendChild(n);
    setTimeout(function () { n.remove(); }, wide ? 9000 : 6000);
  };
  var refCode = null;
  try { refCode = new URLSearchParams(location.search).get('ref'); } catch (e) { refCode = null; }
  if (refCode && /^[A-Za-z0-9_-]{3,30}$/.test(refCode)) {
    try { var u = new URL(location.href); u.searchParams.delete('ref'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* the address keeps ?ref */ }
    post({ intent: 'ref', code: refCode }).then(function (r) {
      if (!r || !r.ok || !r.ref) return;
      fetch(root + 'discount/' + encodeURIComponent(refCode), { credentials: 'same-origin' }).then(function () {
        toast(String(t.refBanner).replace('{friend}', offer(r.ref.k, r.ref.v)), true);
        document.dispatchEvent(new CustomEvent('ucs:cart:changed'));
      }).catch(function () {});
    });
  }

  /* ---------- "You earned" when a member's points went up since their last visit ---------- */
  if (D.in) {
    load('me').then(function (r) {
      if (!r || !r.member) return;
      var now = r.member.points + r.member.pending, before = null;
      try { before = Number(localStorage.getItem('ucs-loy-total')); localStorage.setItem('ucs-loy-total', String(now)); } catch (e) { before = null; }
      if (before && now > before) toast(fill(t.earned, now - before));
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
