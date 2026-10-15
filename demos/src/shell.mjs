/**
 * The page around every live demo: a small, neutral demo store ("Lumen Goods") with a header,
 * a product page, a cart page or a collection grid, a theme cart drawer, and a fake store backend
 * that answers the storefront scripts' requests (/cart/add.js, /cart.js, /products/<handle>.js…)
 * from the demo catalog. The cart lives in sessionStorage, so it is shared by every demo in the tab
 * and by the demo cart page (/store/cart/).
 *
 * Each demo page runs in an iframe on the website and tells its parent its height.
 */
export const STORE_NAME = "Lumen Goods";
export const STORE_ROOT = "/store/";

const CSS = `
:root{--color-foreground:18,18,18;--color-background:255,255,255;--color-button:18,18,18;--color-button-text:255,255,255;--buttons-radius:999px;--product-card-corner-radius:14px;--page-width:1120px;--font-body-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:15px/1.55 var(--font-body-family);color:rgb(18,18,18);background:#fff;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;height:auto;display:block}
a{color:inherit}
h1,h2,h3{line-height:1.15;letter-spacing:-.01em}
.page-width{max-width:var(--page-width);margin:0 auto;padding:0 20px}
.demo-header{border-bottom:1px solid #eee;background:#fff}
.demo-header .page-width{display:flex;align-items:center;gap:24px;height:64px}
.demo-logo{font-weight:800;font-size:19px;letter-spacing:-.02em;text-decoration:none}
.demo-nav{display:flex;gap:18px;font-size:14px;color:#444}
.demo-nav a{text-decoration:none}
.demo-icons{margin-left:auto;display:flex;align-items:center;gap:14px}
.demo-icons svg{width:22px;height:22px}
#cart-icon-bubble{position:relative;display:inline-flex;text-decoration:none}
.cart-count-bubble{position:absolute;top:-6px;right:-8px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#121212;color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center}
.cart-count-bubble[hidden]{display:none}
@media (max-width:640px){.demo-nav{display:none}}
.product{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:40px;padding:32px 0 40px}
@media (max-width:749px){.product{grid-template-columns:minmax(0,1fr);gap:20px;padding-top:16px}}
.product__media img{width:100%;aspect-ratio:1;border-radius:16px;object-fit:cover;background:#f3f3f3}
.product__thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
.product__thumbs img{aspect-ratio:1;border-radius:10px}
@media (max-width:749px){.product__thumbs{display:none}.product__media img{aspect-ratio:4/3}}
.product__vendor{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#777}
.product__title{font-size:30px;margin:6px 0 8px}
.price{display:flex;gap:10px;align-items:baseline;font-size:18px}
.price s{color:#888;font-size:15px}
.product-form{margin-top:18px;display:grid;gap:12px}
.product-form__input{border:0;padding:0;margin:0}
.product-form__input legend{font-size:13px;color:#555;margin-bottom:6px}
.product-form__input input[type=radio]{position:absolute;opacity:0;width:1px;height:1px}
.product-form__input label{display:inline-block;margin:0 6px 6px 0;padding:8px 16px;border:1px solid #ccc;border-radius:999px;font-size:14px;cursor:pointer}
.product-form__input input:checked+label{background:#121212;color:#fff;border-color:#121212}
.qty{display:inline-flex;align-items:center;border:1px solid #ccc;border-radius:999px;width:max-content}
.qty button{width:40px;height:44px;border:0;background:none;font-size:18px;cursor:pointer}
.qty input{width:40px;border:0;text-align:center;font:inherit;-moz-appearance:textfield}
.qty input::-webkit-inner-spin-button{-webkit-appearance:none}
.button,.product-form__submit{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 24px;border:0;border-radius:var(--buttons-radius);background:#121212;color:#fff;font:inherit;font-weight:600;cursor:pointer;width:100%}
.button--secondary{background:#fff;color:#121212;border:1px solid #121212}
.shopify-payment-button{min-height:50px;border-radius:999px;background:#5a31f4;color:#fff;display:grid;place-items:center;font-weight:700;letter-spacing:.01em}
.product__description{margin-top:22px;color:#444;font-size:14px}
.product__description ul{padding-left:18px}
.demo-section{padding:8px 0}
.demo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;padding:12px 0 40px;list-style:none;margin:0}
@media (max-width:749px){.demo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}
.card-wrapper{position:relative;list-style:none}
.card{position:relative}
.card__media{position:relative;border-radius:var(--product-card-corner-radius);overflow:hidden;background:#f3f3f3}
.card__media .media{position:relative;padding-bottom:110%}
.card__media .media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.card__heading{font-size:15px;font-weight:600;margin:10px 0 2px}
.card__heading a{text-decoration:none}
.card__content .price{font-size:14px}
.collection-title{font-size:28px;margin:28px 0 6px}
.cart-page{padding:28px 0 40px}
.cart-page h1{font-size:28px;margin:0 0 16px}
.cart-items{list-style:none;padding:0;margin:0;border-top:1px solid #eee}
.cart-items li{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid #eee}
.cart-items img{width:64px;height:64px;border-radius:10px}
.cart-items small{display:block;color:#777}
.cart-footer{display:grid;gap:12px;justify-items:end;margin-top:16px}
.cart-footer .button{width:auto;min-width:240px}
/* TODO: remove once the cart drawer stops sharing the class ucs-cd with the countdown timer in ucs-sections.css (its position:fixed;inset:0 turns every timer into a full screen layer). */
ucs-countdown.ucs-cd{position:static;inset:auto;z-index:auto}
.cart-empty{color:#777;padding:12px 0}
cart-drawer{position:fixed;inset:0 0 0 auto;width:min(380px,92vw);background:#fff;box-shadow:-8px 0 30px rgba(0,0,0,.15);transform:translateX(105%);transition:transform .25s ease;z-index:60;display:flex;flex-direction:column}
cart-drawer.active{transform:none}
.drawer__head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #eee;font-weight:700;font-size:17px}
.drawer__close{border:0;background:none;font-size:22px;cursor:pointer;line-height:1}
.drawer__body{flex:1;overflow:auto;padding:4px 18px}
#CartDrawer,.drawer__inner{display:flex;flex-direction:column;height:100%;min-height:0}
.drawer__footer{border-top:1px solid #eee;padding:14px 18px;display:grid;gap:10px}
[data-ucro-drawer]{padding:0 18px 12px}
.drawer__total{display:flex;justify-content:space-between;font-weight:700}
.drawer__note{font-size:12px;color:#777}
.demo-toast{position:fixed;left:50%;bottom:18px;transform:translate(-50%,20px);opacity:0;background:#121212;color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;z-index:99;transition:all .25s;pointer-events:none;max-width:90vw;text-align:center}
.demo-toast.on{opacity:1;transform:translate(-50%,0)}
.demo-pad{padding:24px 0}
.demo-narrow{max-width:520px}
`;

