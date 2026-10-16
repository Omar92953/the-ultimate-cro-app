/**
 * "Frequently bought together" learned from the store's own orders: for each product, the products
 * most often in the same order. Score = how often they're bought with it (confidence), with lift
 * (how much more than chance) breaking ties; a pair needs at least 2 shared orders. The top 4 per
 * product are stored as handles in $app:cro_design "bought_together", which the Cross sell block reads.
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";

const PAGES = 15; // 40 orders a page: up to 600 recent orders (Shopify shows the last 60 days without extra access)
const TOP = 4;

export type BoughtTogether = { at: string; orders: number; pairs: number; map: Record<string, string[]> };

export async function computeBoughtTogether(admin: AdminClient): Promise<BoughtTogether> {
  const baskets: string[][] = [];
  const handle = new Map<string, string>();
  let after: string | null = null;
  for (let page = 0; page < PAGES; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { lineItems: { nodes: { product: { id: string; handle: string; status: string } | null }[] } }[] } } = await gql(
      admin,
      `#graphql
      query CroOrderPairs($after: String) {
        orders(first: 40, after: $after, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          nodes { lineItems(first: 20) { nodes { product { id handle status } } } }
        }
      }`,
      { after },
    );
    for (const o of data.orders.nodes) {
      const ids = [...new Set(o.lineItems.nodes.flatMap((l) => (l.product && l.product.status === "ACTIVE" ? [l.product.id.split("/").pop()!] : [])))];
      o.lineItems.nodes.forEach((l) => l.product && handle.set(l.product.id.split("/").pop()!, l.product.handle));
      if (ids.length) baskets.push(ids);
    }
    if (!data.orders.pageInfo.hasNextPage) break;
    after = data.orders.pageInfo.endCursor;
  }
  const map = scorePairs(baskets, handle);
  const result = { at: new Date().toISOString(), orders: baskets.length, pairs: Object.keys(map).length, map };
  await upsert(admin, "$app:cro_design", "bought_together", { config: JSON.stringify(result) });
  return result;
}

export async function getBoughtTogether(admin: AdminClient): Promise<Omit<BoughtTogether, "map"> | null> {
  const data = await gql(admin, `#graphql
    query CroBoughtTogether { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "bought_together" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    return v ? { at: v.at, orders: v.orders, pairs: v.pairs } : null;
  } catch {
    return null;
  }
}

/** Recomputed when older than a week (called from the Cross sell design page). */
export async function refreshIfOld(admin: AdminClient) {
  const now = await getBoughtTogether(admin).catch(() => null);
  if (now && Date.now() - Date.parse(now.at) < 7 * 86_400_000) return now;
  return computeBoughtTogether(admin).catch(() => now);
}

/** For each product id: the handles of up to TOP products most often in the same orders. */
export function scorePairs(baskets: string[][], handle: Map<string, string>): Record<string, string[]> {
  const single = new Map<string, number>();
  const pair = new Map<string, number>();
  for (const b of baskets) {
    for (const a of b) single.set(a, (single.get(a) ?? 0) + 1);
    for (const a of b) for (const c of b) if (a !== c) pair.set(`${a}|${c}`, (pair.get(`${a}|${c}`) ?? 0) + 1);
  }
  const n = baskets.length || 1;
  const best = new Map<string, { id: string; conf: number; lift: number }[]>();
  for (const [k, count] of pair) {
    if (count < 2) continue;
    const [a, c] = k.split("|");
    const conf = count / single.get(a)!;
    const lift = conf / (single.get(c)! / n);
    if (lift <= 1) continue;
    const list = best.get(a) ?? [];
    list.push({ id: c, conf, lift });
    best.set(a, list);
  }
  const map: Record<string, string[]> = {};
  for (const [a, list] of best) {
    map[a] = list
      .sort((x, y) => y.conf - x.conf || y.lift - x.lift)
      .slice(0, TOP)
      .map((x) => handle.get(x.id)!)
      .filter(Boolean);
  }
  return map;
}
