/**
 * Loyalty → Analytics: what the program did in the last 30 or 90 days. Members, points and rewards come from the
 * app's own tables; orders that used a reward code, and the repeat purchase rate of members against other
 * customers, come from the store's orders (one read of the last 90 days, kept 10 minutes). The maths is pure
 * (`summarize`) so tests don't need Shopify.
 */
import db from "../../db.server";
import { gql, type AdminClient } from "../admin.server";
import { remember } from "../short-cache.server";

const DAY = 86_400_000;
export const PERIODS = [30, 90] as const;
export type Period = (typeof PERIODS)[number];
/** Orders read at most (250 a page): a store with more in 90 days sees the newest ones and a note. */
const MAX_PAGES = 40;

export type AnalyticsOrder = { createdAt: string; total: number; customerId: string | null; codes: string[] };
export type AnalyticsInput = {
  members: { customerId: string; joinedAt: Date }[];
  events: { kind: string; points: number; createdAt: Date }[];
  rewards: { title: string; kind: string; value: number; createdAt: Date }[];
  /** Every reward code the program gave (a code made before the period can be used in it). */
  codes: string[];
  referrals: { kind: string; status: string; amount: number; createdAt: Date }[];
  orders: AnalyticsOrder[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Ledger kinds that are not earned: the store's own changes, imports, spending, and points taken back or expired. */
const NOT_EARNED = new Set(["adjust", "import", "redeem", "redeem_back", "refund", "cancel", "expire", "referral_back"]);

/** Share of customers with an order in the period who ordered at least twice in it; null with nobody to count. */
const repeatRate = (counts: number[]) => (counts.length ? round2((counts.filter((n) => n >= 2).length / counts.length) * 100) : null);

export function summarize(x: AnalyticsInput, days: Period, now = new Date()) {
  const since = now.getTime() - days * DAY;
  const inside = (d: Date | string) => new Date(d).getTime() >= since;

  // Members over time: one row a week, the total at the end of the week and how many joined in it.
  const weeks = Math.ceil(days / 7);
  const growth = Array.from({ length: weeks }, (_, i) => {
    const end = now.getTime() - (weeks - 1 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const joined = x.members.filter((m) => m.joinedAt.getTime() > start && m.joinedAt.getTime() <= end).length;
    return { end: new Date(end).toISOString(), joined, total: x.members.filter((m) => m.joinedAt.getTime() <= end).length };
  });

  const ev = x.events.filter((e) => inside(e.createdAt));
  const sum = (pick: (e: AnalyticsInput["events"][number]) => boolean) => ev.filter(pick).reduce((n, e) => n + e.points, 0);
  const points = {
    earned: sum((e) => e.points > 0 && !NOT_EARNED.has(e.kind)),
    // Net of rewards Shopify refused (their points came back).
    spent: -sum((e) => e.kind === "redeem" || e.kind === "redeem_back"),
    expired: -sum((e) => e.kind === "expire"),
    takenBack: -sum((e) => ["refund", "cancel", "referral_back"].includes(e.kind)),
    byStore: sum((e) => e.kind === "adjust" || e.kind === "import"),
  };

  // Rewards redeemed, by reward, and the orders that used one of their codes.
  const rw = x.rewards.filter((r) => inside(r.createdAt));
  const byTitle = new Map<string, number>();
  for (const r of rw) byTitle.set(r.title, (byTitle.get(r.title) ?? 0) + 1);
  const codes = new Set(x.codes.map((c) => c.toUpperCase()));
  const orders = x.orders.filter((o) => inside(o.createdAt));
  const withCode = orders.filter((o) => o.codes.some((c) => codes.has(c.toUpperCase())));

  const ref = x.referrals.filter((r) => inside(r.createdAt));
  const refSum = (kind: string, status: string) => ref.filter((r) => r.kind === kind && r.status === status);

  // Repeat purchase rate: orders per customer in the period, members against everyone else.
  const memberIds = new Set(x.members.map((m) => m.customerId));
  const perCustomer = new Map<string, number>();
  for (const o of orders) if (o.customerId) perCustomer.set(o.customerId, (perCustomer.get(o.customerId) ?? 0) + 1);
  const mine = [...perCustomer].filter(([id]) => memberIds.has(id)).map(([, n]) => n);
  const others = [...perCustomer].filter(([id]) => !memberIds.has(id)).map(([, n]) => n);

  return {
    days,
    members: { total: x.members.length, joined: x.members.filter((m) => inside(m.joinedAt)).length, growth },
    points,
    rewards: {
      redeemed: rw.length,
      // Money given: store credit and amounts off (a percent reward's value is a percent, a free item's a product).
      value: round2(rw.filter((r) => r.kind === "credit" || r.kind === "amount").reduce((n, r) => n + r.value, 0)),
      top: [...byTitle].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, count]) => ({ title, count })),
      orders: withCode.length,
      revenue: round2(withCode.reduce((n, o) => n + o.total, 0)),
    },
    referrals: {
      orders: refSum("referral", "rewarded").length,
      sales: round2(refSum("referral", "rewarded").reduce((n, r) => n + r.amount, 0)),
      affiliateOrders: refSum("affiliate", "counted").length,
      affiliateSales: round2(refSum("affiliate", "counted").reduce((n, r) => n + r.amount, 0)),
    },
    repeat: { members: repeatRate(mine), others: repeatRate(others), memberCustomers: mine.length, otherCustomers: others.length },
  };
}
export type LoyaltySummary = ReturnType<typeof summarize>;

