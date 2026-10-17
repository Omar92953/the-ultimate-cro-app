/**
 * The rules every save must follow, whoever saves: the admin pages and the MCP tools (lib/mcp) call
 * the same functions, so an assistant never gets around a plan limit. Failing a rule throws a
 * RuleError whose message is what the merchant reads. Pure (no Shopify calls): the checks that need the
 * store (offer slots, checkout rules) are in rules.server.ts.
 */
import type { FeatureKey } from "./catalog";
import { isLocked, pageLock } from "./plan-gate";
import { EXTRA_PLAN, FEATURE_PLAN, PLANS, atLeast, limitOf, planAbove, type PlanKey } from "./plans";
import { MAX_CHARTS, MAX_COLUMNS, MAX_ROWS } from "./size-guide";

/** "plan": needs a higher plan. "limit": a counted limit is reached. "input": the values are not allowed. */
export type RuleKind = "plan" | "limit" | "input";

export class RuleError extends Error {
  readonly kind: RuleKind;
  /** The merchant can fix it by choosing a plan (the pages show an upgrade button). */
  readonly upgrade: boolean;
  constructor(message: string, kind: RuleKind, upgrade = kind !== "input") {
    super(message);
    this.name = "RuleError";
    this.kind = kind;
    this.upgrade = upgrade;
  }
}
export const isRuleError = (e: unknown): e is RuleError => e instanceof RuleError;

/** Shopify silently ignores Function metafields over 10,000 bytes; keep a margin. */
export const FUNCTION_METAFIELD_LIMIT = 9500;

const needsPlan = (p: PlanKey) => `This needs the ${PLANS[p].name} plan.`;

/** May this plan use this feature (its free trial feature counts as unlocked)? */
export function requireFeature(plan: PlanKey, f: FeatureKey, trial: FeatureKey | null = null) {
  if (isLocked(plan, f, trial)) throw new RuleError(needsPlan(FEATURE_PLAN[f]), "plan");
}

/** May this plan open and save this admin page (an address like /app/designs/faq?design=2)? */
export function requirePage(plan: PlanKey, pathname: string, search = "", trial: FeatureKey | null = null) {
  const lock = pageLock(plan, pathname, search, trial);
  if (lock) throw new RuleError(needsPlan(lock.needs), "plan");
}

/** Sending a feature request is included from one plan up (plans.ts EXTRA_PLAN). */
export function requireFeatureRequests(plan: PlanKey) {
  if (!atLeast(plan, EXTRA_PLAN.featureRequests)) throw new RuleError(`Requests are included from the ${PLANS[EXTRA_PLAN.featureRequests].name} plan.`, "plan");
}

/** Styles 2 to 5 of a section need a plan with more styles per section (plans.ts designsPerSection). */
export function requireStyleSlot(plan: PlanKey, slot: number) {
  const allowed = limitOf(plan, "designsPerSection");
  if (allowed !== null && slot > allowed) throw new RuleError(needsPlan(planAbove("designsPerSection", slot - 1, plan) ?? "pro"), "plan");
}

/** A Function's metafield must stay under Shopify's size limit. */
export function requireFunctionSize(value: string, what: string) {
  if (value.length > FUNCTION_METAFIELD_LIMIT) throw new RuleError(`${what} is too large for Shopify's checkout engine (${value.length} of ${FUNCTION_METAFIELD_LIMIT} bytes). Use collections instead of long product lists.`, "input", false);
}

/**
 * The size guide's limits, said out loud. The saved copy is cut to these (withSizeGuideDefaults); the
 * admin shows the buttons greyed, but a tool call can send anything, so it is told what was too much.
 */
export function requireSizeGuide(raw: unknown) {
  const r = (raw && typeof raw === "object" ? raw : {}) as { charts?: unknown };
  if (r.charts === undefined) return;
  if (!Array.isArray(r.charts)) throw new RuleError("The size guide needs a list of charts.", "input", false);
  if (r.charts.length > MAX_CHARTS) throw new RuleError(`A size guide can have up to ${MAX_CHARTS} charts.`, "input", false);
  r.charts.forEach((c, i) => {
    const ch = (c && typeof c === "object" ? c : {}) as { columns?: unknown; rows?: unknown; name?: unknown };
    const name = typeof ch.name === "string" && ch.name ? `“${ch.name}”` : `chart ${i + 1}`;
    if (Array.isArray(ch.columns) && ch.columns.length > MAX_COLUMNS) throw new RuleError(`Chart ${name} can have up to ${MAX_COLUMNS} columns.`, "input", false);
    if (Array.isArray(ch.rows) && ch.rows.length > MAX_ROWS) throw new RuleError(`Chart ${name} can have up to ${MAX_ROWS} sizes.`, "input", false);
  });
}


