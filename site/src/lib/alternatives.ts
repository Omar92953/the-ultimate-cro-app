/**
 * "X alternative" pages (/compare/<slug>-alternative/), docs/plans/seo-geo.md §3: for merchants looking
 * to switch from another app. Rules (same as competitors.ts): facts about the other app only from its
 * own Shopify App Store listing, opened on CHECKED_ALT, with a link; no ratings, no guesses. `listing`
 * holds what the listing said that day (name, developer, launch date, plans, what it says it does).
 * Check the listings again when you touch this file and update CHECKED_ALT.
 *
 * Everything about CRO Toolbox comes from the app's catalog.ts and plans.ts.
 */
import { PLANS, FEATURE_PLAN, type FeatureKey } from "./app";
import type { PageMeta } from "./pages";
import type { QA } from "../components/Faq.astro";
import { SOURCE_PLAN } from "../../../app/lib/tracking";
import { LIVE_TRACKING } from "../../../app/lib/plans";

const livePlan = PLANS[SOURCE_PLAN.live].name;
const savingPlan = PLANS[FEATURE_PLAN.return_saving].name;

/** What the other app's own Shopify App Store listing said on CHECKED_ALT. */
export type Listing = {
  url: string;
  /** The listing's title. */
  title: string;
  developer: string;
  launched: string;
  /** Plans and prices, one line each, as listed (USD). */
  pricing: string[];
  /** What the listing says the app does, in short plain lines. */
  says: string[];
};

export type Alternative = {
  /** The address: /compare/<slug>-alternative/. */
  slug: string;
  /** The app's usual name, as merchants search for it. */
  name: string;
  listing: Listing;
  /** The job merchants compare it on (from the SEO plan, not from the app's pages). */
  job: string;
  /** Meta description: must contain "<name> alternative", under 200 characters. */
  description: string;
  /** CRO Toolbox features that do this job. */
  features: FeatureKey[];
  /** Keyword pages (src/keywords/) on the same topic; ones that don't exist yet are left out. */
  keywordPages: string[];
  /** An existing /compare/cro-toolbox-vs-<slug>/ page. */
  compare?: string;
  /** Switching tips for this kind of app (facts about Shopify or CRO Toolbox only). */
  tips: string[];
  /** Questions for this page, after the shared ones. */
  faq: QA[];
};

/** The day the other apps' listings were opened and the facts below copied. */
export const CHECKED_ALT = "October 20, 2026";

/** "a Bundler alternative", "an AfterShip alternative". */
export const article = (name: string) => (/^[aeiou]/i.test(name) ? "an" : "a");
export const altPath = (a: Pick<Alternative, "slug">) => `/compare/${a.slug}-alternative/`;
export const altMeta = (a: Alternative): PageMeta => ({
  slug: `alt-${a.slug}`,
  path: altPath(a),
  title: `${a.name} alternative for Shopify: CRO Toolbox`,
  description: a.description,
  ogTitle: `${article(a.name) === "an" ? "An" : "A"} ${a.name} alternative`,
  ogKicker: "Compare",
});