const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;
const ICON_CART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>`;

export const storeHeader = () => `<header class="demo-header site-header" id="shopify-section-header"><div class="page-width">
  <a class="demo-logo" href="${STORE_ROOT}">${STORE_NAME}</a>
  <nav class="demo-nav" aria-label="Store menu"><a href="${STORE_ROOT}collections/all">Shop</a><a href="${STORE_ROOT}collections/candles">Candles</a><a href="${STORE_ROOT}collections/skincare">Skincare</a><a href="${STORE_ROOT}pages/about">About</a></nav>
  <div class="demo-icons"><a href="${STORE_ROOT}search" aria-label="Search">${ICON_SEARCH}</a><a href="${STORE_ROOT}cart" id="cart-icon-bubble" aria-label="Cart">${ICON_CART}<span class="cart-count-bubble" hidden>0</span></a></div>
</div></header>`;

/**
 * The fake store: Shopify-like globals, the cart and the endpoints the storefront scripts call.
 * `catalog` maps handle → product JSON (as /products/<handle>.js returns it).
 */
function backendScript({ catalog, collections, frameId, orderJson }) {
  return `<script>
(function () {
  var ROOT = ${JSON.stringify(STORE_ROOT)};
  window.Shopify = window.Shopify || {};
  window.Shopify.routes = { root: ROOT };
  window.Shopify.currency = { active: "USD", rate: "1.0" };
  window.Shopify.shop = "lumen-goods.myshopify.com";
  window.routes = { root_url: ROOT, cart_add_url: ROOT + "cart/add", cart_change_url: ROOT + "cart/change", cart_update_url: ROOT + "cart/update", cart_url: ROOT + "cart", predictive_search_url: ROOT + "search/suggest", product_recommendations_url: ROOT + "recommendations/products" };
  window.PUB_SUB_EVENTS = { cartUpdate: "cart-update", variantChange: "variant-change", cartError: "cart-error", quantityUpdate: "quantity-update" };
  var subs = {};
  window.subscribe = function (e, cb) { (subs[e] = subs[e] || []).push(cb); return function () { subs[e] = subs[e].filter(function (c) { return c !== cb; }); }; };
  window.publish = function (e, data) { (subs[e] || []).forEach(function (cb) { cb(data); }); return Promise.resolve(); };

  var CATALOG = ${JSON.stringify(catalog)};
  var COLLECTIONS = ${JSON.stringify(collections)};
  var ORDER = ${JSON.stringify(orderJson)};
  window.__demoCatalog = CATALOG;
  var byVariant = {};
  Object.keys(CATALOG).forEach(function (h) { CATALOG[h].variants.forEach(function (v) { byVariant[v.id] = { p: CATALOG[h], v: v }; }); });

  var KEY = "lumen-demo-cart";
  function load() { try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  var state = load() || { items: [], attributes: {}, note: "", discount: "" };
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var n = 0;
  function line(it) {
    var hit = byVariant[it.id] || {};
    var p = hit.p || {}, v = hit.v || {};
    var price = v.price || 0;
    return {
      key: it.key, id: it.id, variant_id: it.id, product_id: p.id, handle: p.handle, title: p.title + (v.title && v.title !== "Default Title" ? " - " + v.title : ""),
      product_title: p.title, variant_title: v.title === "Default Title" ? null : v.title, url: ROOT + "products/" + p.handle, image: p.featured_image, featured_image: { url: p.featured_image },
      quantity: it.quantity, price: price, original_price: price, final_price: price, line_price: price * it.quantity, original_line_price: price * it.quantity, final_line_price: price * it.quantity,
      properties: it.properties || {}, options_with_values: (p.options || []).map(function (o, i) { return { name: o.name || o, value: (v.options || [])[i] }; }), product_has_only_default_variant: p.variants && p.variants.length === 1,
      requires_shipping: true, discounts: [], line_level_discount_allocations: []
    };
  }
  function cart() {
    var items = state.items.map(line);
    var sub = items.reduce(function (t, i) { return t + i.final_line_price; }, 0);
    return { token: "demo", items: items, item_count: items.reduce(function (t, i) { return t + i.quantity; }, 0), total_price: sub, items_subtotal_price: sub, original_total_price: sub, total_discount: 0,
      currency: "USD", attributes: state.attributes, note: state.note, requires_shipping: true, discount_codes: state.discount ? [{ code: state.discount, applicable: false }] : [], cart_level_discount_applications: [] };
  }
  window.__demoCart = cart;
  function findLine(id) {
    return state.items.filter(function (i) { return String(i.key) === String(id) || String(i.id) === String(id); })[0];
  }
  function sections(body) {
    var out = {};
    var list = body && (body.sections || (body.get && body.get("sections")));
    if (typeof list === "string") list = list.split(",");
    (list || []).forEach(function (s) { out[s] = '<div id="shopify-section-' + s + '"></div>'; });
    return out;
  }
  function res(data, status) { return Promise.resolve(new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json" } })); }
  function changed() { save(); bubble(); try { window.parent.postMessage({ type: "demo-cart", count: cart().item_count }, "*"); } catch (e) {} document.dispatchEvent(new CustomEvent("demo:cart")); }
  function parseBody(opts) {
    if (!opts || !opts.body) return {};
    if (typeof FormData !== "undefined" && opts.body instanceof FormData) {
      var props = {}, o = {};
      opts.body.forEach(function (v, k) { var m = k.match(/^properties\\[(.*)\\]$/); if (m) props[m[1]] = v; else o[k] = v; });
      o.properties = props;
      o.get = function (k) { return o[k]; };
      return o;
    }
    try { return JSON.parse(opts.body); } catch (e) { return {}; }
  }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = typeof url === "string" ? url : (url && url.url) || String(url);
    var path = u.replace(/^https?:\\/\\/[^/]+/, "").split("?")[0];
    var q = new URL(u, location.href).searchParams;
    var body = parseBody(opts);
    var m;
    if (/\\/cart\\/add(\\.js)?$/.test(path)) {
      var items = body.items || [{ id: Number(body.id), quantity: Number(body.quantity || 1), properties: body.properties || {} }];
      var added = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var hit = byVariant[it.id];
        if (!hit || hit.v.available === false) return res({ status: 422, message: "Cart Error", description: "That item is sold out." }, 422);
        var props = it.properties || {};
        var same = state.items.filter(function (x) { return x.id === Number(it.id) && JSON.stringify(x.properties || {}) === JSON.stringify(props); })[0];
        if (same) same.quantity += Number(it.quantity || 1);
        else { same = { key: "k" + Date.now().toString(36) + (++n), id: Number(it.id), quantity: Number(it.quantity || 1), properties: props }; state.items.push(same); }
        added.push(line(same));
      }
      changed();
      var single = added.length === 1 && !body.items ? added[0] : { items: added };
      single.sections = sections(body);
      return res(single);
    }
    if (/\\/cart(\\.js)?$/.test(path) && (!opts || !opts.method || opts.method === "GET")) return res(cart());
    if (/\\/cart\\/change(\\.js)?$/.test(path)) {
      var l = body.line ? state.items[Number(body.line) - 1] : findLine(body.id);
      if (l) { l.quantity = Number(body.quantity); if (body.properties) l.properties = body.properties; }
      state.items = state.items.filter(function (x) { return x.quantity > 0; });
      changed();
      var c = cart(); c.sections = sections(body); return res(c);
    }
    if (/\\/cart\\/update(\\.js)?$/.test(path)) {
      if (body.attributes) Object.keys(body.attributes).forEach(function (k) { state.attributes[k] = body.attributes[k]; });
      if (typeof body.note === "string") state.note = body.note;
      if (typeof body.discount === "string") state.discount = body.discount;
      if (body.updates) Object.keys(body.updates).forEach(function (k) { var l2 = findLine(k); if (l2) l2.quantity = Number(body.updates[k]); });
      state.items = state.items.filter(function (x) { return x.quantity > 0; });
      changed();
      var c2 = cart(); c2.sections = sections(body); return res(c2);
    }
    if (/\\/cart\\/clear(\\.js)?$/.test(path)) { state.items = []; changed(); return res(cart()); }
    if ((m = path.match(/\\/products\\/([^/]+)\\.js$/))) { var p = CATALOG[decodeURIComponent(m[1])]; return p ? res(p) : res({}, 404); }
    if ((m = path.match(/\\/collections\\/([^/]+)\\/products\\.json$/))) {
      var handles = COLLECTIONS[decodeURIComponent(m[1])] || Object.keys(CATALOG);
      var page = Number(q.get("page") || 1), limit = Number(q.get("limit") || 30);
      return res({ products: handles.slice((page - 1) * limit, page * limit).map(function (h) { return CATALOG[h]; }) });
    }
    if (/\\/products\\.json$/.test(path)) return res({ products: Object.keys(CATALOG).map(function (h) { return CATALOG[h]; }) });
    if (/\\/recommendations\\/products(\\.json)?$/.test(path)) return res({ products: Object.keys(CATALOG).slice(0, 6).map(function (h) { return CATALOG[h]; }) });
    if (/\\/search\\/suggest(\\.json)?$/.test(path)) {
      var term = (q.get("q") || "").toLowerCase();
      var found = Object.keys(CATALOG).map(function (h) { return CATALOG[h]; }).filter(function (p) { return p.title.toLowerCase().indexOf(term) >= 0; }).slice(0, 6);
      return res({ resources: { results: { products: found.map(function (p) { return { title: p.title, url: ROOT + "products/" + p.handle, image: p.featured_image, price: (p.price / 100).toFixed(2) }; }) } } });
    }
    if (/\\/apps\\/ucro\\/track$/.test(path)) return res({ ok: true, order: ORDER });
    if (/\\/apps\\/ucro\\/returns$/.test(path)) return res(body.intent === "send" ? { ok: true } : { ok: true, order: ORDER });
    if (/\\/apps\\/ucro\\//.test(path)) return res({ ok: true });
    if (/\\/contact$/.test(path)) return res({ ok: true });
    return realFetch(url, opts);
  };

  // ---- the theme's cart icon and drawer (Dawn-like) ---------------------------------------
  function money(c) { return "$" + (c / 100).toFixed(2); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  window.__demoEsc = esc;
  function bubble() {
    var b = document.querySelector(".cart-count-bubble");
    if (!b) return;
    var count = cart().item_count;
    b.textContent = count;
    b.hidden = count === 0;
  }
  function drawerHtml() {
    var c = cart();
    var rows = c.items.map(function (i) {
      var props = Object.keys(i.properties).filter(function (k) { return k.charAt(0) !== "_"; }).map(function (k) { return "<small>" + esc(k) + ": " + esc(i.properties[k]) + "</small>"; }).join("");
      return '<li><img src="' + esc(i.image) + '" alt="" width="64" height="64"><span>' + esc(i.product_title) + (i.variant_title ? "<small>" + esc(i.variant_title) + "</small>" : "") + props + "<small>Qty " + i.quantity + "</small></span><b>" + money(i.final_line_price) + "</b></li>";
    }).join("");
    return '<div id="CartDrawer"><div class="drawer__inner' + (rows ? "" : " is-empty") + '"><div class="drawer__head">Your cart<button class="drawer__close" type="button" aria-label="Close">×</button></div><div class="drawer__body">' +
      (rows ? '<ul class="cart-items">' + rows + "</ul>" : '<p class="cart-empty">Your cart is empty.</p>') +
      '</div><div class="drawer__footer"><div class="drawer__total"><span>Subtotal</span><span>' + money(c.total_price) + '</span></div><p class="drawer__note">Offer and bundle discounts are applied by Shopify at checkout.</p><a class="button" href="' + ROOT + 'checkout" name="checkout">Check out</a></div></div></div>';
  }
  if (!customElements.get("cart-drawer")) customElements.define("cart-drawer", class extends HTMLElement {
    connectedCallback() { this.innerHTML = drawerHtml(); this.addEventListener("click", function (e) { if (e.target.closest(".drawer__close")) this.close(); }.bind(this)); }
    getSectionsToRender() { return [{ id: "cart-drawer", selector: "#CartDrawer" }, { id: "cart-icon-bubble" }]; }
    setActiveElement() {}
    renderContents() { this.innerHTML = drawerHtml(); this.open(); }
    open() { this.innerHTML = drawerHtml(); this.classList.add("active"); }
    close() { this.classList.remove("active"); }
  });
  document.addEventListener("demo:cart", function () { var d = document.querySelector("cart-drawer"); if (d && d.classList.contains("active")) d.innerHTML = drawerHtml(); });

  // ---- links and forms stay in the demo --------------------------------------------------------
  var toastEl;
  window.demoToast = function (text) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "demo-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = text;
    toastEl.classList.add("on");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("on"); }, 2200);
  };
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented) return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || a.target === "_blank" || /^(mailto|tel):/.test(href)) return;
    if (a.id === "cart-icon-bubble" || /\\/cart$/.test(href)) {
      var d = document.querySelector("cart-drawer");
      if (d) { e.preventDefault(); d.open(); }
      return;
    }
    if (/\\/checkout$/.test(href)) return;
    e.preventDefault();
    window.demoToast("This is a demo store: links to other pages are off.");
  });
  document.addEventListener("submit", function (e) {
    if (e.defaultPrevented) return;
    var f = e.target;
    if (f.id === "product-form-main") return;
    e.preventDefault();
    window.demoToast("Sent. In this demo nothing leaves your browser.");
  });
  document.addEventListener("DOMContentLoaded", bubble);

  // ---- height for the iframe on the website ---------------------------------------------------
  var FRAME = ${JSON.stringify(frameId)};
  function report() { try { window.parent.postMessage({ type: "demo-height", id: FRAME, h: Math.ceil(document.documentElement.scrollHeight) }, "*"); } catch (e) {} }
  window.addEventListener("load", report);
  if (window.ResizeObserver) document.addEventListener("DOMContentLoaded", function () { new ResizeObserver(report).observe(document.body); });
})();
</script>`;
}

/** The theme's product form (Dawn-like): variant pills, quantity, Add to cart, a dynamic checkout button. */
export function productForm(p) {
  const multi = p.variants.length > 1;
  const first = p.variants.find((v) => v.available) ?? p.variants[0];
  const option = typeof p.options?.[0] === "string" ? { name: p.options[0] } : p.options?.[0];
  const pills = multi
    ? `<fieldset class="product-form__input"><legend>${option?.name ?? "Option"}</legend>${p.variants
        .map(
          (v, i) =>
            `<input type="radio" id="opt-${p.handle}-${i}" name="${option?.name ?? "Option"}-1" value="${v.title}" data-variant="${v.id}"${v.id === first.id ? " checked" : ""}${v.available ? "" : " disabled"}><label for="opt-${p.handle}-${i}">${v.title}</label>`,
        )
        .join("")}</fieldset>`
    : "";
  return `<form action="${STORE_ROOT}cart/add" method="post" id="product-form-main" class="product-form" novalidate>
  <input type="hidden" name="id" value="${first.id}">
  ${pills}
  <div class="qty"><button type="button" data-qty="-1" aria-label="Less">−</button><input type="number" name="quantity" value="1" min="1" aria-label="Quantity" id="Quantity-main"><button type="button" data-qty="1" aria-label="More">+</button></div>
  <button type="submit" name="add" class="product-form__submit button">${first.available ? "Add to cart" : "Sold out"}</button>
  <div class="shopify-payment-button" aria-hidden="true">Buy with Shop Pay</div>
