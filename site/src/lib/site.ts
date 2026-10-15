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

export type NavLink = { label: string; href: string };

/** Header menu. Pages are added here as they ship. */
export const NAV: NavLink[] = [
  { label: "Features", href: "/features/" },
  { label: "Bundles", href: "/bundles/" },
  { label: "Use cases", href: "/use-cases/" },
  { label: "Compare", href: "/compare/" },
  { label: "Pricing", href: "/pricing/" },
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
      { label: "FAQ", href: "/#faq" },
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
