/* CRO section: email pop up with a discount code (loaded by the Conversion boosters embed when it is on).
   When to show, which pages and how often come from the app. A sign up posts to the app proxy
   (/apps/ucro/subscribe), which adds the email to the store's own customers with email marketing consent
   and returns a one use code for that email; the code is shown and applied to the cart (/discount/<code>).
   The browser only keeps when the pop up was last shown or that the shopper signed up (functional). */
(function () {
  var S = window.UCSsec;
  if (!S) return;
  var KEY = 'ucs-pop';
  function seen() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage off */ } }
  var PAGES = { home: 'index', product: 'product', collection: 'collection' };

  function build(c, ctx, inline) {
    var d = c.d, id = S.id();
    var box = document.createElement('div');
    box.className = 'ucs usec-pop ' + c.cls.replace(/(^|\s)usec(?=\s|$)/g, ' ') + (inline ? ' is-inline' : '');
    box.style.cssText = c.css;
    var pic = d.im && c.l.style !== 'bar' ? '<div class="usec-pop__pic"><img src="' + S.esc(S.img(d.im.u, 900)) + '" alt=""></div>' : '';
    box.innerHTML = '<div class="usec-pop__box" role="dialog" aria-modal="' + !inline + '" aria-labelledby="' + id + '">' + pic +
      '<div class="usec-pop__body"><button type="button" class="usec-pop__x" aria-label="Close">✕</button>' +
      '<p class="usec-pop__h" id="' + id + '">' + S.esc(c.h) + '</p>' + (c.s ? '<p class="usec-pop__s">' + S.esc(c.s) + '</p>' : '') +
      '<form class="usec-pop__form" novalidate><div class="usec-pop__row"><input type="email" name="email" required autocomplete="email" placeholder="' + S.esc(d.ph) + '" aria-label="' + S.esc(d.ph) + '">' +
      '<input type="text" name="company" tabindex="-1" autocomplete="off" class="usec-pop__hp" aria-hidden="true">' +
      '<button type="submit" class="usec__btn">' + S.esc(d.btn) + '</button></div>' +
      (d.consent ? '<label class="usec-pop__consent">' + (d.tick ? '<input type="checkbox" name="ok"> ' : '') + '<span>' + S.esc(d.consent) + '</span></label>' : '') +
      '<p class="usec-pop__err" role="alert" hidden></p></form>' +
      '<div class="usec-pop__done" hidden><p class="usec-pop__ok">' + S.esc(d.ok) + '</p><div class="usec-pop__code"><strong></strong><button type="button" class="usec__btn">' + S.esc(d.copy) + '</button></div></div>' +
      (d.no ? '<button type="button" class="usec-pop__no">' + S.esc(d.no) + '</button>' : '') + '</div></div>';
    return box;
  }

  function wire(box, c, ctx, close) {
    var form = box.querySelector('form'), err = box.querySelector('.usec-pop__err'), btn = form.querySelector('.usec__btn');
    function fail(m) { err.hidden = false; err.textContent = m; btn.removeAttribute('aria-busy'); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email.');
      if (c.d.tick && !form.ok.checked) return fail('Please tick the box to sign up.');
      err.hidden = true;
      btn.setAttribute('aria-busy', 'true');
      var go = ctx.preview ? Promise.resolve({ ok: true, code: 'WELCOME-7K2QF' }) : fetch(ctx.root + 'apps/ucro/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, company: form.company.value, ok: c.d.tick ? form.ok.checked : true }) }).then(function (r) { return r.json(); });
      go.then(function (res) {
        if (!res || !res.ok) return fail((res && res.error) || 'Something went wrong. Please try again.');
        if (!ctx.preview) {
          remember({ done: 1 });
          if (res.code) fetch(ctx.root + 'discount/' + encodeURIComponent(res.code), { credentials: 'same-origin' }).catch(function () {});
        }
        form.hidden = true;
        var no = box.querySelector('.usec-pop__no');
        if (no) no.hidden = true;
        var done = box.querySelector('.usec-pop__done');
        done.hidden = false;
        done.querySelector('strong').textContent = res.code || '';
        done.querySelector('.usec-pop__code').hidden = !res.code;
      }).catch(function () { fail('Something went wrong. Please try again.'); });
    });
    box.querySelector('.usec-pop__code button').addEventListener('click', function () {
      var code = box.querySelector('.usec-pop__code strong').textContent, b = this;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { b.classList.add('is-added'); }).catch(function () {});
    });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.usec-pop__x') || e.target.closest('.usec-pop__no')) close();
    });
  }

  S.def('email_popup', function (el, c, ctx) {
    el.hidden = true;
    if (ctx.preview) {
      el.hidden = false;
      el.className = '';
      el.style.cssText = '';
      el.innerHTML = '';
      var b = build(c, ctx, true);
      el.appendChild(b);
      wire(b, c, ctx, function () {});
      return;
    }
    var sh = c.d.show;
    if (!c.on) return;
    if (sh.pages !== 'all' && PAGES[sh.pages] !== ctx.page && !ctx.design) return;
    var last = seen();
    if (!ctx.design && last && (last.done || Date.now() - (last.t || 0) < sh.every * 86400000)) return;
    var shown = false, box, before;
    function close() {
      if (!box) return;
      box.classList.remove('is-open');
      setTimeout(function () { if (box) box.remove(); box = null; }, 250);
      document.removeEventListener('keydown', key);
      if (before && before.focus) before.focus();
    }
    function key(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && box) {
        var f = box.querySelectorAll('input:not(.usec-pop__hp), button:not([hidden])');
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    function show() {
      if (shown) return;
      shown = true;
      if (!ctx.design) remember({ t: Date.now() });
      before = document.activeElement;
      box = build(c, ctx, false);
      document.body.appendChild(box);
      wire(box, c, ctx, close);
      document.addEventListener('keydown', key);
      requestAnimationFrame(function () { box.classList.add('is-open'); var i = box.querySelector('input[type=email]'); if (i && c.l.style !== 'bar') i.focus({ preventScroll: true }); });
    }
    if (ctx.design || (!sh.delay && !sh.scroll && !sh.exit)) return show();
    if (sh.delay) setTimeout(show, sh.delay * 1000);
    if (sh.scroll) window.addEventListener('scroll', function on() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0 && (window.scrollY / h) * 100 >= sh.scroll) { window.removeEventListener('scroll', on); show(); }
    }, { passive: true });
    if (sh.exit && window.matchMedia('(pointer: fine)').matches) document.addEventListener('mouseout', function (e) { if (!e.relatedTarget && e.clientY < 10) show(); });
  });
})();
