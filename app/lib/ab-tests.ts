/**
 * A/B tests for offers (Pro): half of the shoppers see version A (the offer as saved), half see version B
 * (some of its words, its discount, its style). A shopper keeps the same version (stored in the browser and
 * on the cart as `_cro_ab`), so orders can be told apart. Only upsells and cross sells for now.
 * Pure: shared by the app, the storefront copy and the tests.
 */
import { validateRule } from "./validate";
import type { Rule } from "./types";

export const AB_KINDS = ["upsell", "cross_sell"] as const;
export type AbKind = (typeof AB_KINDS)[number];
export const MAX_RUNNING_TESTS = 5;
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
export type AbStatus = "running" | "stopped" | "applied";
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
  winner: "A" | "B" | null;
  b: AbOverrides;
};

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

/** Problems with a test, said in the merchant's words; empty when it can run. */
export function validateTest(rule: Rule | null, kind: AbKind, b: AbOverrides): string[] {
  if (!rule) return ["Choose an upsell or cross sell offer."];
  if (rule.kind !== kind) return ["That offer is not a " + (kind === "upsell" ? "upsell" : "cross sell") + "."];
  if (!Object.keys(b).length) return ["Change at least one thing in version B: a text, the discount or the style."];
  const errors: string[] = [];
  if (b.tiers && rule.kind === "upsell") {
    const same = rule.upsellType === "variant" ? (t: AbTier) => String(t.value ?? "").toLowerCase() : (t: AbTier) => String(t.qty);
    const a = rule.tiers.map(same).sort().join("|");
    if (b.tiers.map(same).sort().join("|") !== a) errors.push("Version B keeps the same quantities (or option values) as the offer: change the discounts, not the tiers.");
  }
  errors.push(...validateRule(applyOverrides(rule, b)));
  return [...new Set(errors)];
}

/** Does B change the price the shopper pays? Then the discount engine must know the group. */
export const changesDiscount = (b: AbOverrides) => b.discountPercent !== undefined || b.tiers !== undefined;

/** What the offer blocks read ($app:cro_design "ab_tests"): running tests by offer handle, with B's full values. */
export function toStorefrontAbTests(tests: AbTest[], rules: Rule[]) {
  const out: Record<string, { id: string; b: Record<string, unknown> }> = {};
  for (const t of tests) {
    if (t.status !== "running") continue;
    const rule = rules.find((r) => r.handle === t.offer);
    if (!rule) continue;
    const b = applyOverrides(rule, t.b);
    out[t.offer] = { id: t.id, b: { headline: b.headline, subheadline: b.subheadline, button_label: b.buttonLabel, discount_percent: b.discountPercent, tiers: b.tiers, design: b.design ?? 0, discount_label: b.discountLabel } };
  }
  return out;
}

/** What the discount engine reads: the test id and the pieces of B that change the price. */
export function functionAb(test: AbTest | undefined, rule: Rule) {
  if (!test || test.status !== "running") return null;
  const b = applyOverrides(rule, test.b);
  const label = b.discountLabel || b.headline || b.name;
  return { id: test.id, b: { ...(rule.kind === "cross_sell" ? { pct: b.discountPercent } : { tiers: b.tiers.map((t) => (rule.upsellType === "variant" ? { value: t.value || "", pct: t.pct } : { qty: t.qty, pct: t.pct })) }), label } };
}

/* -------------------------------------------------------------- results -- */
export type GroupStats = { views: number; orders: number; revenue: number; adds: number };
export type AbResult = {
  a: GroupStats;
  b: GroupStats;
  /** Orders per view, per group. */
  rate: { a: number | null; b: number | null };
  /** Revenue per view, per group. */
  perView: { a: number | null; b: number | null };
  leader: "A" | "B" | null;
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

/**
 * Which version earns more and how sure we are. Orders per view are compared with a two proportion z test;
 * "sure" is 1 minus the two sided p value. Nothing is said before each version has MIN_VIEWS views and the
 * two have MIN_ORDERS orders together, so a lucky start is not called a winner.
 */
export function compareGroups(a: GroupStats, b: GroupStats): AbResult {
  const rate = (g: GroupStats) => (g.views > 0 ? g.orders / g.views : null);
  const per = (g: GroupStats) => (g.views > 0 ? g.revenue / g.views : null);
  const base = { a, b, rate: { a: rate(a), b: rate(b) }, perView: { a: per(a), b: per(b) } };
  if (a.views < MIN_VIEWS || b.views < MIN_VIEWS || a.orders + b.orders < MIN_ORDERS) return { ...base, leader: null, sure: null, verdict: "wait" };
  const pa = a.orders / a.views, pb = b.orders / b.views;
  const pooled = (a.orders + b.orders) / (a.views + b.views);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.views + 1 / b.views));
  const z = se > 0 ? (pb - pa) / se : 0;
  const sure = Math.round((1 - 2 * (1 - normalCdf(Math.abs(z)))) * 1000) / 10;
  const leader = pa === pb ? null : pb > pa ? "B" : "A";
  return { ...base, leader, sure, verdict: sure >= 95 ? "clear" : sure >= 80 ? "likely" : "close" };
}