type OrderNode = { createdAt: string; cancelledAt: string | null; discountCodes: string[]; totalPriceSet: { shopMoney: { amount: string } }; customer: { id: string } | null };

/** The store's orders of the last 90 days (not cancelled, not test orders), newest first; `capped` when there were more to read. */
async function readOrders(admin: AdminClient, now: Date) {
  const orders: AnalyticsOrder[] = [];
  let after: string | null = null;
  let capped = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const d: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: OrderNode[] } } = await gql(admin, `#graphql
      query CroLoyaltyAnalyticsOrders($after: String, $q: String) {
        orders(first: 250, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          nodes { createdAt cancelledAt discountCodes totalPriceSet { shopMoney { amount } } customer { id } }
        }
      }`, { after, q: `created_at:>='${new Date(now.getTime() - 90 * DAY).toISOString()}' test:false` });
    for (const n of d.orders.nodes) {
      if (n.cancelledAt) continue;
      orders.push({ createdAt: n.createdAt, total: Number(n.totalPriceSet.shopMoney.amount) || 0, customerId: n.customer?.id.split("/").pop() ?? null, codes: n.discountCodes ?? [] });
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    if (page === MAX_PAGES - 1) capped = true;
    after = d.orders.pageInfo.endCursor;
  }
  return { orders, capped };
}

/** Both periods for the page. If the orders can't be read, the app's own numbers still show (`ordersError`). */
export async function loyaltyAnalytics(admin: AdminClient, shop: string, now = new Date()) {
  const since = new Date(now.getTime() - 90 * DAY);
  const [members, events, rewards, codes, referrals, read] = await Promise.all([
    db.loyaltyMember.findMany({ where: { shop }, select: { customerId: true, joinedAt: true } }),
    db.loyaltyEvent.findMany({ where: { shop, createdAt: { gte: since } }, select: { kind: true, points: true, createdAt: true } }),
    db.loyaltyReward.findMany({ where: { shop, createdAt: { gte: since } }, select: { title: true, kind: true, value: true, createdAt: true } }),
    db.loyaltyReward.findMany({ where: { shop, code: { not: "" } }, select: { code: true } }),
    db.loyaltyReferral.findMany({ where: { shop, createdAt: { gte: since } }, select: { kind: true, status: true, amount: true, createdAt: true } }),
    remember(shop, "loyalty-analytics-orders", 10 * 60_000, () => readOrders(admin, now))
      .then((r) => ({ ...r, error: null as string | null }))
      .catch((e: unknown) => ({ orders: [] as AnalyticsOrder[], capped: false, error: e instanceof Error ? e.message : String(e) })),
  ]);
  const input: AnalyticsInput = { members, events, rewards, codes: codes.map((c) => c.code), referrals, orders: read.orders };
  return { periods: Object.fromEntries(PERIODS.map((p) => [p, summarize(input, p, now)])) as Record<Period, LoyaltySummary>, capped: read.capped, ordersError: read.error };
}
