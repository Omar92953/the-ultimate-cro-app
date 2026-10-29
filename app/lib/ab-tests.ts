/**
 * A/B tests for offers (Pro): shoppers are split evenly between version A (the offer as saved) and up to three
 * other versions, B, C and D (some of its words, its discount, its style). A shopper keeps the same version (stored
 * in the browser and on the cart as `_cro_ab`), so orders can be told apart. Only upsells and cross sells for now.
 * Pure: shared by the app, the storefront copy and the tests.
 */
import { validateRule } from "./validate";
import type { Rule } from "./types";

export const AB_KINDS = ["upsell", "cross_sell"] as const;
export type AbKind = (typeof AB_KINDS)[number];
export const MAX_RUNNING_TESTS = 5;
/** Version A (the offer as saved) and up to three others. */
export const AB_GROUPS = ["A", "B", "C", "D"] as const;
export type AbGroup = (typeof AB_GROUPS)[number];
export const MAX_VERSIONS = AB_GROUPS.length;
export const isGroup = (g: unknown): g is AbGroup => (AB_GROUPS as readonly unknown[]).includes(g);
/** Version B changes at most these; everything else (products, triggers, placements) is shared. */
export type AbTier = { qty: number; pct: number; value?: string; label?: string; badge?: string };
export type AbOverrides = {
  headline?: string;
  subheadline?: string;
  buttonLabel?: string;
  discountLabel?: string;
  /** Cross sell. */
  discountPercent?: number;
  /** Upsell: the same tiers (same quantities or option values) with other discounts, labels or badges. */
  tiers?: AbTier[];
  /** The style (2 to 5) the offer uses, 1 = the group's default. */
  design?: number;
};
/** "paused": was running when the store went below Pro; it runs again after an upgrade (billing.server.ts applyPlanLimits). */
export type AbStatus = "running" | "paused" | "stopped" | "applied";
export type AbTest = {
  id: string;
  name: string;
  /** The offer's handle (upsells and cross sells are rules). */
  offer: string;
  kind: AbKind;
  status: AbStatus;
  startedAt: string;
  endedAt: string | null;
  /** Set when the test ended with a winner chosen. */
  winner: AbGroup | null;
  /** Version B. */
  b: AbOverrides;
  /** Versions C and D, when the test has them. */
  more?: AbOverrides[];
};

/** The versions other than A, in order: B, then C and D when the test has them. */
export const challengers = (t: Pick<AbTest, "b" | "more">): AbOverrides[] => [t.b, ...(t.more ?? [])].slice(0, MAX_VERSIONS - 1);
/** Every group of the test: A, B and C, D when it has them. */
export const groupsOf = (t: Pick<AbTest, "b" | "more">): AbGroup[] => AB_GROUPS.slice(0, 1 + challengers(t).length) as AbGroup[];
/** A version's changes (null for A, the offer as saved). */
export const overridesOf = (t: Pick<AbTest, "b" | "more">, g: AbGroup): AbOverrides | null => (g === "A" ? null : (challengers(t)[AB_GROUPS.indexOf(g) - 1] ?? null));

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** B's overrides, cleaned for this kind of offer: only known fields, only when they were sent. */
export function cleanOverrides(kind: AbKind, raw: unknown): AbOverrides {
  const r = obj(raw);
  const out: AbOverrides = {};
  for (const [key, max] of [["headline", 120], ["subheadline", 200], ["buttonLabel", 60], ["discountLabel", 60]] as const) {
    const v = text(r[key], max);
    if (v !== undefined) out[key] = v;
  }
  if (kind === "cross_sell" && r.discountPercent !== undefined) out.discountPercent = Math.round(Number(r.discountPercent) * 100) / 100;
  if (kind === "upsell" && Array.isArray(r.tiers)) {
    out.tiers = r.tiers.slice(0, 8).map((t) => {
      const o = obj(t);
      return { qty: Number(o.qty), pct: Math.round(Number(o.pct) * 100) / 100, ...(text(o.value, 60) ? { value: text(o.value, 60) } : {}), ...(text(o.label, 40) ? { label: text(o.label, 40) } : {}), ...(text(o.badge, 30) ? { badge: text(o.badge, 30) } : {}) };
    });
  }
  if (r.design !== undefined) out.design = Math.min(5, Math.max(1, Math.round(Number(r.design)) || 1));
  return out;
}

