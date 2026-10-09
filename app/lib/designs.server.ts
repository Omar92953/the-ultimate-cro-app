/**
 * Section designs, Admin API side: one $app:cro_design metaobject per section (handle = section key)
 * whose "config" field holds the storefront-ready JSON.
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { COUNTDOWN_PLACES, toStorefrontCountdownBar, withCountdownBarDefaults, type CountdownBarConfig, type CountdownPlace } from "./designs";
import { toStorefrontReviews, withReviewsDefaults, type ReviewsDesign } from "./reviews-design";
import { toStorefrontShippingBar, withShippingBarDefaults, type ShippingBarConfig } from "./shipping-bar";
import { toStorefrontPills, withPillsDefaults, type CollectionPillsConfig } from "./collection-pills";
import { toStorefrontHeader, withHeaderDefaults, type HeaderConfig } from "./header";
import { toStorefrontAddons, withAddonsDefaults, type AddonsConfig } from "./addons";
import { toStorefrontVideoCarousel, withVideoCarouselDefaults, type VideoCarouselDesign } from "./video-carousel-design";
import { toStorefrontBundle, withBundleDesignDefaults, type BundleDesign } from "./bundle-design";
import { toStorefrontUpsell, withUpsellDefaults, type UpsellDesign } from "./upsell-design";
import { toStorefrontImageCarousel, withImageCarouselDefaults, type ImageCarouselConfig } from "./image-carousel";

/**
 * "See it on my store": unsaved changes stored as "<key>_draft". Blocks show the draft only inside the
 * theme editor (request.design_mode), so shoppers keep the saved design. Saving copies the live
 * design over the draft.
 */
export async function saveDraft(admin: AdminClient, key: string, storefront: unknown) {
  await upsert(admin, "$app:cro_design", `${key}_draft`, { config: JSON.stringify(storefront) });
}

