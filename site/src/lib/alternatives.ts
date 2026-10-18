/**
 * "X alternative" pages (/compare/<slug>-alternative/), docs/plans/seo-geo.md §3: for merchants looking
 * to switch from another app. Rules (same as competitors.ts): facts about the other app only from its
 * own public pages, with the date checked and a link. We could not open the other apps' pages from the
 * build environment on CHECKED_ALT, so these pages state nothing about their features or prices and say
 * so; the job each app is compared on comes from the SEO plan. When you check an app's own listing,
 * add what it says here with the source and date, and show it on the page.
 *
 * Everything about CRO Toolbox comes from the app's catalog.ts and plans.ts.
 */
import { PLANS, FEATURE_PLAN, type FeatureKey } from "./app";
import type { PageMeta } from "./pages";
import type { QA } from "../components/Faq.astro";
import { SOURCE_PLAN } from "../../../app/lib/tracking";

const livePlan = PLANS[SOURCE_PLAN.live].name;
const savingPlan = PLANS[FEATURE_PLAN.return_saving].name;

export type Alternative = {
  /** The address: /compare/<slug>-alternative/. */
  slug: string;
  /** The app's usual name, as merchants search for it. */
  name: string;
  /** Its name on the Shopify App Store, as the listing's title shows in search results (not opened). */
  listingName: string;
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

/** The day we tried to open the other apps' own pages. */
export const CHECKED_ALT = "October 18, 2026";

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
/** The other app on the Shopify App Store: a search, so the link works whatever its listing address is. */
export const appStoreSearch = (a: Pick<Alternative, "listingName">) => `https://apps.shopify.com/search?q=${encodeURIComponent(a.listingName)}`;

export const ALTERNATIVES: Alternative[] = [
  {
    slug: "reconvert",
    name: "ReConvert",
    listingName: "ReConvert",
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
    listingName: "Frequently Bought Together CBB",
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
    listingName: "Bundler",
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
    listingName: "AfterShip Order Tracking",
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
        a: `From Shopify's tracking data by default. On ${livePlan}, live tracking shows where the parcel is now from most carriers; you can also use your own key or a webhook link.`,
      },
    ],
  },
  {
    slug: "loop-returns",
    name: "Loop Returns",
    listingName: "Loop Returns & Exchanges",
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
