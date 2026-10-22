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
import { birthdayPoints, expireInactive, getProgram, releasePending, reviewTiers, syncOrder, syncSignup } from "./program.server";
import { getReferralState, matchCodes, refreshMemberCodes, syncReferralDiscounts } from "./referrals.server";
import { pruneEmails, queueScheduled, sendQueued, webhookUrl } from "./mailer.server";
import { mailProvider } from "../email/provider.server";
import { judgeMeReviews, sendEvents } from "./integrations.server";

type Money = { shopMoney: { amount: string; currencyCode?: string } } | null;
type CustomerNode = { id: string; locale: string | null; tags: string[]; state: string; defaultEmailAddress: { emailAddress: string; marketingState?: string | null } | null } | null;
type OrderNode = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  discountCodes?: string[];
  displayFinancialStatus: string | null;
  currentSubtotalPriceSet: Money;
  currentShippingPriceSet: Money;
  currentTotalTaxSet: Money;
  customer: CustomerNode;
  lineItems?: { nodes: { currentQuantity: number; discountedUnitPriceAfterAllDiscountsSet: Money; product: { id: string } | null }[] };
};

const ORDER_FIELDS = `id name createdAt cancelledAt discountCodes displayFinancialStatus currentSubtotalPriceSet { shopMoney { amount currencyCode } } currentShippingPriceSet { shopMoney { amount } } currentTotalTaxSet { shopMoney { amount } } customer { id locale tags state defaultEmailAddress { emailAddress marketingState } }`;
// Lines only when the store has product or collection rules (they make the query heavier).
const LINE_FIELDS = `lineItems(first: 30) { nodes { currentQuantity discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount } } product { id } } }`;
const fieldsFor = (c: LoyaltyConfig) => (c.productRules.length ? `${ORDER_FIELDS} ${LINE_FIELDS}` : ORDER_FIELDS);
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
    customer: c ? { id: idOf(c.id), email: (c.defaultEmailAddress?.emailAddress ?? "").toLowerCase(), firstName: "", locale: c.locale ?? "", tags: c.tags ?? [], marketing: c.defaultEmailAddress?.marketingState === "SUBSCRIBED" } : null,
    paid: PAID.has(String(n.displayFinancialStatus ?? "")),
    cancelled: !!n.cancelledAt,
    subtotal: amount(n.currentSubtotalPriceSet),
    shipping: amount(n.currentShippingPriceSet),
    taxes: amount(n.currentTotalTaxSet),
    ...(n.discountCodes?.length ? { codes: n.discountCodes } : {}),
    ...(n.lineItems
      ? { lines: n.lineItems.nodes.filter((l) => l.product && l.currentQuantity > 0).map((l) => ({ productId: l.product!.id, collectionIds: [] as string[], amount: Math.round(amount(l.discountedUnitPriceAfterAllDiscountsSet) * l.currentQuantity * 100) / 100 })) }
      : {}),
  };
}

/** Collection rules: which of these products are in which rule collection (one aliased query for the page). */
async function fillCollections(admin: AdminClient, c: LoyaltyConfig, facts: OrderFacts[]) {
  const cols = [...new Set(c.productRules.filter((r) => r.kind === "collections").flatMap((r) => r.items.map((i) => i.id)))].slice(0, 20);
  const products = [...new Set(facts.flatMap((f) => (f.lines ?? []).map((l) => l.productId)))].slice(0, 100);
  if (!cols.length || !products.length) return;
  const sel = cols.map((id, i) => `c${i}: inCollection(id: "${id}")`).join(" ");
  const data = await gql(admin, `#graphql
    query CroLoyaltyCollections($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id ${sel} } } }`, { ids: products });
  const inCols = new Map<string, string[]>();
  for (const n of (data.nodes ?? []) as Record<string, unknown>[]) if (n?.id) inCols.set(String(n.id), cols.filter((_, i) => n[`c${i}`] === true));
  for (const f of facts) for (const l of f.lines ?? []) l.collectionIds = inCols.get(l.productId) ?? [];
}

