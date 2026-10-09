/* Collection pills: builds the row from the app's design, highlights the collection being viewed
   (and scrolls it into view), lets mouse users drag the row, and wires the optional arrows. */
(function () {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  var CHEV = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function build(el) {
    var c;
    try {
      c = JSON.parse(el.querySelector("script").textContent);
    } catch (e) {
      return;
    }
    if (!c.i || !c.i.length) return;
    var base = (el.getAttribute("data-root") || "/collections").replace(/\/$/, "");
    var on = el.getAttribute("data-on");
    el.className = c.cls;
    el.style.cssText = c.css;
    el.innerHTML =
      '<div class="ucs-wrap">' +
      (c.h ? '<div class="ucs-head"><h2>' + esc(c.h) + "</h2></div>" : "") +
      '<div class="ucs-cp__vp">' +
      '<button type="button" class="ucs-cp__arrow ucs-cp__arrow--prev" aria-label="Scroll back" tabindex="-1">' + CHEV + "</button>" +
      '<nav class="ucs-cp__row" aria-label="' + esc(c.h || "Collections") + '">' +
      c.i
        .map(function (x) {
          var cur = x.h === on;
          return (
            '<a class="ucs-cp__pill' + (cur ? " is-on" : "") + '" href="' + esc(base + "/" + x.h) + '"' + (cur ? ' aria-current="page"' : "") + ">" +
            (x.im ? '<img src="' + esc(x.im + (x.im.indexOf("?") > -1 ? "&" : "?") + "width=80") + '" alt="" width="28" height="28" loading="lazy">' : "") +
            "<span>" + esc(x.t) + "</span></a>"
          );
        })
        .join("") +
      "</nav>" +
      '<button type="button" class="ucs-cp__arrow ucs-cp__arrow--next" aria-label="Scroll on" tabindex="-1">' + CHEV + "</button>" +
      "</div></div>";

    var row = el.querySelector(".ucs-cp__row");
    var cur = row.querySelector(".is-on");
    // Show the current collection without moving the page itself.
    if (cur) row.scrollLeft = cur.offsetLeft - (row.clientWidth - cur.offsetWidth) / 2;

    function ends() {
      el.classList.toggle("ucs-cp--start", row.scrollLeft < 4);
      el.classList.toggle("ucs-cp--end", row.scrollLeft + row.clientWidth >= row.scrollWidth - 4);
    }
    ends();
    row.addEventListener("scroll", ends, { passive: true });
    window.addEventListener("resize", ends);
    el.querySelector(".ucs-cp__arrow--prev").addEventListener("click", function () {
      row.scrollBy({ left: -row.clientWidth * 0.7, behavior: "smooth" });
    });
    el.querySelector(".ucs-cp__arrow--next").addEventListener("click", function () {
      row.scrollBy({ left: row.clientWidth * 0.7, behavior: "smooth" });
    });

    // Mouse users can drag the row; a drag never counts as a click on a pill.
    var down = false, moved = false, startX = 0, startLeft = 0;
    row.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse") return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = row.scrollLeft;
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) {
        moved = true;
        el.classList.add("ucs-cp--drag");
      }
      row.scrollLeft = startLeft - dx;
    });
    window.addEventListener("pointerup", function () {
      down = false;
      el.classList.remove("ucs-cp--drag");
    });
    row.addEventListener(
      "click",
      function (e) {
        if (moved) {
          e.preventDefault();
          moved = false;
        }
      },
      true,
    );
    row.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
  }

  function init() {
    document.querySelectorAll("[data-ucs-cp]:not([data-ready])").forEach(function (el) {
      el.setAttribute("data-ready", "");
      build(el);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  document.addEventListener("shopify:section:load", init);
})();
