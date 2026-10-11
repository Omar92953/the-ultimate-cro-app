/**
 * Which plan a shop is on, and keeping the store within it. Plans, prices and limits: plans.ts.
 *
 * Billing is Shopify App Pricing: plans are created in the Partner Dashboard and Shopify hosts the
 * plan selection page (plans.ts → planPageUrl). The app NEVER creates charges (no
 * appSubscriptionCreate, no billing.request) — it only reads the active subscription:
 *  1. Partner API `activeSubscription` (Shopify's recommended check for App Pricing). Used when
 *     SHOPIFY_PARTNER_API_TOKEN, SHOPIFY_PARTNER_ORG_ID and SHOPIFY_APP_GID are set on the server.
 *     The plan comes from the subscription item's handle (= the plan handle in the Partner Dashboard).
 *  2. Otherwise the Admin API `currentAppInstallation.activeSubscriptions` (the plan's name).
 *  No active subscription → Free. CRO_PLAN_OVERRIDE=free|starter|growth|pro forces a plan outside
 *  production, for testing every plan locally.
 *
 * Downgrades never break a store: items over the new limit stay saved, and only the first N (in
 * the order the app lists them) stay on — see applyPlanLimits. The ones the app switched off are
 * remembered and switched back on after an upgrade.
 */
import { gql, type AdminClient } from "./admin.server";
import { listBundles, listDeals, listRules, syncBundles, syncDiscounts, upsert } from "./cro.server";
import { forgetShop, remember } from "./short-cache.server";
import { listKitIds } from "./kits.server";
import { DEFAULT_APP_HANDLE, PLAN_KEYS, canResume, isPlanKey, limitError, limitOf, overLimit, planFromSubscription, planPageUrl, type LimitKey, type PlanKey } from "./plans";

export type PlanInfo = {
  plan: PlanKey;
  /**
   * Where the answer came from. "error": the check failed, so nothing is locked (never punish a
   * paying store for our outage). "none": the Admin API listed no subscription — not proof enough to
   * switch anything off (App Pricing subscriptions are confirmed by the Partner API).
   */
  source: "override" | "partner" | "admin" | "none" | "error";
  /** The subscription's own name, when there is one. */
  subscription: string | null;
  trialEndsAt: string | null;
  /** Shopify's plan selection page for this shop. */
  planUrl: string;
};

const PARTNER_VERSION = "2026-07";

export function appHandle() {
  return process.env.CRO_APP_HANDLE || DEFAULT_APP_HANDLE;
}

function override(): PlanKey | null {
  const v = process.env.CRO_PLAN_OVERRIDE?.trim().toLowerCase();
  return process.env.NODE_ENV !== "production" && isPlanKey(v) ? v : null;
}

async function fromPartnerApi(admin: AdminClient): Promise<Omit<PlanInfo, "planUrl"> | null> {
  const token = process.env.SHOPIFY_PARTNER_API_TOKEN;
  const org = process.env.SHOPIFY_PARTNER_ORG_ID;
  const appId = process.env.SHOPIFY_APP_GID;
  if (!token || !org || !appId) return null;
  const shop = await gql(admin, `#graphql
    query CroShopId { shop { id } }`);
  // Partner API, not Admin: no #graphql tag, so codegen doesn't check it against the Admin schema.
  const res = await fetch(`https://partners.shopify.com/${org}/api/${PARTNER_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({
      query: `query CroActiveSubscription($appId: ID!, $shopId: ID!) {
        activeSubscription(appId: $appId, shopId: $shopId) { trialEndsAt items { handle description } }
      }`,
      variables: { appId: appId.startsWith("gid://") ? appId : `gid://shopify/App/${appId}`, shopId: shop.shop.id },
    }),
  });
  const json = (await res.json().catch(() => null)) as { data?: { activeSubscription: { trialEndsAt: string | null; items: { handle: string; description: string | null }[] } | null }; errors?: unknown } | null;
  // Throw on throttling or other failures, so a paying store is never shown as Free by mistake.
  if (!res.ok || !json || json.errors) throw new Error(`Partner API request failed (${res.status})`);
  const sub = json.data?.activeSubscription;
  // The Partner API answered "no subscription": a confirmed Free store.
  if (!sub) return { plan: "free", source: "partner", subscription: null, trialEndsAt: null };
  const item = sub.items.map((i) => ({ i, plan: planFromSubscription(i.handle) ?? planFromSubscription(i.description) })).find((x) => x.plan);
  return { plan: item?.plan ?? "free", source: "partner", subscription: item?.i.description ?? item?.i.handle ?? null, trialEndsAt: sub.trialEndsAt };
}

