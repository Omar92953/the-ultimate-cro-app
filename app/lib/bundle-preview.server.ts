/* eslint-disable @typescript-eslint/no-explicit-any -- Admin API product and collection nodes are read loosely */
/**
 * Real product pictures and prices for bundle previews (the Bundles design page and the bundle
 * editor). Collection steps show their first 8 products.
 */
import { gql, type AdminClient } from "./admin.server";
import type { Bundle } from "./types";
import type { PreviewBundle, PreviewItem } from "../components/BundlePreview";

/** The merchant's bundles with prices and pictures (collection steps: their first 8 products). */
/** Bundle products (tag cro-bundle) are never offered as picks, on the store or in previews. */
const notBundle = (p: any) => !(p?.tags ?? []).includes("cro-bundle");

export async function previewBundles(admin: AdminClient, bundles: Bundle[]): Promise<{ list: PreviewBundle[]; currency: string }> {
  const ids = [...new Set(bundles.flatMap((b) => [...(b.product ? [b.product.id] : []), ...b.steps.flatMap((s) => (s.products.length ? s.products.map((p) => p.id) : s.collection ? [s.collection.id] : []))]))];
  if (!ids.length) return { list: [], currency: "USD" };
  const PRODUCT = `id title handle tags featuredMedia { preview { image { url } } } priceRangeV2 { minVariantPrice { amount currencyCode } }`;
  const data = await gql(
    admin,
    `#graphql
    query CroBundlePreview($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product { ${PRODUCT} }
        ... on Collection { id products(first: 12) { nodes { ${PRODUCT} } } }
      }
    }`,
    { ids },
  );
  let currency = "USD";
  const item = (p: any): PreviewItem => {
    const m = p?.priceRangeV2?.minVariantPrice;
    if (m?.currencyCode) currency = m.currencyCode;
    return { title: p?.title ?? "", image: p?.featuredMedia?.preview?.image?.url ?? null, cents: Math.round(Number(m?.amount ?? 0) * 100) };
  };
  const byId = new Map<string, any>((data.nodes ?? []).filter(Boolean).map((n: any) => [n.id, n]));
  const list = bundles
    .filter((b) => b.steps.length)
    .sort((a, b) => Number(b.active) - Number(a.active))
    .slice(0, 10)
    .map((b) => ({
      name: b.name,
      handle: b.product ? (byId.get(b.product.id)?.handle as string | undefined) : undefined,
      pricing: { kind: b.pricing, percent: b.percentOff, tiers: b.tiers },
      price: b.product ? item(byId.get(b.product.id)).cents : 0,
      steps: b.steps.map((s) => ({
        label: s.label,
        min: s.required ? Math.max(1, s.min) : 0,
        max: Math.max(1, s.max),
        items: (s.products.length ? s.products.map((p) => byId.get(p.id)) : s.collection ? (byId.get(s.collection.id)?.products?.nodes ?? []).filter(notBundle) : []).filter(Boolean).slice(0, 8).map(item),
      })),
    }));
  return { list, currency };
}

/**
 * Items for the editor's live preview, by product or collection id (a collection gives its first
 * 8 products), plus the shop currency.
 */
export async function previewItems(admin: AdminClient, ids: string[]): Promise<{ items: Record<string, PreviewItem[]>; currency: string }> {
  const out: Record<string, PreviewItem[]> = {};
  let currency = "USD";
  const unique = [...new Set(ids)].slice(0, 60);
  if (!unique.length) return { items: out, currency };
  const PRODUCT = `id title tags featuredMedia { preview { image { url } } } priceRangeV2 { minVariantPrice { amount currencyCode } }`;
  const data = await gql(
    admin,
    `#graphql
    query CroBundleEditorPreview($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product { ${PRODUCT} }
        ... on Collection { id products(first: 12) { nodes { ${PRODUCT} } } }
      }
    }`,
    { ids: unique },
  );
  const item = (p: any): PreviewItem => {
    const m = p?.priceRangeV2?.minVariantPrice;
    if (m?.currencyCode) currency = m.currencyCode;
    return { title: p?.title ?? "", image: p?.featuredMedia?.preview?.image?.url ?? null, cents: Math.round(Number(m?.amount ?? 0) * 100) };
  };
  for (const n of (data.nodes ?? []).filter(Boolean)) {
    out[n.id] = n.products ? n.products.nodes.filter(notBundle).slice(0, 8).map(item) : [item(n)];
  }
  return { items: out, currency };
}