</form>`;
}

/** Dawn's product form behaviour: variant pills publish variant changes; submit adds and opens the drawer. */
const PRODUCT_SCRIPT = `<script>
(function () {
  var form = document.getElementById("product-form-main");
  if (!form) return;
  var idInput = form.querySelector('[name="id"]');
  form.addEventListener("change", function (e) {
    if (!e.target.dataset.variant) return;
    idInput.value = e.target.dataset.variant;
    var p = Object.values(window.__demoCatalog).filter(function (x) { return x.variants.some(function (v) { return String(v.id) === idInput.value; }); })[0];
    var v = p && p.variants.filter(function (x) { return String(x.id) === idInput.value; })[0];
    var pr = document.querySelector(".product .price span");
    if (v && pr) pr.textContent = "$" + (v.price / 100).toFixed(2);
    window.publish(window.PUB_SUB_EVENTS.variantChange, { data: { variant: v, sectionId: "main" } });
  });
  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-qty]");
    if (!b) return;
    var q = form.querySelector('[name="quantity"]');
    q.value = Math.max(1, Number(q.value) + Number(b.dataset.qty));
    q.dispatchEvent(new Event("change", { bubbles: true }));
  });
  form.addEventListener("submit", function (e) {
    if (e.defaultPrevented) return;
    e.preventDefault();
    fetch(window.routes.cart_add_url + ".js", { method: "POST", body: new FormData(form) }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.status) { window.demoToast(data.description); return; }
      window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: "product-form", cartData: data });
      var d = document.querySelector("cart-drawer");
      if (d) d.renderContents(data);
    });
  });
})();
</script>`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** The product page around product page widgets: `above` goes over the theme's buy buttons, `body` under them. */
const src = (img) => (typeof img === "string" ? img : img?.src ?? "");

export function productPage(p, body, { description = "", above = "" } = {}) {
  const imgs = [p.featured_image, ...(p.images ?? []).slice(1, 4)].map(src);
  return `<div class="page-width"><div class="product">
  <div class="product__media"><img src="${src(p.featured_image)}" alt="${esc(p.title)}" width="800" height="800">${imgs.length > 1 ? `<div class="product__thumbs">${imgs.map((s) => `<img src="${s}" alt="" width="200" height="200" loading="lazy">`).join("")}</div>` : ""}</div>
  <product-info class="product__info" data-section="main" data-product-id="${p.id}">
    <div class="product__vendor">${STORE_NAME}</div>
    <h1 class="product__title">${esc(p.title)}</h1>
    <div class="price"><span class="price-item price-item--regular">$${(p.price / 100).toFixed(2)}</span>${p.compare_at_price ? `<s>$${(p.compare_at_price / 100).toFixed(2)}</s>` : ""}</div>
    ${above}
    ${productForm(p)}
    ${body}
    ${description ? `<div class="product__description">${description}</div>` : ""}
  </product-info>
