/**
 * Section designs, Admin API side: one $app:cro_design metaobject per section (handle = section key)
 * whose "config" field holds the storefront-ready JSON.
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { toStorefrontCountdownBar, withCountdownBarDefaults, type CountdownBarConfig } from "./designs";
import { toStorefrontPills, withPillsDefaults, type CollectionPillsConfig } from "./collection-pills";
import { toStorefrontHeader, withHeaderDefaults, type HeaderConfig } from "./header";
import { toStorefrontAddons, withAddonsDefaults, type AddonsConfig } from "./addons";
import { toStorefrontImageCarousel, withImageCarouselDefaults, type ImageCarouselConfig } from "./image-carousel";

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

export async function getCountdownBar(admin: AdminClient): Promise<{ config: CountdownBarConfig; saved: boolean }> {
  const raw = await getDesign(admin, "countdown_bar");
  return { config: withCountdownBarDefaults(raw), saved: raw !== null };
}

export async function saveCountdownBar(admin: AdminClient, config: CountdownBarConfig) {
  const clean = withCountdownBarDefaults(config);
  await upsert(admin, "$app:cro_design", "countdown_bar", { config: JSON.stringify(toStorefrontCountdownBar(clean)) });
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

export async function saveImageCarousel(admin: AdminClient, config: ImageCarouselConfig) {
  const clean = withImageCarouselDefaults(config);
  const images = await imageFiles(admin, [...new Set(clean.slides.flatMap((s) => (s.image ? [s.image.id] : [])))]);
  const missing = clean.slides.filter((s) => s.image && !images.has(s.image.id)).length;
  const storefront = toStorefrontImageCarousel(clean, images);
  await upsert(admin, "$app:cro_design", "image_carousel", { config: JSON.stringify(storefront) });
  await upsert(admin, "$app:cro_design", "image_carousel_editor", { config: JSON.stringify(clean) });
  return { config: clean, missing };
}

/* ------------------------------------------------------------------- add-ons -- */
export async function getAddons(admin: AdminClient): Promise<{ config: AddonsConfig; saved: boolean }> {
  const raw = await getDesign(admin, "addons_editor");
  return { config: withAddonsDefaults(raw), saved: raw !== null };
}

export async function saveAddons(admin: AdminClient, config: AddonsConfig) {
  const clean = withAddonsDefaults(config);
  await upsert(admin, "$app:cro_design", "addons", { config: JSON.stringify(toStorefrontAddons(clean)) });
  await upsert(admin, "$app:cro_design", "addons_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* -------------------------------------------------------------------- header -- */
export async function getHeader(admin: AdminClient): Promise<{ config: HeaderConfig; saved: boolean }> {
  const raw = await getDesign(admin, "header_editor");
  return { config: withHeaderDefaults(raw), saved: raw !== null };
}

export async function saveHeader(admin: AdminClient, config: HeaderConfig) {
  const clean = withHeaderDefaults(config);
  const logo = clean.logo.image ? (await imageFiles(admin, [clean.logo.image.id])).get(clean.logo.image.id) : undefined;
  clean.logo.url = logo?.url ?? null;
  await upsert(admin, "$app:cro_design", "header", { config: JSON.stringify(toStorefrontHeader(clean, clean.logo.url)) });
  await upsert(admin, "$app:cro_design", "header_editor", { config: JSON.stringify(clean) });
  return clean;
}

/* ---------------------------------------------------------- collection pills -- */
export async function getPills(admin: AdminClient): Promise<{ config: CollectionPillsConfig; saved: boolean }> {
  const raw = await getDesign(admin, "collection_pills_editor");
  return { config: withPillsDefaults(raw), saved: raw !== null };
}

export async function savePills(admin: AdminClient, config: CollectionPillsConfig) {
  const clean = withPillsDefaults(config);
  await upsert(admin, "$app:cro_design", "collection_pills", { config: JSON.stringify(toStorefrontPills(clean)) });
  await upsert(admin, "$app:cro_design", "collection_pills_editor", { config: JSON.stringify(clean) });
  return clean;
}
