/**
 * Results: revenue the app's widgets brought in, and the holdout test.
 *  - Every cart line the app adds carries `_source` (quick_add, cross_sell, upsell…) or one of the
 *    app's own markers (_cro_addon, _cro_gift, _cro_fee). Orders from the last 60 days (the last 30
 *    and the 30 before, for comparisons) are summed by it; test orders are left out.
 *  - Holdout test: a share of shoppers don't see the app's widgets; their cart (and so their order)
 *    carries `_cro_group` = "holdout", everyone else "app". Because shoppers are split at random,
 *    orders per group divided by the group's share compares how often each group buys.
 * Stored setting: $app:cro_design "experiment" ({ on, holdout %, since }).
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";
import db from "../db.server";

export type Experiment = { on: boolean; holdout: number; since: string | null };
export const DEFAULT_EXPERIMENT: Experiment = { on: false, holdout: 10, since: null };

export const SOURCE_LABELS: Record<string, string> = {
  quick_add: "Quick add to cart",
  cross_sell: "Cross sell offers",
  upsell: "Upsell offers",
  bundle_builder: "Bundle builder",
  bundle_tray: "Bundle tray",
  fixed_bundle: "Fixed bundles",
  upgrade: "Upgrades",
  cart_drawer_offer: "Cart drawer offers",
  video_carousel: "Video carousel",
  sticky_cart: "Sticky add to cart",
  wishlist: "Wishlist",
  track_recs: "Track page recommendations",
  track_offer: "Track page offers",
  buy_again: "Track page buy again",
  quiz: "Product quiz",
  addons: "Add-ons",
  gift: "Gift with purchase",
  personalize: "Personalization fee",
  cro: "Other app widgets",
};

export async function getExperiment(admin: AdminClient): Promise<Experiment> {
  const data = await gql(admin, `#graphql
    query CroExperiment { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "experiment" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    return v ? { on: v.on === true, holdout: Math.min(50, Math.max(5, Number(v.holdout) || 10)), since: typeof v.since === "string" ? v.since : null } : DEFAULT_EXPERIMENT;
  } catch {
    return DEFAULT_EXPERIMENT;
  }
}

export async function saveExperiment(admin: AdminClient, e: Experiment) {
  const clean = { on: !!e.on, holdout: Math.min(50, Math.max(5, Math.round(Number(e.holdout) || 10))), since: e.on ? (e.since ?? new Date().toISOString()) : null };
  await upsert(admin, "$app:cro_design", "experiment", { config: JSON.stringify(clean) });
  return clean;
}

type Line = {
  customAttributes: { key: string; value: string | null }[];
  discountedTotalSet: { shopMoney: { amount: string } };
  /** Set on the items of a bundle (mix & match or bundle product): which bundle, how many sold. */
  lineItemGroup: { id: string; title: string; productId: string | null; quantity: number } | null;
};
type Order = { id: string; createdAt: string; cancelledAt: string | null; discountCodes: string[]; totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }; customAttributes: { key: string; value: string | null }[]; lineItems: { nodes: Line[] } };

export type Period = { appRevenue: number; appOrders: number; appOrdersTotal: number; orders: number; revenue: number };
const emptyPeriod = (): Period => ({ appRevenue: 0, appOrders: 0, appOrdersTotal: 0, orders: 0, revenue: 0 });

export type Results = {
  currency: string;
  orders: number;
  revenue: number;
  bySource: { key: string; label: string; revenue: number; lines: number; orders: number }[];
  /** Each bundle (mix & match and bundle products): orders, bundles sold, revenue, average order value. */
  byBundle: { key: string; name: string; orders: number; units: number; revenue: number; aov: number }[];
  groups: { app: { orders: number; revenue: number }; holdout: { orders: number; revenue: number } } | null;
  /** The Track page's own sales, last 30 days: only real orders (cart lines the page marked, and orders that used a code the page gave). */
  track: TrackResults;
  lift: number | null; // e.g. 0.12 = the app's group buys 12% more often
  /** Last 30 days and the 30 before: sales from the app's items, orders with them, all orders. */
  periods: { current: Period; previous: Period };
  from: string | null;
};

