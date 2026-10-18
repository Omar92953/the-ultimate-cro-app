/**
 * /shopify-bundles/: main search "shopify bundles app", also "mix and match", "quantity breaks".
 * Facts from the help guides (bundles, upsell-offers), the mix and match article and lib/features.ts;
 * the six bundle types from app/lib/bundle-recipes.ts; plans from app/lib/plans.ts.
 */
import { BUNDLE_RECIPES, PLANS, FEATURE_PLAN, cheapestPaid, money, plain } from "../lib/app";
import type { KeywordPage } from "../lib/keywords";
import { freeLimits } from "../lib/plan-lines";
import { FEATURE_COPY } from "../lib/features";

const bundlesPlan = PLANS[FEATURE_PLAN.bundles].name;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const typeNames = BUNDLE_RECIPES.map((r) => plain(r.title).replace(/ \(.*\)$/, "").toLowerCase());
const list = (items: string[]) => `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const page: KeywordPage = {
  slug: "shopify-bundles",
  order: 30,
  menu: "Bundles app",
  keyword: "Shopify bundles app",
  title: `Shopify bundles app: ${BUNDLE_RECIPES.length} bundle types, mix and match and quantity breaks`,
  description: `CRO Toolbox is a Shopify bundles app with ${BUNDLE_RECIPES.length} bundle types, from frequently bought together to mix and match boxes, plus quantity breaks. Shopify prices each bundle at checkout.`,
  ogTitle: "A Shopify bundles app with six bundle types",
  kicker: "Bundles",
  h1: "Shopify bundles app: every way to sell products together",
  answer: `A bundles app lets shoppers buy several products together for one price or a discount, and makes sure Shopify charges that price at checkout and counts each item's stock. CRO Toolbox has ${BUNDLE_RECIPES.length} bundle types on Shopify (${list(typeNames)}) plus quantity breaks, in one app.`,
  updated: "2026-10-18",
  shot: { name: "bundles/mixmatch", alt: "A pick 3 candle box on a product page of a demo store, with candles to choose from", caption: "A mix and match box on a demo store." },
  sections: [
    {
      heading: "What a Shopify bundles app does",
      paragraphs: [
        "A bundle sells products together: a gift set, a starter kit, a box the shopper fills, or any 3 for one price. The app shows the bundle on your store, lets shoppers pick the items when the bundle allows it, and passes the bundle price to Shopify so the shopper pays exactly what the page said.",
        "Two things decide whether a bundles app works for you: the bundle types you need, and what happens at checkout (the price, and the stock of each item).",
      ],
    },
    {
      heading: "How CRO Toolbox does bundles",
      list: FEATURE_COPY.bundles.points.map((t) => plain(t)),
      after: ["Every bundle type has its own editor with numbered steps on the left and a live preview on the right, using your real products and prices."],
    },
    {
      heading: "Mix and match bundles",
      paragraphs: ["In a mix and match bundle the shopper fills a box from a collection, for example any 3 candles. You set how it is priced: one price for the box, a percentage off the picks, or tiers by item count such as any 3 for $30 and any 6 for $55."],
      steps: [
        "Open <b>Bundles → Create bundle</b> and choose <b>Mix and match</b>.",
        "Let the app create and publish the bundle product for you, or pick one you have.",
        "Add steps, for example \"Pick 3 candles\" (min 3, max 3). A step can use a whole collection.",
        "Choose the price: one price, a percentage off, or tiers.",
        "Click <b>Add to theme</b> in the editor's \"Get it on your store\" card once.",
      ],
      after: ["Full walkthrough: <a href=\"/blog/mix-and-match-bundles-on-shopify/\">mix and match bundles on Shopify</a>."],
    },
    {
      heading: "Quantity breaks",
      paragraphs: [
        "Quantity breaks are bundles of one product: Buy 2, save 10% and Buy 3, save 15%. In CRO Toolbox they are upsell offers, with a size picker per item so Buy 2 can be one M and one L. See <a href=\"/shopify-upsell-app/\">Shopify upsell app</a>.",
      ],
    },
    {
      heading: "What happens at checkout",
      paragraphs: [
        "Customers pay exactly the bundle's price. At checkout a bundle the shopper built is split into the items they picked, so each item's stock goes down and the items appear on the order; in the cart the picks show as one bundle line. A fixed bundle is one product made with Shopify's own bundles, and Shopify tracks its stock from its items.",
        plain(FEATURE_COPY.bundles.note ?? ""),
      ],
    },
  ],
  table: {
    heading: `The ${BUNDLE_RECIPES.length} bundle types`,
    caption: "Each bundle type in CRO Toolbox, what it is and what it is best for",
    head: ["Bundle type", "What shoppers get", "Best for"],
    rows: BUNDLE_RECIPES.map((r) => [plain(r.title), plain(r.about), cap(plain(r.best).replace(/^Best for /, ""))]),
    note: `Every bundle type is on the ${bundlesPlan} plan and above. Try each one on the demo store below.`,
  },
  features: ["bundles", "upsell", "discounts"],
  demos: BUNDLE_RECIPES.map((r) => ({ label: `${plain(r.title).replace(/ \(.*\)$/, "")} demo`, feature: "bundles" as const, recipe: r.key })),
  help: ["bundles", "upsell-offers"],
  useCases: ["bundles-for-beauty-brands", "food-and-drink-mixed-cases"],
  articles: ["mix-and-match-bundles-on-shopify", "best-shopify-bundle-apps-compared", "how-to-add-frequently-bought-together-to-shopify"],
  related: ["shopify-cross-sell", "shopify-upsell-app", "increase-aov-shopify"],
  faq: [
    {
      q: "What kinds of bundles can I make on Shopify with CRO Toolbox?",
      a: `${BUNDLE_RECIPES.length}: ${list(BUNDLE_RECIPES.map((r) => plain(r.title).toLowerCase()))}. Quantity breaks on one product are upsell offers.`,
    },
    {
      q: "How does a mix and match bundle work?",
      a: "The shopper picks items from a collection on the bundle's own page, for one price, a percentage off or tier prices. You set the steps, for example \"Pick 3 candles\", with a minimum and a maximum for each.",
    },
    {
      q: "Does each item's stock go down when a bundle sells?",
      a: "Yes. At checkout a bundle the shopper built is split into the items they picked, so each item's stock goes down and the items appear on the order. A fixed bundle is made with Shopify's own bundles, which tracks its stock from its items.",
    },
    {
      q: "Do bundle prices work on every Shopify plan?",
      a: plain(FEATURE_COPY.bundles.note ?? ""),
    },
    {
      q: "Can shoppers build a bundle while they browse?",
      a: "Yes, with the Build your own bundle type. Shoppers add items from product pages and collection pages with \"+ Add to bundle\", and a bundle tray follows them with each step's progress until they add the bundle to the cart.",
    },
    {
      q: "Which plan do I need for bundles?",
      a: `Every bundle type is on the ${bundlesPlan} plan. The ${PLANS.free.name} plan allows ${freeLimits()}; paid plans start at ${money(cheapestPaid.monthly)} a month with unlimited offers on at once. See <a href="/pricing/">pricing</a>.`,
    },
  ],
};

export default page;