async function getDesign(admin: AdminClient, handle: string): Promise<unknown> {
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

const countdownHandle = (place: CountdownPlace) => COUNTDOWN_PLACES.find((p) => p.key === place)!.handle;

export async function getCountdownBar(admin: AdminClient, place: CountdownPlace = "header"): Promise<{ config: CountdownBarConfig; saved: boolean }> {
  const raw = await getDesign(admin, countdownHandle(place));
  return { config: withCountdownBarDefaults(raw, place), saved: raw !== null };
}

export async function saveCountdownBar(admin: AdminClient, config: CountdownBarConfig, place: CountdownPlace = "header", draftOnly = false) {
  const clean = withCountdownBarDefaults(config, place);
  if (!draftOnly) await upsert(admin, "$app:cro_design", countdownHandle(place), { config: JSON.stringify(toStorefrontCountdownBar(clean)) });
  await upsert(admin, "$app:cro_design", `${countdownHandle(place)}_draft`, { config: JSON.stringify(toStorefrontCountdownBar(clean)) });
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
  if (!draftOnly) await upsert(admin, "$app:cro_design", "image_carousel", { config: JSON.stringify(storefront) });
  await upsert(admin, "$app:cro_design", "image_carousel_draft", { config: JSON.stringify(storefront) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "image_carousel_editor", { config: JSON.stringify(clean) });
  return { config: clean, missing };
}

/* ------------------------------------------------------------------- add-ons -- */
export async function getAddons(admin: AdminClient): Promise<{ config: AddonsConfig; saved: boolean }> {
  const raw = await getDesign(admin, "addons_editor");
  return { config: withAddonsDefaults(raw), saved: raw !== null };
}

export async function saveAddons(admin: AdminClient, config: AddonsConfig, draftOnly = false) {
  const clean = withAddonsDefaults(config);
  if (!draftOnly) await upsert(admin, "$app:cro_design", "addons", { config: JSON.stringify(toStorefrontAddons(clean)) });
  await upsert(admin, "$app:cro_design", "addons_draft", { config: JSON.stringify(toStorefrontAddons(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "addons_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* -------------------------------------------------------------------- header -- */
export async function getHeader(admin: AdminClient): Promise<{ config: HeaderConfig; saved: boolean }> {
  const raw = await getDesign(admin, "header_editor");
  return { config: withHeaderDefaults(raw), saved: raw !== null };
}

export async function saveHeader(admin: AdminClient, config: HeaderConfig, draftOnly = false) {
  const clean = withHeaderDefaults(config);
  const logo = clean.logo.image ? (await imageFiles(admin, [clean.logo.image.id])).get(clean.logo.image.id) : undefined;
  clean.logo.url = logo?.url ?? null;
  if (!draftOnly) await upsert(admin, "$app:cro_design", "header", { config: JSON.stringify(toStorefrontHeader(clean, clean.logo.url)) });
  await upsert(admin, "$app:cro_design", "header_draft", { config: JSON.stringify(toStorefrontHeader(clean, clean.logo.url)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "header_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* ---------------------------------------------------------- collection pills -- */
export async function getPills(admin: AdminClient): Promise<{ config: CollectionPillsConfig; saved: boolean }> {
  const raw = await getDesign(admin, "collection_pills_editor");
  return { config: withPillsDefaults(raw), saved: raw !== null };
}

export async function savePills(admin: AdminClient, config: CollectionPillsConfig, draftOnly = false) {
  const clean = withPillsDefaults(config);
  if (!draftOnly) await upsert(admin, "$app:cro_design", "collection_pills", { config: JSON.stringify(toStorefrontPills(clean)) });
  await upsert(admin, "$app:cro_design", "collection_pills_draft", { config: JSON.stringify(toStorefrontPills(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "collection_pills_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* ------------------------------------------------------------ shipping bar -- */
export async function getShippingBar(admin: AdminClient): Promise<{ config: ShippingBarConfig; saved: boolean }> {
  const raw = await getDesign(admin, "shipping_bar_editor");
  return { config: withShippingBarDefaults(raw), saved: raw !== null };
}

export async function saveShippingBar(admin: AdminClient, config: ShippingBarConfig, draftOnly = false) {
  const clean = withShippingBarDefaults(config);
  if (!draftOnly) await upsert(admin, "$app:cro_design", "shipping_bar", { config: JSON.stringify(toStorefrontShippingBar(clean)) });
  await upsert(admin, "$app:cro_design", "shipping_bar_draft", { config: JSON.stringify(toStorefrontShippingBar(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "shipping_bar_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* -------------------------------------------------------------- reviews -- */
export async function getReviewsDesign(admin: AdminClient): Promise<{ config: ReviewsDesign; saved: boolean }> {
  const raw = await getDesign(admin, "reviews_editor");
  return { config: withReviewsDefaults(raw), saved: raw !== null };
}

export async function saveReviewsDesign(admin: AdminClient, config: ReviewsDesign, draftOnly = false) {
  const clean = withReviewsDefaults(config);
  const img = clean.fill.image ? (await imageFiles(admin, [clean.fill.image.id])).get(clean.fill.image.id) : undefined;
  clean.fill.imageUrl = img?.url ?? null;
  if (!draftOnly) await upsert(admin, "$app:cro_design", "reviews", { config: JSON.stringify(toStorefrontReviews(clean)) });
  await upsert(admin, "$app:cro_design", "reviews_draft", { config: JSON.stringify(toStorefrontReviews(clean)) });
  if (!draftOnly) await upsert(admin, "$app:cro_design", "reviews_editor", { config: JSON.stringify(clean) });
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
  await upsert(admin, "$app:cro_design", "upsell", { config: live });
  await upsert(admin, "$app:cro_design", "upsell_editor", { config: JSON.stringify(clean) });
  await upsert(admin, "$app:cro_design", "upsell_draft", { config: live });
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
  await upsert(admin, "$app:cro_design", "videos", { config: live });
  await upsert(admin, "$app:cro_design", "videos_editor", { config: JSON.stringify(clean) });
  await upsert(admin, "$app:cro_design", "videos_draft", { config: live });
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
  await upsert(admin, "$app:cro_design", "bundles", { config: live });
  await upsert(admin, "$app:cro_design", "bundles_editor", { config: JSON.stringify(clean) });
  await upsert(admin, "$app:cro_design", "bundles_draft", { config: live });
  return clean;
}