export type TrackResults = {
  recs: { orders: number; revenue: number };
  offers: { orders: number; revenue: number };
  buyAgain: { orders: number; revenue: number };
  /** Orders that used a code the Track page gave, and what they came to; `byKind` counts them by the kind of code. */
  codes: { orders: number; revenue: number; byKind: { next: number; friend: number; delay: number; offer: number } };
};
const emptyTrack = (): TrackResults => ({ recs: { orders: 0, revenue: 0 }, offers: { orders: 0, revenue: 0 }, buyAgain: { orders: 0, revenue: 0 }, codes: { orders: 0, revenue: 0, byKind: { next: 0, friend: 0, delay: 0, offer: 0 } } });

/** The kind of a Track page code row ("next", "friend", "delay", "offer-<id>", or the shared code). */
export const codeGroup = (kind: string): keyof TrackResults["codes"]["byKind"] | null => (kind === "next" || kind === "shared" ? "next" : kind === "friend" ? "friend" : kind === "delay" ? "delay" : kind.startsWith("offer-") ? "offer" : null);

const sourceOf = (l: Line) => {
  const a = Object.fromEntries(l.customAttributes.map((x) => [x.key, x.value ?? ""]));
  if (a._source) return a._source;
  if (a._cro_addon) return "addons";
  if (a._cro_gift) return "gift";
  if (a._cro_fee) return "personalize";
  return null;
};

const round2 = (t: { orders: number; revenue: number }) => ({ orders: t.orders, revenue: Math.round(t.revenue * 100) / 100 });

/** Most orders read per visit (25 a page): enough for busy stores, short enough to stay fast. */
const MAX_PAGES = 60;

