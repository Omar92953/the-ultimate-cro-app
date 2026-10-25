/**
 * Which plan a shop is on, and keeping the store within it. Plans, prices and limits: plans.ts.
 *
 * Billing is Shopify App Pricing: plans are created in the Partner Dashboard. Merchants choose on the
 * app's Plans page (/app/plans), whose buttons open Shopify's approval page for one plan
 * (plans.ts → planApproveUrl), never Shopify's pricing_plans page. The app NEVER creates charges (no
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
import { listBundles, listDeals, listRules, remove, syncBundles, syncDiscounts, upsert } from "./cro.server";
import { parkPlan, parkedHandle } from "./plan-park";
import { setTestsPaused } from "./ab-tests.server";
import { forgetShop, remember } from "./short-cache.server";
import { setBillingYearly } from "./usage.server";
import { timed } from "./timing.server";
import { listKitIds } from "./kits.server";
import { listOffers } from "./offers.server";
import { getPostPurchase } from "./post-purchase.server";
import { getCheckoutRules, saveCheckoutRules } from "./checkout-rules.server";
import type { CheckoutKind } from "./checkout-rules";
import type { FeatureKey } from "./catalog";
import { DEFAULT_APP_HANDLE, FEATURE_PLAN, PLAN_KEYS, atLeast, canResume, isPlanKey, limitError, limitOf, overLimit, planFromSubscription, planPageUrl, type LimitKey, type PlanKey } from "./plans";

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
  /**
   * Billed yearly ("Growth yearly", "Pro yearly"): Shopify App Pricing can't charge usage on a yearly plan, so the
   * plan's limits are hard stops there and "Allow extra" is off (usage.server.ts `setBillingYearly`).
   */
  yearly: boolean;
  /** Shopify's plan selection page for this shop. */
  planUrl: string;
};

/** A yearly subscription, by its plan's handle or name ("growth-yearly", "Pro yearly") or Shopify's interval. */
export const isYearly = (...names: (string | null | undefined)[]) => names.some((n) => /year|annual/i.test(n ?? ""));

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
  if (!sub) return { plan: "free", source: "partner", subscription: null, trialEndsAt: null, yearly: false };
  const item = sub.items.map((i) => ({ i, plan: planFromSubscription(i.handle) ?? planFromSubscription(i.description) })).find((x) => x.plan);
  return { plan: item?.plan ?? "free", source: "partner", subscription: item?.i.description ?? item?.i.handle ?? null, trialEndsAt: sub.trialEndsAt, yearly: !!item && isYearly(item.i.handle, item.i.description) };
}

async function fromAdminApi(admin: AdminClient): Promise<Omit<PlanInfo, "planUrl">> {
  const data = await gql(admin, `#graphql
    query CroActiveSubscriptions { currentAppInstallation { activeSubscriptions { name status trialDays createdAt lineItems { plan { pricingDetails { ... on AppRecurringPricing { interval } } } } } } }`);
  const subs: { name: string; status: string; trialDays: number; createdAt: string; lineItems?: { plan?: { pricingDetails?: { interval?: string | null } | null } | null }[] | null }[] = data.currentAppInstallation?.activeSubscriptions ?? [];
  const active = subs.filter((s) => s.status === "ACTIVE");
  // The highest plan wins if Shopify ever lists two (e.g. during a plan change).
  const best = active
    .map((s) => ({ s, plan: planFromSubscription(s.name) }))
    .filter((x): x is { s: (typeof subs)[number]; plan: PlanKey } => !!x.plan)
    .sort((a, b) => PLAN_KEYS.indexOf(b.plan) - PLAN_KEYS.indexOf(a.plan))[0];
  if (!best) return { plan: "free", source: active.length ? "admin" : "none", subscription: active[0]?.name ?? null, trialEndsAt: null, yearly: false };
  const trialEnd = best.s.trialDays ? new Date(Date.parse(best.s.createdAt) + best.s.trialDays * 864e5) : null;
  return {
    plan: best.plan,
    source: "admin",
    subscription: best.s.name,
    trialEndsAt: trialEnd && trialEnd.getTime() > Date.now() ? trialEnd.toISOString() : null,
    yearly: isYearly(best.s.name, ...(best.s.lineItems ?? []).map((l) => l.plan?.pricingDetails?.interval)),
  };
}

/**
 * The shop's plan. Remembered for 5 minutes per shop (short-cache.server.ts). Pass `fresh` right
 * after Shopify sends the merchant back from the plan selection page (?plan_handle=… on the URL).
 */
/** The plan is read from Shopify once per 5 minutes per shop; coming back from the plan page (?plan_handle) reads it again. */
const PLAN_MS = 5 * 60000;