</div></div>${PRODUCT_SCRIPT}`;
}

/** A Dawn-like product card (quick add, wishlist hearts and "+ Add to bundle" attach to these). */
export const productCard = (p) => `<li class="grid__item card-wrapper product-card-wrapper" data-product-handle="${p.handle}"><div class="card card--media"><div class="card__inner"><div class="card__media"><div class="media media--transparent"><img src="${src(p.featured_image)}" alt="${esc(p.title)}" width="400" height="440" loading="lazy"></div></div></div>
<div class="card__content"><h3 class="card__heading"><a href="${STORE_ROOT}products/${p.handle}" class="full-unstyled-link">${esc(p.title)}</a></h3><div class="price"><span>$${(p.price / 100).toFixed(2)}</span>${p.compare_at_price ? `<s>$${(p.compare_at_price / 100).toFixed(2)}</s>` : ""}</div></div></div></li>`;

export const collectionGrid = (title, products) =>
  `<div class="page-width"><h1 class="collection-title">${esc(title)}</h1><ul class="demo-grid product-grid" role="list">${products.map(productCard).join("")}</ul></div>`;

/** The theme's cart page (the cart lines are drawn from the demo cart). */
export const cartPage = (body = "") => `<div class="page-width cart-page"><h1>Your cart</h1><form action="${STORE_ROOT}cart" method="post" id="cart">
<ul class="cart-items" data-demo-cart-lines></ul><div class="cart-footer"><div class="drawer__total" style="min-width:240px"><span>Subtotal</span><span data-demo-cart-total></span></div>${body}<button type="submit" name="checkout" class="button" formaction="${STORE_ROOT}checkout">Check out</button></div></form></div>
<script>(function(){function draw(){var c=window.__demoCart();var l=document.querySelector("[data-demo-cart-lines]");l.innerHTML=c.items.length?c.items.map(function(i){var e=window.__demoEsc;return '<li><img src="'+e(i.image)+'" alt="" width="64" height="64"><span>'+e(i.product_title)+(i.variant_title?'<small>'+e(i.variant_title)+'</small>':'')+'<small>Qty '+i.quantity+'</small></span><b>$'+(i.final_line_price/100).toFixed(2)+'</b></li>'}).join(''):'<li class="cart-empty" style="display:block">Your cart is empty. Add something from another demo, or use the offer below.</li>';document.querySelector("[data-demo-cart-total]").textContent="$"+(c.total_price/100).toFixed(2)}draw();document.addEventListener("demo:cart",draw)})();</script>`;

/**
 * A whole demo page around `body`. `top` sits above the store header (announcement and countdown
 * bars); `embeds` are app embeds (end of body, like Shopify puts them); `css` lists the extension
 * stylesheets the blocks need.
 */
export function frame({ title, frameId, body, top = "", embeds = "", css = [], catalog, collections, orderJson, header = true, cartSeed = null, head = "" }) {
  const links = ["ucro.css", "ucs-sections.css", ...css].map((f) => `<link rel="stylesheet" href="/assets/${f}">`).join("");
  const seed = cartSeed
    ? `<script>try{if(!sessionStorage.getItem("lumen-demo-cart"))sessionStorage.setItem("lumen-demo-cart",${JSON.stringify(JSON.stringify(cartSeed))})}catch(e){}</script>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>${esc(title)} | ${STORE_NAME} demo store</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>${links}${seed}${backendScript({ catalog, collections, frameId, orderJson })}${head}
</head><body class="template-demo">
${top}${header ? storeHeader() : ""}
<main id="MainContent">${body}</main>
<cart-drawer></cart-drawer>
${embeds}
</body></html>`;
}
