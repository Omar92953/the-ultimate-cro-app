/* Free shipping bar: message + progress toward the free-shipping goal, kept in step with the cart.
   The goal is set in the store's currency and converted with Shopify's rate for shoppers in other
   currencies. Optionally shows a copy inside the theme's cart drawer (re-added when the drawer redraws). */
(function () {
  if (window.__ucsFsb) return;
  window.__ucsFsb = true;
  var bars = [];
  var cfg = null, total = 0, goal = 0, reached = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function currency() {
    return (window.Shopify && Shopify.currency) || {};
  }
  function money(cents) {
    var v = cents / 100;
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: "currency",
        currency: currency().active || "USD",
        maximumFractionDigits: v % 1 ? 2 : 0,
      }).format(v);
    } catch (e) {
      return v.toFixed(2);
    }
  }
  var ICON = {
    truck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z"/><circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/></svg>',
    gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9h17v3.5h-17zM5 12.5h14V20H5zM12 9v11M12 9c-1.5-3.5-5.5-3.5-5.5-1S10 9 12 9c1.5-3.5 5.5-3.5 5.5-1S14 9 12 9"/></svg>',
  };

  function message() {
    var t = cfg.t;
    if (total <= 0) return t.empty.replace(/\{goal\}/g, money(goal));
    if (total >= goal) return t.done;
    return t.progress.replace(/\{left\}/g, money(goal - total)).replace(/\{goal\}/g, money(goal));
  }

  function draw(el) {
    var done = total >= goal;
    el.classList.toggle("is-done", done);
    el.hidden = total <= 0 && !cfg.s.whenEmpty;
    var msg = el.querySelector(".ucs-fsb__msg");
    if (msg) msg.textContent = message();
    var fill = el.querySelector(".ucs-fsb__fill");
    if (fill) fill.style.width = Math.min(100, goal ? (total / goal) * 100 : 0) + "%";
  }
  function drawAll() {
    var done = total >= goal;
    var celebrate = cfg.s.celebrate && reached === false && done;
    bars.forEach(function (el) {
      draw(el);
      if (celebrate) {
        el.classList.remove("is-party");
        void el.offsetWidth;
        el.classList.add("is-party");
      }
    });
    reached = done;
  }

  function markup(el, inDrawer) {
    el.className = cfg.cls + (inDrawer ? " ucs-fsb--drawer" : "");
    el.style.cssText = cfg.css;
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="ucs-fsb__in">' +
      (cfg.s.icon !== "none" ? '<span class="ucs-fsb__icon">' + ICON[cfg.s.icon] + "</span>" : "") +
      '<span class="ucs-fsb__msg"></span></div>' +
      (cfg.s.bar ? '<div class="ucs-fsb__track"><i class="ucs-fsb__fill"></i></div>' : "");
    bars.push(el);
    draw(el);
  }

  function refresh() {
    var root = (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";
    fetch(root + "cart.js", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        total = cart.total_price || 0;
        drawAll();
        drawer();
      })
      .catch(function () {});
  }

  // A copy inside the theme's cart drawer, put back whenever the theme redraws the drawer.
  var DRAWER = "cart-drawer .drawer__inner, #CartDrawer .drawer__inner, #CartDrawer, .cart-drawer__content, [data-cart-drawer] .drawer__inner";
  function drawer() {
    if (!cfg || !cfg.s.drawer) return;
    var box = document.querySelector(DRAWER);
    if (!box || box.querySelector(".ucs-fsb--drawer")) return;
    bars = bars.filter(function (b) { return b.isConnected; });
    var el = document.createElement("div");
    markup(el, true);
    var head = box.querySelector(".drawer__header, .cart-drawer__header");
    if (head) head.after(el);
    else box.insertBefore(el, box.firstChild);
  }

  function init() {
    var hosts = document.querySelectorAll("[data-ucs-fsb]:not([data-ready])");
    hosts.forEach(function (host) {
      host.setAttribute("data-ready", "");
      var c;
      try {
        c = JSON.parse(host.querySelector("script").textContent);
      } catch (e) {
        return;
      }
      var page = { index: "home", product: "product", collection: "collection", cart: "cart" }[host.getAttribute("data-page")] || "other";
      if (!c.w.a && c.w.p.indexOf(page) < 0 && !(window.Shopify && Shopify.designMode)) {
        host.remove();
        return;
      }
      if (!cfg) {
        cfg = c;
        var rate = parseFloat(currency().rate) || 1;
        goal = Math.round(c.goal * 100 * rate);
        total = parseInt(host.getAttribute("data-total"), 10) || 0;
        reached = total >= goal;
      }
      var group = host.closest(".shopify-section");
      if (group && /header/.test(group.className)) group.classList.add("ucs-in-group");
      markup(host, false);
    });
    if (cfg) {
      drawer();
      var cd = document.querySelector("cart-drawer, #CartDrawer");
      if (cd && window.MutationObserver) new MutationObserver(function () { drawer(); }).observe(cd, { childList: true, subtree: true });
    }
  }

  // Keep in step with the cart: after any add/change/update/clear made by the theme or other apps.
  var nativeFetch = window.fetch;
  window.fetch = function (input) {
    var p = nativeFetch.apply(this, arguments);
    var url = typeof input === "string" ? input : input && input.url;
    if (cfg && url && /\/cart\/(add|change|update|clear)/.test(url)) p.then(function () { setTimeout(refresh, 80); });
    return p;
  };
  document.addEventListener("cart:updated", function () { if (cfg) refresh(); });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  document.addEventListener("shopify:section:load", init);
})();
