/**
 * Real products for design-page previews, so offers and bundles look the way they will on the store:
 * title, picture, price, variants (with their options) and the handle (to open that page in the
 * theme editor).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- GraphQL node payloads */
import { gql, type AdminClient } from "./admin.server";
import { remember } from "./short-cache.server";
import type { Rule } from "./types";

/** With `shop`, a read is fresh for 1 min and then answered from memory while it refreshes, for
 * 30 min (products change rarely; this saves a round of Admin API calls on most design pages). */
const cached = <T>(shop: string | undefined, key: string, load: () => Promise<T>) => (shop ? remember(shop, `preview|${key}`, 60000, load, 1800000) : load());

export type PreviewProduct = {
  title: string;
  handle: string;
  image: string | null;
  cents: number;
  currency: string;
  variants: { title: string; cents: number; options: Record<string, string> }[];
};

const FIELDS = `title handle featuredMedia { preview { image { url } } }
  priceRangeV2 { minVariantPrice { amount currencyCode } }
  variants(first: 50) { nodes { title price selectedOptions { name value } } }`;

function toProduct(p: any): PreviewProduct | null {
  if (!p) return null;
  const m = p.priceRangeV2?.minVariantPrice;
  return {
    title: p.title ?? "",
    handle: p.handle ?? "",
    image: p.featuredMedia?.preview?.image?.url ?? null,
    cents: Math.round(Number(m?.amount ?? 0) * 100),
    currency: m?.currencyCode ?? "USD",
    variants: (p.variants?.nodes ?? []).map((v: any) => ({
      title: v.title,
      cents: Math.round(Number(v.price ?? 0) * 100),
      options: Object.fromEntries((v.selectedOptions ?? []).map((o: any) => [String(o.name).toLowerCase(), String(o.value)])),
    })),
  };
}

export function productById(admin: AdminClient, id: string, shop?: string) {
  return cached(shop, `p|${id}`, async () => {
    const d = await gql(admin, `#graphql\n query CroPreviewProduct($id: ID!) { product(id: $id) { ${FIELDS} } }`, { id });
    return toProduct(d.product);
  });
}

export function firstInCollection(admin: AdminClient, id: string, shop?: string) {
  return cached(shop, `c|${id}`, async () => {
    const d = await gql(admin, `#graphql\n query CroPreviewCollection($id: ID!) { collection(id: $id) { products(first: 1) { nodes { ${FIELDS} } } } }`, { id });
    return toProduct(d.collection?.products?.nodes?.[0]);
  });
}

export function firstProduct(admin: AdminClient, shop?: string) {
  return cached(shop, "first", async () => {
    const d = await gql(admin, `#graphql\n query CroPreviewFirst { products(first: 1, query: "status:active", sortKey: UPDATED_AT, reverse: true) { nodes { ${FIELDS} } } }`);
    return toProduct(d.products?.nodes?.[0]);
  });
}

/** The product an offer rule shows on: its first trigger product, a product in its collection, or any product. */
export async function productForRule(admin: AdminClient, r: Rule, shop?: string): Promise<PreviewProduct | null> {
  try {
    if (r.triggerType === "products" && r.triggerProducts[0]) return await productById(admin, r.triggerProducts[0].id, shop);
    if (r.triggerType === "collections" && r.triggerCollections[0]) return (await firstInCollection(admin, r.triggerCollections[0].id, shop)) ?? (await firstProduct(admin, shop));
    return await firstProduct(admin, shop);
  } catch {
    return null;
  }
}

