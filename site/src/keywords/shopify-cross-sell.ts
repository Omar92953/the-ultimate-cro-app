/**
 * /shopify-cross-sell/: main search "shopify cross sell", also "frequently bought together".
 * Facts from the help guides (cross-sell-offers, bundles, cart), the article on Frequently bought
 * together and lib/features.ts; the recipe from app/lib/bundle-recipes.ts; plans from app/lib/plans.ts.
 */
import { BUNDLE_RECIPES, cheapestPaid, money, PLANS, FEATURE_PLAN, plain } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { planOf, freeLimits } from "../lib/plan-lines";
import { FEATURE_COPY } from "../lib/features";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const fbt = BUNDLE_RECIPES.find((r) => r.key === "fbt")!;
const crossPlan = PLANS[FEATURE_PLAN.cross_sell].name;
const fbtPlan = PLANS[FEATURE_PLAN.bundles].name;
const plansLine =
  crossPlan === fbtPlan
    ? `Cross sell offers and Frequently bought together are on the ${crossPlan} plan`
    : `Cross sell offers are on the ${crossPlan} plan and Frequently bought together on the ${fbtPlan} plan`;

const page: KeywordPage = {
  slug: "shopify-cross-sell",
  order: 20,
  menu: "Cross sell app",
  keyword: "Shopify cross sell",
  title: "Shopify cross sell and frequently bought together app",
  description: "Shopify cross sell offers and frequently bought together boxes with CRO Toolbox: pairs shoppers add in one click on the product page, the cart and the cart drawer.",
  ogTitle: "Cross sells and frequently bought together",
  kicker: "Cross sells",
  h1: "Shopify cross sell and frequently bought together",
  answer:
    "A cross sell offers products that go with the one a shopper is looking at, like a case with a phone, and a frequently bought together box shows them as a set to add in one click. CRO Toolbox does both on Shopify: cross sell offers on the product page, the cart page and the cart drawer, and a Frequently bought together box with a discount when the set is bought together.",
  updated: "2026-10-17",
  shot: { name: "features/cross-sell", alt: "A Pairs well with box on a product page of a demo store, with products to tick and add", caption: "A cross sell offer on a demo store, made with the app's first template." },
  sections: [
    {
      heading: "What is a cross sell?",
      paragraphs: [
        "A cross sell suggests a different product that completes the one in front of the shopper: a cream with a serum, matches with a candle, socks with shoes. It answers \"what else do I need?\" at the moment the shopper is deciding.",
        "An upsell is the other way to raise order value: more of the same product or a better version of it. See <a href=\"/shopify-upsell-app/\">Shopify upsell app</a>.",
      ],
    },
    {
      heading: "How CRO Toolbox does cross sells",
      list: [
        "<b>Cross sell offers:</b> products that pair well, shown with a box the shopper ticks to add them in one click. Nothing is ticked in advance.",
        "<b>Where they show:</b> the product page, the cart page and the cart drawer. In the cart, the offer shows when a trigger product is in the cart.",
        "<b>Optional discount:</b> a percentage off the offered products, applied at checkout while a trigger product is also in the cart, however the products were added.",
        "<b>Smart skipping:</b> sold out products, the product being viewed and products already in the cart are left out automatically.",
        `<b>Frequently bought together:</b> ${plain(fbt.about).replace(/\.$/, "")}. One button adds the whole set.`,
      ],
      after: ["Products that no rule covers can show Shopify's own recommendations instead, chosen in the theme editor."],
    },
    {
      heading: "How to set up a cross sell offer",
      steps: [
        "Install CRO Toolbox and open <b>Offers → Cross sell offers</b>. Create an offer.",
        "Choose the trigger: all products, specific products, or products in collections.",
        "Pick the products to offer and where the offer appears: product page, cart page and/or cart drawer.",
        "Add an optional discount, then set the look in <b>Style</b> with the live preview.",
        "Place the block in the theme editor and save.",
      ],
      after: [
        "Offers inside your theme's own cart drawer work with Dawn and Dawn based themes.",
        "For a Frequently bought together box, open <b>Bundles → Create bundle</b>, choose <b>Frequently bought together</b>, pick two or three items and a discount. The box shows on the product page of every item in the set. Step by step: <a href=\"/blog/how-to-add-frequently-bought-together-to-shopify/\">how to add Frequently bought together to a Shopify theme</a>.",
      ],
    },
  ],
  table: {
    heading: "Cross sell offer or frequently bought together?",
    caption: "A cross sell offer compared with a Frequently bought together box in CRO Toolbox",
    head: ["", "Cross sell offer", "Frequently bought together"],
    rows: [
      ["What shoppers see", "Products that pair well, ticked and added in one click", "The product and its set, with the total and one button to add all"],
      ["Where", "Product page, cart page and cart drawer", "The product page of every item in the set"],
      ["Discount", "Optional percentage off the offered products", "A discount when the whole set is in the cart"],
      ["Best for", cap(FEATURE_COPY.cross_sell.who.replace(/^For /, "")), cap(plain(fbt.best).replace(/^Best for /, ""))],
      ["Plan", planOf("cross_sell"), planOf("bundles")],
    ],
  },
  features: ["cross_sell", "cart_offers", "bundles"],
  demos: [
    { label: "Cross sell offers demo", feature: "cross_sell" },
    { label: "Offers in the cart demo", feature: "cart_offers" },
    { label: "Frequently bought together demo", feature: "bundles", recipe: "fbt" },
  ],
  help: ["cross-sell-offers", "bundles", "cart"],
  useCases: ["raise-average-order-value", "home-and-candle-stores"],
  articles: ["how-to-add-frequently-bought-together-to-shopify", "cart-drawer-upsells-that-work"],
  related: ["shopify-upsell-app", "shopify-bundles", "increase-aov-shopify"],
  faq: [
    {
      q: "What is the difference between cross selling and upselling?",
      a: "Cross selling offers a different product that goes with the one in the cart, like a case with a phone. Upselling offers more of the same product or a better version of it. CRO Toolbox has <a href=\"/shopify-upsell-app/\">upsell offers</a> and cross sell offers.",
    },
    {
      q: "Are cross sell products added to the cart automatically?",
      a: "No. The shopper ticks the products they want and adds them in one click; nothing is ticked in advance.",
    },
    {
      q: "Does the cross sell discount apply at checkout?",
      a: "Yes. The percentage off the offered products applies at checkout while a trigger product is also in the cart, however the products were added.",
    },
    {
      q: "Can I show cross sells in the cart drawer?",
      a: "Yes. An offer can appear on the product page, the cart page and the cart drawer. Offers inside your theme's own cart drawer work with Dawn and Dawn based themes.",
    },
    {
      q: "How do I add frequently bought together on Shopify?",
      a: "In CRO Toolbox open Bundles, create a Frequently bought together bundle, pick two or three items and a discount, and save. The box shows on the product page of every item in the set, and Shopify applies the discount at checkout when the whole set is in the cart.",
    },
    {
      q: "Which plan do I need?",
      a: `${plansLine}. The ${PLANS.free.name} plan allows ${freeLimits()}. Paid plans start at ${money(cheapestPaid.monthly)} a month, with unlimited offers on at once. See <a href="/pricing/">pricing</a>.`,
    },
  ],
};

export default page;
