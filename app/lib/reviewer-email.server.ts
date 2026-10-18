/**
 * "Verified buyer" backed by real orders. The merchant can type the email of the person behind a
 * review and check it against the store's orders. The email lives in the app's database
 * (ReviewerEmail), never in the store's metaobjects and never on the storefront. Only the order
 * name and whether it holds the product are read from Shopify.
 */
import db from "../db.server";
import { gql, type AdminClient } from "./admin.server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmail = (v: unknown) => String(v ?? "").trim().toLowerCase().slice(0, 120);
export const validEmail = (v: string) => EMAIL.test(v);

export async function getReviewerEmail(shop: string, reviewId: string | null): Promise<string> {
  if (!reviewId) return "";
  return (await db.reviewerEmail.findUnique({ where: { shop_reviewId: { shop, reviewId } } }))?.email ?? "";
}

/** Saves the email for a review; an empty one removes it. */
export async function setReviewerEmail(shop: string, reviewId: string, email: string) {
  const e = cleanEmail(email);
  if (!e) return void (await db.reviewerEmail.deleteMany({ where: { shop, reviewId } }));
  await db.reviewerEmail.upsert({ where: { shop_reviewId: { shop, reviewId } }, update: { email: e }, create: { shop, reviewId, email: e } });
}

export const removeReviewerEmail = (shop: string, reviewId: string) => db.reviewerEmail.deleteMany({ where: { shop, reviewId } });

export type OrderCheck = { found: boolean; message: string };

/** Looks for an order placed with this email (and, for a product review, one that holds the product). */
export async function checkReviewerOrders(admin: AdminClient, rawEmail: string, productId?: string | null): Promise<OrderCheck> {
  const email = cleanEmail(rawEmail);
  if (!validEmail(email)) return { found: false, message: "Enter a valid email first." };
  const data = await gql(
    admin,
    `#graphql
    query CroReviewerOrders($q: String!) {
      orders(first: 20, query: $q, sortKey: CREATED_AT, reverse: true) {
        nodes { name email cancelledAt lineItems(first: 100) { nodes { product { id } } } }
      }
    }`,
    { q: `email:${JSON.stringify(email)}` },
  );
  // The search can be loose, so the order's own email must match exactly; cancelled orders don't count.
  const orders = ((data?.orders?.nodes ?? []) as { name: string; email: string | null; cancelledAt: string | null; lineItems: { nodes: { product: { id: string } | null }[] } }[]).filter(
    (o) => !o.cancelledAt && cleanEmail(o.email) === email,
  );
  if (!orders.length) return { found: false, message: "No order with this email." };
  if (!productId) return { found: true, message: `Order ${orders[0].name} found.` };
  const hit = orders.find((o) => o.lineItems.nodes.some((l) => l.product?.id === productId));
  if (hit) return { found: true, message: `Order ${hit.name} found with this product.` };
  return { found: false, message: `${orders[0].name} found, but no order with this product.` };
}

/* Privacy webhooks */
export const reviewerEmailsFor = (shop: string, email: string) => db.reviewerEmail.findMany({ where: { shop, email: email.toLowerCase() } });
export const redactReviewerEmail = (shop: string, email: string) => db.reviewerEmail.deleteMany({ where: { shop, email: email.toLowerCase() } });
export const redactReviewerEmails = (shop: string) => db.reviewerEmail.deleteMany({ where: { shop } });