export function getPlan(admin: AdminClient, shop: string, fresh = false): Promise<PlanInfo> {
  const planUrl = planPageUrl(shop, appHandle());
  const forced = override();
  if (forced) return Promise.resolve({ plan: forced, source: "override", subscription: null, trialEndsAt: null, yearly: process.env.CRO_PLAN_YEARLY === "1", planUrl });
  const load = async (): Promise<PlanInfo> => {
    try {
      const info = (await fromPartnerApi(admin)) ?? (await fromAdminApi(admin));
      return { ...info, planUrl };
    } catch (e) {
      console.error(`Plan check failed for ${shop}:`, e);
      return { plan: "pro", source: "error", subscription: null, trialEndsAt: null, yearly: false, planUrl };
    }
  };
  // Back from the plan page: everything remembered for the shop may depend on the old plan.
  if (fresh) forgetShop(shop);
  return timed("plan", () => remember(shop, "plan", PLAN_MS, load));
}

/**
 * All of the store's orders this calendar month (UTC), for the soft order limit (plans.ts
 * monthlyOrders). Shopify's order count works before the protected customer data approval; null
 * when the read fails (then no banner is shown).
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

type PausedItem = { type: "rule" | "bundle" | "deal" | "checkout"; handle: string; name: string; limit: LimitKey };
/**
 * `parked`: storefront designs of features the plan locks, moved aside (plan-park.ts). `tried`: features a Free store
 * tried before moving its trial to another one; they keep working on the store until the plan changes.
 */
export type PlanState = { plan: PlanKey | null; paused: PausedItem[]; at: string | null; trial?: FeatureKey | null; parked?: string[]; tried?: FeatureKey[] };
const EMPTY_STATE: PlanState = { plan: null, paused: [], at: null, trial: null };