/** The offer with B's changes laid over it (what version B shows and charges). */
export function applyOverrides(rule: Rule, b: AbOverrides): Rule {
  const next: Rule = { ...rule };
  if (b.headline !== undefined) next.headline = b.headline;
  if (b.subheadline !== undefined) next.subheadline = b.subheadline;
  if (b.buttonLabel !== undefined) next.buttonLabel = b.buttonLabel;
  if (b.discountLabel !== undefined) next.discountLabel = b.discountLabel;
  if (b.discountPercent !== undefined && rule.kind === "cross_sell") next.discountPercent = b.discountPercent;
  if (b.tiers !== undefined && rule.kind === "upsell") next.tiers = b.tiers.map((t) => ({ ...t }));
  if (b.design !== undefined) next.design = b.design;
  return next;
}

/** Problems with a test, said in the merchant's words; empty when it can run. `name` is the version ("B", "C", "D"). */
export function validateTest(rule: Rule | null, kind: AbKind, b: AbOverrides, name: AbGroup = "B"): string[] {
  if (!rule) return ["Choose an upsell or cross sell offer."];
  if (rule.kind !== kind) return ["That offer is not a " + (kind === "upsell" ? "upsell" : "cross sell") + "."];
  if (!Object.keys(b).length) return [`Change at least one thing in version ${name}: a text, the discount or the style.`];
  const errors: string[] = [];
  if (b.tiers && rule.kind === "upsell") {
    const same = rule.upsellType === "variant" ? (t: AbTier) => String(t.value ?? "").toLowerCase() : (t: AbTier) => String(t.qty);
    const a = rule.tiers.map(same).sort().join("|");
    if (b.tiers.map(same).sort().join("|") !== a) errors.push(`Version ${name} keeps the same quantities (or option values) as the offer: change the discounts, not the tiers.`);
  }
  errors.push(...validateRule(applyOverrides(rule, b)));
  return [...new Set(errors)];
}

/** Every version of a test checked; empty when it can run. Two versions may not be the same. */
export function validateVersions(rule: Rule | null, kind: AbKind, versions: AbOverrides[]): string[] {
  if (!versions.length) return ["Add version B: change a text, the discount or the style."];
  if (versions.length > MAX_VERSIONS - 1) return [`A test has up to ${MAX_VERSIONS} versions.`];
  const errors = versions.flatMap((v, i) => validateTest(rule, kind, v, AB_GROUPS[i + 1]));
  const seen = new Set<string>();
  versions.forEach((v, i) => {
    const key = JSON.stringify(Object.keys(v).sort().map((k) => [k, v[k as keyof AbOverrides]]));
    if (seen.has(key)) errors.push(`Version ${AB_GROUPS[i + 1]} is the same as another version: change it or remove it.`);
    seen.add(key);
  });
  return [...new Set(errors)];
}

/** Does this version change the price the shopper pays? Then the discount engine must know the group. */
export const changesDiscount = (b: AbOverrides) => b.discountPercent !== undefined || b.tiers !== undefined;
/** Does any version of the test change the price? */
export const testChangesDiscount = (t: Pick<AbTest, "b" | "more">) => challengers(t).some(changesDiscount);

/** What the offer blocks read ($app:cro_design "ab_tests"): running tests by offer handle, with B's full values. */
export function toStorefrontAbTests(tests: AbTest[], rules: Rule[]) {
  const out: Record<string, unknown> = {};
  for (const t of tests) {
    if (t.status !== "running") continue;
    const rule = rules.find((r) => r.handle === t.offer);
    if (!rule) continue;
    const shown = (o: AbOverrides) => {
      const v = applyOverrides(rule, o);
      return { headline: v.headline, subheadline: v.subheadline, button_label: v.buttonLabel, discount_percent: v.discountPercent, tiers: v.tiers, design: v.design ?? 0, discount_label: v.discountLabel };
    };
    const v = Object.fromEntries(challengers(t).map((o, i) => [AB_GROUPS[i + 1], shown(o)]));
    // "b" stays for blocks that only know two versions; "v" has every version but A, "n" how many there are.
    out[t.offer] = { id: t.id, n: 1 + challengers(t).length, b: v.B, v };
  }
  return out as Record<string, { id: string; n: number; b: Record<string, unknown>; v: Record<string, Record<string, unknown>> }>;
}

