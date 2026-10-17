/**
 * Section designs, Admin API side: one $app:cro_design metaobject per section (handle = section key)
 * whose "config" field holds the storefront-ready JSON.
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { copyingFromFirst, slotted } from "./design-slot.server";
import { COUNTDOWN_PLACES, toStorefrontCountdownBar, withCountdownBarDefaults, type CountdownBarConfig, type CountdownPlace } from "./designs";
import { toStorefrontReviews, withReviewsDefaults, type ReviewsDesign, type ReviewsPlace } from "./reviews-design";
import { toStorefrontShippingBar, withShippingBarDefaults, type ShippingBarConfig } from "./shipping-bar";
import { toStorefrontPills, withPillsDefaults, type CollectionPillsConfig } from "./collection-pills";
import { toStorefrontStock, withStockDefaults, type StockDesign } from "./stock-design";
import { toStorefrontDelivery, withDeliveryDefaults, type DeliveryDesign } from "./delivery-design";
import { toStorefrontPersonalize, withPersonalizeDefaults, type PersonalizeDesign } from "./personalize-design";
import { toStorefrontCartExtras, withCartExtrasDefaults, type CartExtrasDesign } from "./cart-extras-design";
import { toStorefrontSizeGuide, withSizeGuideDefaults, type SizeGuideDesign } from "./size-guide";
import { toStorefrontWishlist, withWishlistDefaults, type WishlistDesign } from "./wishlist-design";
import { toStorefrontQuiz, withQuizDefaults, type QuizDesign } from "./quiz-design";
import { toStorefrontOrderPage, withOrderPageDefaults, type OrderPageDesign, type OrderPageKind } from "./order-pages";
import { toStorefrontAddons, withAddonsDefaults, type AddonsConfig } from "./addons";
import { toStorefrontVideoCarousel, withVideoCarouselDefaults, type VideoCarouselDesign } from "./video-carousel-design";
import { toStorefrontCrossSell, withCrossSellDefaults, type CrossSellDesign } from "./cross-sell-design";
import { toStorefrontFaq, withFaqDefaults, type FaqDesign } from "./faq-design";
import { toStorefrontLogos, withLogosDefaults, type LogosDesign } from "./logos-design";
import { toStorefrontAnnouncement, withAnnouncementDefaults, type AnnouncementDesign } from "./announcement-design";
import { toStorefrontQuickAdd, withQuickAddDefaults, type QuickAddDesign } from "./quick-add-design";
import { toStorefrontBundle, withBundleDesignDefaults, type BundleDesign } from "./bundle-design";
import { toStorefrontUpsell, withUpsellDefaults, type UpsellDesign } from "./upsell-design";
import { toStorefrontImageCarousel, withImageCarouselDefaults, type ImageCarouselConfig } from "./image-carousel";

/**
 * "See it on my store": unsaved changes stored as "<key>_draft". Blocks show the draft only inside the
 * theme editor (request.design_mode), so shoppers keep the saved design. Saving copies the live
 * design over the draft.
 */
export async function saveDraft(admin: AdminClient, key: string, storefront: unknown) {
  await upsert(admin, "$app:cro_design", slotted(`${key}_draft`), { config: JSON.stringify(storefront) });
}

async function readDesign(admin: AdminClient, handle: string): Promise<unknown> {
  const data = await gql(
    admin,
    `#graphql
    query CroDesign($handle: String!) {
      metaobjectByHandle(handle: { type: "$app:cro_design", handle: $handle }) { field(key: "config") { value } }
    }`,
    { handle },
  );
  try {
    return JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
  } catch {
    return null;
  }
}

/** The open design's copy (design N: "<key>_N…"); a new, unsaved design N can start from design 1. */
async function getDesign(admin: AdminClient, handle: string): Promise<unknown> {
  const own = await readDesign(admin, slotted(handle));
  if (own === null && copyingFromFirst()) return readDesign(admin, handle);
  return own;
}

const countdownHandle = (place: CountdownPlace) => COUNTDOWN_PLACES.find((p) => p.key === place)!.handle;

