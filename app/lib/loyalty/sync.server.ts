/**
 * Reads what changed in each Pro store with loyalty on: orders updated since the last read (paid, refunded,
 * edited, cancelled) and customer accounts made or activated, and brings points up to date. Runs every
 * 10 minutes in the server (one long-running Render process, like retention.server.ts), and for one member
 * at once when they open the loyalty widget. Every change is idempotent (program.server.ts `syncOrder`),
 * so a read that overlaps the last one changes nothing.
 *
 * Customer names are not read: the app's protected customer data access covers email only.
 */
import db from "../../db.server";
import { gql, type AdminClient } from "../admin.server";
import { atLeast } from "../plans";
import { getPlan } from "../billing.server";
import type { LoyaltyConfig } from "./config";
import type { OrderFacts } from "./points";
import { expireInactive, getProgram, releasePending, syncOrder, syncSignup } from "./program.server";

type Money = { shopMoney: { amount: string; currencyCode?: string } } | null;
type CustomerNode = { id: string; locale: string | null; tags: string[]; state: string; defaultEmailAddress: { emailAddress: string } | null } | null;
type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  currentSubtotalPriceSet: Money;
  currentShippingPriceSet: Money;
  currentTotalTaxSet: Money;
  customer: CustomerNode;
};

const ORDER_FIELDS = `id name createdAt cancelledAt displayFinancialStatus currentSubtotalPriceSet { shopMoney { amount currencyCode } } currentShippingPriceSet { shopMoney { amount } } currentTotalTaxSet { shopMoney { amount } } customer { id locale tags state defaultEmailAddress { emailAddress } }`;
const PAID = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);
const amount = (m: Money) => Number(m?.shopMoney?.amount) || 0;
const idOf = (gid: string) => gid.split("/").pop() ?? gid;

/** An Admin API order in the shape the points engine uses. Exported for the tests. */
export function factsFromNode(n: OrderNode): OrderFacts {
  const c = n.customer;
  return {
    id: idOf(n.id),
    name: n.name,
    createdAt: n.createdAt,
    customer: c ? { id: idOf(c.id), email: (c.defaultEmailAddress?.emailAddress ?? "").toLowerCase(), firstName: "", locale: c.locale ?? "", tags: c.tags ?? [] } : null,
    paid: PAID.has(String(n.displayFinancialStatus ?? "")),
    cancelled: !!n.cancelledAt,
    subtotal: amount(n.currentSubtotalPriceSet),
    shipping: amount(n.currentShippingPriceSet),
    taxes: amount(n.currentTotalTaxSet),
  };
}

/** Orders and accounts changed since `since`, at most 10 pages of 50 each per read (the rest on the next read). */
async function readChanges(admin: AdminClient, shop: string, c: LoyaltyConfig, since: Date) {
  const q = `updated_at:>='${since.toISOString()}'`;
  let after: string | null = null;
  let orders = 0;
  for (let page = 0; page < 10; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: OrderNode[] } } = await gql(admin, `#graphql
      query CroLoyaltyOrders($q: String!, $after: String) { orders(first: 50, after: $after, query: $q, sortKey: UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { ${ORDER_FIELDS} } } }`, { q, after });
    for (const n of data.orders.nodes) if ((await syncOrder(shop, c, factsFromNode(n)).catch((e) => (console.error(`[loyalty] order ${shop}:`, e), null)))) orders++;
    if (!data.orders.pageInfo.hasNextPage) break;
    after = data.orders.pageInfo.endCursor;
  }
  let signups = 0;
  if (c.earn.signup.on || c.autoJoin) {
    after = null;
    for (let page = 0; page < 10; page++) {
      const data: { customers: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: NonNullable<CustomerNode>[] } } = await gql(admin, `#graphql
        query CroLoyaltyCustomers($q: String!, $after: String) { customers(first: 50, after: $after, query: $q, sortKey: UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { id locale tags state defaultEmailAddress { emailAddress } } } }`, { q, after });
      for (const n of data.customers.nodes) {
        const done = await syncSignup(shop, c, { id: idOf(n.id), email: (n.defaultEmailAddress?.emailAddress ?? "").toLowerCase(), firstName: "", locale: n.locale ?? "", tags: n.tags ?? [], accountActive: n.state === "ENABLED" }).catch(() => null);
        if (done) signups++;
      }
      if (!data.customers.pageInfo.hasNextPage) break;
      after = data.customers.pageInfo.endCursor;
    }
  }
  return { orders, signups };
}

/** One store: reads what changed since the last read (5 minutes of overlap, so nothing in between is missed). */
export async function syncShop(shop: string, admin: AdminClient) {
  const p = await db.loyaltyProgram.findUnique({ where: { shop } });
  if (!p?.on) return null;
  const { plan } = await getPlan(admin, shop);
  if (!atLeast(plan, "pro")) return null;
  const { config } = await getProgram(shop);
  const started = new Date();
  const since = new Date((p.syncedAt ?? started).getTime() - 5 * 60_000);
  const done = await readChanges(admin, shop, config, since);
  await db.loyaltyProgram.update({ where: { shop }, data: { syncedAt: started } });
  await expireInactive(shop, config);
  return done;
}

/** One member, right away (they opened the loyalty widget): their last orders. */
export async function syncCustomer(shop: string, admin: AdminClient, customerId: string) {
  const p = await db.loyaltyProgram.findUnique({ where: { shop } });
  if (!p?.on) return;
  const { config } = await getProgram(shop);
  const data = await gql(admin, `#graphql
    query CroLoyaltyMemberOrders($id: ID!) { customer(id: $id) { orders(first: 10, sortKey: CREATED_AT, reverse: true) { nodes { ${ORDER_FIELDS} } } } }`, { id: `gid://shopify/Customer/${customerId}` });
  for (const n of (data.customer?.orders?.nodes ?? []) as OrderNode[]) await syncOrder(shop, config, factsFromNode(n));
}

declare global {
  // eslint-disable-next-line no-var
  var croLoyaltyTimer: ReturnType<typeof setInterval> | undefined;
}

/** Every 10 minutes: each store with loyalty on, then pending points that are due. Not in tests or local development. */
export function startLoyaltyJobs() {
  if (globalThis.croLoyaltyTimer || process.env.NODE_ENV !== "production") return;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { unauthenticated } = await import("../../shopify.server");
      for (const p of await db.loyaltyProgram.findMany({ where: { on: true }, select: { shop: true } })) {
        try {
          const { admin } = await unauthenticated.admin(p.shop);
          await syncShop(p.shop, admin);
        } catch (e) {
          console.error(`[loyalty] ${p.shop}:`, e instanceof Error ? e.message : e);
        }
      }
      await releasePending();
    } finally {
      running = false;
    }
  };
  setTimeout(run, 90_000);
  globalThis.croLoyaltyTimer = setInterval(run, 10 * 60_000);
}
