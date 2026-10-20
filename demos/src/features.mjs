/**
 * What every live demo shows: for each feature key of app/lib/catalog.ts, its designs, rendered
 * from the real theme blocks with the app's own design presets (the same "Templates" the app offers),
 * saved the way the app saves them (toStorefront…). Checkout-only features are drawn
 * as pictures (checkout.mjs) since checkout can't run outside Shopify.
 *
 * A design is { title, layout, product?, html, embeds?, css?, …frame options } (see build.mjs).
 */
import { resolveTsImports } from "../../test/storefront/engine.mjs";
import { BASE } from "./base.mjs";
import { imgUrl, products, collections, collectionHandles, reviews, faq, logos, announcements, recent } from "./data.mjs";

resolveTsImports();
const app = async (name) => import(`../../app/lib/${name}.ts`);

const [
  upsellD, crossD, bundleD, videoD, reviewsD, faqD, logosD, annD, shipD, countD, quickD, deliveryD, stockD, wishD, carouselD, pillsD,
  orderD, persD, extrasD, addonsD, quizD, deals, boostersD, sizeD, headerD,
] = await Promise.all([
  "upsell-design", "cross-sell-design", "bundle-design", "video-carousel-design", "reviews-design", "faq-design", "logos-design", "announcement-design",
  "shipping-bar", "designs", "quick-add-design", "delivery-design", "stock-design", "wishlist-design", "image-carousel", "collection-pills",
  "order-pages", "personalize-design", "cart-extras-design", "addons", "quiz-design", "deals", "boosters", "size-guide", "header",
].map(app));
const secD = await app("cro-sections");

const PAY_CSS = ["ucs-boosters.css"];

/** Designs from a preset list: one design per preset, in the app's order. */
const fromPresets = (presets, make) => presets.map((p) => ({ title: p.title, ...make(p.key, p) }));

