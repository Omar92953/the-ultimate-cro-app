/*
 * Ultimate CRO — customer reviews: carousel arrows/autoplay, "Read more" for long reviews,
 * and videos that play silently in view with a tap-for-sound button (one with sound at a time).
 */
(function () {
  if (window.__ucsReviews) return;
  window.__ucsReviews = true;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        v.preload = 'auto';
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else if (!v.paused) v.pause();
    });
  }, { threshold: [0, 0.6] }) : null;

  function setMuted(card, root, muted) {
    var v = card.querySelector('video'), b = card.querySelector('.ucs-rv__sound');
    if (!v || !b) return;
    v.muted = muted;
    b.setAttribute('aria-pressed', muted ? 'false' : 'true');
    b.setAttribute('aria-label', muted ? root.dataset.unmute : root.dataset.mute);
  }

  function setup(root) {
    if (root.__ucs) return;
    root.__ucs = true;
    var track = root.querySelector('.ucs-rv__track');
    if (!track) return;
    var autoVideo = root.getAttribute('data-video') === 'true' && !reduce;

    /* read more — measured again once fonts and images settle, and on resize */
    var measure = function () {
      root.querySelectorAll('.ucs-rv__text:not(.is-open)').forEach(function (t) {
        var more = t.nextElementSibling;
        if (more && more.classList.contains('ucs-rv__more')) more.hidden = t.scrollHeight <= t.clientHeight + 2;
      });
    };
    /* same size everywhere: every picture as tall as the tallest one (smaller ones sit on the
       fill), and the name/badge/date and product rows equally tall in every card */
    var level = function () {
      root.classList.remove('is-sized');
      var tallest = 0;
      root.querySelectorAll('.ucs-rv__media').forEach(function (m) {
        var w = m.clientWidth, img = m.querySelector('img');
        // Lazy images aren't loaded yet off-screen: their width/height attributes give the shape.
        var iw = img && (img.naturalWidth || Number(img.getAttribute('width'))), ih = img && (img.naturalHeight || Number(img.getAttribute('height')));
        var h = m.classList.contains('ucs-rv__media--shot') ? (iw && ih ? Math.min(460, (w * ih) / iw) : 0) : w * 1.25;
        tallest = Math.max(tallest, h);
      });
      if (tallest > 0) {
        root.style.setProperty('--ucs-rv-media-h', Math.round(tallest) + 'px');
        root.classList.add('is-sized');
      }
      ['.ucs-rv__who', '.ucs-rv__prod'].forEach(function (sel) {
        var els = root.querySelectorAll(sel);
        els.forEach(function (e) { e.style.minHeight = ''; });
        var max = 0;
        els.forEach(function (e) { max = Math.max(max, e.offsetHeight); });
        if (els.length > 1) els.forEach(function (e) { e.style.minHeight = max + 'px'; });
      });
    };
    var settle = function () { measure(); level(); };
    root.querySelectorAll('.ucs-rv__media img').forEach(function (i) { if (!i.complete) i.addEventListener('load', settle); });
    settle();
    window.addEventListener('load', settle);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(settle, 150); });

    /* videos */
    root.querySelectorAll('.ucs-rv__video, .ucs-rv__media video').forEach(function (v) {
      v.muted = true;
      v.playsInline = true;
      v.removeAttribute('controls');
      if (autoVideo && io) io.observe(v);
      v.addEventListener('play', function () { v.closest('.ucs-rv__card').classList.add('is-playing'); });
      v.addEventListener('pause', function () { v.closest('.ucs-rv__card').classList.remove('is-playing'); });
    });

    root.addEventListener('click', function (e) {
      var more = e.target.closest('.ucs-rv__more');
      if (more) {
        var text = more.previousElementSibling;
        var open = text.classList.toggle('is-open');
        more.textContent = open ? root.dataset.less : root.dataset.more;
        return;
      }
      var sound = e.target.closest('.ucs-rv__sound');
      var media = e.target.closest('.ucs-rv__media');
      if (!sound && !media) return;
      var card = e.target.closest('.ucs-rv__card');
      var v = card.querySelector('video');
      if (!v) return;
      if (sound) {
        var turnOn = v.muted;
        // only one review plays with sound
        document.querySelectorAll('.ucs-rv__card').forEach(function (c) { if (c !== card) setMuted(c, root, true); });
        setMuted(card, root, !turnOn);
        if (turnOn && v.paused) v.play().catch(function () {});
      } else if (v.paused) {
        v.play().catch(function () {});
      } else {
        v.pause();
      }
    });

    /* carousel */
    if (!root.classList.contains('ucs-rv--carousel')) return;
    var step = function () {
      var card = track.querySelector('.ucs-rv__card');
      return card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth;
    };
    var arrows = root.querySelectorAll('.ucs-rv__arrow');
    var rtl = getComputedStyle(track).direction === 'rtl';
    var update = function () {
      var max = track.scrollWidth - track.clientWidth - 2;
      var x = Math.abs(track.scrollLeft);
      arrows.forEach(function (a) {
        var back = Number(a.getAttribute('data-dir')) < 0;
        a.disabled = back ? x <= 2 : x >= max;
      });
      root.classList.toggle('is-static', max <= 0);
    };
    var go = function (dir, wrap) {
      var max = track.scrollWidth - track.clientWidth - 2;
      var x = Math.abs(track.scrollLeft);
      var left = wrap && dir > 0 && x >= max ? 0 : x + dir * step();
      track.scrollTo({ left: rtl ? -left : left, behavior: reduce ? 'auto' : 'smooth' });
    };
    arrows.forEach(function (a) { a.addEventListener('click', function () { go(Number(a.getAttribute('data-dir'))); restart(); }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();

    var secs = Number(root.getAttribute('data-autoplay')), timer = null, hold = false;
    function restart() {
      clearInterval(timer);
      if (secs > 0 && !hold && !reduce) timer = setInterval(function () { go(1, true); }, secs * 1000);
    }
    ['mouseenter', 'focusin', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function () { hold = true; restart(); }, { passive: true }); });
    ['mouseleave', 'focusout'].forEach(function (ev) { root.addEventListener(ev, function () { hold = false; restart(); }); });
    restart();
  }

  function scan() { document.querySelectorAll('.ucs-rv').forEach(setup); }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
