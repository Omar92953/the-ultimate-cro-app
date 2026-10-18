/**
 * Product recommendations under the order on the Track page (Growth): "You may also like" and "Complete your
 * order". Candidates come from the order's own collections, the store's bought together data, or products
 * the merchant picked. Never products already in the order, only active ones with something in stock.
 * Only public product data goes to the page; the add to cart happens in the shopper's browser.
 */
import { gql, type AdminClient } from "./admin.server";

export type RecSource = "together" | "collection" | "picks";
export type RecRequest = { count: number; rows: { key: "like" | "complete"; source: RecSource; picks: string[] }[] };
export type RecProduct = { handle: string; title: string; image: string | null; price: string; currency: string; variantId: number };

const HANDLE = /^[a-z0-9][a-z0-9_-]{0,254}$/;

/** The request as the page sent it, cleaned: at most two rows, 8 products, handles that look like handles. */
export function readRecRequest(raw: unknown): RecRequest | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!o || !Array.isArray(o.rows)) return null;
  const rows = o.rows.slice(0, 2).flatMap((r) => {
    const x = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
    const key = x.key === "complete" ? "complete" : x.key === "like" ? "like" : null;
    const source = x.source === "together" || x.source === "picks" || x.source === "collection" ? x.source : null;
    if (!key || !source) return [];
    const picks = Array.isArray(x.picks) ? x.picks.map(String).filter((h) => HANDLE.test(h)).slice(0, 12) : [];
    return [{ key, source, picks } as RecRequest["rows"][number]];
  });
  return rows.length ? { count: Math.min(8, Math.max(1, Math.round(Number(o.count) || 4))), rows } : null;
}

async function boughtMap(admin: AdminClient): Promise<Record<string, string[]>> {
  const d = await gql(admin, `#graphql
    query CroBoughtTogetherMap { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "bought_together" }) { field(key: "config") { value } } }`);
  try {
    return JSON.parse(d.metaobjectByHandle?.field?.value ?? "{}")?.map ?? {};
  } catch {
    return {};
  }
}

type Related = { id: string; handle: string; collections: { nodes: { products: { nodes: { handle: string }[] } }[] } };

export async function trackRecs(admin: AdminClient, orderProductIds: string[], req: RecRequest): Promise<Record<"like" | "complete", RecProduct[]>> {
  const out: Record<"like" | "complete", RecProduct[]> = { like: [], complete: [] };
  const ids = [...new Set(orderProductIds)].slice(0, 6);
  if (!ids.length && !req.rows.some((r) => r.source === "picks")) return out;
  const own = ids.length ? ((await gql(admin, `#graphql
    query CroTrackRelated($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id handle collections(first: 2) { nodes { products(first: 8) { nodes { handle } } } } } } }`, { ids })).nodes as (Related | null)[]).filter((n): n is Related => !!n && !!n.handle) : [];
  const inOrder = new Set(own.map((p) => p.handle));
  const together: Record<string, string[]> = req.rows.some((r) => r.source === "together") ? await boughtMap(admin).catch(() => ({})) : {};

  const candidates = (r: RecRequest["rows"][number]): string[] => {
    if (r.source === "picks") return r.picks;
    if (r.source === "together") return ids.flatMap((id) => together[id.split("/").pop()!] ?? []);
    return own.flatMap((p) => p.collections.nodes.flatMap((c) => c.products.nodes.map((n) => n.handle)));
  };
  const wanted = req.rows.map((r) => ({ key: r.key, handles: [...new Set(candidates(r))].filter((h) => !inOrder.has(h)).slice(0, 20) }));
  const all = [...new Set(wanted.flatMap((w) => w.handles))].slice(0, 30);
  if (!all.length) return out;
  const d = await gql(admin, `#graphql
    query CroTrackRecs($q: String!, $n: Int!) { products(first: $n, query: $q) { nodes { handle title status featuredMedia { preview { image { url } } } priceRangeV2 { minVariantPrice { amount currencyCode } } variants(first: 20) { nodes { id availableForSale price } } } } }`, { q: all.map((h) => `handle:${h}`).join(" OR "), n: all.length });
  const byHandle = new Map<string, RecProduct>();
  for (const p of d.products.nodes as { handle: string; title: string; status: string; featuredMedia?: { preview?: { image?: { url?: string } } }; priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } }; variants: { nodes: { id: string; availableForSale: boolean }[] } }[]) {
    const v = p.variants.nodes.find((x) => x.availableForSale);
    if (p.status !== "ACTIVE" || !v) continue;
    byHandle.set(p.handle, { handle: p.handle, title: p.title, image: p.featuredMedia?.preview?.image?.url ?? null, price: p.priceRangeV2.minVariantPrice.amount, currency: p.priceRangeV2.minVariantPrice.currencyCode, variantId: Number(v.id.split("/").pop()) });
  }
  const shown = new Set<string>();
  for (const w of wanted) {
    for (const h of w.handles) {
      const p = byHandle.get(h);
      // A product shows in one row only.
      if (p && !shown.has(h) && out[w.key].length < req.count) {
        out[w.key].push(p);
        shown.add(h);
      }
    }
  }
  return out;
}
