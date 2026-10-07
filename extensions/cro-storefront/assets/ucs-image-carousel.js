/* Image carousel: builds the section from the app's design (JSON in the block), then wires the
   arrows, dots and optional autoplay. Same markup as the app's live preview. */
(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var CHEV = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function sized(u, w) {
    return u + (u.indexOf("?") > -1 ? "&" : "?") + "width=" + w;
  }

  function slide(s, i, n) {
    var widths = [360, 540, 720, 960, 1200].filter(function (w) {
      return w <= Math.max(360, s.w);
    });
    var img =
      '<img src="' + esc(sized(s.u, 720)) + '" srcset="' +
      widths.map(function (w) { return esc(sized(s.u, w)) + " " + w + "w"; }).join(", ") +
      '" sizes="(min-width: 750px) 33vw, 85vw" width="' + s.w + '" height="' + s.h + '" alt="' + esc(s.a) + '" loading="' + (i < 4 ? "eager" : "lazy") + '">';
    var cap = s.t || s.x || s.b
      ? '<span class="ucs-ic__cap">' +
        (s.t ? '<span class="ucs-ic__title">' + esc(s.t) + "</span>" : "") +
        (s.x ? '<span class="ucs-ic__text">' + esc(s.x) + "</span>" : "") +
        (s.b ? '<span class="ucs-ic__btn">' + esc(s.b) + "</span>" : "") +
        "</span>"
      : "";
    var tag = s.l ? "a" : "div";
    return (
      '<li class="ucs-ic__slide" aria-roledescription="slide" aria-label="' + (i + 1) + " / " + n + '">' +
      "<" + tag + ' class="ucs-ic__card"' + (s.l ? ' href="' + esc(s.l) + '"' : "") + ">" +
      '<span class="ucs-ic__media">' + img + "</span>" + cap +
      "</" + tag + "></li>"
    );
  }

  function build(root) {
    var c;
    try {
      c = JSON.parse(root.querySelector("script").textContent);
    } catch (e) {
      return;
    }
    if (!c.s || !c.s.length) return;
    root.className = c.cls;
    root.style.cssText = c.css;
    var label = (c.h && c.h.t) || "Image carousel";
    root.innerHTML =
      '<div class="ucs-wrap">' +
      (c.h && (c.h.t || c.h.s) ? '<div class="ucs-head">' + (c.h.t ? "<h2>" + esc(c.h.t) + "</h2>" : "") + (c.h.s ? "<p>" + esc(c.h.s) + "</p>" : "") + "</div>" : "") +
      '<div class="ucs-ic__vp">' +
      '<ul class="ucs-ic__track" role="list" tabindex="0" aria-roledescription="carousel" aria-label="' + esc(label) + '">' +
      c.s.map(function (s, i) { return slide(s, i, c.s.length); }).join("") +
      "</ul>" +
      '<button type="button" class="ucs-ic__arrow ucs-ic__arrow--prev" aria-label="Previous">' + CHEV + "</button>" +
      '<button type="button" class="ucs-ic__arrow ucs-ic__arrow--next" aria-label="Next">' + CHEV + "</button>" +
      "</div>" +
      '<div class="ucs-ic__dots"></div>' +
      "</div>";
    wire(root, c);
  }

  function wire(root, c) {
    var track = root.querySelector(".ucs-ic__track");
    var slides = track.children;
    var prev = root.querySelector(".ucs-ic__arrow--prev");
    var next = root.querySelector(".ucs-ic__arrow--next");
    var dotsBox = root.querySelector(".ucs-ic__dots");
    var step = function () {
      return slides[0] ? slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : track.clientWidth;
    };
    var pages = function () {
      return Math.max(1, Math.round((track.scrollWidth - track.clientWidth) / step()) + 1);
    };
    var go = function (dir) {
      var end = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (dir > 0 && end) track.scrollTo({ left: 0, behavior: "smooth" });
      else if (dir < 0 && track.scrollLeft < 4) track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
      else track.scrollBy({ left: dir * step(), behavior: "smooth" });
    };
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });

    function drawDots() {
      var n = pages();
      if (dotsBox.childElementCount === n) return;
      dotsBox.innerHTML = "";
      for (var i = 0; i < n; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "ucs-ic__dot";
        b.setAttribute("aria-label", "Go to slide " + (i + 1));
        b.addEventListener("click", (function (k) {
          return function () { track.scrollTo({ left: k * step(), behavior: "smooth" }); };
        })(i));
        dotsBox.appendChild(b);
      }
      dotsBox.hidden = n < 2;
    }
    function update() {
      var at = Math.round(track.scrollLeft / step());
      Array.prototype.forEach.call(dotsBox.children, function (d, i) {
        d.setAttribute("aria-current", i === at ? "true" : "false");
      });
      var fits = track.scrollWidth <= track.clientWidth + 4;
      root.classList.toggle("ucs-ic--fits", fits);
    }
    drawDots();
    update();
    track.addEventListener("scroll", function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", function () { drawDots(); update(); });

    // Autoplay: pauses on hover/focus, off for shoppers who prefer reduced motion.
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (c.auto > 0 && !reduce) {
      var paused = false;
      ["mouseenter", "focusin", "touchstart"].forEach(function (e) {
        root.addEventListener(e, function () { paused = true; }, { passive: true });
      });
      ["mouseleave", "focusout"].forEach(function (e) {
        root.addEventListener(e, function () { paused = false; });
      });
      setInterval(function () {
        if (!paused && !document.hidden) go(1);
      }, c.auto * 1000);
    }
  }

  function init() {
    document.querySelectorAll("[data-ucs-ic]:not([data-ready])").forEach(function (root) {
      root.setAttribute("data-ready", "");
      build(root);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  // Theme editor: re-run when the block is added or moved.
  document.addEventListener("shopify:section:load", init);
})();
