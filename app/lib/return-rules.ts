/**
 * Return rules (Tracking & Returns → Returns → Rules): what can be returned, for how long, which reasons
 * are approved at once, and what the shopper is told once a return is approved. Stored in
 * $app:cro_design "return_rules". The words the shopper sees on the Returns page (reasons, thanks…) are
 * the page's own text (order-pages.ts). Shared by client and server.
 */
/**
 * Return saving rules (Pro): ways to keep the sale before a refund, and approving by rule. A rule matches when every
 * condition it sets holds; a return that matches any rule is approved at once.
 */
export type AutoRule = {
  /** Reasons (as on the Returns page); none = any reason. */
  reasons: string[];
  /** Product tags: any item with one of these tags (comma separated); none = any product. */
  tags: string;
  /** Up to this order value (shop currency, 0 = any). */
  maxValue: number;
  /** Up to this many days after the order was delivered (0 = any). */
  maxDays: number;
};
export type Saving = {
  /** The ways a shopper can be paid back. Refund to the original payment is always possible. */
  /** Exchange for another size or colour instead of returning for money. `extra`: also when the new item costs more (the merchant then collects the difference). */
  exchange: { on: boolean; extra: boolean };
  /** When credit is given: once the items are received (default) or at once when the return is approved. */
  creditWhen: "received" | "approved";
  credit: { on: boolean; /** Extra credit on top of the refund value, in percent. */ bonus: number; /** Days the store credit lasts (0 = never). */ expiryDays: number };
  /** Put returned items back in stock when they are processed. */
  restock: boolean;
  rules: AutoRule[];
};
export const DEFAULT_SAVING: Saving = { creditWhen: "received", exchange: { on: false, extra: false }, credit: { on: false, bonus: 0, expiryDays: 0 }, restock: false, rules: [] };

export type ReturnRules = {
  /** Pro: store credit instead of a refund, auto approve rules, restocking. */
  saving: Saving;
  /** How many days after the order a return can be asked for (0 = no limit). */
  days: number;
  /** Products with one of these tags can't be returned (e.g. final-sale), comma separated. */
  excludeTags: string;
  /** Reasons (as written on the Returns page) that are approved without waiting. */
  autoApprove: { on: boolean; reasons: string[] };
  /** Where returns are sent, shown to the shopper after approval. */
  address: string;
  /** Who pays for the return shipping, said to the shopper after approval. */
  shipping: "shopper" | "merchant";
  /** Extra words after approval ("Pack the items in the original box"). */
  instructions: string;
};

export const DEFAULT_RETURN_RULES: ReturnRules = {
  saving: DEFAULT_SAVING,
  days: 30,
  excludeTags: "",
  autoApprove: { on: false, reasons: [] },
  address: "",
  shipping: "shopper",
  instructions: "",
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? Array.from(v).filter((c) => c === "\n" || c.charCodeAt(0) >= 32).join("").trim().slice(0, max) : fallback);

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function withSaving(raw: unknown): Saving {
  const r = obj(raw), c = obj(r.credit);
  const e = obj(r.exchange);
  // Stores that saved rules before "when credit is given" existed keep giving credit at approval.
  const creditWhen = r.creditWhen === "received" || r.creditWhen === "approved" ? r.creditWhen : Object.keys(r).length ? "approved" : "received";
  return {
    creditWhen,
    exchange: { on: e.on === true, extra: e.extra === true },
    credit: { on: c.on === true, bonus: clampInt(c.bonus, 0, 100, 0), expiryDays: clampInt(c.expiryDays, 0, 3650, 0) },
    restock: r.restock === true,
    rules: (Array.isArray(r.rules) ? r.rules : []).slice(0, 10).map((x) => {
      const o = obj(x);
      return {
        reasons: (Array.isArray(o.reasons) ? o.reasons : []).map((v) => text(v, 80)).filter(Boolean).slice(0, 10),
        tags: text(o.tags, 200).toLowerCase(),
        maxValue: Math.min(1_000_000, Math.max(0, Math.round(Number(o.maxValue) * 100) / 100 || 0)),
        maxDays: clampInt(o.maxDays, 0, 365, 0),
      };
    }),
  };
}

/** What a return looks like to the rules. `daysSinceDelivery` is null when the delivery date is unknown. */
export type RuleContext = { reason: string; tags: string[]; orderValue: number; daysSinceDelivery: number | null };