export async function getResults(admin: AdminClient, xp: Experiment, shop?: string): Promise<Results> {
  // The codes the Track page gave (this shop's own rows): an order that used one came from the Track page.
  const codeKinds = new Map<string, keyof TrackResults["codes"]["byKind"]>();
  if (shop) {
    for (const r of await db.trackCode.findMany({ where: { shop }, select: { code: true, kind: true } }).catch(() => [])) {
      const g = codeGroup(r.kind);
      if (g) codeKinds.set(r.code.toUpperCase(), g);
    }
  }
  const track = emptyTrack();
  const orders: Order[] = [];
  let after: string | null = null;
  // Only what the numbers use: the last 60 days (or since the holdout test started, if earlier).
  const since = new Date(Math.min(Date.now() - 60 * 864e5, xp.since ? Date.parse(xp.since) : Infinity)).toISOString();
  const q = `created_at:>='${since}' test:false`;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Order[] } } = await gql(
      admin,
      `#graphql
      query CroResults($after: String, $q: String) {
        orders(first: 25, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id createdAt cancelledAt discountCodes
            totalPriceSet { shopMoney { amount currencyCode } }
            customAttributes { key value }
            lineItems(first: 30) { nodes { customAttributes { key value } discountedTotalSet { shopMoney { amount } } lineItemGroup { id title productId quantity } } }
          }
        }
      }`,
      { after, q },
    );
    orders.push(...data.orders.nodes.filter((o) => !o.cancelledAt));
    if (!data.orders.pageInfo.hasNextPage) break;
    after = data.orders.pageInfo.endCursor;
  }
  const by = new Map<string, { revenue: number; lines: number; orders: Set<string> }>();
  const bundles = new Map<string, { name: string; revenue: number; units: number; orders: Set<string>; orderTotals: number; groups: Set<string> }>();
  let revenue = 0;
  const groups = { app: { orders: 0, revenue: 0 }, holdout: { orders: 0, revenue: 0 } };
  const periods = { current: emptyPeriod(), previous: emptyPeriod() };
  const day = 864e5;
  const now = Date.now();
  for (const o of orders) {
    const total = Number(o.totalPriceSet.shopMoney.amount) || 0;
    revenue += total;
    const age = now - Date.parse(o.createdAt);
    const period = age < 30 * day ? periods.current : age < 60 * day ? periods.previous : null;
    let appHere = 0;
    const trackHere = { track_recs: 0, track_offer: 0, buy_again: 0 };
    const bundlesHere = new Set<string>();
    for (const l of o.lineItems.nodes) {
      const grp = l.lineItemGroup;
      if (grp) {
        const key = grp.productId ?? grp.title;
        const row = bundles.get(key) ?? { name: grp.title, revenue: 0, units: 0, orders: new Set<string>(), orderTotals: 0, groups: new Set<string>() };
        row.revenue += Number(l.discountedTotalSet.shopMoney.amount) || 0;
        // A bundle's items share one group: count the bundles sold once per group.
        if (!row.groups.has(grp.id)) {
          row.groups.add(grp.id);
          row.units += grp.quantity;
        }
        if (!bundlesHere.has(key)) {
          bundlesHere.add(key);
          row.orders.add(o.id);
          row.orderTotals += total;
        }
        bundles.set(key, row);
      }
      const s = sourceOf(l);
      if (!s) continue;
      appHere += Number(l.discountedTotalSet.shopMoney.amount) || 0;
      if (s in trackHere && age < 30 * day) {
        const t = s === "track_recs" ? track.recs : s === "track_offer" ? track.offers : track.buyAgain;
        t.revenue += Number(l.discountedTotalSet.shopMoney.amount) || 0;
        if (!trackHere[s as keyof typeof trackHere]) t.orders += 1;
        trackHere[s as keyof typeof trackHere] += 1;
      }
      const row = by.get(s) ?? { revenue: 0, lines: 0, orders: new Set<string>() };
      row.revenue += Number(l.discountedTotalSet.shopMoney.amount) || 0;
      row.lines += 1;
      row.orders.add(o.id);
      by.set(s, row);
    }
    if (age < 30 * day) {
      const used = (o.discountCodes ?? []).map((c) => codeKinds.get(c.toUpperCase())).find(Boolean);
      if (used) {
        track.codes.orders += 1;
        track.codes.revenue += total;
        track.codes.byKind[used] += 1;
      }
    }
    if (period) {
      period.orders += 1;
      period.revenue += total;
      if (appHere > 0) {
        period.appOrders += 1;
        period.appRevenue += appHere;
        period.appOrdersTotal += total;
      }
    }
    const g = o.customAttributes.find((x) => x.key === "_cro_group")?.value;
    if (xp.since && o.createdAt >= xp.since && (g === "app" || g === "holdout")) {
      groups[g].orders += 1;
      groups[g].revenue += total;
    }
  }
  const share = xp.holdout / 100;
  const lift = groups.holdout.orders >= 5 && groups.app.orders >= 5 ? groups.app.orders / (1 - share) / (groups.holdout.orders / share) - 1 : null;
  return {
    currency: orders[0]?.totalPriceSet.shopMoney.currencyCode ?? "USD",
    orders: orders.length,
    revenue,
    bySource: [...by.entries()].map(([key, r]) => ({ key, label: SOURCE_LABELS[key] ?? key, revenue: r.revenue, lines: r.lines, orders: r.orders.size })).sort((a, b) => b.revenue - a.revenue),
    byBundle: [...bundles.entries()]
      .map(([key, r]) => ({ key, name: r.name, orders: r.orders.size, units: r.units, revenue: r.revenue, aov: r.orders.size ? r.orderTotals / r.orders.size : 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    groups: xp.since ? groups : null,
    periods,
    track: { ...track, recs: round2(track.recs), offers: round2(track.offers), buyAgain: round2(track.buyAgain), codes: { ...track.codes, revenue: Math.round(track.codes.revenue * 100) / 100 } },
    lift,
    from: orders.length ? orders[orders.length - 1].createdAt : null,
  };
}
