/**
 * Results: revenue the app's widgets brought in, and the holdout test.
 *  - Every cart line the app adds carries `_source` (quick_add, cross_sell, upsell…) or one of the
 *    app's own markers (_cro_addon, _cro_gift, _cro_fee). Orders from the last 60 days are summed by it.
 *  - Holdout test: a share of shoppers don't see the app's widgets; their cart (and so their order)
 *    carries `_cro_group` = "holdout", everyone else "app". Because shoppers are split at random,
 *    orders per group divided by the group's share compares how often each group buys.
 * Stored setting: $app:cro_design "experiment" ({ on, holdout %, since }).
 */
import { gql, type AdminClient } from "./admin.server";
import { upsert } from "./cro.server";

export type Experiment = { on: boolean; holdout: number; since: string | null };
export const DEFAULT_EXPERIMENT: Experiment = { on: false, holdout: 10, since: null };

export const SOURCE_LABELS: Record<string, string> = {
  quick_add: "Quick add to cart",
  cross_sell: "Cross-sell offers",
  upsell: "Upsell offers",
  bundle_builder: "Bundle builder",
  bundle_tray: "Bundle tray",
  fixed_bundle: "Fixed bundles",
  upgrade: "Upgrades",
  cart_drawer_offer: "Cart drawer offers",
  video_carousel: "Video carousel",
  sticky_cart: "Sticky add to cart",
  wishlist: "Wishlist",
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
type Order = { id: string; createdAt: string; cancelledAt: string | null; totalPriceSet: { shopMoney: { amount: string; currencyCode: string } }; customAttributes: { key: string; value: string | null }[]; lineItems: { nodes: Line[] } };

export type Results = {
  currency: string;
  orders: number;
  revenue: number;
  bySource: { key: string; label: string; revenue: number; lines: number; orders: number }[];
  /** Each bundle (mix & match and bundle products): orders, bundles sold, revenue, average order value. */
  byBundle: { key: string; name: string; orders: number; units: number; revenue: number; aov: number }[];
  groups: { app: { orders: number; revenue: number }; holdout: { orders: number; revenue: number } } | null;
  lift: number | null; // e.g. 0.12 = the app's group buys 12% more often
  from: string | null;
};

const sourceOf = (l: Line) => {
  const a = Object.fromEntries(l.customAttributes.map((x) => [x.key, x.value ?? ""]));
  if (a._source) return a._source;
  if (a._cro_addon) return "addons";
  if (a._cro_gift) return "gift";
  if (a._cro_fee) return "personalize";
  return null;
};

export async function getResults(admin: AdminClient, xp: Experiment): Promise<Results> {
  const orders: Order[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const data: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Order[] } } = await gql(
      admin,
      `#graphql
      query CroResults($after: String, $q: String) {
        orders(first: 25, after: $after, query: $q, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id createdAt cancelledAt
            totalPriceSet { shopMoney { amount currencyCode } }
            customAttributes { key value }
            lineItems(first: 30) { nodes { customAttributes { key value } discountedTotalSet { shopMoney { amount } } lineItemGroup { id title productId quantity } } }
          }
        }
      }`,
      { after, q: "status:any" },
    );
    orders.push(...data.orders.nodes.filter((o) => !o.cancelledAt));
    if (!data.orders.pageInfo.hasNextPage) break;
    after = data.orders.pageInfo.endCursor;
  }
  const by = new Map<string, { revenue: number; lines: number; orders: Set<string> }>();
  const bundles = new Map<string, { name: string; revenue: number; units: number; orders: Set<string>; orderTotals: number; groups: Set<string> }>();
  let revenue = 0;
  const groups = { app: { orders: 0, revenue: 0 }, holdout: { orders: 0, revenue: 0 } };
  for (const o of orders) {
    const total = Number(o.totalPriceSet.shopMoney.amount) || 0;
    revenue += total;
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
      const row = by.get(s) ?? { revenue: 0, lines: 0, orders: new Set<string>() };
      row.revenue += Number(l.discountedTotalSet.shopMoney.amount) || 0;
      row.lines += 1;
      row.orders.add(o.id);
      by.set(s, row);
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
    lift,
    from: orders.length ? orders[orders.length - 1].createdAt : null,
  };
}
