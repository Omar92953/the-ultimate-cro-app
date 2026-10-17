/**
 * Return rules (Tracking & Returns → Returns → Rules): what can be returned, for how long, which reasons
 * are approved at once, and what the shopper is told once a return is approved. Stored in
 * $app:cro_design "return_rules". The words the shopper sees on the Returns page (reasons, thanks…) are
 * the page's own text (order-pages.ts). Shared by client and server.
 */
export type ReturnRules = {
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
  days: 30,
  excludeTags: "",
  autoApprove: { on: false, reasons: [] },
  address: "",
  shipping: "shopper",
  instructions: "",
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? Array.from(v).filter((c) => c === "\n" || c.charCodeAt(0) >= 32).join("").trim().slice(0, max) : fallback);

export function withReturnRulesDefaults(raw: unknown): ReturnRules {
  const r = obj(raw);
  const a = obj(r.autoApprove);
  const d = DEFAULT_RETURN_RULES;
  const days = Math.round(Number(r.days));
  return {
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
export type ReturnState = "requested" | "approved" | "declined" | "refunded" | "closed";
export const RETURN_STATES: Record<ReturnState, { text: string; tone: "ok" | "warn" | "muted" }> = {
  requested: { text: "New", tone: "warn" },
  approved: { text: "Approved, waiting for the items", tone: "ok" },
  declined: { text: "Declined", tone: "muted" },
  refunded: { text: "Refunded", tone: "ok" },
  closed: { text: "Closed", tone: "muted" },
};
/** Old rows used pending/approved/declined/done. */
export const returnState = (s: string): ReturnState => (s === "pending" ? "requested" : s === "done" ? "closed" : (["requested", "approved", "declined", "refunded", "closed"].includes(s) ? (s as ReturnState) : "requested"));