async function fromAdminApi(admin: AdminClient): Promise<Omit<PlanInfo, "planUrl">> {
  const data = await gql(admin, `#graphql
    query CroActiveSubscriptions { currentAppInstallation { activeSubscriptions { name status trialDays createdAt } } }`);
  const subs: { name: string; status: string; trialDays: number; createdAt: string }[] = data.currentAppInstallation?.activeSubscriptions ?? [];
  const active = subs.filter((s) => s.status === "ACTIVE");
  // The highest plan wins if Shopify ever lists two (e.g. during a plan change).
  const best = active
    .map((s) => ({ s, plan: planFromSubscription(s.name) }))
    .filter((x): x is { s: (typeof subs)[number]; plan: PlanKey } => !!x.plan)
    .sort((a, b) => PLAN_KEYS.indexOf(b.plan) - PLAN_KEYS.indexOf(a.plan))[0];
  if (!best) return { plan: "free", source: active.length ? "admin" : "none", subscription: active[0]?.name ?? null, trialEndsAt: null };
  const trialEnd = best.s.trialDays ? new Date(Date.parse(best.s.createdAt) + best.s.trialDays * 864e5) : null;
  return {
    plan: best.plan,
    source: "admin",
    subscription: best.s.name,
    trialEndsAt: trialEnd && trialEnd.getTime() > Date.now() ? trialEnd.toISOString() : null,
  };
}

/**
 * The shop's plan. Remembered for a minute per shop (short-cache.server.ts). Pass `fresh` right
 * after Shopify sends the merchant back from the plan selection page (?plan_handle=… on the URL).
 */
export function getPlan(admin: AdminClient, shop: string, fresh = false): Promise<PlanInfo> {
  const planUrl = planPageUrl(shop, appHandle());
  const forced = override();
  if (forced) return Promise.resolve({ plan: forced, source: "override", subscription: null, trialEndsAt: null, planUrl });
  const load = async (): Promise<PlanInfo> => {
    try {
      const info = (await fromPartnerApi(admin)) ?? (await fromAdminApi(admin));
      return { ...info, planUrl };
    } catch (e) {
      console.error(`Plan check failed for ${shop}:`, e);
      return { plan: "pro", source: "error", subscription: null, trialEndsAt: null, planUrl };
    }
  };
  // Back from the plan page: everything remembered for the shop may depend on the old plan.
  if (fresh) forgetShop(shop);
  return remember(shop, "plan", 60000, load);
}

/**
 * Orders this calendar month (UTC), for the soft order limit. Needs read_orders; null when the
 * store hasn't granted it yet or the read fails (then no banner is shown).
 */
export function getMonthlyOrders(admin: AdminClient, shop: string): Promise<number | null> {
  return remember(shop, "orders-month", 10 * 60000, async () => {
    try {
      const now = new Date();
      const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const data = await gql(admin, `#graphql
        query CroOrdersThisMonth($q: String!) { ordersCount(query: $q, limit: 100000) { count } }`, { q: `created_at:>='${since}'` });
      return typeof data.ordersCount?.count === "number" ? data.ordersCount.count : null;
    } catch {
      return null;
    }
  });
}

/* ----------------------------------------------- keeping within the plan -- */

type PausedItem = { type: "rule" | "bundle" | "deal"; handle: string; name: string; limit: LimitKey };
export type PlanState = { plan: PlanKey | null; paused: PausedItem[]; at: string | null };
const EMPTY_STATE: PlanState = { plan: null, paused: [], at: null };