export async function getCountdownBar(admin: AdminClient, place: CountdownPlace = "header"): Promise<{ config: CountdownBarConfig; saved: boolean }> {
  const raw = await getDesign(admin, countdownHandle(place));
  return { config: withCountdownBarDefaults(raw, place), saved: raw !== null };
}

export async function saveCountdownBar(admin: AdminClient, config: CountdownBarConfig, place: CountdownPlace = "header", draftOnly = false) {
  const clean = withCountdownBarDefaults(config, place);
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted(countdownHandle(place)), { config: JSON.stringify(toStorefrontCountdownBar(clean)) });
  await upsert(admin, "$app:cro_design", slotted(`${countdownHandle(place)}_draft`), { config: JSON.stringify(toStorefrontCountdownBar(clean)) });
  return clean;
}

/* ------------------------------------------------------------ image carousel -- */
export async function getImageCarousel(admin: AdminClient): Promise<{ config: ImageCarouselConfig; saved: boolean }> {
  // The editor's copy (file ids, empty slides) is kept apart from the lean storefront copy.
  const raw = await getDesign(admin, "image_carousel_editor");
  return { config: withImageCarouselDefaults(raw), saved: raw !== null };
}

/** Looks up each slide's image (CDN address and size) so the storefront needs no extra Liquid. */
async function imageFiles(admin: AdminClient, ids: string[]) {
  const out = new Map<string, { url: string; width: number; height: number }>();
  if (!ids.length) return out;
  const data = await gql(
    admin,
    `#graphql
    query CroCarouselImages($ids: [ID!]!) {
      nodes(ids: $ids) { ... on MediaImage { id image { url width height } } }
    }`,
    { ids },
  );
  for (const n of data.nodes ?? []) {
    if (n?.image?.url) out.set(n.id, { url: n.image.url, width: n.image.width ?? 1000, height: n.image.height ?? 1000 });
  }
  return out;
}

export async function saveImageCarousel(admin: AdminClient, config: ImageCarouselConfig, draftOnly = false) {
  const clean = withImageCarouselDefaults(config);
  const images = await imageFiles(admin, [...new Set(clean.slides.flatMap((s) => (s.image ? [s.image.id] : [])))]);
  const missing = clean.slides.filter((s) => s.image && !images.has(s.image.id)).length;
  const storefront = toStorefrontImageCarousel(clean, images);
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("image_carousel"), { config: JSON.stringify(storefront) });
  await upsert(admin, "$app:cro_design", slotted("image_carousel_draft"), { config: JSON.stringify(storefront) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("image_carousel_editor"), { config: JSON.stringify(clean) });
  return { config: clean, missing };
}

/* ------------------------------------------------------------------- add-ons -- */
export async function getAddons(admin: AdminClient): Promise<{ config: AddonsConfig; saved: boolean }> {
  const raw = await getDesign(admin, "addons_editor");
  return { config: withAddonsDefaults(raw), saved: raw !== null };
}

