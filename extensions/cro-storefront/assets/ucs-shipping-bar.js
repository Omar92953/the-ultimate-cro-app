/* Free shipping bar: message + progress toward the free-shipping goal, kept in step with the cart.
   The goal is set in the store's currency and converted with Shopify's rate for shoppers in other
   currencies. Copies inside the theme's cart drawer and on the cart page (above the items or above
   the checkout button) are put back whenever the theme redraws the cart. The cart copies also come
   from the Conversion boosters embed ([data-cart-only]), so they work without the top bar. */
(function () {
  if (window.__ucsFsb) return;
  window.__ucsFsb = true;
  var bars = [];
  var cfg = null, total = 0, goal = 0, reached = null, page = "other";

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

  // where: "" (the top bar), "drawer" or "page" (the cart page).
  function markup(el, where) {
    el.className = cfg.cls + (where ? " ucs-fsb--" + where + (cfg.s.cartPos === "bottom" ? " ucs-fsb--bottom" : "") : "");
    el.style.cssText = cfg.css;
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="ucs-fsb__in">' +
      (cfg.s.icon !== "none" ? '<span class="ucs-fsb__icon">' + ICON[cfg.s.icon] + "</span>" : "") +
      '<span class="ucs-fsb__msg"></span></div>' +
      (cfg.s.bar ? '<div class="ucs-fsb__track"><i class="ucs-fsb__fill"></i></div>' : "");
    bars = bars.filter(function (b) { return b.isConnected; });
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
        cartPage();
      })
      .catch(function () {});
  }

  // A copy inside the theme's cart drawer, put back whenever the theme redraws the drawer.
  var DRAWER = "cart-drawer .drawer__inner, #CartDrawer .drawer__inner, #CartDrawer, .cart-drawer__content, [data-cart-drawer] .drawer__inner";
  function drawer() {
    if (!cfg || !cfg.s.drawer) return;
    var box = document.querySelector(DRAWER);
    if (!box || box.querySelector(".ucs-fsb--drawer")) return;
    var el = document.createElement("div");
    markup(el, "drawer");
    var foot = cfg.s.cartPos === "bottom" && box.querySelector(".drawer__footer, .cart-drawer__footer, .cart-drawer__ctas");
    var head = box.querySelector(".drawer__header, .cart-drawer__header");
    if (foot) foot.insertBefore(el, foot.firstChild);
    else if (head) head.after(el);
    else box.insertBefore(el, box.firstChild);
  }

  // A copy on the cart page: under the "Your cart" title, or just above the checkout button.
  function cartPage() {
    if (!cfg || !cfg.s.cartPage || page !== "cart") return;
    var main = document.querySelector("main, #MainContent") || document.body;
    if (main.querySelector(".ucs-fsb--page, [data-ucs-fsb]:not([hidden]):not([data-cart-only])")) return;
    var form = main.querySelector('cart-items, #main-cart-items, form[action*="/cart"]:not([action*="/add"])');
    var title = main.querySelector(".title-wrapper-with-link, .cart__title, .cart-title, h1");
    var ctas = main.querySelector('.cart__ctas, .cart__checkout-wrapper, [name="checkout"]');
    var el = document.createElement("div");
    if (cfg.s.cartPos === "bottom" && ctas) ctas.before(el);
    else if (title && (!form || form.contains(title) || title.compareDocumentPosition(form) & 4)) title.after(el);
    else if (form) form.before(el);
    else return;
    markup(el, "page");
  }
  var queued = false;
  function watch(node) {
    if (!node || !window.MutationObserver) return;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        drawer();
        cartPage();
      });
    }).observe(node, { childList: true, subtree: true });
  }

  function init() {
    var design = window.Shopify && Shopify.designMode;
    document.querySelectorAll("[data-ucs-fsb]:not([data-ready])").forEach(function (host) {
      host.setAttribute("data-ready", "");
      var c;
      try {
        c = JSON.parse(host.querySelector("script").textContent);
      } catch (e) {
        return;
      }
      var here = { index: "home", product: "product", collection: "collection", cart: "cart" }[host.getAttribute("data-page")] || "other";
      if (!cfg) {
        cfg = c;
        page = here;
        var rate = parseFloat(currency().rate) || 1;
        goal = Math.round(c.goal * 100 * rate);
        total = parseInt(host.getAttribute("data-total"), 10) || 0;
        reached = total >= goal;
      }
      // The embed's copy only carries the settings for the cart; the top bar shows where it's placed.
      var off = host.hasAttribute("data-cart-only") || (!design && (c.s.top === false || (!c.w.a && c.w.p.indexOf(here) < 0)));
      if (off) {
        host.remove();
        return;
      }
      var group = host.closest(".shopify-section");
      if (group && /header/.test(group.className)) group.classList.add("ucs-in-group");
      markup(host, "");
    });
    if (!cfg) return;
    drawer();
    cartPage();
    if (!window.__ucsFsbWatch) {
      window.__ucsFsbWatch = true;
      watch(document.querySelector("cart-drawer, #CartDrawer"));
      if (page === "cart") watch(document.querySelector("main, #MainContent"));
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
