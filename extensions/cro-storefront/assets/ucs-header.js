/* The app's header. Reads the design + menu passed by the "Header" app embed, draws the header in
   place of the theme's header bar (which is hidden; its cart drawer keeps working), and wires
   dropdowns, mega menus, the mobile menu, search, cart count, country/language and stickiness. */
(function () {
  var host = document.getElementById("ucs-hd");
  if (!host || window.__ucsHeader) return;
  window.__ucsHeader = true;
  var data;
  try {
    data = JSON.parse(host.querySelector("script").textContent);
  } catch (e) {
    return;
  }
  var c = data.c || {};
  var menu = data.m || [];
  var ROOT = host.getAttribute("data-root") || "/";
  var SEARCH = host.getAttribute("data-search") || "/search";
  var CART = host.getAttribute("data-cart-url") || "/cart";
  var ACC = host.getAttribute("data-acc");
  var HOME = host.getAttribute("data-home") === "1";
  var SHOP = host.getAttribute("data-shop") || "";
  var uid = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  var I = {
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    caret: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/></svg>',
  };

  /* ---------------------------------------------------------------- markup -- */
  function logo() {
    var inner = c.logo
      ? '<img src="' + esc(c.logo.u + (c.logo.u.indexOf("?") > -1 ? "&" : "?") + "width=" + c.logo.w * 2) + '" alt="' + esc(SHOP) + '" width="' + c.logo.w + '">'
      : '<span class="uh__name">' + esc(c.text || SHOP) + "</span>";
    return '<a class="uh__logo" href="' + esc(ROOT) + '">' + inner + "</a>";
  }

  function panel(item, id) {
    var kids = item.k || [];
    if (c.mega) {
      var cards = "", cols = "", loose = "";
      kids.forEach(function (k) {
        if (k.k && k.k.length) {
          cols +=
            '<div class="uh__col"><a class="uh__colh" href="' + esc(k.u) + '">' + esc(k.t) + "</a><ul>" +
            k.k.map(function (d) { return '<li><a href="' + esc(d.u) + '">' + esc(d.t) + "</a></li>"; }).join("") +
            "</ul></div>";
        } else if (c.imgs && k.i) {
          cards += '<a class="uh__card" href="' + esc(k.u) + '"><img src="' + esc(k.i) + '" alt="" loading="lazy" width="120" height="120"><span>' + esc(k.t) + "</span></a>";
        } else {
          loose += '<li><a href="' + esc(k.u) + '">' + esc(k.t) + "</a></li>";
        }
      });
      if (loose) cols = '<div class="uh__col"><ul>' + loose + "</ul></div>" + cols;
      return '<div class="uh__panel uh__panel--mega" id="' + id + '"><div class="uh__mega">' + (cards ? '<div class="uh__cards">' + cards + "</div>" : "") + (cols ? '<div class="uh__cols">' + cols + "</div>" : "") + "</div></div>";
    }
    return (
      '<div class="uh__panel" id="' + id + '"><ul class="uh__drop">' +
      kids
        .map(function (k) {
          return (
            '<li><a href="' + esc(k.u) + '">' + esc(k.t) + "</a>" +
            (k.k && k.k.length ? '<ul class="uh__sub">' + k.k.map(function (d) { return '<li><a href="' + esc(d.u) + '">' + esc(d.t) + "</a></li>"; }).join("") + "</ul>" : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul></div>"
    );
  }

  function nav() {
    return (
      '<nav class="uh__nav" aria-label="Main"><ul class="uh__menu">' +
      menu
        .map(function (a) {
          var has = a.k && a.k.length;
          var id = "uh-p" + ++uid;
          return (
            '<li class="uh__li' + (has ? " uh__li--kids" : "") + (c.mega ? " uh__li--mega" : "") + '">' +
            '<a class="uh__a' + (a.on ? " is-on" : "") + '" href="' + esc(a.u) + '"' + (a.on ? ' aria-current="page"' : "") + ">" + esc(a.t) + "</a>" +
            (has ? '<button type="button" class="uh__caret" aria-expanded="false" aria-controls="' + id + '" aria-label="' + esc(a.t) + '">' + I.caret + "</button>" + panel(a, id) : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul></nav>"
    );
  }

  function icons() {
    var count = +host.getAttribute("data-count") || 0;
    var h = '<div class="uh__icons">';
    if (data.loc) h += '<button type="button" class="uh__icon uh__locbtn" aria-expanded="false" aria-controls="uh-loc">' + I.globe + '<span class="uh__lbl">' + esc(data.loc.cc || data.loc.lc) + "</span></button>";
    if (c.icons.s) h += '<button type="button" class="uh__icon uh__searchbtn" aria-label="Search" aria-expanded="false" aria-controls="uh-search">' + I.search + '<span class="uh__lbl">Search</span></button>';
    if (c.icons.a && ACC) h += '<a class="uh__icon uh__acc" href="' + esc(ACC) + '" aria-label="Account">' + I.user + '<span class="uh__lbl">Account</span></a>';
    if (c.icons.c) {
      h +=
        '<a class="uh__icon uh__cart uh__cart--' + c.icons.cs + '" href="' + esc(CART) + '" aria-label="Cart, ' + count + ' items">' +
        (c.icons.cs === "text" ? "" : I.bag) +
        '<span class="uh__lbl">Cart</span>' +
        (c.icons.cs === "icon" ? "" : '<span class="uh__count" data-uh-count' + (count ? "" : " hidden") + ">" + count + "</span>") +
        "</a>";
    }
    if (c.btn) h += '<a class="uh__btn" href="' + esc(c.btn.l) + '">' + esc(c.btn.t) + "</a>";
    return h + "</div>";
  }

  function drawer() {
    var items = menu
      .map(function (a) {
        if (!a.k || !a.k.length) return '<li><a class="uh__dl" href="' + esc(a.u) + '">' + esc(a.t) + "</a></li>";
        return (
          '<li><details><summary class="uh__dl">' + esc(a.t) + I.caret + "</summary><ul>" +
          '<li><a href="' + esc(a.u) + '">' + esc(a.t) + "</a></li>" +
          a.k
            .map(function (k) {
              return '<li><a href="' + esc(k.u) + '">' + (k.i && c.imgs ? '<img src="' + esc(k.i) + '" alt="" width="44" height="44" loading="lazy">' : "") + esc(k.t) + "</a></li>";
            })
            .join("") +
          "</ul></details></li>"
        );
      })
      .join("");
    return (
      '<div class="uh__drawer" id="uh-drawer" role="dialog" aria-modal="true" aria-label="Menu" hidden><div class="uh__dpanel">' +
      '<button type="button" class="uh__icon uh__dclose" aria-label="Close menu">' + I.close + "</button>" +
      '<ul class="uh__dlist">' + items + "</ul>" +
      (ACC && c.icons.a ? '<a class="uh__dacc" href="' + esc(ACC) + '">' + I.user + "Account</a>" : "") +
      "</div></div>"
    );
  }

  function pills() {
    return (
      '<div class="uh__pills" role="list">' +
      menu
        .map(function (a, i) {
          return a.k && a.k.length
            ? '<button type="button" role="listitem" class="uh__pill' + (a.on ? " is-on" : "") + '" data-pill="' + i + '" aria-expanded="false">' + esc(a.t) + "</button>"
            : '<a role="listitem" class="uh__pill' + (a.on ? " is-on" : "") + '" href="' + esc(a.u) + '">' + esc(a.t) + "</a>";
        })
        .join("") +
      '</div><div class="uh__pillpanel" hidden></div>'
    );
  }

  function searchBox() {
    return (
      '<div class="uh__search" id="uh-search" hidden><form action="' + esc(SEARCH) + '" method="get" role="search" class="uh__sform">' +
      I.search +
      '<input type="search" name="q" placeholder="Search" aria-label="Search" autocomplete="off">' +
      '<input type="hidden" name="options[prefix]" value="last">' +
      '<button type="button" class="uh__icon uh__sclose" aria-label="Close search">' + I.close + "</button>" +
      '</form><div class="uh__results" aria-live="polite"></div></div>'
    );
  }

  function locBox() {
    if (!data.loc) return "";
    var l = data.loc;
    var sel = function (name, list, cur, label, fmt) {
      if (!list || list.length < 2) return "";
      return (
        '<label class="uh__locf"><span>' + label + '</span><select name="' + name + '">' +
        list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === cur ? " selected" : "") + ">" + esc(fmt(x)) + "</option>"; }).join("") +
        "</select></label>"
      );
    };
    return (
      '<div class="uh__loc" id="uh-loc" hidden>' +
      sel("country_code", l.co, l.cc, "Country / region", function (x) { return x[1] + " (" + x[2] + ")"; }) +
      sel("language_code", l.la, l.lc, "Language", function (x) { return x[1]; }) +
      "</div>"
    );
  }

  /* ----------------------------------------------------------------- build -- */
  var el = document.createElement("header");
  el.className = c.cls + " ucs-uh";
  // Theme editor: the inspector selects the header through this marker.
  if (host.hasAttribute("data-shopify-editor-block")) el.setAttribute("data-shopify-editor-block", host.getAttribute("data-shopify-editor-block"));
  el.style.cssText = c.css;
  el.innerHTML =
    '<div class="uh__bar">' +
    '<button type="button" class="uh__icon uh__burger" aria-label="Menu" aria-expanded="false" aria-controls="uh-drawer">' + I.menu + "</button>" +
    logo() + nav() + icons() +
    "</div>" +
    pills() + searchBox() + locBox() + drawer();

  // Hide the theme's header bar (not its section: the cart drawer often lives there).
  var HIDE = "sticky-header, .header-wrapper, header-component, .site-header, header.header, #shopify-section-header > header, .section-header > header" + (c.hide ? ", " + c.hide : "");
  var style = document.createElement("style");
  style.textContent = ":where(" + HIDE + "):not(.ucs-uh) { display: none !important; }";
  document.head.appendChild(style);
  // As a block in the Header area it renders where it's placed (so the theme editor's inspector can
  // select it); its section becomes the sticky layer. Otherwise it goes where the theme header was.
  var section = host.closest(".shopify-section");
  if (section) {
    section.classList.add("ucs-in-group");
    host.after(el);
  } else {
    var themeHeader = document.querySelector(HIDE.split(", ").map(function (s) { return s + ":not(.ucs-uh)"; }).join(", "));
    var anchor = themeHeader && (themeHeader.closest(".shopify-section") || themeHeader);
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor);
    else document.body.insertBefore(el, document.body.firstChild);
  }
  var box = section || el;

  var over = c.overlay === "all" || (c.overlay === "home" && HOME);
  // Over the page, the header must be the last thing in the Header area: other bars there
  // (countdown, announcements) stay above it instead of sliding under it.
  if (over && section) {
    var tail = section, next = section.nextElementSibling;
    while (next && /shopify-section-group-header/.test(next.className)) {
      tail = next;
      next = next.nextElementSibling;
    }
    if (tail !== section) tail.after(section);
  }
  if (over) {
    el.classList.add("uh--over");
    // Sit over the first section without pushing it down, and stay sticky.
    var fit = function () {
      box.style.marginBottom = -el.querySelector(".uh__bar").offsetHeight - 2 * (parseFloat(getComputedStyle(el).paddingTop) || 0) + "px";
    };
    fit();
    window.addEventListener("resize", fit);
  }
  if (c.sticky !== "none") box.classList.add("uh-stick");
  // Above the page whatever the theme's own section rules say (inline wins over theme CSS).
  if (section) {
    if (c.sticky === "none") section.style.position = "relative";
    section.style.zIndex = "40";
  }

  /* ------------------------------------------------------------- behaviour -- */
  var openPanel = null;
  function setOpen(btn, on) {
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    btn.closest(".uh__li").classList.toggle("is-open", on);
    if (on) openPanel = btn;
    else if (openPanel === btn) openPanel = null;
  }
  el.querySelectorAll(".uh__caret").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-expanded") !== "true";
      if (openPanel && openPanel !== btn) setOpen(openPanel, false);
      setOpen(btn, on);
    });
    var li = btn.closest(".uh__li");
    li.addEventListener("mouseenter", function () {
      if (window.matchMedia("(hover: hover)").matches) {
        if (openPanel && openPanel !== btn) setOpen(openPanel, false);
        setOpen(btn, true);
      }
    });
    li.addEventListener("mouseleave", function () {
      if (window.matchMedia("(hover: hover)").matches) setOpen(btn, false);
    });
    li.addEventListener("focusout", function (e) {
      if (!li.contains(e.relatedTarget)) setOpen(btn, false);
    });
  });

  // Mobile drawer
  var dr = el.querySelector(".uh__drawer");
  var burger = el.querySelector(".uh__burger");
  function drawerOpen(on) {
    dr.hidden = !on;
    burger.setAttribute("aria-expanded", on ? "true" : "false");
    document.documentElement.classList.toggle("uh-lock", on);
    if (on) dr.querySelector(".uh__dclose").focus();
    else burger.focus();
  }
  burger.addEventListener("click", function () {
    drawerOpen(dr.hidden);
  });
  dr.querySelector(".uh__dclose").addEventListener("click", function () {
    drawerOpen(false);
  });
  dr.addEventListener("click", function (e) {
    if (e.target === dr) drawerOpen(false);
  });

  // Mobile pills: a tap opens that item's links underneath
  var pp = el.querySelector(".uh__pillpanel");
  el.querySelectorAll("[data-pill]").forEach(function (b) {
    b.addEventListener("click", function () {
      var a = menu[+b.getAttribute("data-pill")];
      var on = b.getAttribute("aria-expanded") !== "true";
      el.querySelectorAll("[data-pill]").forEach(function (x) { x.setAttribute("aria-expanded", "false"); });
      b.setAttribute("aria-expanded", on ? "true" : "false");
      pp.hidden = !on;
      if (on) {
        pp.innerHTML =
          '<a class="uh__ppall" href="' + esc(a.u) + '">' + esc(a.t) + " →</a>" +
          a.k.map(function (k) { return '<a class="uh__ppi" href="' + esc(k.u) + '">' + (k.i && c.imgs ? '<img src="' + esc(k.i) + '" alt="" width="44" height="44" loading="lazy">' : "") + "<span>" + esc(k.t) + "</span></a>"; }).join("");
      }
    });
  });

  // Search with live results
  var sb = el.querySelector(".uh__search");
  var sbtn = el.querySelector(".uh__searchbtn");
  function searchOpen(on) {
    if (!sb) return;
    sb.hidden = !on;
    if (sbtn) sbtn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) sb.querySelector("input").focus();
    else if (sbtn) sbtn.focus();
  }
  if (sbtn) sbtn.addEventListener("click", function () { searchOpen(sb.hidden); });
  sb.querySelector(".uh__sclose").addEventListener("click", function () { searchOpen(false); });
  var timer, results = sb.querySelector(".uh__results");
  sb.querySelector('input[name="q"]').addEventListener("input", function (e) {
    var q = e.target.value.trim();
    clearTimeout(timer);
    if (q.length < 2) {
      results.innerHTML = "";
      return;
    }
    timer = setTimeout(function () {
      fetch(ROOT.replace(/\/$/, "") + "/search/suggest.json?q=" + encodeURIComponent(q) + "&resources[type]=product,collection,page&resources[limit]=6")
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var r = (j && j.resources && j.resources.results) || {};
          var rows = (r.products || []).map(function (p) {
            return '<a class="uh__res" href="' + esc(p.url) + '">' + (p.image ? '<img src="' + esc(p.image) + '" alt="" width="48" height="48">' : "") + "<span>" + esc(p.title) + "<small>" + esc(p.price) + "</small></span></a>";
          });
          (r.collections || []).concat(r.pages || []).forEach(function (x) {
            rows.push('<a class="uh__res uh__res--link" href="' + esc(x.url) + '"><span>' + esc(x.title) + "</span></a>");
          });
          results.innerHTML = rows.length ? rows.join("") + '<a class="uh__resall" href="' + esc(SEARCH) + "?q=" + encodeURIComponent(q) + '">See all results for “' + esc(q) + "”</a>" : '<p class="uh__none">No results for “' + esc(q) + "”</p>";
        })
        .catch(function () {});
    }, 220);
  });

  // Country / language
  var lb = el.querySelector(".uh__locbtn"), lp = el.querySelector(".uh__loc");
  if (lb && lp) {
    lb.addEventListener("click", function () {
      lp.hidden = !lp.hidden;
      lb.setAttribute("aria-expanded", lp.hidden ? "false" : "true");
    });
    lp.querySelectorAll("select").forEach(function (s) {
      s.addEventListener("change", function () {
        var f = document.getElementById("ucs-hd-loc");
        if (!f) return;
        var i = f.querySelector('[name="' + s.name + '"]') || f.appendChild(Object.assign(document.createElement("input"), { type: "hidden", name: s.name }));
        i.value = s.value;
        f.submit();
      });
    });
  }

  // Escape closes whatever is open; a click outside closes dropdowns
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (openPanel) {
      var b = openPanel;
      setOpen(b, false);
      b.focus();
    }
    if (sb && !sb.hidden) searchOpen(false);
    if (!dr.hidden) drawerOpen(false);
    if (lp && !lp.hidden) lp.hidden = true;
  });
  document.addEventListener("click", function (e) {
    if (openPanel && !openPanel.closest(".uh__li").contains(e.target)) setOpen(openPanel, false);
  });

  // Cart: open the theme's cart drawer when it has one; keep the count up to date
  var cartLink = el.querySelector(".uh__cart");
  if (cartLink) {
    cartLink.addEventListener("click", function (e) {
      var themeIcon = document.querySelector("#cart-icon-bubble, [data-cart-drawer-toggle], .js-drawer-open-cart");
      if (themeIcon && document.querySelector("cart-drawer, #CartDrawer, [data-cart-drawer]")) {
        e.preventDefault();
        themeIcon.click();
      }
    });
  }
  function refreshCount() {
    fetch(ROOT.replace(/\/$/, "") + "/cart.js")
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var n = cart.item_count;
        el.querySelectorAll("[data-uh-count]").forEach(function (b) {
          b.textContent = n;
          b.hidden = !n;
        });
        if (cartLink) cartLink.setAttribute("aria-label", "Cart, " + n + " items");
      })
      .catch(function () {});
  }
  var nativeFetch = window.fetch;
  window.fetch = function (input) {
    var p = nativeFetch.apply(this, arguments);
    var url = typeof input === "string" ? input : input && input.url;
    if (url && /\/cart\/(add|change|update|clear)/.test(url)) p.then(function () { setTimeout(refreshCount, 60); });
    return p;
  };

  // Sticky: always, or only when scrolling up
  var last = window.scrollY;
  window.addEventListener(
    "scroll",
    function () {
      var y = window.scrollY;
      el.classList.toggle("uh--scrolled", y > 8);
      if (c.sticky === "up") box.classList.toggle("uh-away", y > last && y > el.offsetHeight * 2);
      last = y;
    },
    { passive: true },
  );
})();
