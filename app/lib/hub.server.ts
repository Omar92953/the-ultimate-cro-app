/**
 * Everything the hubs (Storefront, Cart, Checkout) and Home show about the store's features, in one
 * read: counts, theme status, saved designs, checkout rules. Remembered per shop by the callers
 * (key "hub", short-cache.server.ts).
 */
import { errorMessage, type AdminClient } from "./admin.server";
import { editorLinks, getDiscountStatus, getSavedSections, getSettings, getSlides, getThemeStatus, hasCartTransform, listBundles, listRules } from "./cro.server";
import type { DiscountMode } from "./types";
import { listItems, sectionLinks } from "./sections.server";
import { getBoosters } from "./boosters.server";
import { getAddons, getHeader, getImageCarousel, getPills, getShippingBar } from "./designs.server";
import { DEFAULT_BOOSTERS } from "./boosters";
import { SECTION_KINDS, itemStatus, type SectionKind } from "./sections";
import { getCheckoutRules } from "./checkout-rules.server";
import { getThankYou } from "./thank-you.server";
import { getPostPurchase } from "./post-purchase.server";
import { gql } from "./admin.server";
import { SEC_KINDS, type SecKind } from "./cro-sections";

/** The CRO sections the merchant has saved at least once (their "<kind>_editor" design exists). One read for all nine. */
async function savedSecs(admin: AdminClient): Promise<SecKind[]> {
  const data = await gql(admin, `#graphql
    query CroSecHandles { metaobjects(type: "$app:cro_design", first: 250) { nodes { handle } } }`);
  const have = new Set<string>((data.metaobjects?.nodes ?? []).map((m: { handle: string }) => m.handle));
  return SEC_KINDS.filter((k) => have.has(`${k}_editor`));
}

function settled<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === "fulfilled" ? r.value : fallback;
}

export async function loadHub(admin: AdminClient, session: { shop: string }) {
  // Everything at once: none of these reads depends on another.
  const firstWave = Promise.allSettled([
    getSettings(admin),
    listRules(admin),
    getSlides(admin),
    listBundles(admin),
    getThemeStatus(admin, session.shop),
    getDiscountStatus(admin),
    hasCartTransform(admin),
  ]);
  const secondWave = Promise.all([
    Promise.allSettled(SECTION_KINDS.map((k) => listItems(admin, k))),
    getBoosters(admin).catch(() => DEFAULT_BOOSTERS),
    getSavedSections(admin).catch(() => [] as string[]),
    getImageCarousel(admin).catch(() => null),
    getAddons(admin).catch(() => null),
    getPills(admin).catch(() => null),
    getShippingBar(admin).catch(() => null),
    getHeader(admin).catch(() => null),
    getCheckoutRules(admin).catch(() => null),
    getThankYou(admin).catch(() => null),
    getPostPurchase(admin).catch(() => null),
    savedSecs(admin).catch(() => [] as SecKind[]),
    getImageCarousel(admin, "coverflow").catch(() => null),
  ]);
  const [[settings, rules, slides, bundles, theme, discount, transform], [lists, boosters, saved, carousel, addons, pills, shipBar, header, checkout, thankYou, postPurchase, secSaved, coverflow]] = await Promise.all([firstWave, secondWave]);
  const ruleList = settled(rules, []);
  const sectionCounts = Object.fromEntries(
    SECTION_KINDS.map((k, i) => {
      const items = settled(lists[i], []);
      return [k, { total: items.length, shown: items.filter((it) => itemStatus(k, it).tone === "ok").length }];
    }),
  ) as Record<SectionKind, { total: number; shown: number }>;
  return {
    boosters,
    saved,
    // null: the store hasn't granted the checkout scopes yet (or the read failed).
    checkout: checkout
      ? {
          payment: checkout.payment.id ? (checkout.payment.enabled ? checkout.payment.rules.filter((r) => r.on).length : -1) : 0,
          delivery: checkout.delivery.id ? (checkout.delivery.enabled ? checkout.delivery.rules.filter((r) => r.on).length : -1) : 0,
          limits: checkout.validation.id ? (checkout.validation.enabled ? checkout.validation.rules.filter((r) => r.on).length : -1) : 0,
        }
      : null,
    thankYou: thankYou ? thankYou.config.modules.filter((m) => m.on).length : 0,
    postPurchase: postPurchase ? (postPurchase.config.on ? "on" : postPurchase.config.product ? "off" : "none") : "none",
    pillCount: pills ? pills.config.items.length : 0,
    shipBarSaved: !!shipBar?.saved,
    headerSaved: !!header?.saved,
    secSaved,
    addonCount: addons ? addons.config.items.length + (addons.config.message.on ? 1 : 0) : 0,
    carouselImages: carousel ? carousel.config.slides.filter((x) => x.image).length : 0,
    coverflowImages: coverflow ? coverflow.config.slides.filter((x) => x.image).length : 0,
    sectionCounts,
    // Reviews written on the store, waiting for the merchant's approval.
    pendingReviews: settled(lists[SECTION_KINDS.indexOf("reviews")], []).filter((it) => it.values.pending === true).length,
    sectionLinks: sectionLinks(session.shop),
    shop: session.shop,
    links: editorLinks(session.shop),
    settings: settled(settings, { cross_sell_enabled: true, upsell_enabled: true, videos_enabled: true, bundles_enabled: true }),
    counts: {
      cross_sell: ruleList.filter((r) => r.kind === "cross_sell" && r.active).length,
      upsell: ruleList.filter((r) => r.kind === "upsell" && r.active).length,
      drawer: ruleList.filter((r) => r.kind === "cross_sell" && r.active && r.placements.includes("drawer")).length,
      videos: settled(slides, []).length,
      bundles: settled(bundles, []).filter((b) => b.active).length,
    },
    theme: theme.status === "fulfilled" ? theme.value : null,
    themeError: theme.status === "rejected" ? errorMessage(theme.reason) : null,
    discount: settled(discount, {
      id: null,
      status: null,
      needed: false,
      mode: "auto" as DiscountMode,
      engine: "function" as const,
      reason: "",
      nativeCount: 0,
    }),
    cartTransform: settled(transform, false),
    loadError: [settings, rules].find((r) => r.status === "rejected") ? "Some data could not be loaded. Refresh to try again." : null,
  };
}

