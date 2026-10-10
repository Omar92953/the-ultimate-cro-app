/**
 * Back-in-stock requests ("Notify me when available"), kept in the app's database (StockAlert).
 * Only the shopper's email and the variant they want are stored. The merchant sees who is waiting,
 * which variants are back in stock, exports the emails and marks them as told.
 */
import db from "../db.server";
import { gql, type AdminClient } from "./admin.server";

export type AlertGroup = {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  waiting: number;
  told: number;
  inStock: boolean | null; // null = couldn't check
  quantity: number | null;
};

export async function addAlert(shop: string, a: { productId: string; variantId: string; productTitle: string; variantTitle: string; email: string }) {
  await db.stockAlert.upsert({
    where: { shop_variantId_email: { shop, variantId: a.variantId, email: a.email } },
    // Asking again after being told: wait again.
    update: { notifiedAt: null, productTitle: a.productTitle, variantTitle: a.variantTitle },
    create: { shop, ...a },
  });
}

export async function alertGroups(admin: AdminClient, shop: string): Promise<AlertGroup[]> {
  const rows = await db.stockAlert.groupBy({
    by: ["variantId", "productId", "productTitle", "variantTitle"],
    where: { shop },
    _count: { _all: true, notifiedAt: true },
  });
  const ids = rows.map((r) => `gid://shopify/ProductVariant/${r.variantId}`);
  const stock = new Map<string, { inStock: boolean; quantity: number | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const data = await gql(admin, `#graphql
      query CroAlertStock($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id availableForSale inventoryQuantity } } }`, { ids: ids.slice(i, i + 100) }).catch(() => null);
    for (const n of data?.nodes ?? []) if (n?.id) stock.set(n.id.split("/").pop(), { inStock: !!n.availableForSale && (n.inventoryQuantity ?? 1) > 0, quantity: n.inventoryQuantity ?? null });
  }
  return rows
    .map((r) => ({
      variantId: r.variantId,
      productId: r.productId,
      productTitle: r.productTitle,
      variantTitle: r.variantTitle,
      waiting: r._count._all - r._count.notifiedAt,
      told: r._count.notifiedAt,
      inStock: stock.get(r.variantId)?.inStock ?? null,
      quantity: stock.get(r.variantId)?.quantity ?? null,
    }))
    .sort((a, b) => Number(b.inStock && b.waiting > 0) - Number(a.inStock && a.waiting > 0) || b.waiting - a.waiting);
}

/** Emails still waiting for a variant (or all variants), for copying or a CSV. */
export async function waitingEmails(shop: string, variantId?: string) {
  return db.stockAlert.findMany({ where: { shop, notifiedAt: null, ...(variantId ? { variantId } : {}) }, orderBy: { createdAt: "asc" } });
}

export async function markTold(shop: string, variantId: string) {
  const r = await db.stockAlert.updateMany({ where: { shop, variantId, notifiedAt: null }, data: { notifiedAt: new Date() } });
  return r.count;
}

export async function clearTold(shop: string) {
  const r = await db.stockAlert.deleteMany({ where: { shop, notifiedAt: { not: null } } });
  return r.count;
}

/* Privacy webhooks */
export const alertsForEmail = (shop: string, email: string) => db.stockAlert.findMany({ where: { shop, email: email.toLowerCase() } });
export const redactEmail = (shop: string, email: string) => db.stockAlert.deleteMany({ where: { shop, email: email.toLowerCase() } });
export const redactShop = (shop: string) => db.stockAlert.deleteMany({ where: { shop } });