export async function getPlanState(admin: AdminClient): Promise<PlanState> {
  const data = await gql(admin, `#graphql
    query CroPlanState { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "plan_state" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    return v && Array.isArray(v.paused) ? { plan: isPlanKey(v.plan) ? v.plan : null, paused: v.paused, at: v.at ?? null } : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

const TYPE: Record<PausedItem["type"], string> = { rule: "$app:cro_rule", bundle: "$app:cro_bundle", deal: "$app:cro_deal" };

/**
 * Switches off what's over the plan's limits (first N stay on) and, after an upgrade, switches back
 * on what the app paused before. Nothing is ever deleted. Returns the stored state.
 */
export async function applyPlanLimits(admin: AdminClient, plan: PlanKey): Promise<PlanState> {
  const [rules, bundles, deals, state] = await Promise.all([listRules(admin), listBundles(admin), listDeals(admin), getPlanState(admin)]);
  type Item = { type: PausedItem["type"]; handle: string; name: string; active: boolean; limit: LimitKey };
  const groups: Record<"upsellOffers" | "crossSellOffers" | "bundlesAndDeals", Item[]> = {
    upsellOffers: rules.filter((r) => r.kind === "upsell").map((r) => ({ type: "rule", handle: r.handle!, name: r.name, active: r.active, limit: "upsellOffers" })),
    crossSellOffers: rules.filter((r) => r.kind === "cross_sell").map((r) => ({ type: "rule", handle: r.handle!, name: r.name, active: r.active, limit: "crossSellOffers" })),
    // Mix & match bundles first, then deals in their list order.
    bundlesAndDeals: [
      ...bundles.map((b): Item => ({ type: "bundle", handle: b.handle!, name: b.name, active: b.active, limit: "bundlesAndDeals" })),
      ...deals.map((d): Item => ({ type: "deal", handle: d.handle!, name: d.name, active: d.active, limit: "bundlesAndDeals" })),
    ],
  };
  // Still paused = still saved and still off (the merchant may have deleted or switched one on since).
  const off = new Set(Object.values(groups).flat().filter((i) => !i.active).map((i) => `${i.type}:${i.handle}`));
  let paused = state.paused.filter((p) => off.has(`${p.type}:${p.handle}`));
  const turnOff: Item[] = [];
  const turnOn: PausedItem[] = [];
  for (const [key, items] of Object.entries(groups) as [LimitKey, Item[]][]) {
    const limit = limitOf(plan, key);
    const over = overLimit(items, limit);
    turnOff.push(...over);
    const activeNow = items.filter((i) => i.active).length - over.length;
    if (!over.length) turnOn.push(...canResume(paused.filter((p) => p.limit === key), activeNow, limit));
  }
  if (!turnOff.length && !turnOn.length && state.plan === plan) return { ...state, paused };

  const set = (type: PausedItem["type"], handle: string, active: boolean) => upsert(admin, TYPE[type], handle, { active: String(active) });
  for (const i of turnOff) await set(i.type, i.handle, false);
  for (const p of turnOn) await set(p.type, p.handle, true);
  const resumed = new Set(turnOn.map((p) => `${p.type}:${p.handle}`));
  paused = [...paused.filter((p) => !resumed.has(`${p.type}:${p.handle}`)), ...turnOff.map(({ type, handle, name, limit }) => ({ type, handle, name, limit }))];
  const changed = [...turnOff, ...turnOn];
  if (changed.some((i) => i.type !== "bundle")) await syncDiscounts(admin);
  if (changed.some((i) => i.type === "bundle")) await syncBundles(admin);
  const next: PlanState = { plan, paused, at: new Date().toISOString() };
  await upsert(admin, "$app:cro_design", "plan_state", { config: JSON.stringify(next) });
  return next;
}

/**
 * Runs applyPlanLimits once per plan change per shop (in the background; never slows a page). Only
 * when the plan is confirmed: an unconfirmed "Free" (no Partner API set up) must never switch off a
 * paying store's offers.
 */
const applied = new Map<string, PlanKey>();
export function keepWithinPlan(admin: AdminClient, shop: string, info: PlanInfo) {
  if (info.source === "error" || info.source === "none" || applied.get(shop) === info.plan) return;
  applied.set(shop, info.plan);
  applyPlanLimits(admin, info.plan).catch((e) => {
    applied.delete(shop);
    console.error(`Plan limits for ${shop}:`, e);
  });
}

/**
 * For save actions: may this item be switched on? Counts the ones already on (not this one).
 * Returns null when allowed, otherwise { error, upgrade } for the page's error banner.
 */
export async function checkLimit(admin: AdminClient, shop: string, key: "upsellOffers" | "crossSellOffers" | "bundlesAndDeals", self: { active: boolean; handle?: string | null }) {
  if (!self.active) return null;
  const info = await getPlan(admin, shop);
  if (limitOf(info.plan, key) === null) return null;
  let othersOn: number;
  if (key === "bundlesAndDeals") {
    // Bundle products (kits) count too; `handle` is the kit's product id when saving one.
    const [bundles, deals, kits] = await Promise.all([listBundles(admin), listDeals(admin), listKitIds(admin)]);
    othersOn = [...bundles, ...deals].filter((x) => x.active && x.handle !== self.handle).length + kits.filter((id) => id !== self.handle).length;
  } else {
    const kind = key === "upsellOffers" ? "upsell" : "cross_sell";
    othersOn = (await listRules(admin, kind)).filter((r) => r.active && r.handle !== self.handle).length;
  }
  const error = limitError(info.plan, key, othersOn);
  return error ? { error, upgrade: info.planUrl } : null;
}
