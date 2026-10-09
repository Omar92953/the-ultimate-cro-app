/**
 * Real products for design-page previews, so offers and bundles look the way they will on the store:
 * title, picture, price, variants (with their options) and the handle (to open that page in the
 * theme editor).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- GraphQL node payloads */
import { gql, type AdminClient } from "./admin.server";
import type { Rule } from "./types";

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

export async function productById(admin: AdminClient, id: string) {
  const d = await gql(admin, `#graphql\n query CroPreviewProduct($id: ID!) { product(id: $id) { ${FIELDS} } }`, { id });
  return toProduct(d.product);
}

export async function firstInCollection(admin: AdminClient, id: string) {
  const d = await gql(admin, `#graphql\n query CroPreviewCollection($id: ID!) { collection(id: $id) { products(first: 1) { nodes { ${FIELDS} } } } }`, { id });
  return toProduct(d.collection?.products?.nodes?.[0]);
}

export async function firstProduct(admin: AdminClient) {
  const d = await gql(admin, `#graphql\n query CroPreviewFirst { products(first: 1, query: "status:active", sortKey: UPDATED_AT, reverse: true) { nodes { ${FIELDS} } } }`);
  return toProduct(d.products?.nodes?.[0]);
}

/** The product an offer rule shows on: its first trigger product, a product in its collection, or any product. */
export async function productForRule(admin: AdminClient, r: Rule): Promise<PreviewProduct | null> {
  try {
    if (r.triggerType === "products" && r.triggerProducts[0]) return await productById(admin, r.triggerProducts[0].id);
    if (r.triggerType === "collections" && r.triggerCollections[0]) return (await firstInCollection(admin, r.triggerCollections[0].id)) ?? (await firstProduct(admin));
    return await firstProduct(admin);
  } catch {
    return null;
  }
}