export const ALTERNATIVES: Alternative[] = [
  {
    slug: "reconvert",
    name: "ReConvert",
    listing: {
      url: "https://apps.shopify.com/reconvert-upsell-cross-sell",
      title: "ReConvert Post Purchase Upsell",
      developer: "Upsell.com ex ReConvert",
      launched: "September 26, 2018",
      pricing: [
        "Free: up to 50 orders or $50 upsell revenue a month",
        "Growth $9.99 a month: 51 to 100 store orders",
        "Growth $19.99 a month: 101 to 200 store orders",
        "Growth $39.99 a month: 201 to 500 store orders",
        "14 day free trial on paid plans",
      ],
      says: [
        "Now called Upsell.com, formerly ReConvert.",
        "Upsell and cross sell offers on the product page, cart, checkout and thank you page; checkout upsells need Shopify Plus.",
        "One click post purchase upsell funnels.",
        "AI product recommendations, frequently bought together, bundles, quantity breaks, free gifts and upsell pop ups.",
      ],
    },
    job: "offers after checkout and on the thank you page",
    description: "Looking for a ReConvert alternative? CRO Toolbox has a one click offer after payment, thank you page modules, upsells and cross sells for Shopify, with a free plan.",
    features: ["post_purchase", "thank_you", "upsell", "cross_sell"],
    keywordPages: ["post-purchase-upsell-shopify", "shopify-upsell-app"],
    tips: [
      "Shopify shows the after purchase offer of one app: in Settings → Checkout, under Post purchase page, choose CRO Toolbox.",
      "Check the thank you page after a test order, so shoppers don't see modules from two apps.",
    ],
    faq: [
      {
        q: "Does CRO Toolbox have a one click offer after payment?",
        a: "Yes. One product at a discount right after payment, added to the same order and shipment without entering card details again. Shopify shows it for card and Shop Pay payments.",
      },
    ],
  },
  {
    slug: "frequently-bought-together",
    name: "Frequently Bought Together",
    listing: {
      url: "https://apps.shopify.com/frequently-bought-together",
      title: "Frequently Bought Together CBB",
      developer: "Code Black Belt",
      launched: "March 15, 2017",
      pricing: [
        "Starter: free, up to 3 manual bundles",
        "Professional I $9.99 a month: up to 50 orders a month",
        "Professional II $24.99 a month: up to 500 orders a month",
        "Professional III $39.99 a month: over 500 orders a month",
        "14 day free trial on paid plans",
      ],
      says: [
        "AI, manual and global bundle recommendations with one click add to cart.",
        "Four bundle discount types: percentage, fixed, free item or free shipping.",
        "The widget shows on product and cart pages.",
        "Star ratings from review apps such as Judge.me, Loox and Yotpo.",
      ],
    },
    job: "a frequently bought together box on product pages",
    description: "Looking for a Frequently Bought Together alternative? CRO Toolbox has a frequently bought together box with a set discount, cross sells in the cart and five more bundle types.",
    features: ["bundles", "cross_sell", "cart_offers"],
    keywordPages: ["shopify-cross-sell", "shopify-bundles"],
    tips: [
      "In CRO Toolbox the box is a bundle: open Bundles, create a Frequently bought together bundle and pick two or three items and a discount. It shows on the product page of every item in the set.",
      "Remove the old app's block or embed in the theme editor, so product pages don't show two boxes.",
    ],
    faq: [
      {
        q: "Does the set discount apply at checkout?",
        a: "Yes. Shopify applies it when all the items of the set are in the cart, even if the shopper added them one by one.",
      },
    ],
  },
  {
    slug: "bundler",
    name: "Bundler",
    listing: {
      url: "https://apps.shopify.com/bundler-product-bundles",
      title: "Bundler » Product Bundles App",
      developer: "Bundler.app",
      launched: "July 2, 2019",
      pricing: [
        "Free: Buy X get Y, volume discounts and quantity breaks, product page upsells, Shopify POS",
        "Premium $9.99 a month: adds mix and match, custom landing pages, free shipping and funnel upsells",
        "Executive $19.99 a month: adds bundle analytics",
        "7 day free trial on paid plans",
      ],
      says: [
        "Quantity breaks, classic bundles, mix and match bundles and tiered discounts.",
        "Discounts by percentage, fixed amount or fixed price.",
        "Bundle landing pages and upsell and cross sell offers.",
        "Works with Shopify POS.",
      ],
    },
    job: "product bundles and bundle discounts",
    description: "Looking for a Bundler alternative? CRO Toolbox has six bundle types, from mix and match boxes to any 3 for one price, plus quantity breaks, priced by Shopify at checkout.",
    features: ["bundles", "upsell", "discounts"],
    keywordPages: ["shopify-bundles"],
    compare: "bundler",
    tips: [
      "Make each bundle again in CRO Toolbox: Bundles → Create bundle asks what you want to sell and opens the right editor, with your real products and prices in the preview.",
      "Remove the old app's blocks in the theme editor before you add CRO Toolbox's, so a product page shows one bundle builder.",
    ],
    faq: [
      {
        q: "Does stock go down for each item in a bundle?",
        a: "Yes. At checkout a bundle the shopper built is split into the items they picked, so each item's stock goes down. A fixed bundle uses Shopify's own bundles, which tracks its stock from its items.",
      },
    ],
  },
  {
    slug: "aftership",
    name: "AfterShip",
    listing: {
      url: "https://apps.shopify.com/aftership",
      title: "AfterShip Order Tracking",
      developer: "AfterShip",
      launched: "May 9, 2012",
      pricing: [
        "Free: 50 shipments a month",
        "Essentials $11 a month or $108 a year: 100 shipments a month, then $0.08 per extra shipment",
        "Premium $70 a month or $708 a year: 500 shipments a month, then $0.12 per extra shipment",
        "7 day free trial; $1 for the first month on paid plans",
      ],
      says: [
        "A branded tracking page and email and SMS shipment notifications, across 1,100+ carriers.",
        "A shipment dashboard and analytics reports.",
        "AI estimated delivery dates on product and checkout pages.",
        "Product recommendations on the tracking page.",
      ],
    },
    job: "an order tracking page",
    description: "Looking for an AfterShip alternative? CRO Toolbox adds a Track your order page to your Shopify store, with the delivery status, carrier link, dates and product rows.",
    features: ["track", "returns"],
    keywordPages: ["shopify-order-tracking-page", "shopify-returns-app"],
    tips: [
      "Click Make the pages in Tracking & Returns: the app creates a Track your order page in your store.",
      "Point your menu, footer and any links to your old tracking page at the new page.",
    ],
    faq: [
      {
        q: "Where does the tracking information come from?",
        a: LIVE_TRACKING ? `From Shopify's tracking data by default. On ${livePlan}, live tracking shows where the parcel is now from most carriers; you can also use your own key or a webhook link.` : `From Shopify's tracking data by default. On ${livePlan}, you can also use your own key from a shipping company or tracking service, or a webhook link.`,
      },
    ],
  },
  {
    slug: "loop-returns",
    name: "Loop Returns",
    listing: {
      url: "https://apps.shopify.com/loop-returns",
      title: "Loop Returns & Exchanges",
      developer: "Loop",
      launched: "May 27, 2021",
      pricing: [
        "Checkout+: free, with returns software, US and Canada domestic return labels and package protection",
        "Essential $155 a month: adds unlimited destinations, automated return policies, carrier rate shopping and workflows",
        "Advanced $340 a month: adds Shop Now, instant exchange, bonus credit and fraud prevention",
      ],
      says: [
        "Returns, exchanges, order editing, tracking and fraud prevention.",
        "Exchanges encouraged with bonus credit, Shop Now and instant exchanges.",
        "Workflows, custom rules and blocklists against return fraud.",
        "Works with Shopify POS.",
      ],
    },
    job: "returns and exchanges",
    description: `Looking for a Loop Returns alternative? CRO Toolbox has a returns page that creates real Shopify returns, plus exchanges and store credit with a bonus on ${savingPlan}.`,
    features: ["returns", "return_saving", "track"],
    keywordPages: ["shopify-returns-app", "shopify-order-tracking-page"],
    tips: [
      "Finish the returns already open in the old app, or handle them in Shopify, before you switch.",
      "Click Make the pages in Tracking & Returns, set your return window and address, and add the Returns page to your menu or footer.",
    ],
    faq: [
      {
        q: "Does CRO Toolbox create real Shopify returns?",
        a: "Yes. Each request from the Returns page becomes a Shopify return you approve or decline in the app, and Shopify emails the shopper.",
      },
    ],
  },
];

for (const a of ALTERNATIVES) {
  const k = `${a.name} alternative`.toLowerCase();
  if (!a.description.toLowerCase().includes(k)) throw new Error(`Alternative ${a.slug}: the description must contain "${a.name} alternative"`);
  if (a.description.length > 200) throw new Error(`Alternative ${a.slug}: the description is ${a.description.length} characters (keep it under 200)`);
}
