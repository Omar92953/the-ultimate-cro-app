/**
 * Tutorial videos on Home — the ONLY list of them. Placeholders until Omar records them.
 *
 * HOW TO ADD A VIDEO: upload it to YouTube, open it, and copy the ID from the address
 * (youtube.com/watch?v=THIS_PART). Paste it as `youtubeId` on that tutorial below. Done: the card
 * appears on Home, and the video plays on the website's tutorials page.
 * Cards without a `youtubeId` are hidden on Home (no "coming soon" cards).
 *
 * The website's tutorials page (site/src/pages/tutorials.astro) reads THIS list, so both show the
 * same titles. If you ever change how it is shown, update the other place too.
 */
import type { FeatureKey } from "./catalog";

export type Tutorial = {
  title: string;
  /** "2:30" */
  length: string;
  /** Which feature it teaches (its card links to the feature too). */
  feature: FeatureKey | null;
  youtubeId: string | null;
};

// PLACEHOLDERS — no videos recorded yet (Omar).
export const TUTORIALS: Tutorial[] = [
  { title: "Set up CRO Toolbox in 5 steps", length: "5:00", feature: null, youtubeId: null },
  { title: "Create your first offer", length: "3:00", feature: "upsell", youtubeId: null },
  { title: "Mix and match bundles and fixed bundles", length: "4:00", feature: "bundles", youtubeId: null },
  { title: "Add storefront sections to your theme", length: "3:00", feature: "reviews", youtubeId: null },
  { title: "Bars: announcement, countdown, free shipping", length: "2:30", feature: "announcements", youtubeId: null },
  { title: "Cart offers, gift notes and the free shipping bar", length: "3:30", feature: "cart_offers", youtubeId: null },
  { title: "Payment and delivery rules", length: "3:00", feature: "payment_rules", youtubeId: null },
  { title: "Read your Analytics", length: "2:30", feature: null, youtubeId: null },
];

export const tutorialEmbedUrl = (t: Tutorial) => (t.youtubeId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.youtubeId)}?autoplay=1&rel=0` : null);
export const tutorialWatchUrl = (t: Tutorial) => (t.youtubeId ? `https://www.youtube.com/watch?v=${encodeURIComponent(t.youtubeId)}` : null);

/** "What's new" on Home, newest first. Keep it to a few short lines. */
export const WHATS_NEW: { date: string; text: string; href?: string }[] = [
  { date: "Oct 2026", text: "Offers in four groups: Upsell, Cross sell, Bundles and Discounts.", href: "/app/offers" },
  { date: "Oct 2026", text: "New plans: Free covers up to 50 orders a month.", href: "/app/plans" },
  { date: "Oct 2026", text: "A new menu: Offers, Storefront, Cart, Checkout and Analytics.", href: "/app/offers" },
  { date: "Oct 2026", text: "Bundle products, price tiers and option pricing.", href: "/app/offers/new" },
  { date: "Oct 2026", text: "After-purchase offer: a one-click offer right after payment.", href: "/app/checkout/after-purchase" },
  { date: "Sep 2026", text: "Thank-you page modules and checkout order limits.", href: "/app/checkout" },
  { date: "Sep 2026", text: "Analytics: see what the app's offers sell, and run a holdout test.", href: "/app/analytics" },
];
