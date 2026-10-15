/**
 * Title and description of every page, in one list: the pages use them for their <title> and meta
 * description, and /og/<slug>.png draws each page's share image from them.
 * Prices in descriptions come from the app's plans.ts.
 */
import { plans, cheapestPaid, money, trialDays } from "./app";

const paidList = plans.filter((p) => p.monthly > 0).map((p) => `${p.name} ${money(p.monthly)}`);
const free = plans.find((p) => p.monthly === 0)?.name ?? "Free";

export type PageMeta = {
  slug: string;
  path: string;
  /** The <title>; " | CRO Toolbox" is added unless it already names the app. */
  title: string;
  description: string;
  /** Short line on the share image (defaults to the title). */
  ogTitle?: string;
  ogKicker?: string;
};

export const PAGES = {
  home: {
    slug: "home",
    path: "/",
    title: "CRO Toolbox: upsells, bundles, cart drawer and more for Shopify",
    description:
      `CRO Toolbox is one Shopify app for upsells, cross sells, six kinds of bundles, discounts, a cart drawer, reviews, countdowns and checkout rules. Works with any Online Store 2.0 theme, no code. Free plan, paid plans from ${money(cheapestPaid.monthly)} a month.`,
    ogTitle: "Sell more per order, with one app",
    ogKicker: "Shopify app",
  },
  pricing: {
    slug: "pricing",
    path: "/pricing/",
    title: "Pricing",
    description:
      `CRO Toolbox pricing: ${free}, ${paidList.slice(0, -1).join(", ")} and ${paidList.at(-1)} a month, or yearly. Every paid plan has a ${trialDays} day free trial. See what each plan includes and its orders per month.`,
    ogTitle: "Simple pricing. Free plan included.",
    ogKicker: "Pricing",
  },
  support: {
    slug: "support",
    path: "/support/",
    title: "Support",
    description: "How to get help with CRO Toolbox: contact support, what to include in your message and where to find setup guides.",
    ogTitle: "We're here to help",
    ogKicker: "Support",
  },
  privacy: {
    slug: "privacy",
    path: "/privacy/",
    title: "Privacy policy",
    description: "What data the CRO Toolbox Shopify app and this website collect, why, where it's kept and how it's deleted.",
    ogKicker: "Legal",
  },
  terms: {
    slug: "terms",
    path: "/terms/",
    title: "Terms of service",
    description: "The terms for using the CRO Toolbox Shopify app and this website.",
    ogKicker: "Legal",
  },
} satisfies Record<string, PageMeta>;

export const ALL_PAGES: PageMeta[] = Object.values(PAGES);
