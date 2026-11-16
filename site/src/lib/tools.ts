/**
 * The free tools at /tools/: small calculators built from the maths the articles explain.
 * Each page lives in src/pages/tools/<slug>.astro; this list gives their titles (and share images,
 * through ALL_PAGES), the /tools/ index cards, the related feature and article, and the llms.txt lines.
 */
import type { PageMeta } from "./pages";
import type { FeatureKey } from "./app";

export type Tool = PageMeta & {
  h1: string;
  /** One line for the /tools/ card. */
  card: string;
  feature: FeatureKey;
  /** The article whose maths the tool uses. */
  article: { title: string; href: string };
};

export const TOOLS_PAGE: PageMeta = {
  slug: "tools",
  path: "/tools/",
  title: "Free tools: calculators for Shopify stores",
  description: "Free tools for Shopify stores: a free shipping threshold calculator, a bundle price and margin calculator and a loyalty points value calculator. No sign up.",
  ogTitle: "Free calculators for your store",
  ogKicker: "Free tools",
};

export const TOOLS: Tool[] = [
  {
    slug: "tool-free-shipping-threshold",
    path: "/tools/free-shipping-threshold-calculator/",
    title: "Free shipping threshold calculator for Shopify",
    description:
      "Free shipping threshold calculator: enter your average order, margin and shipping fee to get a threshold to try, what it costs and how many top ups pay for it.",
    ogTitle: "Free shipping threshold calculator",
    ogKicker: "Free tool",
    h1: "Free shipping threshold calculator",
    card: "Find a threshold to try, what free shipping costs you on orders that already qualify, and how many shoppers must top up to pay for it.",
    feature: "shipping_bar",
    article: { title: "How to set a free shipping threshold: the maths, step by step", href: "/blog/free-shipping-threshold-maths/" },
  },
  {
    slug: "tool-bundle-price",
    path: "/tools/bundle-price-calculator/",
    title: "Bundle price calculator: margin and break even",
    description:
      "Bundle price calculator: enter item prices, costs and a discount or fixed price to see the bundle margin against selling separately and the break even uplift.",
    ogTitle: "Bundle price calculator",
    ogKicker: "Free tool",
    h1: "Bundle price calculator",
    card: "Set a percent off or a fixed bundle price and see the margin per bundle against the items sold separately, and the extra sales needed to break even.",
    feature: "bundles",
    article: { title: "Quantity breaks that raise average order value", href: "/blog/quantity-breaks-that-raise-aov/" },
  },
  {
    slug: "tool-loyalty-points",
    path: "/tools/loyalty-points-calculator/",
    title: "Loyalty points calculator: point value and cost",
    description:
      "Loyalty points calculator: see what a point is worth, how much shoppers get back and what your points program costs per order. Free, no sign up.",
    ogTitle: "Loyalty points calculator",
    ogKicker: "Free tool",
    h1: "Loyalty points calculator",
    card: "See what one point is worth, how much shoppers get back, how long the first reward takes and what the program costs per order.",
    feature: "loyalty",
    article: { title: "How to set up a loyalty program on Shopify", href: "/blog/shopify-loyalty-program-setup/" },
  },
];

export const tool = (path: string) => TOOLS.find((t) => t.path === path)!;
