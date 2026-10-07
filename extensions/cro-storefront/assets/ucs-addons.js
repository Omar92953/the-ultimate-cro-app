/* Add-ons under the Add to cart button. Ticked add-ons are added in the same cart request as the
   product: the theme's own /cart/add call is widened to an `items` list, and its reply is put
   back in the single-item shape the theme expects (so drawers and pop-ups keep working).
   The gift message is a line item property on the product, sent with the theme's own form. */
(function () {
  var ROOT_ATTR = "data-ucs-ao";
  var active = []; // one entry per widget on the page

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(cents) {
    var f = window.Shopify && Shopify.currency && Shopify.currency.active;
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: "currency", currency: f || "USD" }).format(cents / 100);
    } catch (e) {
      return (cents / 100).toFixed(2);
    }
  }
  function root() {
    return (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";
  }

  function findForm(el) {
    var scope = el.closest(".shopify-section") || document;
    var forms = scope.querySelectorAll('form[action*="/cart/add"]');
    for (var i = 0; i < forms.length; i++) {
      // getAttribute: the form holds an input named "id", which hides form.id
      if (forms[i].querySelector('[name="id"]') && !/installment/i.test(forms[i].getAttribute("id") || "")) return forms[i];
    }
    return null;
  }

  function shows(c, el) {
    if (!c.w || c.w.m === "all") return true;
    if (c.w.m === "products") return c.w.p.indexOf(el.getAttribute("data-handle")) > -1;
    var cols = (el.getAttribute("data-cols") || "").split(",");
    return c.w.c.some(function (h) { return cols.indexOf(h) > -1; });
  }

  function build(el) {
    var c;
    try {
      c = JSON.parse(el.querySelector("script").textContent);
    } catch (e) {
      return;
    }
    if (!shows(c, el)) return;
    var form = findForm(el);
    if (!form) return;
    var formId = form.getAttribute("id");
    if (!formId) form.setAttribute("id", (formId = "ucs-ao-form-" + Math.random().toString(36).slice(2, 8)));
    var here = el.getAttribute("data-handle");
    var items = (c.a || []).filter(function (a) { return a.h !== here; });
    if (!items.length && !c.m) return;

    el.className = "ucs ucs-ao ucs-ao--" + (c.st || "list");
    el.style.cssText = c.css || "";
    var html = c.h ? '<p class="ucs-ao__h">' + esc(c.h) + "</p>" : "";
    html += '<div class="ucs-ao__list">';
    items.forEach(function (a, i) {
      html +=
        '<label class="ucs-ao__item" data-i="' + i + '">' +
        '<input type="checkbox" class="ucs-ao__check"' + (a.c ? " checked" : "") + ">" +
        (a.i ? '<img class="ucs-ao__img" src="' + esc(a.i) + (a.i.indexOf("?") > -1 ? "&" : "?") + 'width=120" alt="" width="48" height="48" loading="lazy">' : "") +
        '<span class="ucs-ao__body"><span class="ucs-ao__t">' + esc(a.t) + "</span>" +
        (a.x ? '<span class="ucs-ao__x">' + esc(a.x) + "</span>" : "") +
        "</span>" +
        '<span class="ucs-ao__p" data-price></span>' +
        "</label>";
    });
    html += "</div>";
    if (c.m) {
      var id = formId + "-msg";
      html +=
        '<div class="ucs-ao__msg">' +
        '<label class="ucs-ao__item ucs-ao__msgtoggle"><input type="checkbox" class="ucs-ao__check" data-msg><span class="ucs-ao__body"><span class="ucs-ao__t">' + esc(c.m.l) + "</span></span></label>" +
        '<textarea id="' + id + '" class="ucs-ao__text" form="' + esc(formId) + '" maxlength="' + (c.m.n || 200) + '" rows="3" placeholder="' + esc(c.m.p) + '" aria-label="' + esc(c.m.l) + '" hidden disabled></textarea>' +
        "</div>";
    }
    el.innerHTML = html;
    el.hidden = false;

    // Prices and stock from the store itself (right currency, right market).
    items.forEach(function (a, i) {
      fetch(root() + "products/" + encodeURIComponent(a.h) + ".js")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (p) {
          var row = el.querySelector('[data-i="' + i + '"]');
          if (!row) return;
          var v = p && p.variants.filter(function (x) { return String(x.id) === String(a.v); })[0];
          if (!v || !v.available) {
            row.remove(); // sold out or gone: never offer it
            return;
          }
          row.querySelector("[data-price]").textContent = v.price ? "+" + money(v.price) : "";
        })
        .catch(function () {});
    });

    var msgBox = el.querySelector("[data-msg]");
    if (msgBox) {
      var ta = el.querySelector(".ucs-ao__text");
      msgBox.addEventListener("change", function () {
        ta.hidden = ta.disabled = !msgBox.checked;
        // A named field on the theme's form: sent as a line item property only when ticked.
        if (msgBox.checked) {
          ta.name = "properties[" + c.m.k + "]";
          ta.focus();
        } else ta.removeAttribute("name");
      });
    }

    active.push({
      form: form,
      title: el.getAttribute("data-title") || "",
      picked: function () {
        var out = [];
        el.querySelectorAll(".ucs-ao__item[data-i]").forEach(function (row) {
          if (row.querySelector("input").checked) out.push(items[+row.getAttribute("data-i")]);
        });
        return out;
      },
    });
  }

  /* ---- adding: widen the theme's own /cart/add request --------------------------------- */
  function widgetFor(variantId) {
    for (var i = 0; i < active.length; i++) {
      var f = active[i].form.querySelector('[name="id"]');
      if (f && String(f.value) === String(variantId)) return active[i];
    }
    return null;
  }
  function addonLines(w) {
    return w.picked().map(function (a) {
      return { id: Number(a.v), quantity: 1, properties: { _cro_addon: w.title } };
    });
  }

  var nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : input && input.url;
      if (url && /\/cart\/add(\.js)?(\?|$)/.test(url) && init && init.body) {
        var body = init.body, main = null, rest = {};
        if (typeof FormData !== "undefined" && body instanceof FormData) {
          if (!body.get("id") || body.get("items[0][id]")) return nativeFetch.apply(this, arguments);
          main = { id: Number(body.get("id")), quantity: Number(body.get("quantity") || 1), properties: {} };
          body.forEach(function (v, k) {
            var m = /^properties\[(.+)\]$/.exec(k);
            if (m) main.properties[m[1]] = v;
            else if (k === "selling_plan" && v) main.selling_plan = Number(v);
            else if (k !== "id" && k !== "quantity" && k !== "form_type" && k !== "utf8" && k !== "product-id" && k !== "section-id" && typeof v === "string") rest[k] = v;
          });
        } else if (typeof body === "string" && body.charAt(0) === "{") {
          var j = JSON.parse(body);
          if (!j.id || j.items) return nativeFetch.apply(this, arguments);
          main = { id: Number(j.id), quantity: Number(j.quantity || 1), properties: j.properties || {} };
          if (j.selling_plan) main.selling_plan = j.selling_plan;
          Object.keys(j).forEach(function (k) {
            if (["id", "quantity", "properties", "selling_plan"].indexOf(k) < 0) rest[k] = j[k];
          });
        }
        var w = main && widgetFor(main.id);
        var extra = w ? addonLines(w) : [];
        if (extra.length) {
          rest.items = [main].concat(extra);
          var headers = new Headers(init.headers || {});
          headers.set("Content-Type", "application/json");
          headers.set("Accept", "application/json");
          var next = Object.assign({}, init, { body: JSON.stringify(rest), headers: headers });
          return nativeFetch.call(this, input, next).then(function (res) {
            if (!res.ok) return res;
            return res.json().then(function (data) {
              // Back to the single-line reply the theme expects (it reads key, variant_id, sections…).
              var one = data && data.items ? Object.assign({}, data.items[0], { sections: data.sections }) : data;
              return new Response(JSON.stringify(one), { status: res.status, headers: { "Content-Type": "application/json" } });
            });
          });
        }
      }
    } catch (e) {
      /* fall through to the theme's request untouched */
    }
    return nativeFetch.apply(this, arguments);
  };

  function init() {
    document.querySelectorAll("[" + ROOT_ATTR + "]:not([data-ready])").forEach(function (el) {
      el.setAttribute("data-ready", "");
      build(el);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  document.addEventListener("shopify:section:load", init);
})();
