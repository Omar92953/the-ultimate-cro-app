/**
 * One keyword page per app feature that has no hand written keyword page (src/keywords/), at /<slug>/.
 * Each answers the search a merchant types when looking for an app for that one job ("shopify countdown timer app"),
 * says what that kind of app does, and why getting it inside CRO Toolbox is better value: the same plan also has the
 * other tools listed in its plan card (app/lib/plans.ts highlights). Everything about the feature itself comes from
 * the app's catalog and lib/features.ts, so the pages stay true when the app changes.
 *
 * To add or change one, edit SEARCHES. `what` is one or two sentences on what such an app does in general (never a
 * claim about CRO Toolbox: those come from the feature's own copy).
 */
import { PLANS, PLAN_KEYS, FEATURE_PLAN, FEATURES, featureTitle, featureAbout, money, atLeast, type FeatureKey, type PlanKey } from "./app";
import { FEATURE_COPY } from "./features";
import { CHECKOUT_ONLY } from "./app";
import { planLine } from "./pages";
import type { KeywordPage } from "./keywords";

type Search = { slug: string; keyword: string; menu: string; what: string };

export const SEARCHES: Partial<Record<FeatureKey, Search>> = {
  discounts: { slug: "shopify-discount-app", keyword: "Shopify discount app", menu: "Discounts", what: "A discount app runs promotions Shopify's own discounts don't show on the store, such as Buy X get Y, volume tiers on the product page and a free gift once the cart reaches an amount." },
  addons: { slug: "shopify-product-add-ons", keyword: "Shopify product add ons", menu: "Product add ons", what: "Product add ons are small extras offered under the Add to cart button, such as gift wrap, a card or a matching item, added to the cart together with the product." },
  personalize: { slug: "shopify-product-personalization", keyword: "Shopify product personalization", menu: "Personalization", what: "A personalization app lets shoppers add a name, text or a colour choice to a product before buying, and saves it on the order for you to make or print." },
  cart_offers: { slug: "shopify-cart-upsell", keyword: "Shopify cart upsell", menu: "Cart upsell", what: "A cart upsell shows offers inside the cart or cart drawer, the last moment before checkout, so shoppers can add one more item without leaving the cart." },
  cart_extras: { slug: "shopify-gift-note-delivery-date", keyword: "Shopify delivery date picker", menu: "Delivery date", what: "A delivery date picker lets shoppers choose when they want the order and leave a gift note in the cart, both saved on the order." },
  cart_code: { slug: "shopify-cart-discount-code", keyword: "Shopify cart discount code box", menu: "Cart discount code", what: "A discount code box in the cart lets shoppers enter and check a code before checkout, so they see the price they will pay earlier." },
  reviews: { slug: "shopify-reviews-app", keyword: "Shopify reviews app", menu: "Reviews app", what: "A reviews app collects reviews from customers and shows them on your store, with stars, photos and a summary that help new shoppers trust a product." },
  product_reviews: { slug: "shopify-product-reviews", keyword: "Shopify product reviews", menu: "Product reviews", what: "Product reviews show a product's own stars and reviews on its page, close to the price and the Add to cart button." },
  sales_pop: { slug: "shopify-sales-pop-up", keyword: "Shopify sales pop up", menu: "Sales pop up", what: "A sales pop up shows small notices of recent orders on your store, a form of social proof. It should only ever show real orders." },
  trust_badges: { slug: "shopify-trust-badges", keyword: "Shopify trust badges", menu: "Trust badges", what: "Trust badges show payment methods, secure checkout and your store's promises near the Add to cart button, where shoppers decide." },
  logos: { slug: "shopify-scrolling-text-logos", keyword: "Shopify scrolling text", menu: "Scrolling text", what: "A scrolling text or logo strip moves short messages or brand logos across the page, for press mentions, partner logos or store promises." },
  announcements: { slug: "shopify-announcement-bar", keyword: "Shopify announcement bar", menu: "Announcement bar", what: "An announcement bar is a thin bar at the top of every page for a sale, free shipping or a new collection, often with several messages that rotate." },
  countdown: { slug: "shopify-countdown-timer", keyword: "Shopify countdown timer", menu: "Countdown timer", what: "A countdown timer shows the time left in a sale or until an order cut off. It works when the end is real; a timer that resets for each visitor misleads shoppers." },
  shipping_bar: { slug: "shopify-free-shipping-bar", keyword: "Shopify free shipping bar", menu: "Free shipping bar", what: "A free shipping bar shows how much more a shopper needs to spend for free shipping, and updates as the cart changes." },
  stock_urgency: { slug: "shopify-low-stock-alert", keyword: "Shopify low stock alert", menu: "Low stock alert", what: "A low stock alert shows \"Only 3 left\" on the product page when stock is really low, read from your inventory." },
  sticky_atc: { slug: "shopify-sticky-add-to-cart", keyword: "Shopify sticky add to cart", menu: "Sticky add to cart", what: "A sticky add to cart bar keeps the product, price and button on screen while the shopper scrolls down a long product page." },
  quick_add: { slug: "shopify-quick-add-to-cart", keyword: "Shopify quick add to cart", menu: "Quick add", what: "Quick add puts an Add to cart button on product cards in collections, so shoppers can buy without opening each product page." },
  delivery: { slug: "shopify-delivery-estimate", keyword: "Shopify delivery date estimate", menu: "Delivery estimate", what: "A delivery date estimate tells shoppers on the product page when the order should arrive, and how long they have to order for that date." },
  size_guide: { slug: "shopify-size-chart", keyword: "Shopify size chart", menu: "Size chart", what: "A size chart app shows a size table on product pages, often with a size finder, so shoppers pick the right size and send fewer returns." },
  stock: { slug: "shopify-back-in-stock-pre-order", keyword: "Shopify back in stock alert", menu: "Back in stock", what: "A back in stock app lets shoppers ask to be told when a sold out product returns; a pre order option keeps selling products you will restock." },
  wishlist: { slug: "shopify-wishlist-app", keyword: "Shopify wishlist app", menu: "Wishlist", what: "A wishlist app lets shoppers save products to come back to, with a heart on product cards and pages and a page that lists what they saved." },
  image_carousel: { slug: "shopify-image-carousel", keyword: "Shopify image carousel", menu: "Image carousel", what: "An image carousel shows several pictures in a row that shoppers scroll or swipe, for collections, lookbooks and categories." },
  videos: { slug: "shopify-video-carousel", keyword: "Shopify shoppable video", menu: "Shoppable video", what: "Shoppable videos are short product videos on your store, like social media reels, each linked to a product with its price and Add to cart." },
  faq: { slug: "shopify-faq-page", keyword: "Shopify FAQ section", menu: "FAQ section", what: "A FAQ section answers the questions shoppers ask before buying, such as shipping, returns and sizing, in short questions that open on click." },
  quiz: { slug: "shopify-product-quiz", keyword: "Shopify product quiz", menu: "Product quiz", what: "A product quiz asks shoppers a few questions and recommends the products that fit their answers, like a sales assistant in a shop." },
  collection_pills: { slug: "shopify-collection-links", keyword: "Shopify collection links", menu: "Collection links", what: "Collection links are small rounded buttons, often with pictures, that take shoppers straight to your main collections." },
  header: { slug: "shopify-custom-header", keyword: "Shopify custom header", menu: "Header", what: "A custom header replaces the theme's top bar with your own layout of logo, menu, search and cart." },
  compare_table: { slug: "shopify-comparison-table", keyword: "Shopify comparison table", menu: "Comparison table", what: "A comparison table puts your product next to others, or several of your products side by side, with ticks and short facts." },
  benefits: { slug: "shopify-benefits-section", keyword: "Shopify benefits section", menu: "Benefits section", what: "A benefits section shows a row of icons with short promises, such as free returns or handmade, so shoppers see why to buy at a glance." },
  product_tabs: { slug: "shopify-product-tabs", keyword: "Shopify product tabs", menu: "Product tabs", what: "Product tabs group long product details, such as ingredients, sizing and care, into tabs or panels that open on click." },
  guarantee: { slug: "shopify-guarantee-badge", keyword: "Shopify guarantee badge", menu: "Guarantee badge", what: "A guarantee badge states your promise, such as a money back guarantee, close to the Add to cart button." },
  before_after: { slug: "shopify-before-after-slider", keyword: "Shopify before after slider", menu: "Before and after", what: "A before and after slider shows two pictures in one frame that the shopper drags to compare, for results such as cleaning, skin care or repairs." },
  shoppable: { slug: "shopify-shoppable-image", keyword: "Shopify shoppable image", menu: "Shoppable image", what: "A shoppable image (shop the look) puts dots on a lifestyle photo; each dot shows a product in the picture with its price and Add to cart." },
  recently_viewed: { slug: "shopify-recently-viewed-products", keyword: "Shopify recently viewed products", menu: "Recently viewed", what: "A recently viewed section shows the products a shopper looked at before, so they can find them again without searching." },
  how_it_works: { slug: "shopify-how-it-works-section", keyword: "Shopify how it works section", menu: "How it works", what: "A how it works section explains buying from you in a few numbered steps, useful for subscriptions, custom orders and services." },
  email_popup: { slug: "shopify-email-pop-up", keyword: "Shopify email pop up", menu: "Email pop up", what: "An email pop up asks visitors for their email in exchange for a welcome discount, and adds them to your customers for email marketing." },
  payment_rules: { slug: "shopify-hide-payment-methods", keyword: "Shopify hide payment methods", menu: "Payment rules", what: "Payment rules hide, rename or reorder payment methods at checkout by cart, country or customer, for example no cash on delivery above an amount." },
  delivery_rules: { slug: "shopify-hide-shipping-methods", keyword: "Shopify hide shipping methods", menu: "Delivery rules", what: "Delivery rules hide, rename or reorder shipping methods at checkout, for example no express shipping for heavy items." },
  order_limits: { slug: "shopify-order-limits", keyword: "Shopify order limits", menu: "Order limits", what: "Order limits set a minimum or maximum quantity or amount at checkout, per product or per order, for wholesale minimums or limited drops." },
  thank_you: { slug: "shopify-thank-you-page", keyword: "Shopify thank you page", menu: "Thank you page", what: "A thank you page app adds content to the page shoppers see after paying, such as a code for the next order, follow buttons and product suggestions." },
  ab_tests: { slug: "shopify-ab-testing-app", keyword: "Shopify A/B testing app", menu: "A/B testing", what: "An A/B testing app shows different versions of something to different shoppers and compares what each version sells, so changes are based on real orders." },
};

