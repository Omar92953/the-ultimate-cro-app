/* eslint-disable @typescript-eslint/no-explicit-any -- raw Admin API JSON; operations are schema-checked by `npm run graphql-codegen` */
/**
 * Conversion boosters, Admin API side: settings ($app:cro_boosters "main") and the list of recent
 * real purchases for sales pop-ups ($app:cro_recent "main"). No customer names are ever stored;
 * the city only when the merchant turns it on.
 */
import { gql, numericId, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import { withDefaults, type BoostersConfig, type RecentPurchase } from "./boosters";

const KEEP = 20;

export async function getBoosters(admin: AdminClient): Promise<BoostersConfig> {
  const data = await gql(
    admin,
    `#graphql
    query CroBoosters { metaobjectByHandle(handle: { type: "$app:cro_boosters", handle: "main" }) { field(key: "config") { value } } }`,
  );
  const raw = data.metaobjectByHandle?.field?.value;
  try {
    return withDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return withDefaults(null);
  }
}

export async function saveBoosters(admin: AdminClient, config: BoostersConfig) {
  await upsert(admin, "$app:cro_boosters", "main", { config: JSON.stringify(withDefaults(config)) });
}

export async function getRecent(admin: AdminClient): Promise<RecentPurchase[]> {
  const data = await gql(
    admin,
    `#graphql
    query CroRecent { metaobjectByHandle(handle: { type: "$app:cro_recent", handle: "main" }) { field(key: "purchases") { value } } }`,
  );
  try {
    return JSON.parse(data.metaobjectByHandle?.field?.value ?? "[]");
  } catch {
    return [];
  }
}

async function saveRecent(admin: AdminClient, list: RecentPurchase[]) {
  await upsert(admin, "$app:cro_recent", "main", { purchases: JSON.stringify(list.slice(0, KEEP)) });
}

/** Rebuilds the list from the store's latest orders (Boosters page → "Refresh"). */
export async function refreshRecent(admin: AdminClient): Promise<RecentPurchase[]> {
  const { salesPop } = await getBoosters(admin);
  const data = await gql(
    admin,
    salesPop.showCity
      ? `#graphql
        query CroRecentOrdersCity {
          orders(first: 30, sortKey: CREATED_AT, reverse: true) {
            nodes { id createdAt test cancelledAt shippingAddress { city } lineItems(first: 1) { nodes { product { handle title status featuredMedia { preview { image { url } } } } } } }
          }
        }`
      : `#graphql
        query CroRecentOrders {
          orders(first: 30, sortKey: CREATED_AT, reverse: true) {
            nodes { id createdAt test cancelledAt lineItems(first: 1) { nodes { product { handle title status featuredMedia { preview { image { url } } } } } } }
          }
        }`,
  );
  const list: RecentPurchase[] = [];
  for (const o of data.orders.nodes) {
    // Only real, live purchases: no test or cancelled orders, no draft/archived/deleted products.
    if (o.test || o.cancelledAt) continue;
    const p = o.lineItems.nodes[0]?.product;
    if (!p?.handle || p.status !== "ACTIVE") continue;
    list.push({
      product: p.title,
      handle: p.handle,
      image: p.featuredMedia?.preview?.image?.url ?? null,
      city: salesPop.showCity ? (o.shippingAddress?.city ?? null) : null,
      at: o.createdAt,
      order: numericId(o.id),
    });
  }
  await saveRecent(admin, list);
  return list;
}

/** orders/create webhook: put the new purchase at the top of the list. */
export async function addPurchaseFromWebhook(admin: AdminClient, order: any) {
  if (order?.test) return;
  const productId = order?.line_items?.find((l: any) => l.product_id)?.product_id;
  if (!productId) return;
  const orderId = String(order?.id ?? "");
  const data = await gql(
    admin,
    `#graphql
    query CroRecentProduct($id: ID!) { product(id: $id) { handle title status featuredMedia { preview { image { url } } } } }`,
    { id: `gid://shopify/Product/${productId}` },
  );
  const p = data.product;
  if (!p || p.status !== "ACTIVE") return;
  const [{ salesPop }, current] = await Promise.all([getBoosters(admin), getRecent(admin)]);
  // Shopify retries deliveries: the same order is only ever listed once.
  if (orderId && current.some((r) => r.order === orderId)) return;
  const entry: RecentPurchase = {
    product: p.title,
    handle: p.handle,
    image: p.featuredMedia?.preview?.image?.url ?? null,
    city: salesPop.showCity ? (order?.shipping_address?.city ?? null) : null,
    at: order?.created_at ?? new Date().toISOString(),
    order: orderId || undefined,
  };
  await saveRecent(admin, [entry, ...current]);
}

/**
 * customers/redact: drop the listed orders from the sales pop-up list. Entries saved before order
 * ids were kept can't be matched, so those lose their city (the only customer-related detail).
 */
export async function redactRecent(admin: AdminClient, orderIds: (string | number)[]) {
  const ids = new Set(orderIds.map(String));
  const current = await getRecent(admin);
  const next = current
    .filter((r) => !(r.order && ids.has(r.order)))
    .map((r) => (r.order ? r : { ...r, city: null }));
  if (JSON.stringify(next) !== JSON.stringify(current)) await saveRecent(admin, next);
  return current.length - next.length;
}

/** customers/data_request: what the app holds for these orders (product, time, optional city). */
export async function recentForOrders(admin: AdminClient, orderIds: (string | number)[]) {
  const ids = new Set(orderIds.map(String));
  return (await getRecent(admin)).filter((r) => r.order && ids.has(r.order));
}
