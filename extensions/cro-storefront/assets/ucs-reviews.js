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
      if (root.classList.contains('ucs-rv--list')) return; // one review per row: nothing to line up
      var tallest = 0, fixed = /ucs-rv--shape-/.test(root.className);
      root.querySelectorAll('.ucs-rv__media').forEach(function (m) {
        var w = m.clientWidth, img = m.querySelector('img');
        // Lazy images aren't loaded yet off-screen: their width/height attributes give the shape.
        var iw = img && (img.naturalWidth || Number(img.getAttribute('width'))), ih = img && (img.naturalHeight || Number(img.getAttribute('height')));
        // A set photo shape (Design) sizes every picture by itself.
        if (fixed) return;
        var shot = m.classList.contains('ucs-rv__media--shot');
        var h = shot ? (iw && ih ? Math.min(460, (w * ih) / iw) : 0) : w * 1.25;
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
    // Coverflow: each card is drawn by its distance from the centre (same maths as image-carousel.ts flowStyle).
    var flow = root.classList.contains('ucs-rv--flow');
    var draw = function () {
      var mid = Math.abs(track.scrollLeft) + track.clientWidth / 2, w = step() || 1;
      track.querySelectorAll('.ucs-rv__card').forEach(function (el) {
        var d = (el.offsetLeft + el.offsetWidth / 2 - mid) / w, a = Math.min(Math.abs(d), 3.5);
        el.style.transform = 'translateX(' + (-d * 16).toFixed(1) + '%) scale(' + (1 - a * 0.12).toFixed(3) + ')';
        el.style.zIndex = String(10 - Math.round(a * 2));
        el.style.opacity = a > 3.2 ? '0' : '1';
      });
    };
    var update = function () {
      if (flow) draw();
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
    c: { style: 'classic', text: true, media: true, stars: true, source: true, verified: false, location: true, date: true, product: true, clamp: 5, videoAutoplay: true },
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
    var h = '<article class="ucs-rv__card ucs-rv__card--' + c.c.style + (showMedia ? ' has-media' : '') + '" data-r="' + (r.r || 0) + '" data-d="' + esc(r.di || '') + '" data-m="' + (r.m && r.m.u ? 1 : 0) + '">';
    if (showMedia) {
      // Photo fit: this review's own choice, else the section's (whole on the fill, or cropped to fill).
      var pf = r.pf || (c.c.photoFit === 'crop' ? c.c.photoFocus || 'center' : 'whole');
      var whole = !fromProd && md.k !== 'video' && pf === 'whole';
      h += '<div class="ucs-rv__media' + (whole ? ' ucs-rv__media--shot' : '') + '"' + (!whole && pf !== 'center' && pf !== 'whole' ? ' style="--ucs-rv-focus: center ' + pf + '"' : '') + '>';
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
    var text = c.c.text && r.t ? '<div class="ucs-rv__text">' + esc(r.t).replace(/\n/g, '<br>') + '</div><button type="button" class="ucs-rv__more" hidden>' + esc(t.readMore) + '</button>' : '';
    var prod = c.c.product && !only && r.p ? '<a class="ucs-rv__prod" href="' + esc(r.p.u) + '">' + (r.p.i && !fromProd ? '<img src="' + esc(sized(r.p.i, 96)) + '" width="40" height="40" loading="lazy" alt="">' : '') + '<span><span class="ucs-rv__for">' + esc(t.reviewFor || '') + ' </span>' + esc(r.p.t) + '</span></a>' : '';
    if (c.c.style === 'snippet') {
      // Snippet card (next to the price): stars, the review, the name with a tick, then "Review for: …"
      var who = '<div class="ucs-rv__who"><span class="ucs-rv__name">' + esc(r.n) + '</span>' +
        (c.c.verified && r.v ? '<span class="ucs-rv__tick" title="' + esc(t.verified) + '"><span class="ucs-i ucs-i--verified" aria-hidden="true"></span><span class="ucs-rv__sr">' + esc(t.verified) + '</span></span>' : '') + '</div>';
      h += c.c.stars && r.r > 0 ? '<div class="ucs-rv__top">' + stars(r.r, r.r + ' out of 5 stars') + '</div>' : '';
      return h + text + who + (c.c.product && r.p ? '<a class="ucs-rv__prod" href="' + esc(r.p.u) + '"><span><span class="ucs-rv__for">' + esc(t.reviewFor || '') + ' </span>' + esc(r.p.t) + '</span></a>' : '') + '</div></article>';
    }
    if (c.c.textFirst) h += text;
    var hasStars = c.c.stars && r.r > 0, src = r.s, hasSrc = c.c.source && src && src !== 'other';
    if (hasStars || hasSrc) {
      h += '<div class="ucs-rv__top">' + (hasStars ? stars(r.r, r.r + ' out of 5 stars') : '');
      if (hasSrc) {
        var name = src === 'website' ? shop : (SRC[src] || src);
        // Your own picture for this source (Reviews → Design), or the built-in icon.
        var own = c.ic && c.ic[src];
        var icon = own ? '<img src="' + esc(sized(own, 96)) + '" alt="" loading="lazy">' : '<span class="ucs-i ucs-i--' + esc(src) + '" aria-hidden="true"></span>';
        var cls = 'ucs-rv__src ucs-rv__src--' + esc(src) + (own ? ' has-img' : '');
        h += r.su
          ? '<a class="' + cls + '" href="' + esc(r.su) + '" target="_blank" rel="noopener nofollow" title="On ' + esc(name) + '" aria-label="On ' + esc(name) + '">' + icon + '</a>'
          : '<span class="' + cls + '" title="' + esc(name) + '">' + icon + '</span>';
      }
      h += '</div>';
    }
    if (!c.c.textFirst) h += text;
    var meta = [c.c.location && r.l ? esc(r.l) : '', c.c.date && r.d ? esc(r.d) : ''].filter(Boolean).join(' · ');
    h += '<footer class="ucs-rv__who"><span class="ucs-rv__name">' + esc(r.n) + '</span>' +
      (c.c.verified && r.v ? '<span class="ucs-rv__ver"><span class="ucs-i ucs-i--verified" aria-hidden="true"></span>' + esc(t.verified) + '</span>' : '') +
      (meta ? '<span class="ucs-rv__meta">' + meta + '</span>' : '') + '</footer>';
    h += prod;
    return h + '</div></article>';
  }

  var seq = 0;
  function build(host) {
    var uid = 'ucs-rv-' + (++seq);
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
    if (c.l.mode === 'badge') {
      // Star rating line near the price: average, stars and count; tapping it goes to the reviews section below.
      if (!rated.length) { if (!design) host.remove(); return; }
      host.className = c.cls;
      host.style.cssText = c.css;
      host.innerHTML = '<a class="ucs-rv__badge" href="#reviews">' + (c.sm.stars ? stars(avg, avg + ' out of 5 stars') : '') + (c.sm.average ? '<span class="ucs-rv__avg">' + avg + '</span>' : '') +
        (c.sm.count ? '<span class="ucs-rv__count">' + esc(t.basedOn.replace(/\{count\}/g, rated.length)) + '</span>' : '') + '</a>';
      host.querySelector('a').addEventListener('click', function (e) {
        var target = Array.prototype.find.call(document.querySelectorAll('.ucs-rv'), function (x) { return x !== host && !x.classList.contains('ucs-rv--badge'); });
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
      return;
    }
    var ls = c.ls || { perPage: 5, sort: true, bars: true, more: 'Show more reviews', sortBy: 'Sort by', newest: 'Newest', highest: 'Highest rating', lowest: 'Lowest rating', photos: 'With photos' };
    var isList = c.l.mode === 'list';
    // "Write a review": only on a product's page (the review is about that product).
    var wr = c.wr && host.getAttribute('data-product') ? c.wr : null;
    var writeBtn = wr ? '<button type="button" class="ucs-btn ucs-rv__write-open" aria-expanded="false">' + esc(wr.button) + '</button>' : '';
    if (isList) {
      // The full widget: average and count, the 5→1 star bars, and the button, side by side.
      var bars = '';
      if (ls.bars && rated.length) {
        bars = '<div class="ucs-rv__bars">' + [5, 4, 3, 2, 1].map(function (n) {
          var k = rated.filter(function (r) { return Math.round(r.r) === n; }).length;
          return '<div class="ucs-rv__bar"><span>' + n + ' ★</span><span class="ucs-rv__bar-track"><span style="width: ' + Math.round((k / rated.length) * 100) + '%"></span></span><span>' + k + '</span></div>';
        }).join('') + '</div>';
      }
      summary = (summary || bars || writeBtn) ? '<div class="ucs-rv__overview">' + summary + bars + (writeBtn ? '<div class="ucs-rv__write-at">' + writeBtn + '</div>' : '') + '</div>' : '';
      writeBtn = '';
    }
    var head = t.heading || t.sub || summary || writeBtn ? '<div class="ucs-head ucs-rv__head">' + (t.heading ? '<h2>' + esc(t.heading) + '</h2>' : '') + (t.sub ? '<p>' + esc(t.sub) + '</p>' : '') + summary + (writeBtn ? '<div class="ucs-rv__write-at">' + writeBtn + '</div>' : '') + '</div>' : '';
    if (wr) {
      head += '<form class="ucs-rv__form" hidden novalidate>' +
        '<h3>' + esc(wr.title) + '</h3>' +
        '<fieldset class="ucs-rv__rate"><legend class="ucs-rv__sr">Rating</legend>' + [5, 4, 3, 2, 1].map(function (n) {
          return '<input type="radio" name="rating" value="' + n + '" id="' + uid + '-r' + n + '"><label for="' + uid + '-r' + n + '" title="' + n + ' / 5"><span aria-hidden="true">★</span><span class="ucs-rv__sr">' + n + ' out of 5</span></label>';
        }).join('') + '</fieldset>' +
        '<label class="ucs-rv__field"><span>' + esc(wr.name) + '</span><input name="name" maxlength="60" autocomplete="name" required></label>' +
        '<label class="ucs-rv__field"><span>' + esc(wr.review) + '</span><textarea name="text" rows="4" maxlength="2000" required></textarea></label>' +
        '<label class="ucs-rv__hp" aria-hidden="true">Company<input name="company" tabindex="-1" autocomplete="off"></label>' +
        '<p class="ucs-rv__msg" role="status"></p>' +
        '<button type="submit" class="ucs-btn">' + esc(wr.send) + '</button></form>';
    }
    var carousel = c.l.mode === 'carousel';
    var html = '<div class="ucs-wrap">' + head;
    if (isList && shown.length > 1 && ls.sort) {
      html += '<div class="ucs-rv__tools"><label>' + esc(ls.sortBy) + ' <select class="ucs-rv__sort">' +
        [['newest', ls.newest], ['highest', ls.highest], ['lowest', ls.lowest], ['photos', ls.photos]].map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') +
        '</select></label></div>';
    }
    if (!shown.length) html += '<p class="ucs-note">No reviews to show here yet. Add them in the app: Sections → Customer reviews.</p>';
    else {
      var nav = carousel ? '<div class="ucs-rv__nav"><button type="button" class="ucs-rv__arrow" data-dir="-1" aria-label="Previous"><span class="ucs-i ucs-i--chev-l" aria-hidden="true"></span></button>' +
        '<span class="ucs-rv__dots"></span>' +
        '<button type="button" class="ucs-rv__arrow" data-dir="1" aria-label="Next"><span class="ucs-i ucs-i--chev-r" aria-hidden="true"></span></button></div>' : '';
      // Arrows on the sides sit over the cards; otherwise below them.
      var sides = carousel && c.l.nav === 'sides';
      // Coverflow: a spacer on each side so the first and last cards can sit in the centre.
      var pad = carousel && /ucs-rv--flow/.test(c.cls) ? '<div class="ucs-rv__pad" aria-hidden="true"></div>' : '';
      html += '<div class="ucs-rv__viewport"><div class="ucs-rv__track"' + (carousel ? ' tabindex="0" aria-roledescription="carousel" aria-label="' + esc(t.heading || 'Reviews') + '"' : '') + (pad ? ' style="--ucs-flow-n:' + shown.length + '"' : '') + '>' +
        pad + shown.map(function (r) { return card(r, c, t, only, shop); }).join('') + pad + '</div>' + (sides ? nav : '') + '</div>';
      if (carousel && !sides) html += nav;
    }
    if (isList && shown.length > ls.perPage) html += '<div class="ucs-rv__more-at"><button type="button" class="ucs-btn ucs-btn--outline ucs-rv__page">' + esc(ls.more) + '</button></div>';
    html += '</div>';
    host.innerHTML = html;
    if (isList) listing(host, ls);
    if (wr) writing(host, wr);

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

  /* ---------- "List" layout: sorting and "Show more" ---------- */
  function listing(host, ls) {
    var track = host.querySelector('.ucs-rv__track'), more = host.querySelector('.ucs-rv__page'), sort = host.querySelector('.ucs-rv__sort');
    if (!track) return;
    var limit = ls.perPage;
    var page = function () {
      Array.prototype.forEach.call(track.children, function (card, i) { card.hidden = i >= limit; });
      if (more) more.parentNode.hidden = limit >= track.children.length;
    };
    var order = function (how) {
      var cards = Array.prototype.slice.call(track.children);
      var by = {
        newest: function (a, b) { return (b.getAttribute('data-d') || '').localeCompare(a.getAttribute('data-d') || ''); },
        highest: function (a, b) { return b.getAttribute('data-r') - a.getAttribute('data-r'); },
        lowest: function (a, b) { return a.getAttribute('data-r') - b.getAttribute('data-r'); },
        photos: function (a, b) { return b.getAttribute('data-m') - a.getAttribute('data-m'); }
      }[how];
      if (by) cards.sort(by).forEach(function (c) { track.appendChild(c); });
      page();
    };
    if (sort) sort.addEventListener('change', function () { order(sort.value); });
    if (more) more.addEventListener('click', function () { limit += ls.perPage; page(); });
    page();
  }

  /* ---------- "Write a review": sent to the app, shown after the merchant approves it ---------- */
  function writing(host, wr) {
    var open = host.querySelector('.ucs-rv__write-open'), form = host.querySelector('.ucs-rv__form');
    if (!open || !form) return;
    var msg = form.querySelector('.ucs-rv__msg'), send = form.querySelector('[type="submit"]');
    open.addEventListener('click', function () {
      form.hidden = !form.hidden;
      open.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) form.querySelector('input[name="rating"]').focus();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = new FormData(form);
      var say = function (text, bad) { msg.textContent = text; msg.classList.toggle('is-error', !!bad); };
      if (!f.get('rating')) return say('Please choose 1 to 5 stars.', true);
      if (!String(f.get('name') || '').trim()) return say('Please add your name.', true);
      if (String(f.get('text') || '').trim().length < 3) return say('Please write a few words.', true);
      var root = host.getAttribute('data-root') || '/';
      send.disabled = true;
      say('');
      fetch(root.replace(/\/$/, '') + '/apps/ucro/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ product: host.getAttribute('data-product'), rating: Number(f.get('rating')), name: f.get('name'), text: f.get('text'), company: f.get('company') })
      }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); }).then(function (d) {
        if (d && d.ok) {
          form.innerHTML = '<p class="ucs-rv__thanks" role="status">' + esc(wr.thanks) + '</p>';
          open.hidden = true;
        } else {
          say((d && d.error) || 'Your review could not be sent. Please try again.', true);
          send.disabled = false;
        }
      }).catch(function () { say('Your review could not be sent. Please try again.', true); send.disabled = false; });
    });
  }

  function scan() {
    document.querySelectorAll('[data-ucs-rv]:not([data-built])').forEach(function (host) { host.setAttribute('data-built', ''); build(host); });
    document.querySelectorAll('.ucs-rv').forEach(function (root) { setup(root); dots(root); });
  }
  scan();
  document.addEventListener('shopify:section:load', scan);
})();
