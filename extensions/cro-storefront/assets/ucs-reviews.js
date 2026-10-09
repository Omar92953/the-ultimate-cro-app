/*
 * CRO Toolbox — customer reviews: carousel arrows/autoplay, "Read more" for long reviews,
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

  /* ---------- build the section from the app's design and the reviews passed by the block ---------- */
  var DEF = {
    t: { heading: 'What our customers say', sub: '', headingSize: 30, basedOn: 'Based on {count} reviews', readMore: 'Read more', readLess: 'Show less', verified: 'Verified buyer' },
    sm: { show: true, average: true, stars: true, count: true },
    w: { filter: 'all', fallback: true, limit: 12 },
    l: { mode: 'carousel', perDesktop: 3, perMobile: 1, autoplay: 0, nav: 'arrows', arrowSize: 40 },
    c: { style: 'classic', text: true, media: true, stars: true, source: true, verified: true, location: true, date: true, product: true, clamp: 5, videoAutoplay: true },
    sch: true, cls: 'ucs ucs-rv ucs-rv--carousel ucs-rv--fill-color ucs-rv--pat-chat ucs-rv--nav-arrows', css: ''
  };
  var SRC = { whatsapp: 'WhatsApp', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', google: 'Google', x: 'X', snapchat: 'Snapchat', email: 'Email', youtube: 'YouTube', trustpilot: 'Trustpilot' };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };
  var sized = function (u, w) { return u + (u.indexOf('?') > -1 ? '&' : '?') + 'width=' + w; };
  var stars = function (r, label) { return '<span class="ucs-rv__stars" style="--r: ' + r + '" role="img" aria-label="' + esc(label) + '">★★★★★</span>'; };

  function card(r, c, t, only, shop) {
    var md = r.m, fromProd = false;
    if ((!md || !md.u) && !only && r.p && r.p.i) { md = { k: 'image', u: r.p.i }; fromProd = true; }
    var showMedia = c.c.media && md && md.u;
    var h = '<article class="ucs-rv__card ucs-rv__card--' + c.c.style + (showMedia ? ' has-media' : '') + '">';
    if (showMedia) {
      h += '<div class="ucs-rv__media' + (!fromProd && md.k !== 'video' ? ' ucs-rv__media--shot' : '') + '">';
      if (md.k === 'video') {
        h += '<video class="ucs-rv__video" muted loop playsinline preload="none" src="' + esc(md.u) + '"' + (md.po ? ' poster="' + esc(md.po) + '"' : '') + '></video>' +
          '<button type="button" class="ucs-rv__sound" aria-pressed="false" aria-label="Turn sound on"><span class="ucs-i ucs-i--muted" aria-hidden="true"></span><span class="ucs-i ucs-i--sound" aria-hidden="true"></span></button>' +
          '<span class="ucs-rv__play" aria-hidden="true"><span class="ucs-i ucs-i--play" aria-hidden="true"></span></span>';
      } else {
        h += '<img class="ucs-rv__img" src="' + esc(sized(md.u, 540)) + '" srcset="' + [360, 540, 720].map(function (w) { return esc(sized(md.u, w)) + ' ' + w + 'w'; }).join(', ') +
          '" sizes="(min-width: 750px) 33vw, 90vw" loading="lazy" alt="' + esc(fromProd ? r.p.t : r.n) + '"' + (md.w ? ' width="' + md.w + '" height="' + md.h + '"' : '') + '>';
      }
      h += '</div>';
    }
    h += '<div class="ucs-rv__body">';
    var hasStars = c.c.stars && r.r > 0, src = r.s, hasSrc = c.c.source && src && src !== 'other';
    if (hasStars || hasSrc) {
      h += '<div class="ucs-rv__top">' + (hasStars ? stars(r.r, r.r + ' out of 5 stars') : '');
      if (hasSrc) {
        var name = src === 'website' ? shop : (SRC[src] || src);
        h += r.su
          ? '<a class="ucs-rv__src ucs-rv__src--' + esc(src) + '" href="' + esc(r.su) + '" target="_blank" rel="noopener nofollow" title="On ' + esc(name) + '" aria-label="On ' + esc(name) + '"><span class="ucs-i ucs-i--' + esc(src) + '" aria-hidden="true"></span></a>'
          : '<span class="ucs-rv__src ucs-rv__src--' + esc(src) + '" title="' + esc(name) + '"><span class="ucs-i ucs-i--' + esc(src) + '" aria-hidden="true"></span></span>';
      }
      h += '</div>';
    }
    if (c.c.text && r.t) h += '<div class="ucs-rv__text">' + esc(r.t).replace(/\n/g, '<br>') + '</div><button type="button" class="ucs-rv__more" hidden>' + esc(t.readMore) + '</button>';
    var meta = [c.c.location && r.l ? esc(r.l) : '', c.c.date && r.d ? esc(r.d) : ''].filter(Boolean).join(' · ');
    h += '<footer class="ucs-rv__who"><span class="ucs-rv__name">' + esc(r.n) + '</span>' +
      (c.c.verified && r.v ? '<span class="ucs-rv__ver"><span class="ucs-i ucs-i--verified" aria-hidden="true"></span>' + esc(t.verified) + '</span>' : '') +
      (meta ? '<span class="ucs-rv__meta">' + meta + '</span>' : '') + '</footer>';
    if (c.c.product && !only && r.p) {
      h += '<a class="ucs-rv__prod" href="' + esc(r.p.u) + '">' + (r.p.i && !fromProd ? '<img src="' + esc(sized(r.p.i, 96)) + '" width="40" height="40" loading="lazy" alt="">' : '') + '<span>' + esc(r.p.t) + '</span></a>';
    }
    return h + '</div></article>';
  }

  function build(host) {
    var data;
    try { data = JSON.parse(host.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
    var c = data.c || DEF, t = Object.assign({}, DEF.t, c.t);
    var only = host.getAttribute('data-only') === '1';
    var onProductPage = host.getAttribute('data-pp') && host.getAttribute('data-pp') !== '0';
    var list = data.r || [];
    if (c.w.filter === 'featured') list = list.filter(function (r) { return r.f; });
    if (c.w.filter === 'product' && onProductPage && !only && !c.w.fallback) list = [];
    var design = window.Shopify && window.Shopify.designMode;
    if (!list.length && !design) { host.remove(); return; }
    var rated = list.filter(function (r) { return r.r > 0; });
    var avg = rated.length ? Math.round((rated.reduce(function (a, r) { return a + r.r; }, 0) / rated.length) * 10) / 10 : 0;
    var shown = list.slice(0, c.w.limit);
    var shop = host.getAttribute('data-shop') || '';

    host.className = c.cls;
    host.style.cssText = c.css;
    host.setAttribute('data-autoplay', c.l.mode === 'carousel' && c.l.autoplay ? String(c.l.autoplay) : '');
    host.setAttribute('data-video', c.c.videoAutoplay ? 'true' : 'false');
    host.setAttribute('data-more', t.readMore);
    host.setAttribute('data-less', t.readLess);
    host.setAttribute('data-unmute', 'Turn sound on');
    host.setAttribute('data-mute', 'Turn sound off');

    var sm = c.sm, summary = '';
    if (sm.show && rated.length && (sm.average || sm.stars || sm.count)) {
      summary = '<div class="ucs-rv__summary">' + (sm.average ? '<span class="ucs-rv__avg">' + avg + '</span>' : '') +
        (sm.stars ? stars(avg, avg + ' out of 5 stars') : '') +
        (sm.count ? '<span class="ucs-rv__count">' + esc(t.basedOn.replace(/\{count\}/g, rated.length)) + '</span>' : '') + '</div>';
    }
    var head = t.heading || t.sub || summary ? '<div class="ucs-head ucs-rv__head">' + (t.heading ? '<h2>' + esc(t.heading) + '</h2>' : '') + (t.sub ? '<p>' + esc(t.sub) + '</p>' : '') + summary + '</div>' : '';
    var carousel = c.l.mode === 'carousel';
    var html = '<div class="ucs-wrap">' + head;
    if (!shown.length) html += '<p class="ucs-note">No reviews to show here yet — add them in the app: Store sections → Reviews.</p>';
    else {
      html += '<div class="ucs-rv__viewport"><div class="ucs-rv__track"' + (carousel ? ' tabindex="0" aria-roledescription="carousel" aria-label="' + esc(t.heading || 'Reviews') + '"' : '') + '>' +
        shown.map(function (r) { return card(r, c, t, only, shop); }).join('') + '</div></div>';
      if (carousel) {
        html += '<div class="ucs-rv__nav"><button type="button" class="ucs-rv__arrow" data-dir="-1" aria-label="Previous"><span class="ucs-i ucs-i--chev-l" aria-hidden="true"></span></button>' +
          '<span class="ucs-rv__dots"></span>' +
          '<button type="button" class="ucs-rv__arrow" data-dir="1" aria-label="Next"><span class="ucs-i ucs-i--chev-r" aria-hidden="true"></span></button></div>';
      }
    }
    html += '</div>';
    host.innerHTML = html;

    // Google review data on a product's own page
    if (c.sch && only && rated.length && shown[0] && shown[0].p) {
      var p = shown[0].p, ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product', name: p.t, url: location.origin + p.u, image: p.i ? (p.i.indexOf('//') === 0 ? 'https:' + p.i : p.i) : undefined,
        aggregateRating: { '@type': 'AggregateRating', ratingValue: avg, reviewCount: rated.length, bestRating: 5 },
        review: rated.map(function (r) {
          var o = { '@type': 'Review', author: { '@type': 'Person', name: r.n }, reviewRating: { '@type': 'Rating', ratingValue: r.r, bestRating: 5 } };
          if (r.t) o.reviewBody = r.t;
          if (r.di) o.datePublished = r.di;
          return o;
        })
      });
      host.appendChild(ld);
    }
  }

  /* dots: one per "page" of the carousel */
  function dots(root) {
    var box = root.querySelector('.ucs-rv__dots'), track = root.querySelector('.ucs-rv__track');
    if (!box || !track || root.__dots) return;
    root.__dots = true;
    var cardW = function () { var f = track.querySelector('.ucs-rv__card'); return f ? f.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth; };
    var draw = function () {
      var n = Math.max(1, Math.round((track.scrollWidth - track.clientWidth) / cardW()) + 1);
      if (box.childElementCount !== n) {
        box.innerHTML = '';
        for (var i = 0; i < n; i++) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'ucs-rv__dot';
          b.setAttribute('aria-label', 'Go to review ' + (i + 1));
          b.addEventListener('click', (function (k) { return function () { track.scrollTo({ left: k * cardW(), behavior: reduce ? 'auto' : 'smooth' }); }; })(i));
          box.appendChild(b);
        }
      }
      var at = Math.round(Math.abs(track.scrollLeft) / cardW());
      Array.prototype.forEach.call(box.children, function (d, i) { d.setAttribute('aria-current', i === at ? 'true' : 'false'); });
    };
    draw();
    track.addEventListener('scroll', function () { window.requestAnimationFrame(draw); }, { passive: true });
    window.addEventListener('resize', draw);
  }

  function scan() {
    document.querySelectorAll('[data-ucs-rv]:not([data-built])').forEach(function (host) { host.setAttribute('data-built', ''); build(host); });
    document.querySelectorAll('.ucs-rv').forEach(function (root) { setup(root); dots(root); });
  }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