/** Is this return approved by one of the rules? A condition that is set but cannot be checked (no delivery date) does not match. */
export function matchesAutoRule(rules: AutoRule[], c: RuleContext): boolean {
  return rules.some((r) => {
    if (r.reasons.length && !r.reasons.some((x) => x.toLowerCase() === c.reason.toLowerCase())) return false;
    const tags = r.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length && !tags.some((t) => c.tags.includes(t))) return false;
    if (r.maxValue > 0 && c.orderValue > r.maxValue) return false;
    if (r.maxDays > 0 && (c.daysSinceDelivery === null || c.daysSinceDelivery > r.maxDays)) return false;
    return true;
  });
}

/** What the shopper reads on the Returns page once the money or credit was given (Shopify still calls the return "Open"). */
export const settledSay = (status: string, creditKind: string) => (status === "refunded" ? "Refunded" : creditKind === "store_credit" ? "Store credit given" : "Credit given");

/** The credit for returned items worth `amount`: the bonus on top, rounded to cents. */
export const creditFor = (amount: number, bonusPct: number) => Math.round(amount * (1 + bonusPct / 100) * 100) / 100;

export function withReturnRulesDefaults(raw: unknown): ReturnRules {
  const r = obj(raw);
  const a = obj(r.autoApprove);
  const d = DEFAULT_RETURN_RULES;
  const days = Math.round(Number(r.days));
  return {
    saving: withSaving(r.saving),
    days: Number.isFinite(days) ? Math.min(365, Math.max(0, days)) : d.days,
    excludeTags: text(r.excludeTags, 300),
    autoApprove: { on: a.on === true, reasons: (Array.isArray(a.reasons) ? a.reasons : []).map((x) => text(x, 80)).filter(Boolean).slice(0, 10) },
    address: text(r.address, 400),
    shipping: r.shipping === "merchant" ? "merchant" : "shopper",
    instructions: text(r.instructions, 600),
  };
}

export const excludedTags = (r: ReturnRules) => r.excludeTags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

/** Shopify's reason code for the shopper's own words ("Wrong size" → SIZE_TOO_LARGE is unknown, so OTHER keeps the words as the note). */
export type ShopifyReason = "COLOR" | "DEFECTIVE" | "NOT_AS_DESCRIBED" | "OTHER" | "SIZE_TOO_LARGE" | "SIZE_TOO_SMALL" | "STYLE" | "UNWANTED" | "WRONG_ITEM";
export function reasonCode(words: string): ShopifyReason {
  const w = words.toLowerCase();
  if (/too (big|large)|size.*(large|big)|larger/.test(w)) return "SIZE_TOO_LARGE";
  // "Wrong size" does not say which way: SIZE_TOO_SMALL is the closest (shoppers most often need the bigger one).
  if (/wrong size|doesn'?t fit|does not fit|size/.test(w) && !/small|smaller/.test(w)) return "SIZE_TOO_SMALL";
  if (/too small|size.*small|smaller/.test(w)) return "SIZE_TOO_SMALL";
  if (/damag|defect|broken|faulty|arrived.*(bad|broken)/.test(w)) return "DEFECTIVE";
  if (/not as (expected|described)|different from|doesn't match|does not match/.test(w)) return "NOT_AS_DESCRIBED";
  if (/colou?r/.test(w)) return "COLOR";
  if (/style|design/.test(w)) return "STYLE";
  if (/wrong item|wrong product|received the wrong|incorrect item/.test(w)) return "WRONG_ITEM";
  if (/changed my mind|don'?t (want|need|like)|unwanted/.test(w)) return "UNWANTED";
  return "OTHER";
}

/** The live status words the app shows for a return. */
export type ReturnState = "requested" | "approved" | "declined" | "refunded" | "credited" | "exchanged" | "closed";
export const RETURN_STATES: Record<ReturnState, { text: string; tone: "ok" | "warn" | "muted" }> = {
  requested: { text: "New", tone: "warn" },
  approved: { text: "Approved, waiting for the items", tone: "ok" },
  declined: { text: "Declined", tone: "muted" },
  refunded: { text: "Refunded", tone: "ok" },
  credited: { text: "Store credit given", tone: "ok" },
  exchanged: { text: "Exchange sent", tone: "ok" },
  closed: { text: "Closed", tone: "muted" },
};
/** Old rows used pending/approved/declined/done. */
export const returnState = (s: string): ReturnState => (s === "pending" ? "requested" : s === "done" ? "closed" : (["requested", "approved", "declined", "refunded", "credited", "exchanged", "closed"].includes(s) ? (s as ReturnState) : "requested"));