export async function buildFeatures({ block, shopWith, mo }) {
  const P = products;
  const F = {};

  // ------------------------------------------------------------------------------ Offers --
  const upsellRule = mo("rule-upsell", {
    kind: "upsell", active: true, priority: 1, trigger_type: "all", upsell_type: "quantity", trigger_products: [], trigger_collections: [],
    tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 10, badge: "Most popular" }, { qty: 3, pct: 15 }], placements: ["product"], headline: "Buy more, save more",
  });
  const sizeRule = mo("rule-size", {
    kind: "upsell", active: true, priority: 1, trigger_type: "all", upsell_type: "variant", option_name: "Size", trigger_products: [], trigger_collections: [],
    tiers: [{ value: "S", pct: 0 }, { value: "M", pct: 0 }, { value: "L", pct: 10, badge: "Best value" }, { value: "XL", pct: 15 }], placements: ["product"], headline: "Choose your size",
  });
  const upsellOf = (key) => upsellD.toStorefrontUpsell(upsellD.applyUpsellPreset(upsellD.withUpsellDefaults({}), key));
  F.upsell = [
    ...await Promise.all(upsellD.UPSELL_PRESETS.map(async (p) => ({
      template: p.key, title: `Quantity breaks: ${p.title}`, layout: "product", product: "glow-serum", place: "above",
      html: await block("ucro-upsell", { product: P["glow-serum"], page_type: "product", shop: shopWith({ designs: { upsell: upsellOf(p.key) }, meta: { "$app:cro_rule": [upsellRule] } }) }),
    }))),
    {
      title: "Size upgrade", layout: "product", product: "studio-tee", place: "above",
      html: await block("ucro-upsell", { product: P["studio-tee"], page_type: "product", shop: shopWith({ designs: { upsell: upsellOf("green") }, meta: { "$app:cro_rule": [sizeRule] } }) }),
    },
  ];

  // A/B test (Pro): the same upsell, version A as saved and version B with other words and bigger discounts. In a store each
  // shopper keeps one version; here each demo page is pinned to one so both can be seen.
  const abTest = { "rule-upsell": { id: "demo", b: { headline: "Stock up and save more", subheadline: "Version B: bigger discounts", button_label: "", discount_percent: null, discount_label: "", design: 0, tiers: [{ qty: 1, pct: 0 }, { qty: 2, pct: 20, badge: "Best deal" }, { qty: 3, pct: 30 }] } } };
  F.ab_tests = await Promise.all(["A", "B"].map(async (g) => ({
    title: `Version ${g}`, layout: "product", product: "glow-serum", place: "above",
    html: `<script>try{localStorage.setItem("ucs-ab-demo","${g}")}catch(e){}</script>` + await block("ucro-upsell", { product: P["glow-serum"], page_type: "product", shop: shopWith({ designs: { upsell: upsellOf("green"), ab_tests: abTest }, meta: { "$app:cro_rule": [upsellRule] } }) }),
  })));

  const crossRule = mo("rule-cross", {
    kind: "cross_sell", active: true, priority: 1, trigger_type: "all", trigger_products: [], trigger_collections: [],
    offered_products: [P["daily-cream"], P["oat-soap"], P["sea-shampoo"]], placements: ["product", "drawer"], headline: "Pairs well with",
    subheadline: "Tick what you like", button_label: "Add selected to cart", discount_percent: 10,
  });
  const crossOf = (key) => crossD.toStorefrontCrossSell(crossD.applyCrossSellPreset(crossD.withCrossSellDefaults({}), key));
  F.cross_sell = await Promise.all(crossD.CROSS_SELL_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "product", product: "glow-serum",
    html: await block("ucro-cross-sell", { product: P["glow-serum"], page_type: "product", shop: shopWith({ designs: { cross_sell: crossOf(p.key) }, meta: { "$app:cro_rule": [crossRule] } }) }),
  })));

  // Discounts: buy X get Y, volume, gift (the deals script on the Conversion boosters embed).
  const offerText = { ...deals.DEAL_TEXT, more: "Add {n} more to get {pct}% off", more_btn: "Add {n} more" };
  const dealShop = (list, fbt = deals.DEFAULT_FBT) =>
    shopWith({ meta: { "$app:cro_offers": [mo("main", { data: { t: offerText, fbt: deals.fbtForStorefront(fbt), deals: list } })], "$app:cro_boosters": [mo("main", { config: boostersOnly({}) })] } });
  const candleCols = { ...P["cedar-candle"], collections: [{ id: collections.candles.id }] };
  const dealPage = async (title, list, product = "cedar-candle") => ({
    title, layout: "product", product, css: PAY_CSS,
    embeds: await block("ucs-boosters", { page_type: "product", product: product === "cedar-candle" ? candleCols : P[product], shop: dealShop(list) }),
  });
  F.discounts = [
    await dealPage("Buy 2, get 1 free", [{ id: "d-bogo", t: "bogo", name: "Buy 2, get 1 free", buy: { type: "collections", p: [], c: [collections.candles.id] }, x: 2, get: { type: "collections", p: [], c: [collections.candles.id] }, y: 1, pct: 100 }]),
    await dealPage("Volume discount", [{ id: "d-vol", t: "volume", name: "Buy more, save more", target: { type: "collections", p: [], c: [collections.candles.id] }, tiers: [{ qty: 2, pct: 10 }, { qty: 3, pct: 15 }, { qty: 4, pct: 20 }] }]),
    await dealPage("Free gift over an amount", [{ id: "d-gift", t: "gift", name: "Free tote", gift: { v: P["canvas-tote"].variants[0].id, h: "canvas-tote", title: "Canvas Tote", img: P["canvas-tote"].featured_image.src }, min: 60, only: null }]),
  ];

  // Bundles: the six recipes (see recipes below); the Bundles page shows one design per recipe.
  // Add-ons and personalization.
  const addonItem = (h, label, text) => ({ productId: String(P[h].id), handle: h, title: P[h].title, image: P[h].featured_image.src, variantId: String(P[h].variants[0].id), variants: P[h].variants.map((v) => ({ id: String(v.id), title: v.title, price: (v.price / 100).toFixed(2) })), label, text });
  const addonsCfg = (raw) => addonsD.toStorefrontAddons(addonsD.withAddonsDefaults({ items: [addonItem("gift-wrap", "Gift wrapping", "Wrapped in recycled paper with a ribbon"), addonItem("oat-soap", "Add an Oat Soap", "Our best seller, travel size")], ...raw }));
  const addonsPage = async (title, raw) => ({
    title, layout: "product", product: "cedar-candle", place: "above",
    html: await block("ucs-addons", { product: P["cedar-candle"], page_type: "product", shop: shopWith({ designs: { addons: addonsCfg(raw) } }) }),
  });
  F.addons = [
    await addonsPage("List", { style: "list" }),
    await addonsPage("Cards with a gift message", { style: "cards", message: { on: true } }),
    await addonsPage("Warm cards", { style: "cards", look: { accent: "#c2410c", bg: "#fff6ea", border: "#eadfce", radius: 14 }, heading: "Make it a gift" }),
  ];

  const persOf = (key) => persD.toStorefrontPersonalize(persD.applyPersonalizePreset(persD.withPersonalizeDefaults({ fields: [{ label: "Name to engrave", type: "text", max: 14, required: true, preview: true }] }), key));
  F.personalize = await Promise.all(persD.PERSONALIZE_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "product", product: "engraved-mug", place: "above",
    html: await block("ucs-personalize", { product: P["engraved-mug"], page_type: "product", shop: shopWith({ designs: { personalize: persOf(p.key) } }) }),
  })));

  // ------------------------------------------------------------------------------ Cart --
  const seed = { items: [{ key: "s1", id: P["glow-serum"].variants[0].id, quantity: 1, properties: {} }], attributes: {}, note: "", discount: "" };
  F.cart_offers = [
    {
      title: "In your theme's cart drawer", layout: "product", product: "glow-serum", minHeight: 720, cartSeed: seed, autoClick: "#cart-icon-bubble",
      embeds: await block("ucro-cart-offers", { page_type: "product", shop: shopWith({ designs: { cross_sell: crossOf("theme") }, meta: { "$app:cro_rule": [crossRule] } }) }),
    },
    {
      title: "On the cart page", layout: "cart", cartSeed: seed,
      html: await block("ucro-cross-sell", { page_type: "cart", cart: { items: [{ product_id: P["glow-serum"].id, product: P["glow-serum"] }] }, shop: shopWith({ designs: { cross_sell: crossOf("green") }, meta: { "$app:cro_rule": [mo("rule-cross-cart", { ...Object.fromEntries(Object.entries(crossRule).filter(([k]) => k !== "system").map(([k, v]) => [k, v.value])), placements: ["cart", "drawer"] })] } }) }),
    },
  ];

  const extrasOf = (key) => extrasD.toStorefrontCartExtras(extrasD.applyCartExtrasPreset(extrasD.withCartExtrasDefaults({ date: { on: true } }), key));
  F.cart_extras = await Promise.all(extrasD.CART_EXTRAS_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "cart", cartSeed: seed,
    html: await block("ucs-cart-extras", { page_type: "cart", shop: shopWith({ designs: { cart_extras: extrasOf(p.key) } }) }),
  })));

  // ------------------------------------------------------------------------- Storefront --
  const reviewsOf = (key, place = "home") => reviewsD.toStorefrontReviews(reviewsD.applyReviewPreset(reviewsD.withReviewsDefaults({}, place), key));
  F.reviews = await Promise.all(reviewsD.REVIEW_PRESETS.filter((p) => p.key !== "widget").map(async (p) => ({
    template: p.key, title: p.title, layout: "page",
    html: await block("ucs-reviews", { shop: shopWith({ designs: { reviews: reviewsOf(p.key) } }) }),
  })));
  F.product_reviews = await Promise.all([...reviewsD.PRODUCT_REVIEW_PRESETS, reviewsD.REVIEW_PRESETS.find((p) => p.key === "widget")].map(async (p) => ({
    template: p.key, title: p.title, layout: "product", product: "glow-serum", place: p.key === "widget" ? undefined : "above",
    html: await block("ucs-product-reviews", { page_type: "product", product: reviewProductOf("glow-serum"), shop: shopWith({ designs: { reviews_product: reviewsOf(p.key, "product") } }) }),
  })));

  const boosterPage = async (title, cfg, { product = "glow-serum", layout = "product", ...rest } = {}) => ({
    title, layout, product, css: PAY_CSS, ...rest,
    embeds: await block("ucs-boosters", { page_type: layout === "collection" ? "collection" : "product", product: P[product], shop: shopWith({ meta: { "$app:cro_boosters": [mo("main", { config: boostersOnly(cfg) })], "$app:cro_recent": [mo("main", { purchases: recent(Date.UTC(2026, 9, 15, 12)) })] } }) }),
  });
  // The demo purchases happened "a few minutes ago" whenever the page is opened.
  const freshPurchases = `<script>(function(){var el=document.getElementById("ucs-boost");if(!el)return;var d=JSON.parse(el.textContent);(d.recent||[]).forEach(function(r,i){r.at=new Date(Date.now()-[4,11,26][i%3]*60000).toISOString()});el.textContent=JSON.stringify(d)})();</script>`;
  F.sales_pop = [
    { ...(await boosterPage("Bottom left", { salesPop: { enabled: true, firstDelay: 1, gap: 6, position: "bottom-left" } }, { minHeight: 640 })) },
    { ...(await boosterPage("Bottom right, with the city", { salesPop: { enabled: true, firstDelay: 1, gap: 6, position: "bottom-right", showCity: true, text: "Someone in {city} bought {product}" } }, { minHeight: 640 })) },
  ].map((d) => ({ ...d, embeds: d.embeds + freshPurchases }));
  F.trust_badges = [
    await boosterPage("Row with payment icons", { trust: { enabled: true, style: "row", showPayments: true } }),
    await boosterPage("Grid with a heading", { trust: { enabled: true, style: "grid", heading: "Shop with confidence", showPayments: false, badges: [{ key: "secure", label: "Secure checkout" }, { key: "returns", label: "Free 30 day returns" }, { key: "shipping", label: "Ships in 24 hours" }, { key: "warranty", label: "1 year warranty" }] } }),
  ];
  F.stock_urgency = [
    await boosterPage("With a stock bar", { urgency: { enabled: true, showBar: true, threshold: 10 } }),
    await boosterPage("Text only, dark", { urgency: { enabled: true, showBar: false, color: "#111111", text: "Only {count} left, order soon" } }),
  ];
  F.sticky_atc = [
    await boosterPage("Bottom bar", { sticky: { enabled: true, position: "bottom" } }, { scroll: 560, tall: true }),
    await boosterPage("Dark bar at the top", { sticky: { enabled: true, position: "top", bg: "#111111", fg: "#ffffff", buttonBg: "#d7f25c", buttonFg: "#111111" } }, { scroll: 560, tall: true }),
  ];

  const logosOf = (key) => logosD.toStorefrontLogos(logosD.applyLogosPreset(logosD.withLogosDefaults({ text: { heading: "As seen in" } }), key));
  F.logos = await Promise.all(logosD.LOGOS_PRESETS.map(async (p) => ({ template: p.key, title: p.title, layout: "page", html: await block("ucs-logos", { shop: shopWith({ designs: { logos: logosOf(p.key) } }) }) })));

  const annOf = (key) => annD.toStorefrontAnnouncement(annD.applyAnnouncementPreset(annD.withAnnouncementDefaults({}), key));
  F.announcements = await Promise.all(annD.ANNOUNCEMENT_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "product", product: "cedar-candle",
    top: await block("ucs-announcement", { shop: shopWith({ designs: { announcement: annOf(p.key) } }) }),
  })));

  const in3days = "2026-10-18T18:00";
  const countOf = (key, place, raw = {}) => countD.toStorefrontCountdownBar(countD.applyCountdownBarPreset(countD.withCountdownBarDefaults({ on: true, timer: { mode: "evergreen", hours: 6 }, ...raw }, place), key));
  F.countdown = [
    ...await Promise.all(countD.COUNTDOWN_BAR_PRESETS.slice(0, 6).map(async (p) => ({
      template: p.key, title: `Top bar: ${p.title}`, layout: "product", product: "cedar-candle",
      top: await block("ucs-countdown-bar", { settings: { position: "top" }, shop: shopWith({ designs: { countdown_bar: countOf(p.key, "header") } }) }),
    }))),
    {
      title: "On the product page", layout: "product", product: "glow-serum",
      html: `<div class="shopify-section">${await block("ucs-countdown-bar", { page_type: "product", shop: shopWith({ designs: { countdown_product: countOf("flip", "product") } }) })}</div>`,
    },
    {
      title: "Home page section", layout: "page",
      html: `<div class="shopify-section">${await block("ucs-countdown-bar", { shop: shopWith({ designs: { countdown_home: countOf("gold", "home", { timer: { mode: "fixed", end: in3days } }) } }) })}</div>`,
    },
  ];

  const shipOf = (look, raw = {}) => shipD.toStorefrontShippingBar(shipD.withShippingBarDefaults({ goal: 50, look, ...raw }));
  F.shipping_bar = [
    ...await Promise.all(shipD.SHIPPING_BAR_PRESETS.map(async (p) => ({
      template: p.key, title: p.title, layout: "product", product: "daily-cream", cartSeed: seed, css: ["ucs-shipping-bar.css"],
      html: await block("ucs-shipping-bar", { cartTotal: 3400, shop: shopWith({ designs: { shipping_bar: shipOf(p.look) } }) }),
    }))),
    {
      title: "Tiered rewards", layout: "product", product: "daily-cream", cartSeed: seed, css: ["ucs-shipping-bar.css"],
      html: await block("ucs-shipping-bar", { cartTotal: 3400, shop: shopWith({ designs: { shipping_bar: shipOf(shipD.SHIPPING_BAR_PRESETS[2].look, { tiers: [{ goal: 80, reward: "gift", label: "Free gift", progress: "Spend {left} more for a free gift", done: "Free gift unlocked!" }, { goal: 120, reward: "percent", percent: 10, label: "10% off", progress: "Spend {left} more for 10% off", done: "You've unlocked 10% off!" }] }) } }) }),
    },
  ];

  const quickOf = (key) => quickD.toStorefrontQuickAdd(quickD.applyQuickAddPreset(quickD.withQuickAddDefaults({}), key));
  F.quick_add = await Promise.all(quickD.QUICK_ADD_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "collection", collection: "bestsellers", css: ["ucs-quick-add.css"], minHeight: 620,
    embeds: await block("ucs-quick-add", { settings: { after: "drawer" }, shop: shopWith({ designs: { quick_add: quickOf(p.key) } }) }),
  })));

  const deliveryOf = (key) => deliveryD.toStorefrontDelivery(deliveryD.applyDeliveryPreset(deliveryD.withDeliveryDefaults({}), key));
  F.delivery = await Promise.all(deliveryD.DELIVERY_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "product", product: "studio-tee",
    html: await block("ucs-delivery", { page_type: "product", product: P["studio-tee"], shop: shopWith({ designs: { delivery: deliveryOf(p.key) } }) }),
  })));

  const sizeOf = (key) => sizeD.toStorefrontSizeGuide(sizeD.applySizeGuidePreset(sizeD.withSizeGuideDefaults({}), key));
  F.size_guide = await Promise.all(sizeD.SIZE_GUIDE_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "product", product: "studio-tee",
    html: await block("ucs-size-guide", { page_type: "product", product: P["studio-tee"], shop: shopWith({ designs: { size_guide: sizeOf(p.key) } }) }),
  })));

  const stockOf = (key) => stockD.toStorefrontStock(stockD.applyStockPreset(stockD.withStockDefaults({}), key));
  F.stock = await Promise.all(stockD.STOCK_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "product", product: "rose-candle",
    html: await block("ucs-stock", { page_type: "product", product: P["rose-candle"], shop: shopWith({ designs: { stock: stockOf(p.key) } }) }),
  })));

  const wishOf = (key) => wishD.toStorefrontWishlist(wishD.applyWishlistPreset(wishD.withWishlistDefaults({}), key));
  F.wishlist = await Promise.all(wishD.WISHLIST_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "collection", collection: "bestsellers", css: PAY_CSS,
    embeds: await block("ucs-boosters", { page_type: "collection", shop: shopWith({ designs: { wishlist: wishOf(p.key) }, meta: { "$app:cro_boosters": [mo("main", { config: boostersOnly({}) })] } }) }),
  })));

  // The demo store's banner picture (the Header demo's page behind the header).
  const heroImg = { media_type: "image", src: `${BASE}/img/hero-desktop.svg`, width: 2400, height: 1000, aspect_ratio: 2.4, alt: "Candles and skincare on a shelf" };
  const heroImgM = { media_type: "image", src: `${BASE}/img/hero-mobile.svg`, width: 1000, height: 1250, aspect_ratio: 0.8, alt: "Candles and skincare on a shelf" };

  const slide = (h, title, text, button) => ({ image: { id: `img-${h}`, url: imgUrl(h), kind: "image", title }, alt: P[h].title, title, text, link: "", button });
  const slides = [slide("cedar-candle", "Candles", "Hand poured soy wax", "Shop candles"), slide("glow-serum", "Skincare", "Gentle, every day", "Shop skincare"), slide("studio-tee", "Apparel", "Soft cotton basics", "Shop apparel"), slide("monstera-pot", "Home", "Little things for your space", "Shop home"), slide("clay-mug", "Gifts", "Ready to wrap", "Shop gifts")];
  const imageMap = new Map(slides.map((s) => [s.image.id, { url: s.image.url, width: 800, height: 800 }]));
  const carouselOf = (raw) => carouselD.toStorefrontImageCarousel(carouselD.withImageCarouselDefaults({ slides, ...raw }), imageMap);
  F.image_carousel = await Promise.all([
    ["Cards with captions", {}],
    ["Text on the pictures", { layout: { captions: "overlay", ratio: "4/5", perDesktop: 3 } }],
    ["Squares, three across", { layout: { ratio: "1/1", perDesktop: 3, radius: 0 }, heading: { text: "Shop by category", align: "left" } }],
    ["Coverflow", { layout: { effect: "coverflow", ratio: "4/5", captions: "none", radius: 16 }, heading: { text: "Seen on our customers" } }],
  ].map(async ([title, raw]) => ({ title, layout: "page", html: await block("ucs-image-carousel", { shop: shopWith({ designs: { image_carousel: carouselOf(raw) } }) }) })));

  const video = (n, h) => ({
    alt: P[h].title,
    preview_image: { src: imgUrl(h) },
    sources: [{ mime_type: "video/mp4", url: `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/${n}.mp4`, height: 720 }],
  });
  const vslides = [["flower", "glow-serum", "Morning routine"], ["flower", "cedar-candle", "Unboxing"], ["flower", "studio-tee", "How it fits"], ["flower", "clay-mug", "Made by hand"], ["flower", "canvas-tote", "Everyday carry"]].map(([n, h, caption], i) =>
    mo(`v${i}`, { video: video(n, h), product: P[h], caption }),
  );
  const videoOf = (key) => videoD.toStorefrontVideoCarousel(videoD.applyVideoCarouselPreset(videoD.withVideoCarouselDefaults({}), key));
  F.videos = await Promise.all(videoD.VIDEO_CAROUSEL_PRESETS.map(async (p) => ({
    template: p.key, title: p.title, layout: "page",
    html: `<div class="page-width">${await block("ucro-video-carousel", { product: P["glow-serum"], page_type: "index", shop: shopWith({ designs: { videos: videoOf(p.key) }, meta: { "$app:cro_carousel": [mo("main", { slides: vslides })] } }) })}</div>`,
  })));

  const faqOf = (key) => faqD.toStorefrontFaq(faqD.applyFaqPreset(faqD.withFaqDefaults({}), key));
  F.faq = await Promise.all(faqD.FAQ_PRESETS.map(async (p) => ({ template: p.key, title: p.title, layout: "page", html: await block("ucs-faq", { shop: shopWith({ designs: { faq: faqOf(p.key) } }) }) })));

  const qa = (id, label, tag) => ({ id, label, tag });
  const quizQuestions = [
    { id: "q1", text: "Who is it for?", answers: [qa("a1", "Me", "skincare"), qa("a2", "A gift", "gift"), qa("a3", "My home", "home")] },
    { id: "q2", text: "What sounds best?", answers: [qa("a4", "A calm evening", "candle"), qa("a5", "Glowing skin", "glow"), qa("a6", "Cosy feet", "socks")] },
  ];
  const quizOf = (key) => quizD.toStorefrontQuiz(quizD.applyQuizPreset(quizD.withQuizDefaults({ questions: quizQuestions, text: { intro: "Answer 2 quick questions and we'll pick the best products for you." }, results: { collection: "all", count: 3, saveToCart: true } }), key));
  F.quiz = await Promise.all(quizD.QUIZ_PRESETS.map(async (p) => ({ template: p.key, title: p.title, layout: "page", html: await block("ucs-quiz", { shop: shopWith({ designs: { quiz: quizOf(p.key) } }) }) })));

  const pillItems = ["all", "candles", "skincare", "socks", "home", "apparel", "gifts"].map((h) => ({ id: String(collections[h].id), handle: h, title: collections[h].title, label: "", image: null }));
  const pillsOf = (look, layout = {}) => pillsD.toStorefrontPills(pillsD.withPillsDefaults({ items: pillItems, look, layout }));
  F.collection_pills = await Promise.all([
    ["Outline pills", { style: "outline" }],
    ["Soft filled", { style: "soft", upper: false, radius: 12, bg: "#f2f2ef", border: "#f2f2ef", activeBg: "#121212" }],
    ["Bold, centred", { style: "filled", upper: true, bg: "#111111", text: "#ffffff", border: "#111111", activeBg: "#d7f25c", activeText: "#111111" }, { align: "center", mode: "wrap" }],
  ].map(async ([title, look, layout]) => ({
    title, layout: "collection", collection: "candles",
    top: await block("ucs-collection-pills", { collection: collections.candles, page_type: "collection", shop: shopWith({ designs: { collection_pills: pillsOf(look, layout) } }) }),
  })));

  const menu = (titles) => ({ links: titles.map((t, i) => ({ title: t, url: `${BASE}/store/pages/${t.toLowerCase().replace(/ /g, "-")}`, active: i === 0, object: null, links: [] })) });
  const linklists = { "main-menu": menu(["Shop", "Candles", "Skincare", "Gifts", "About"]) };
  F.header = await Promise.all(headerD.PRESETS.map(async (p) => {
    const cfg = headerD.toStorefrontHeader(headerD.applyPreset(headerD.withHeaderDefaults({ logo: { text: "Lumen Goods" }, button: { text: "Shop now" } }), p.key), null);
    return {
      template: p.key, title: p.title, layout: "page", css: ["ucs-header.css"], minHeight: 520,
      html: `<div style="position:relative;min-height:520px;background:url(${heroImg.src}) center/cover;display:grid;place-items:center;color:#fff;text-align:center"><div><h1 style="margin:0;font-size:2.4rem">Slow evenings, made better</h1><p style="margin:8px 0 0">Hand poured candles and gentle skincare.</p></div></div>`,
      embeds: await block("ucs-header", { linklists, shop: shopWith({ designs: { header: cfg } }) }),
    };
  }));

  const orderPage = (kind) => async (p) => ({
    template: p.key, title: p.title, layout: "page",
    html: await block("ucs-order-page", { settings: { page: kind }, page_type: "page", shop: shopWith({ designs: { [`${kind}_page`]: orderD.toStorefrontOrderPage(orderD.applyOrderPagePreset(orderD.withOrderPageDefaults(kind === "track" ? { recs: { like: { on: true }, complete: { on: true }, count: 4 }, text: { sub: "Demo: try order 1042 (on its way), 1043 (delivered) or 1044 (late), with any email." } } : {}, kind), p.key)) } }) }),
  });
  F.track = await Promise.all(orderD.ORDER_PAGE_PRESETS.map(orderPage("track")));
  F.returns = await Promise.all(orderD.ORDER_PAGE_PRESETS.map(orderPage("returns")));
  // Return saving rules (Pro): the same Returns page, where the shopper can choose store credit (the demo backend offers it with a 10% bonus).
  F.return_saving = (await Promise.all(orderD.ORDER_PAGE_PRESETS.slice(0, 2).map(orderPage("returns")))).map((x, i) => ({ ...x, title: i ? "Store credit, plain" : "Store credit with a bonus" }));

  // ---------------------------------------------------------------------------- Bundles --
  const step = (h, fields) => mo(h, { required: true, products: null, collection: null, ...fields });
  const bundleMo = (h, fields) => mo(h, { name: h, active: true, allow_duplicates: false, hide_sold_out: true, pricing: "fixed", percent_off: 0, price_rules: { tr: [], ex: {} }, store_wide: false, ...fields });
  const bundleOf = (key) => bundleD.toStorefrontBundle(bundleD.applyBundlePreset(bundleD.withBundleDesignDefaults({}), key));
  const candleStep = step("st-candles", { label: "Pick 3 candles", min_picks: 3, max_picks: 3, collection: collections.candles });
  const candleBox = bundleMo("candle-box", { product: P["candle-box"], steps: [candleStep], pricing: "fixed" });
  const builder = async (product, bundle, designKey = "theme", extra = {}) =>
    block("ucro-bundle-builder", { product: P[product], page_type: "product", shop: shopWith({ designs: { bundles: bundleOf(designKey), ...extra }, meta: { "$app:cro_bundle": [bundle] } }) });

  const R = {};
  // 1. Frequently bought together: the fixed bundle box on each item's page (deals script).
  const fbtDeal = { id: "d-fbt", t: "fixed", name: "Evening ritual set", items: [{ h: "cedar-candle", id: P["cedar-candle"].id, q: 1 }, { h: "clay-mug", id: P["clay-mug"].id, q: 1 }, { h: "oat-soap", id: P["oat-soap"].id, q: 1 }], pct: 15 };
  const fbtLooks = [
    ["Pictures in a row", {}],
    ["List with a border", { layout: "list", border: true, align: "start" }],
    ["Boxes around pictures, saving in %", { tiles: true, saving: "pct", align: "start", heading: "Complete the set" }],
  ];
  R.fbt = await Promise.all(fbtLooks.map(async ([title, patch]) => ({
    title, layout: "product", product: "cedar-candle", css: PAY_CSS,
    embeds: await block("ucs-boosters", { page_type: "product", product: P["cedar-candle"], shop: dealShop([fbtDeal], { ...deals.DEFAULT_FBT, ...patch }) }),
  })));
  // 2. Fixed bundle (sold as one product): Shopify's own bundle product, with "What's inside".
  R.kit = [{
    title: "The kit's product page", layout: "product", product: "care-kit",
    description: `<p><strong>What's inside</strong></p><ul><li>1 × Cedar Candle</li><li>1 × Daily Cream</li><li>1 × Oat Soap</li></ul><p>Sold as one product: one line in the cart, and Shopify takes each item from stock.</p>`,
    html: "",
  }];
  // 3. Mix and match: every bundle look the app offers.
  R.mixmatch = await Promise.all(bundleD.BUNDLE_PRESETS.map(async (p) => ({ title: p.title, layout: "product", product: "candle-box", place: "above", html: await builder("candle-box", candleBox, p.key) })));
  // 4. Tiered bundle (buy more, save more): % off that grows with the number of items.
  const skinSet = bundleMo("skin-set", { product: P["skin-set"], pricing: "percent_tiers", price_rules: { tr: [], ex: {}, pt: [[2, 10], [3, 15], [4, 20]] }, steps: [step("st-skin", { label: "Pick 2 or more", min_picks: 2, max_picks: 6, collection: collections.skincare })], allow_duplicates: true });
  R.growing = await Promise.all([["Green", "green"], ["Big cards", "big"]].map(async ([title, key]) => ({ title, layout: "product", product: "skin-set", place: "above", html: await builder("skin-set", skinSet, key) })));
  // 5. Build your own bundle: "+ Add to bundle" on collection cards and product pages, and the tray.
  const browseBox = bundleMo("candle-box", { product: P["candle-box"], steps: [candleStep], pricing: "fixed", store_wide: true });
  const trayShop = shopWith({ designs: { bundles: bundleOf("green") }, meta: { "$app:cro_bundle": [browseBox] } });
  const tray = async (ctx) => `<link rel="stylesheet" href="${BASE}/assets/ucro-bundle-tray.css">` + (await block("ucro-bundle-tray", { ...ctx, shop: trayShop }));
  R.browse = [
    { title: "On a collection page", layout: "collection", collection: "candles", minHeight: 680, embeds: await tray({ page_type: "collection", collection: collections.candles }) },
    { title: "On a product page", layout: "product", product: "fig-candle", minHeight: 680, place: "above", html: await block("ucro-add-to-bundle", { product: P["fig-candle"], page_type: "product", shop: trayShop }), embeds: await tray({ page_type: "product", product: P["fig-candle"] }) },
  ];
  // 6. Fixed price bundle (any 3 for $30): any 3 for $30, any 6 for $55 from a long collection.
  const sockDrawer = bundleMo("sock-drawer", { product: P["sock-drawer"], pricing: "tiers", price_rules: { tr: [[3, 3000], [6, 5500]], ex: {} }, allow_duplicates: true, steps: [step("st-socks", { label: "Pick 3 or 6 pairs", min_picks: 3, max_picks: 6, collection: collections.socks })] });
  R.anyN = await Promise.all([["Sharp and compact", "sharp"], ["Blue", "blue"]].map(async ([title, key]) => ({ title, layout: "product", product: "sock-drawer", place: "above", html: await builder("sock-drawer", sockDrawer, key) })));

  // CRO sections (one shared block, ucs-section; the pop up through the boosters embed): each template of the app.
  const pic = (id, url) => ({ id: `demo-${id}`, url, kind: "image", title: id });
  const secContent = {
    before_after: { before: pic("before", secD.SAMPLE_IMAGES.before), after: pic("after", secD.SAMPLE_IMAGES.after) },
    shoppable: {
      image: pic("look", secD.SAMPLE_IMAGES.look),
      spots: [["studio-tee", 32, 38], ["canvas-tote", 64, 62], ["ribbed-socks", 47, 86]].map(([h, x, y]) => ({ x, y, id: String(P[h].id), handle: h, title: P[h].title, image: imgUrl(h), price: P[h].price, variant: String(P[h].variants[0].id), variants: P[h].variants.length })),
    },
    email_popup: { on: true, show: { delay: 1, scroll: 0, exit: false, pages: "all", every: 1 } },
  };
  const secOf = (kind, key) => {
    const d = secD.defaultSec(kind);
    const own = kind === "email_popup" && key !== "center" && key !== "bar" ? { image: pic("popup", secD.SAMPLE_IMAGES.popup) } : {};
    return secD.toStorefrontSec(secD.applySecPreset(secD.withSecDefaults(kind, { ...d, content: { ...d.content, ...secContent[kind], ...own } }), key));
  };
  const onProduct = { compare_table: "below", product_tabs: "in", guarantee: "in", recently_viewed: "below" };
  const RV = `<script>try{localStorage.setItem("ucs-rv",JSON.stringify(["cedar-candle","clay-mug","studio-tee","canvas-tote","oat-soap"]))}catch(e){}</script>`;
  for (const kind of secD.BLOCK_KINDS) {
    F[kind] = await Promise.all(secD.SEC_PRESETS[kind].map(async (p) => {
      const html = await block("ucs-section", { settings: { kind }, page_type: onProduct[kind] ? "product" : "index", product: onProduct[kind] ? P["glow-serum"] : undefined, shop: shopWith({ designs: { [kind]: secOf(kind, p.key) } }) });
      const css = ["ucs-sec.css"];
      if (!onProduct[kind]) return { template: p.key, title: p.title, layout: "page", css, html };
      if (onProduct[kind] === "in") return { template: p.key, title: p.title, layout: "product", product: "glow-serum", css, html };
      return { template: p.key, title: p.title, layout: "product", product: "glow-serum", css, html: "", bottom: kind === "recently_viewed" ? RV + html : html };
    }));
  }
  const popFake = `<script>try{localStorage.removeItem("ucs-pop")}catch(e){}(function(){var f=window.fetch;window.fetch=function(u,o){if(String(u).indexOf("apps/ucro/subscribe")>-1)return Promise.resolve(new Response(JSON.stringify({ok:true,code:"WELCOME-7K2QF"}),{headers:{"Content-Type":"application/json"}}));if(String(u).indexOf("/discount/")>-1)return Promise.resolve(new Response(""));return f.apply(this,arguments)}})();</script>`;
  F.email_popup = await Promise.all(secD.SEC_PRESETS.email_popup.map(async (p) => ({
    template: p.key, title: p.title, layout: "page", minHeight: 620,
    html: '<div style="padding:60px 24px;text-align:center;opacity:.7">The pop up opens a second after the page loads. Try signing up: the demo shows a sample code.</div>',
    embeds: popFake + await block("ucs-boosters", { shop: shopWith({ designs: { email_popup: secOf("email_popup", p.key) }, meta: { "$app:cro_boosters": [mo("main", { config: boostersOnly({}) })] } }) }),
  })));

  // Each feature's templates as its design page in the app lists them: demo design N shows template N
  // (DEMO_TEMPLATES in app/lib/site.ts says how many; the build checks it).
  const T = {
    upsell: upsellD.UPSELL_PRESETS, cross_sell: crossD.CROSS_SELL_PRESETS, personalize: persD.PERSONALIZE_PRESETS,
    cart_extras: extrasD.CART_EXTRAS_PRESETS,
    reviews: reviewsD.REVIEW_PRESETS, product_reviews: reviewsD.PRODUCT_REVIEW_PRESETS, logos: logosD.LOGOS_PRESETS,
    announcements: annD.ANNOUNCEMENT_PRESETS, countdown: countD.COUNTDOWN_BAR_PRESETS, shipping_bar: shipD.SHIPPING_BAR_PRESETS,
    quick_add: quickD.QUICK_ADD_PRESETS, delivery: deliveryD.DELIVERY_PRESETS, size_guide: sizeD.SIZE_GUIDE_PRESETS, stock: stockD.STOCK_PRESETS, wishlist: wishD.WISHLIST_PRESETS,
    videos: videoD.VIDEO_CAROUSEL_PRESETS, faq: faqD.FAQ_PRESETS, quiz: quizD.QUIZ_PRESETS,
    header: headerD.PRESETS, track: orderD.ORDER_PAGE_PRESETS, returns: orderD.ORDER_PAGE_PRESETS,
    ...Object.fromEntries(secD.SEC_KINDS.map((k) => [k, secD.SEC_PRESETS[k]])),
  };
  return { features: F, recipes: R, templates: T };
}

/** The boosters config with everything off except what a demo shows. */
function boostersOnly(cfg) {
  const out = {};
  for (const k of ["sticky", "urgency", "trust", "salesPop"]) out[k] = { enabled: false, ...(cfg[k] ?? {}) };
  return boostersD.withDefaults(out);
}

/** The reviews blocks match reviews to the product by id. */
const reviewProductOf = (h) => products[h];

export { reviews, faq, logos, announcements, collectionHandles };
