/**
 * The website's addresses and contact details, in one place.
 *
 * SITE_URL: the site's own address (canonical links, sitemap, Open Graph). Set SITE_URL in the
 * host's environment for preview builds. Default: the suggested domain, until Omar picks one.
 *
 * INSTALL_URL: the App Store listing. Empty until the listing is live: every Install button then
 * goes to the "Get notified" section on the home page instead.
 */
export const SITE_URL = (process.env.SITE_URL || "https://crotoolbox.com").replace(/\/$/, "");

/** TODO(Omar): the App Store listing link, once it's live (e.g. https://apps.shopify.com/cro-toolbox). */
export const INSTALL_URL = "";

/** TODO(Omar): the support email shown on the support, privacy and terms pages. */
export const SUPPORT_EMAIL = "";

export const SITE_NAME = "CRO Toolbox";
/** Who runs the app (Shopify Partner organization). TODO(Omar): legal name and country. */
export const OPERATOR = "OMC";

export const NOTIFY_HREF = "/#get-notified";

/**
 * Search engine verification (Google Search Console, Bing Webmaster Tools): paste the content value
 * of the meta tag each one gives you. Empty = no tag. Verifying through Cloudflare DNS also works.
 */
export const GOOGLE_SITE_VERIFICATION = "";
export const BING_SITE_VERIFICATION = "";

/**
 * IndexNow key: tells Bing (and other IndexNow engines) about new pages within hours. The key file
 * public/<key>.txt holds the same value; .github/workflows/indexnow.yml pings after each deploy.
 */
export const INDEXNOW_KEY = "6f1c2b9e4a7d4c8f9b3e5a1d7c2f8e40";

/**
 * Where an Install button goes. `medium` is the page type (home, pricing…), `campaign` the
 * page slug, so installs per page can be measured in the listing's analytics.
 */
export function installHref(medium: string, campaign: string): string {
  if (!INSTALL_URL) return NOTIFY_HREF;
  const url = new URL(INSTALL_URL);
  url.searchParams.set("utm_source", "crotoolbox_site");
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  return url.toString();
}

export type NavLink = { label: string; href: string; /** A dropdown (desktop) and a section (mobile menu). */ children?: NavLink[] };

/** The Features dropdown: the five areas, then the main features, then everything. Header.astro shows it. */
export const FEATURES_MENU: NavLink[] = [
  { label: "Offers", href: "/features/offers/" },
  { label: "Storefront", href: "/features/storefront/" },
  { label: "Cart", href: "/features/cart/" },
  { label: "Checkout", href: "/features/checkout/" },
  { label: "Analytics", href: "/features/analytics/" },
  { label: "Upsell", href: "/features/upsell/" },
  { label: "Cross sell", href: "/features/cross-sell/" },
  { label: "Bundles", href: "/features/bundles/" },
  { label: "Discounts", href: "/features/discounts/" },
  { label: "Cart drawer", href: "/features/cart-tools/" },
  { label: "Reviews", href: "/features/reviews/" },
  { label: "Countdown timers", href: "/features/countdown/" },
  { label: "Sales pop ups", href: "/features/sales-pop/" },
  { label: "All features", href: "/features/" },
];

/** Header menu. Pages are added here as they ship. */
export const NAV: NavLink[] = [
  { label: "Features", href: "/features/", children: FEATURES_MENU },
  { label: "Bundles", href: "/bundles/" },
  { label: "Use cases", href: "/use-cases/" },
  { label: "Pricing", href: "/pricing/" },
  { label: "Blog", href: "/blog/" },
];

export const FOOTER: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features/" },
      { label: "Bundles", href: "/bundles/" },
      { label: "Pricing", href: "/pricing/" },
      { label: "Compare", href: "/compare/" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { label: "Raise order value", href: "/use-cases/raise-average-order-value/" },
      { label: "Beauty brands", href: "/use-cases/bundles-for-beauty-brands/" },
      { label: "Fashion stores", href: "/use-cases/upsells-for-fashion/" },
      { label: "All use cases", href: "/use-cases/" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Help center", href: "/help/" },
      { label: "Tutorials", href: "/tutorials/" },
      { label: "Blog", href: "/blog/" },
      { label: "Support", href: "/support/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy/" },
      { label: "Terms of service", href: "/terms/" },
    ],
  },
];