/** Tools a plan includes, from its plan card, without "Everything in …" lines: its own first, then lower plans'. */
const planTools = (p: PlanKey) =>
  [...PLAN_KEYS].reverse().filter((k) => atLeast(p, k))
    .flatMap((k) => PLANS[k].highlights)
    .filter((h) => !/^Everything in|orders? (on|a month)|^\d+ (offers|checkout|styles)|^Try \d|support$/i.test(h));

const shorten = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(" ", max - 1)).replace(/[,;:]$/, "")}…`);

function pageFor(k: FeatureKey, s: Search, order: number): KeywordPage {
  const t = featureTitle(k);
  const tt = inText(t);
  const copy = FEATURE_COPY[k];
  const plan = PLANS[FEATURE_PLAN[k]];
  const checkout = CHECKOUT_ONLY.includes(k);
  const others = planTools(FEATURE_PLAN[k]).slice(0, 6);
  const head = `${s.keyword} by CRO Toolbox: `;
  const tail = ` ${planLine(k)}, with upsells, bundles and more in one app.`;
  const steps = copy.steps ?? (checkout
    ? ["Install CRO Toolbox from the Shopify App Store.", `Open Cart & Checkout → ${t} in the app and set it up.`, "Switch it on and check a test order at checkout."]
    : ["Install CRO Toolbox from the Shopify App Store.", `Open ${t} in the app, pick a template and set it up with the live preview.`, "Click Add to theme: the theme editor opens with the block ready. Place it and save."]);
  return {
    slug: s.slug,
    order,
    menu: s.menu,
    keyword: s.keyword,
    title: `${s.keyword}, plus upsells and loyalty in one app`,
    description: head + shorten(featureAbout(k), 200 - head.length - tail.length) + tail,
    ogTitle: t,
    kicker: s.menu,
    h1: `${s.keyword}: ${tt} in CRO Toolbox`,
    answer: `${s.what} CRO Toolbox has it as ${tt}: ${featureAbout(k).replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}. It is ${planLine(k).replace(/^Included/, "included").replace(/^On/, "on")}, in the same app as upsells, bundles, a loyalty program and a Track order page.`,
    updated: "2026-10-30",
    shot: { name: `features/${k.replace(/_/g, "-")}`, alt: `${t} from CRO Toolbox on a demo store`, caption: `${t} on a demo store.` },
    sections: [
      {
        heading: `Why get ${tt} in CRO Toolbox`,
        list: [
          `<b>One app instead of several.</b> On the ${plan.name} plan${plan.monthly ? ` (${money(plan.monthly)} a month)` : ""} you also get: ${others.map(inText).join("; ")}.`,
          "<b>Order value and repeat orders together.</b> Upsells, bundles and cart offers raise what each order is worth (AOV); the loyalty program, the Track page and returns that keep the sale bring customers back (LTV).",
          "<b>One look, one menu.</b> Every feature shares the same design style and is set up in one app with a live preview.",
          checkout
            ? "<b>Runs inside Shopify checkout</b> as a Shopify Function; it needs no Shopify Plus when the app is installed from the Shopify App Store."
            : "<b>Fits your theme, no code.</b> It is a theme app block for any Online Store 2.0 theme, placed in the theme editor; your theme's code is never edited.",
        ],
      },
      { heading: `${t} in CRO Toolbox`, paragraphs: [copy.who], list: copy.points, after: copy.note ? [copy.note] : undefined },
      { heading: "How to set it up", steps },
    ],
    features: [k, ...(copy.related ?? [])].slice(0, 4),
    demos: [],
    help: [],
    useCases: [],
    articles: [],
    related: ["increase-aov-shopify", "shopify-cro"],
    faq: [
      {
        q: `What is the best value ${s.keyword.replace(/^Shopify /, "").toLowerCase()} for Shopify?`,
        a: `If you also want upsells, bundles or a loyalty program, an app that includes them saves paying for several. CRO Toolbox has ${tt} ${plan.monthly ? `on the ${plan.name} plan (${money(plan.monthly)} a month)` : `on the ${plan.name} plan`}, together with ${others.slice(0, 3).map(inText).join(", ")}.`,
      },
      { q: `Which plan includes ${tt}?`, a: `${planLine(k)}. Paid plans have a ${PLANS.starter.trialDays} day free trial. See <a href="/pricing/">pricing</a>.` },
      checkout
        ? { q: "Does it need Shopify Plus?", a: "No. It runs inside Shopify checkout as a Shopify Function, which works on every Shopify plan when the app is installed from the Shopify App Store." }
        : { q: "Does it work with my theme?", a: "Yes, with any Online Store 2.0 theme. You set it up in the app and place it in the theme editor; your theme's code is never edited." },
      { q: "Do I need to write code?", a: "No. Everything is set up in the app with a live preview." },
      { q: "How do I set it up?", a: steps.join(" ") },
    ],
  };
}

/** "Countdown timers" in a sentence: lower case except names (FAQ, A/B tests). */
const inText = (t: string) => (/^[A-Z][a-z]/.test(t) && !/^(FAQ|A\/B)/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

/** The generated pages, ordered after the hand written ones. */
export const FEATURE_KEYWORD_PAGES: KeywordPage[] = (Object.entries(SEARCHES) as [FeatureKey, Search][])
  .filter(([k]) => k in FEATURES)
  .map(([k, s], i) => pageFor(k, s, 1000 + i));