export async function getPlanState(admin: AdminClient): Promise<PlanState> {
  const data = await gql(admin, `#graphql
    query CroPlanState { metaobjectByHandle(handle: { type: "$app:cro_design", handle: "plan_state" }) { field(key: "config") { value } } }`);
  try {
    const v = JSON.parse(data.metaobjectByHandle?.field?.value ?? "null");
    return v && Array.isArray(v.paused)
      ? { plan: isPlanKey(v.plan) ? v.plan : null, paused: v.paused, at: v.at ?? null, trial: typeof v.trial === "string" && v.trial in FEATURE_PLAN ? (v.trial as FeatureKey) : null, parked: Array.isArray(v.parked) ? v.parked.filter((h: unknown): h is string => typeof h === "string") : [], tried: Array.isArray(v.tried) ? v.tried.filter((f: unknown): f is FeatureKey => typeof f === "string" && f in FEATURE_PLAN) : [] }
      : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

async function savePlanState(admin: AdminClient, state: PlanState) {
  await upsert(admin, "$app:cro_design", "plan_state", { config: JSON.stringify(state) });
}

/**
 * Free stores try 1 Starter feature of their choice (plans.ts `trialFeatures`). Choosing another
 * one moves the trial: the old one keeps working on the store but can't be edited.
 */
export async function setTrialFeature(admin: AdminClient, key: FeatureKey | null, shop?: string) {
  const state = await getPlanState(admin);
  // The feature tried before keeps working on the store (see above) until the plan changes.
  const tried = [...new Set([...(state.tried ?? []), ...(state.trial && state.trial !== key ? [state.trial] : [])])];
  await savePlanState(admin, { ...state, trial: key, tried });
  // The next page load checks the plan again, so a feature chosen now comes back on the store if it was moved aside.
  if (shop) applied.delete(shop);
}

const TYPE: Record<Exclude<PausedItem["type"], "checkout">, string> = { rule: "$app:cro_rule", bundle: "$app:cro_bundle", deal: "$app:cro_deal" };
const CHECKOUT_KINDS: CheckoutKind[] = ["payment", "delivery", "validation"];

/**
 * Switches off what's over the plan's limits (first N stay on) and, after an upgrade, switches back
 * on what the app paused before. Nothing is ever deleted. Returns the stored state.
 * Offer slots count every offer type together, in the order the Offers hub lists them; bundle
 * products (real products) and the after-purchase offer fill slots but are never switched off, so
 * the others are paused first. Checkout rules count payment, delivery and order limits together.
 */
/** One $app:cro_design row: its id and settings, or null. */
async function designRow(admin: AdminClient, handle: string): Promise<{ id: string; config: string } | null> {
  const d = await gql(admin, `#graphql
    query CroDesignRow($handle: String!) { metaobjectByHandle(handle: { type: "$app:cro_design", handle: $handle }) { id field(key: "config") { value } } }`, { handle });
  return d.metaobjectByHandle?.id ? { id: d.metaobjectByHandle.id, config: d.metaobjectByHandle.field?.value ?? "" } : null;
}

/**
 * Storefront designs of features the plan locks are moved aside ("<handle>__off": the theme block draws nothing), and
 * moved back when the plan includes them again (plan-park.ts). Returns the handles parked now.
 */
async function parkFeatures(admin: AdminClient, plan: PlanKey, state: PlanState) {
  // Features tried on this plan stay on (until the plan changes, when `tried` is cleared below).
  const tried = state.plan === plan ? state.tried ?? [] : [];
  const { park, unpark } = parkPlan(plan, state.trial ?? null, state.parked ?? [], tried);
  const parked = new Set(state.parked ?? []);
  for (const h of park) {
    const row = await designRow(admin, h);
    if (row) {
      await upsert(admin, "$app:cro_design", parkedHandle(h), { config: row.config });
      await remove(admin, row.id);
    }
    parked.add(h);
  }
  for (const h of unpark) {
    const row = await designRow(admin, parkedHandle(h));
    // Saved again while parked (an upgrade in between): the newer design stays.
    if (row && !(await designRow(admin, h))) await upsert(admin, "$app:cro_design", h, { config: row.config });
    if (row) await remove(admin, row.id);
    parked.delete(h);
  }
  return { parked: [...parked], changed: park.length + unpark.length > 0 };
}

export type PlanSync = { discounts: (admin: AdminClient) => Promise<unknown>; bundles: (admin: AdminClient) => Promise<unknown> };

export async function applyPlanLimits(admin: AdminClient, plan: PlanKey, sync: PlanSync = { discounts: syncDiscounts, bundles: syncBundles }): Promise<PlanState> {
  const [rules, bundles, deals, kits, post, checkout, state] = await Promise.all([
    listRules(admin),
    listBundles(admin),
    listDeals(admin),
    listKitIds(admin).catch(() => [] as string[]),
    getPostPurchase(admin).catch(() => null),
    getCheckoutRules(admin).catch(() => null),
    getPlanState(admin),
  ]);
  type Item = { type: PausedItem["type"]; handle: string; name: string; active: boolean; limit: LimitKey };
  const offers: Item[] = [
    ...rules.filter((r) => r.kind === "upsell").map((r): Item => ({ type: "rule", handle: r.handle!, name: r.name, active: r.active, limit: "offerSlots" })),
    ...rules.filter((r) => r.kind === "cross_sell").map((r): Item => ({ type: "rule", handle: r.handle!, name: r.name, active: r.active, limit: "offerSlots" })),
    ...bundles.map((b): Item => ({ type: "bundle", handle: b.handle!, name: b.name, active: b.active, limit: "offerSlots" })),
    ...deals.map((d): Item => ({ type: "deal", handle: d.handle!, name: d.name, active: d.active, limit: "offerSlots" })),
  ];
  const fixedSlots = kits.length + (post?.config.on ? 1 : 0);
  const checks: Item[] = checkout
    ? CHECKOUT_KINDS.flatMap((k) => checkout[k].rules.map((r): Item => ({ type: "checkout", handle: `${k}:${r.id}`, name: checkoutRuleName(k), active: r.on, limit: "checkoutRules" })))
    : [];
  const groups: [LimitKey, Item[], number][] = [["offerSlots", offers, fixedSlots], ["checkoutRules", checks, 0]];

  // Still paused = still saved and still off (the merchant may have deleted or switched one on since).
  const off = new Set(groups.flatMap(([, items]) => items).filter((i) => !i.active).map((i) => `${i.type}:${i.handle}`));
  let paused = state.paused.filter((p) => off.has(`${p.type}:${p.handle}`));
  const turnOff: Item[] = [];
  const turnOn: PausedItem[] = [];
  for (const [key, items, fixed] of groups) {
    const raw = limitOf(plan, key);
    const limit = raw === null ? null : Math.max(0, raw - fixed);
    const over = overLimit(items, limit);
    turnOff.push(...over);
    const activeNow = items.filter((i) => i.active).length - over.length;
    if (!over.length) turnOn.push(...canResume(paused.filter((p) => p.limit === key), activeNow, limit));
  }
  // Theme features the plan locks, and A/B tests below Pro (paused, running again after an upgrade).
  const features = await parkFeatures(admin, plan, state);
  const ab = await setTestsPaused(admin, !atLeast(plan, FEATURE_PLAN.ab_tests)).catch(() => ({ moved: 0, discounts: false }));
  if (!turnOff.length && !turnOn.length && state.plan === plan && !features.changed && !ab.moved) return { ...state, paused, parked: features.parked };

  const changes = [...turnOff.map((i) => ({ ...i, on: false })), ...turnOn.map((p) => ({ ...p, on: true }))];
  for (const c of changes) if (c.type !== "checkout") await upsert(admin, TYPE[c.type], c.handle, { active: String(c.on) });
  if (checkout) {
    for (const kind of CHECKOUT_KINDS) {
      const mine = changes.filter((c) => c.type === "checkout" && c.handle.startsWith(`${kind}:`));
      if (!mine.length) continue;
      const set = new Map(mine.map((c) => [c.handle.slice(kind.length + 1), c.on]));
      const next = checkout[kind].rules.map((r) => (set.has(r.id) ? { ...r, on: set.get(r.id)! } : r));
      await saveCheckoutRules(admin, kind, next, checkout[kind].enabled);
    }
  }
  const resumed = new Set(turnOn.map((p) => `${p.type}:${p.handle}`));
  paused = [...paused.filter((p) => !resumed.has(`${p.type}:${p.handle}`)), ...turnOff.map(({ type, handle, name, limit }) => ({ type, handle, name, limit }))];
  if (changes.some((c) => c.type === "rule" || c.type === "deal") || ab.discounts) await sync.discounts(admin);
  if (changes.some((c) => c.type === "bundle")) await sync.bundles(admin);
  const next: PlanState = { ...state, plan, paused, parked: features.parked, tried: state.plan === plan ? state.tried ?? [] : [], at: new Date().toISOString() };
  await savePlanState(admin, next);
  return next;
}

const checkoutRuleName = (k: CheckoutKind) => (k === "payment" ? "A payment rule" : k === "delivery" ? "A delivery rule" : "An order limit");

/**
 * Runs applyPlanLimits once per plan change per shop (in the background; never slows a page). Only
 * when the plan is confirmed: an unconfirmed "Free" (no Partner API set up) must never switch off a
 * paying store's offers.
 */
const applied = new Map<string, string>();
export function keepWithinPlan(admin: AdminClient, shop: string, info: PlanInfo) {
  const key = `${info.plan}${info.yearly ? ":yearly" : ""}`;
  if (info.source === "error" || info.source === "none" || applied.get(shop) === key) return;
  applied.set(shop, key);
  // Yearly billing has no usage charges: its limits are hard stops ("Allow extra" off).
  setBillingYearly(shop, info.yearly)
    .then(() => applyPlanLimits(admin, info.plan))
    // The loyalty widget is not a theme design (plan-park.ts): it is saved again for the new plan.
    .then(() => import("./loyalty/storefront.server").then((m) => m.republishLoyalty(admin, shop)))
    .catch((e) => {
      applied.delete(shop);
      console.error(`Plan limits for ${shop}:`, e);
    });
}

/**
 * For save actions: may this offer be switched on? Every offer type fills one of the plan's offer
 * slots (plans.ts). `self` is the offer being saved (its id/handle, or a kit's product id), so it
 * isn't counted twice. Returns null when allowed, otherwise { error, upgrade } for the page.
 */
export async function checkLimit(admin: AdminClient, shop: string, key: "offerSlots", self: { active: boolean; handle?: string | null; id?: string | null }) {
  if (!self.active) return null;
  const info = await getPlan(admin, shop);
  if (limitOf(info.plan, key) === null) return null;
  const offers = await listOffers(admin);
  const othersOn = offers.filter((o) => o.active && o.id !== self.id && !(self.handle && o.href.endsWith(`/${self.handle}`))).length;
  const error = limitError(info.plan, key, othersOn);
  return error ? { error, upgrade: info.planUrl } : null;
}

/** For the checkout rules page: may this many rules be on (all kinds together)? */
export async function checkCheckoutRules(admin: AdminClient, shop: string, kind: CheckoutKind, onHere: number) {
  const info = await getPlan(admin, shop);
  if (limitOf(info.plan, "checkoutRules") === null) return null;
  const all = await getCheckoutRules(admin);
  const others = CHECKOUT_KINDS.filter((k) => k !== kind).reduce((n, k) => n + all[k].rules.filter((r) => r.on).length, 0);
  const error = onHere > 0 ? limitError(info.plan, "checkoutRules", others + onHere - 1) : null;
  return error ? { error, upgrade: info.planUrl } : null;
}

/** For pages with their own counted limit (countdown places, thank-you modules): may `onHere` more be on, next to `othersOn`? */
export async function checkCount(admin: AdminClient, shop: string, key: "countdownPlaces" | "thankYouModules", othersOn: number, onHere: number) {
  if (onHere <= 0) return null;
  const info = await getPlan(admin, shop);
  if (limitOf(info.plan, key) === null) return null;
  const error = limitError(info.plan, key, othersOn + onHere - 1);
  return error ? { error, upgrade: info.planUrl } : null;
}