export async function saveAddons(admin: AdminClient, config: AddonsConfig, draftOnly = false) {
  const clean = withAddonsDefaults(config);
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("addons"), { config: JSON.stringify(toStorefrontAddons(clean)) });
  await upsert(admin, "$app:cro_design", slotted("addons_draft"), { config: JSON.stringify(toStorefrontAddons(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("addons_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ---------------------------------------------------------- collection pills -- */
export async function getPills(admin: AdminClient): Promise<{ config: CollectionPillsConfig; saved: boolean }> {
  const raw = await getDesign(admin, "collection_pills_editor");
  return { config: withPillsDefaults(raw), saved: raw !== null };
}

export async function savePills(admin: AdminClient, config: CollectionPillsConfig, draftOnly = false) {
  const clean = withPillsDefaults(config);
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("collection_pills"), { config: JSON.stringify(toStorefrontPills(clean)) });
  await upsert(admin, "$app:cro_design", slotted("collection_pills_draft"), { config: JSON.stringify(toStorefrontPills(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("collection_pills_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------------------ shipping bar -- */
export async function getShippingBar(admin: AdminClient): Promise<{ config: ShippingBarConfig; saved: boolean }> {
  const raw = await getDesign(admin, "shipping_bar_editor");
  return { config: withShippingBarDefaults(raw), saved: raw !== null };
}

export async function saveShippingBar(admin: AdminClient, config: ShippingBarConfig, draftOnly = false) {
  const clean = withShippingBarDefaults(config);
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("shipping_bar"), { config: JSON.stringify(toStorefrontShippingBar(clean)) });
  await upsert(admin, "$app:cro_design", slotted("shipping_bar_draft"), { config: JSON.stringify(toStorefrontShippingBar(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("shipping_bar_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* -------------------------------------------------------------- reviews -- */
/** Home and other pages: "reviews"; product pages have their own design: "reviews_product". */
const reviewsKey = (place: ReviewsPlace) => (place === "product" ? "reviews_product" : "reviews");

export async function getReviewsDesign(admin: AdminClient, place: ReviewsPlace = "home"): Promise<{ config: ReviewsDesign; saved: boolean }> {
  const raw = await getDesign(admin, `${reviewsKey(place)}_editor`);
  return { config: withReviewsDefaults(raw, place), saved: raw !== null };
}

export async function saveReviewsDesign(admin: AdminClient, config: ReviewsDesign, draftOnly = false, place: ReviewsPlace = "home") {
  const key = reviewsKey(place);
  const clean = withReviewsDefaults(config, place);
  const img = clean.fill.image ? (await imageFiles(admin, [clean.fill.image.id])).get(clean.fill.image.id) : undefined;
  clean.fill.imageUrl = img?.url ?? null;
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted(key), { config: JSON.stringify(toStorefrontReviews(clean)) });
  await upsert(admin, "$app:cro_design", slotted(`${key}_draft`), { config: JSON.stringify(toStorefrontReviews(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted(`${key}_editor`), { config: JSON.stringify(clean) });
  return clean;
}

/* --------------------------------------------------------------- upsell -- */
export async function getUpsellDesign(admin: AdminClient): Promise<{ config: UpsellDesign; saved: boolean }> {
  const raw = await getDesign(admin, "upsell_editor");
  return { config: withUpsellDefaults(raw), saved: raw !== null };
}

export async function saveUpsellDesign(admin: AdminClient, config: UpsellDesign) {
  const clean = withUpsellDefaults(config);
  const live = JSON.stringify(toStorefrontUpsell(clean));
  await upsert(admin, "$app:cro_design", slotted("upsell"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("upsell_editor"), { config: JSON.stringify(clean) });
  await upsert(admin, "$app:cro_design", slotted("upsell_draft"), { config: live });
  return clean;
}

/* -------------------------------------------------------- video carousel -- */
export async function getVideoCarouselDesign(admin: AdminClient): Promise<{ config: VideoCarouselDesign; saved: boolean }> {
  const raw = await getDesign(admin, "videos_editor");
  return { config: withVideoCarouselDefaults(raw), saved: raw !== null };
}

export async function saveVideoCarouselDesign(admin: AdminClient, config: VideoCarouselDesign) {
  const clean = withVideoCarouselDefaults(config);
  const live = JSON.stringify(toStorefrontVideoCarousel(clean));
  await upsert(admin, "$app:cro_design", slotted("videos"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("videos_editor"), { config: JSON.stringify(clean) });
  await upsert(admin, "$app:cro_design", slotted("videos_draft"), { config: live });
  return clean;
}

/* -------------------------------------------------------- bundle builder -- */
export async function getBundleDesign(admin: AdminClient): Promise<{ config: BundleDesign; saved: boolean }> {
  const raw = await getDesign(admin, "bundles_editor");
  return { config: withBundleDesignDefaults(raw), saved: raw !== null };
}

export async function saveBundleDesign(admin: AdminClient, config: BundleDesign) {
  const clean = withBundleDesignDefaults(config);
  const live = JSON.stringify(toStorefrontBundle(clean));
  await upsert(admin, "$app:cro_design", slotted("bundles"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("bundles_editor"), { config: JSON.stringify(clean) });
  await upsert(admin, "$app:cro_design", slotted("bundles_draft"), { config: live });
  return clean;
}

/* ------------------------------------------------------------- cross sell -- */
export async function getCrossSellDesign(admin: AdminClient): Promise<{ config: CrossSellDesign; saved: boolean }> {
  const raw = await getDesign(admin, "cross_sell_editor");
  return { config: withCrossSellDefaults(raw), saved: raw !== null };
}

export async function saveCrossSellDesign(admin: AdminClient, config: CrossSellDesign, draftOnly = false) {
  const clean = withCrossSellDefaults(config);
  const live = JSON.stringify(toStorefrontCrossSell(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("cross_sell"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("cross_sell_draft"), { config: live });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("cross_sell_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ---------------------------------------------------------- announcement -- */
export async function getAnnouncementDesign(admin: AdminClient): Promise<{ config: AnnouncementDesign; saved: boolean }> {
  const raw = await getDesign(admin, "announcement_editor");
  return { config: withAnnouncementDefaults(raw), saved: raw !== null };
}

export async function saveAnnouncementDesign(admin: AdminClient, config: AnnouncementDesign, draftOnly = false) {
  const clean = withAnnouncementDefaults(config);
  const live = JSON.stringify(toStorefrontAnnouncement(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("announcement"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("announcement_draft"), { config: live });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("announcement_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------------------- quick add -- */
export async function getQuickAddDesign(admin: AdminClient): Promise<{ config: QuickAddDesign; saved: boolean }> {
  const raw = await getDesign(admin, "quick_add_editor");
  return { config: withQuickAddDefaults(raw), saved: raw !== null };
}

export async function saveQuickAddDesign(admin: AdminClient, config: QuickAddDesign, draftOnly = false) {
  const clean = withQuickAddDefaults(config);
  const live = JSON.stringify(toStorefrontQuickAdd(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("quick_add"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("quick_add_draft"), { config: live });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("quick_add_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ----------------------------------------------------------------- logos -- */
export async function getLogosDesign(admin: AdminClient): Promise<{ config: LogosDesign; saved: boolean }> {
  const raw = await getDesign(admin, "logos_editor");
  return { config: withLogosDefaults(raw), saved: raw !== null };
}

export async function saveLogosDesign(admin: AdminClient, config: LogosDesign, draftOnly = false) {
  const clean = withLogosDefaults(config);
  const live = JSON.stringify(toStorefrontLogos(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("logos"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("logos_draft"), { config: live });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("logos_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------------------------- faq -- */
export async function getFaqDesign(admin: AdminClient): Promise<{ config: FaqDesign; saved: boolean }> {
  const raw = await getDesign(admin, "faq_editor");
  return { config: withFaqDefaults(raw), saved: raw !== null };
}

export async function saveFaqDesign(admin: AdminClient, config: FaqDesign, draftOnly = false) {
  const clean = withFaqDefaults(config);
  const live = JSON.stringify(toStorefrontFaq(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("faq"), { config: live });
  await upsert(admin, "$app:cro_design", slotted("faq_draft"), { config: live });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("faq_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------- back in stock & pre-order -- */
export async function getStockDesign(admin: AdminClient): Promise<{ config: StockDesign; saved: boolean }> {
  const raw = await getDesign(admin, "stock_editor");
  return { config: withStockDefaults(raw), saved: raw !== null };
}

export async function saveStockDesign(admin: AdminClient, config: StockDesign, draftOnly = false) {
  const clean = withStockDefaults(config);
  const store = JSON.stringify(toStorefrontStock(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("stock"), { config: store });
  await upsert(admin, "$app:cro_design", slotted("stock_draft"), { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("stock_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------- track order & returns pages -- */
const orderPageKey = (kind: OrderPageKind) => (kind === "track" ? "track_page" : "returns_page");

export async function getOrderPage(admin: AdminClient, kind: OrderPageKind): Promise<{ config: OrderPageDesign; saved: boolean }> {
  const raw = await getDesign(admin, `${orderPageKey(kind)}_editor`);
  return { config: withOrderPageDefaults(raw, kind), saved: raw !== null };
}

export async function saveOrderPage(admin: AdminClient, kind: OrderPageKind, config: OrderPageDesign, draftOnly = false) {
  const clean = withOrderPageDefaults(config, kind);
  const key = orderPageKey(kind);
  const store = JSON.stringify(toStorefrontOrderPage(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted(key), { config: store });
  await upsert(admin, "$app:cro_design", slotted(`${key}_draft`), { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted(`${key}_editor`), { config: JSON.stringify(clean) });
  return clean;
}

/* ---------------------------------------------------------- delivery estimate -- */
export async function getDeliveryDesign(admin: AdminClient): Promise<{ config: DeliveryDesign; saved: boolean }> {
  const raw = await getDesign(admin, "delivery_editor");
  return { config: withDeliveryDefaults(raw), saved: raw !== null };
}

export async function saveDeliveryDesign(admin: AdminClient, config: DeliveryDesign, draftOnly = false) {
  const clean = withDeliveryDefaults(config);
  const store = JSON.stringify(toStorefrontDelivery(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("delivery"), { config: store });
  await upsert(admin, "$app:cro_design", slotted("delivery_draft"), { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("delivery_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------------------- personalization -- */
export async function getPersonalizeDesign(admin: AdminClient): Promise<{ config: PersonalizeDesign; saved: boolean }> {
  const raw = await getDesign(admin, "personalize_editor");
  return { config: withPersonalizeDefaults(raw), saved: raw !== null };
}

export async function savePersonalizeDesign(admin: AdminClient, config: PersonalizeDesign, draftOnly = false) {
  const clean = withPersonalizeDefaults(config);
  const store = JSON.stringify(toStorefrontPersonalize(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("personalize"), { config: store });
  await upsert(admin, "$app:cro_design", slotted("personalize_draft"), { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("personalize_editor"), { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------- gift note & delivery date -- */
export async function getCartExtras(admin: AdminClient): Promise<{ config: CartExtrasDesign; saved: boolean }> {
  const raw = await getDesign(admin, "cart_extras_editor");
  return { config: withCartExtrasDefaults(raw), saved: raw !== null };
}

export async function saveCartExtras(admin: AdminClient, config: CartExtrasDesign, draftOnly = false) {
  const clean = withCartExtrasDefaults(config);
  const store = JSON.stringify(toStorefrontCartExtras(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", "cart_extras", { config: store });
  await upsert(admin, "$app:cro_design", "cart_extras_draft", { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "cart_extras_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------------------------ wishlist -- */
export async function getWishlist(admin: AdminClient): Promise<{ config: WishlistDesign; saved: boolean }> {
  const raw = await getDesign(admin, "wishlist_editor");
  return { config: withWishlistDefaults(raw), saved: raw !== null };
}

export async function saveWishlist(admin: AdminClient, config: WishlistDesign, draftOnly = false) {
  const clean = withWishlistDefaults(config);
  const store = JSON.stringify(toStorefrontWishlist(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", "wishlist", { config: store });
  await upsert(admin, "$app:cro_design", "wishlist_draft", { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "wishlist_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* ----------------------------------------------------------------- size guide -- */
export async function getSizeGuide(admin: AdminClient): Promise<{ config: SizeGuideDesign; saved: boolean }> {
  const raw = await getDesign(admin, "size_guide_editor");
  return { config: withSizeGuideDefaults(raw), saved: raw !== null };
}

export async function saveSizeGuide(admin: AdminClient, config: SizeGuideDesign, draftOnly = false) {
  const clean = withSizeGuideDefaults(config);
  const store = JSON.stringify(toStorefrontSizeGuide(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", "size_guide", { config: store });
  await upsert(admin, "$app:cro_design", "size_guide_draft", { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "size_guide_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* ---------------------------------------------------------------- product quiz -- */
export async function getQuiz(admin: AdminClient): Promise<{ config: QuizDesign; saved: boolean }> {
  const raw = await getDesign(admin, "quiz_editor");
  return { config: withQuizDefaults(raw), saved: raw !== null };
}

export async function saveQuiz(admin: AdminClient, config: QuizDesign, draftOnly = false) {
  const clean = withQuizDefaults(config);
  const store = JSON.stringify(toStorefrontQuiz(clean));
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("quiz"), { config: store });
  await upsert(admin, "$app:cro_design", slotted("quiz_draft"), { config: store });
  if (!draftOnly) await upsert(admin, "$app:cro_design", slotted("quiz_editor"), { config: JSON.stringify(clean) });
  return clean;
}