/** What the discount engine reads: the test id and the pieces of B that change the price. */
export function functionAb(test: AbTest | undefined, rule: Rule) {
  if (!test || test.status !== "running") return null;
  const priced = (o: AbOverrides) => {
    const v = applyOverrides(rule, o);
    const label = v.discountLabel || v.headline || v.name;
    return { ...(rule.kind === "cross_sell" ? { pct: v.discountPercent } : { tiers: v.tiers.map((t) => (rule.upsellType === "variant" ? { value: t.value || "", pct: t.pct } : { qty: t.qty, pct: t.pct })) }), label };
  };
  const [b, ...more] = challengers(test);
  // C and D only when the test has them, so a two version test stays as small as before.
  return { id: test.id, b: priced(b), ...(more.length ? { v: Object.fromEntries(more.map((o, i) => [AB_GROUPS[i + 2], priced(o)])) } : {}) };
}

/* -------------------------------------------------------------- results -- */
export type GroupStats = { views: number; orders: number; revenue: number; adds: number };
export type AbResult = {
  /** The test's groups, in order (A, B and C, D when it has them). */
  order: AbGroup[];
  groups: Partial<Record<AbGroup, GroupStats>>;
  /** Orders per view, per group. */
  rate: Partial<Record<AbGroup, number | null>>;
  /** Revenue per view, per group. */
  perView: Partial<Record<AbGroup, number | null>>;
  leader: AbGroup | null;
  /** 0 to 100: how sure we are that the leader's order rate is really higher. */
  sure: number | null;
  /** "wait": not enough shoppers; "close": no clear difference; "likely": probably; "clear": clearly. */
  verdict: "wait" | "close" | "likely" | "clear";
};

/** Standard normal CDF (Abramowitz and Stegun 7.1.26). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export const MIN_VIEWS = 100;
export const MIN_ORDERS = 10;

/** How sure we are that x's order rate is really different from y's: 1 minus the two sided p value, in percent. */
function sureOf(x: GroupStats, y: GroupStats) {
  const pooled = (x.orders + y.orders) / (x.views + y.views);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / x.views + 1 / y.views));
  const z = se > 0 ? (x.orders / x.views - y.orders / y.views) / se : 0;
  return Math.round((1 - 2 * (1 - normalCdf(Math.abs(z)))) * 1000) / 10;
}

/**
 * Which version earns more and how sure we are. Orders per view are compared with a two proportion z test between
 * the best version and the next best, so with more versions the leader still has to beat every other one. Nothing
 * is said before each version has MIN_VIEWS views and all have MIN_ORDERS orders together, so a lucky start is not
 * called a winner.
 */
export function compareVersions(groups: Partial<Record<AbGroup, GroupStats>>): AbResult {
  const order = AB_GROUPS.filter((g) => groups[g]) as AbGroup[];
  const stats = order.map((g) => groups[g]!);
  const rate = Object.fromEntries(order.map((g) => [g, groups[g]!.views > 0 ? groups[g]!.orders / groups[g]!.views : null]));
  const perView = Object.fromEntries(order.map((g) => [g, groups[g]!.views > 0 ? groups[g]!.revenue / groups[g]!.views : null]));
  const base = { order, groups, rate, perView };
  if (stats.some((g) => g.views < MIN_VIEWS) || stats.reduce((n, g) => n + g.orders, 0) < MIN_ORDERS) return { ...base, leader: null, sure: null, verdict: "wait" };
  const ranked = [...order].sort((x, y) => (rate[y] ?? 0) - (rate[x] ?? 0));
  const [best, next] = ranked;
  if ((rate[best] ?? 0) === (rate[next] ?? 0)) return { ...base, leader: null, sure: sureOf(groups[best]!, groups[next]!), verdict: "close" };
  const sure = sureOf(groups[best]!, groups[next]!);
  return { ...base, leader: best, sure, verdict: sure >= 95 ? "clear" : sure >= 80 ? "likely" : "close" };
}

/** Two versions (A and B). */
export const compareGroups = (a: GroupStats, b: GroupStats): AbResult => compareVersions({ A: a, B: b });

/** One line for a test on the Analytics overview. */
export function testSummary(r: AbResult | undefined): string {
  if (!r || r.verdict === "wait") return "Collecting shoppers";
  if (r.verdict === "close") return "No clear difference yet";
  return `Version ${r.leader} ahead, ${r.sure}% sure`;
}

/** What a version changes, in words a merchant knows. */
export const AB_CHANGE_LABELS: Record<string, string> = { headline: "headline", subheadline: "text under the headline", buttonLabel: "button", discountLabel: "discount label", discountPercent: "discount", tiers: "tier discounts", design: "style" };
