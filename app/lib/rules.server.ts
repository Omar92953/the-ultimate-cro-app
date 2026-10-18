/**
 * The rules that need the store (what is switched on now). Same RuleError as rules.ts, used by the admin
 * save actions and the MCP tools. The counting itself stays in billing.server.ts.
 */
import type { AdminClient } from "./admin.server";
import { checkCheckoutRules, checkCount, checkLimit, getPlan, getPlanState } from "./billing.server";
import type { CheckoutKind } from "./checkout-rules";
import { PLANS, type PlanKey } from "./plans";
import { RuleError, requireFeature } from "./rules";
import { dealFeature, type FeatureKey } from "./catalog";
import { validateDeal, type Deal } from "./deals";
import { validateBundle } from "./validate";
import { validateKit, type Kit } from "./kits";
import type { Bundle } from "./types";

type Limited = { error: string; upgrade: string | null } | null;
const refuse = (over: Limited) => {
  if (over) throw new RuleError(over.error, "limit");
};

/** The store's plan and its free trial feature, for requireFeature / requirePage. */
export async function planContext(admin: AdminClient, shop: string): Promise<{ plan: PlanKey; trial: FeatureKey | null; planUrl: string }> {
  const info = await getPlan(admin, shop);
  const trial = PLANS[info.plan].limits.trialFeatures ? ((await getPlanState(admin).catch(() => null))?.trial ?? null) : null;
  return { plan: info.plan, trial, planUrl: info.planUrl };
}

/** May this offer be on? Every offer type fills one of the plan's offer slots; an offer can always be saved off. */
export async function requireOfferSlot(admin: AdminClient, shop: string, self: { active: boolean; handle?: string | null; id?: string | null }) {
  refuse(await checkLimit(admin, shop, "offerSlots", self));
}

/**
 * May this deal (buy X get Y, volume, gift, upgrade, fixed bundle) be saved, and switched on if it is on? The plan includes its feature,
 * its settings are complete, and it fits the plan's offer slots. The admin's deal page and the MCP discount tools both use this.
 */
export async function requireDeal(admin: AdminClient, shop: string, deal: Deal) {
  const { plan, trial } = await planContext(admin, shop);
  requireFeature(plan, dealFeature(deal.kind), trial);
  const problems = validateDeal(deal);
  if (problems.length) throw new RuleError(problems.join(" "), "input", false);
  await requireOfferSlot(admin, shop, deal);
}

/**
 * May this bundle (mix and match, build your own, tiered, fixed price) be saved, and switched on if it is on? The plan includes bundles, the
 * bundle is complete (`others` are the store's other bundles), and it fits the offer slots. The admin's bundle page and the MCP bundle tools use this.
 */
export async function requireBundle(admin: AdminClient, shop: string, bundle: Bundle, others: Bundle[]) {
  const { plan, trial } = await planContext(admin, shop);
  requireFeature(plan, "bundles", trial);
  const problems = validateBundle(bundle, others);
  if (problems.length) throw new RuleError(problems.join(" "), "input", false);
  await requireOfferSlot(admin, shop, bundle);
}

/** The same for a fixed bundle sold as its own product (a kit): it fills an offer slot when it is new. */
export async function requireKit(admin: AdminClient, shop: string, kit: Kit) {
  const { plan, trial } = await planContext(admin, shop);
  requireFeature(plan, "bundles", trial);
  const problems = validateKit(kit);
  if (problems.length) throw new RuleError(problems.join(" "), "input", false);
  if (!kit.productId) await requireOfferSlot(admin, shop, { active: true, handle: null });
}

/** Checkout rules count together across payment, delivery and order limits. */
export async function requireCheckoutRules(admin: AdminClient, shop: string, kind: CheckoutKind, onHere: number) {
  refuse(await checkCheckoutRules(admin, shop, kind, onHere));
}

/** Pages with their own counted limit (countdown places, thank-you modules). */
export async function requireCount(admin: AdminClient, shop: string, key: "countdownPlaces" | "thankYouModules", othersOn: number, onHere: number) {
  refuse(await checkCount(admin, shop, key, othersOn, onHere));
}