/** Orders and accounts changed since `since`, at most 10 pages of 50 each per read (the rest on the next read). */
async function readChanges(admin: AdminClient, shop: string, c: LoyaltyConfig, since: Date) {
  const q = `updated_at:>='${since.toISOString()}'`;
  let after: string | null = null;
  let orders = 0;
  for (let page = 0; page < 10; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: OrderNode[] } } = await gql(admin, `#graphql
      query CroLoyaltyOrders($q: String!, $after: String, $first: Int!) { orders(first: $first, after: $after, query: $q, sortKey: UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { ${fieldsFor(c)} } } }`, { q, after, first: c.productRules.length ? 25 : 50 });
    const facts = data.orders.nodes.map(factsFromNode);
    await fillCollections(admin, c, facts).catch(() => null);
    for (const f of facts) {
      if (await syncOrder(shop, c, f).catch((e) => (console.error(`[loyalty] order ${shop}:`, e), null))) orders++;
      if (f.codes?.length) await matchCodes(admin, shop, c, f).catch((e) => console.error(`[loyalty] codes ${shop}:`, e instanceof Error ? e.message : e));
    }
    if (!data.orders.pageInfo.hasNextPage) break;
    after = data.orders.pageInfo.endCursor;
  }
  let signups = 0;
  if (c.earn.signup.on || c.autoJoin) {
    after = null;
    for (let page = 0; page < 10; page++) {
      const data: { customers: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: NonNullable<CustomerNode>[] } } = await gql(admin, `#graphql
        query CroLoyaltyCustomers($q: String!, $after: String) { customers(first: 50, after: $after, query: $q, sortKey: UPDATED_AT) { pageInfo { hasNextPage endCursor } nodes { id locale tags state defaultEmailAddress { emailAddress marketingState } } } }`, { q, after });
      for (const n of data.customers.nodes) {
        const done = await syncSignup(shop, c, { id: idOf(n.id), email: (n.defaultEmailAddress?.emailAddress ?? "").toLowerCase(), firstName: "", locale: n.locale ?? "", tags: n.tags ?? [], marketing: n.defaultEmailAddress?.marketingState === "SUBSCRIBED", accountActive: n.state === "ENABLED" }).catch(() => null);
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
  const { config } = await getProgram(shop);
  if (!atLeast(plan, "pro")) {
    // Left Pro: referral and affiliate codes stop working (kept, so they work again on Pro).
    await syncReferralDiscounts(admin, shop, config, false).catch((e) => console.error(`[loyalty] referrals ${shop}:`, e instanceof Error ? e.message : e));
    return null;
  }
  const started = new Date();
  const since = new Date((p.syncedAt ?? started).getTime() - 5 * 60_000);
  const done = await readChanges(admin, shop, config, since);
  await db.loyaltyProgram.update({ where: { shop }, data: { syncedAt: started } });
  await expireInactive(shop, config);
  await refreshMemberCodes(admin, shop, await getReferralState(shop)).catch((e) => console.error(`[loyalty] referral codes ${shop}:`, e instanceof Error ? e.message : e));
  await issueCashback(admin, shop).catch((e) => console.error(`[loyalty] cashback ${shop}:`, e instanceof Error ? e.message : e));
  // Emails last, so the ones the changes above queued go out in this run.
  await queueScheduled(shop, config, started).catch((e) => console.error(`[loyalty] email queue ${shop}:`, e instanceof Error ? e.message : e));
  await sendQueued(admin, shop, config, started).catch((e) => console.error(`[loyalty] emails ${shop}:`, e instanceof Error ? e.message : e));
  await sendEvents(shop, config).catch((e) => console.error(`[loyalty] events ${shop}:`, e instanceof Error ? e.message : e));
  await judgeMeReviews(shop, config).catch((e) => console.error(`[loyalty] Judge.me ${shop}:`, e instanceof Error ? e.message : e));
  if (config.tiers.on && config.tiers.tag) await syncTierTags(admin, shop, config).catch((e) => console.error(`[loyalty] tier tags ${shop}:`, e instanceof Error ? e.message : e));
  // Once a day per store: birthdays, and tiers measured over the last 12 months.
  const today = started.toISOString().slice(0, 10);
  if (dailyDone.get(shop) !== today) {
    dailyDone.set(shop, today);
    await birthdayPoints(shop, config, started);
    if (config.tiers.period === "year") await reviewTiers(shop, config, started);
  }
  return done;
}
const dailyDone = new Map<string, string>();

/** Cashback mode and referral gifts: an order's store credit, once its pending days are over (the credit net of refunds by then). */
export async function issueCashback(admin: AdminClient, shop: string) {
  const due = await db.loyaltyEvent.findMany({ where: { shop, kind: { in: ["order", "referral"] }, status: "available", credit: { gt: 0 }, issuedAt: null }, take: 50 });
  if (!due.length) return 0;
  const cur = await gql(admin, `#graphql
    query CroLoyaltyCurrency { shop { currencyCode } }`);
  let n = 0;
  for (const e of due) {
    const all = await db.loyaltyEvent.aggregate({ where: { shop, memberId: e.memberId, orderId: e.orderId }, _sum: { credit: true } });
    const amount = Math.round((all._sum.credit ?? 0) * 100) / 100;
    const m = await db.loyaltyMember.findUnique({ where: { id: e.memberId } });
    // Marked first, so a slow or failed call never gives the credit twice.
    const claimed = await db.loyaltyEvent.updateMany({ where: { id: e.id, issuedAt: null }, data: { issuedAt: new Date() } });
    if (!claimed.count || !m || m.blocked || amount <= 0) continue;
    const data = await gql(admin, `#graphql
      mutation CroLoyaltyCashback($id: ID!, $input: StoreCreditAccountCreditInput!) { storeCreditAccountCredit(id: $id, creditInput: $input) { userErrors { message } } }`, { id: `gid://shopify/Customer/${m.customerId}`, input: { creditAmount: { amount: amount.toFixed(2), currencyCode: cur.shop.currencyCode } } });
    if ((data.storeCreditAccountCredit?.userErrors ?? []).length) await db.loyaltyEvent.update({ where: { id: e.id }, data: { issuedAt: null } });
    else n++;
  }
  return n;
}

/** VIP tiers as customer tags ("Loyalty Gold"), so the store can use them in Shopify (segments, Flow, discounts). */
export async function syncTierTags(admin: AdminClient, shop: string, c: LoyaltyConfig) {
  const all = c.tiers.list.map((t) => `Loyalty ${t.name}`);
  const members = await db.loyaltyMember.findMany({ where: { shop }, select: { id: true, customerId: true, tier: true, tierTagged: true }, take: 2000 });
  for (const m of members.filter((x) => x.tier !== x.tierTagged).slice(0, 100)) {
    const id = `gid://shopify/Customer/${m.customerId}`;
    const want = c.tiers.list.find((t) => t.id === m.tier);
    const remove = all.filter((t) => t !== (want ? `Loyalty ${want.name}` : ""));
    if (remove.length) await gql(admin, `#graphql
      mutation CroTierUntag($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { message } } }`, { id, tags: remove });
    if (want) await gql(admin, `#graphql
      mutation CroTierTag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`, { id, tags: [`Loyalty ${want.name}`] });
    await db.loyaltyMember.update({ where: { id: m.id }, data: { tierTagged: m.tier } });
  }
}

/** One member, right away (they opened the loyalty widget): their last orders. */
export async function syncCustomer(shop: string, admin: AdminClient, customerId: string) {
  const p = await db.loyaltyProgram.findUnique({ where: { shop } });
  if (!p?.on) return;
  const { config } = await getProgram(shop);
  const data = await gql(admin, `#graphql
    query CroLoyaltyMemberOrders($id: ID!) { customer(id: $id) { orders(first: 10, sortKey: CREATED_AT, reverse: true) { nodes { ${fieldsFor(config)} } } } }`, { id: `gid://shopify/Customer/${customerId}` });
  const facts = ((data.customer?.orders?.nodes ?? []) as OrderNode[]).map(factsFromNode);
  await fillCollections(admin, config, facts).catch(() => null);
  for (const f of facts) {
    await syncOrder(shop, config, f);
    if (f.codes?.length) await matchCodes(admin, shop, config, f);
  }
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
      await pruneEmails().catch(() => null);
    } finally {
      running = false;
    }
  };
  // Bounces and spam complaints come back to /webhooks/postmark (made once, when the email service is set).
  if (mailProvider().ready() && process.env.SHOPIFY_APP_URL) mailProvider().ensureWebhook(webhookUrl()).catch((e) => console.error("[loyalty] postmark webhook:", e instanceof Error ? e.message : e));
  setTimeout(run, 90_000);
  globalThis.croLoyaltyTimer = setInterval(run, 10 * 60_000);
}
