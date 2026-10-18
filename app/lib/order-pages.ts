/**
 * Track order and Returns pages (Header & pages). The shopper types their order number and email;
 * the app finds the order (proxy.track.tsx) and shows its status and tracking, or lets them choose
 * items to return (proxy.returns.tsx → Returns in the app). Each page's words are a list of fields
 * (TEXTS) so the editor shows them all; look, sizes and spacing are shared.
 * Stored in $app:cro_design "track_page" / "returns_page" (+ "_editor"). Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { BUTTON_HEIGHT, BUTTON_TEXT, defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export type OrderPageKind = "track" | "returns";
export type TextSpec = { key: string; label: string; def: string; max?: number; long?: boolean; group: string };

export const TEXTS: Record<OrderPageKind, TextSpec[]> = {
  track: [
    { key: "heading", label: "Heading", def: "Track your order", group: "Form" },
    { key: "sub", label: "Text under the heading", def: "Enter your order number and the email you used at checkout.", long: true, group: "Form" },
    { key: "order", label: "Order number box", def: "Order number (e.g. 1001)", group: "Form" },
    { key: "email", label: "Email box", def: "Email", group: "Form" },
    { key: "button", label: "Button", def: "Track order", group: "Form" },
    { key: "notFound", label: "Not found", def: "We couldn't find an order with that number and email. Please check both.", long: true, group: "Result" },
    { key: "unavailable", label: "Lookup not available", def: "Order lookup isn't available right now. Please try again in a moment.", long: true, group: "Result" },
    { key: "placed", label: "“Placed on”", def: "Placed on", group: "Result" },
    { key: "shipped", label: "“Tracking number”", def: "Tracking number", group: "Result" },
    { key: "trackLink", label: "Tracking link", def: "Track the parcel", group: "Result" },
    { key: "noTracking", label: "No tracking yet", def: "Your order is being prepared. You'll get tracking details as soon as it ships.", long: true, group: "Result" },
    { key: "delivered", label: "“Delivered”", def: "Delivered", group: "Result" },
    { key: "estimated", label: "“Expected”", def: "Expected", group: "Result" },
    { key: "again", label: "Look up another order", def: "Track another order", group: "Result" },
    { key: "statusInfo", label: "Status: info received", def: "Info received", group: "Tracking" },
    { key: "statusTransit", label: "Status: in transit", def: "In transit", group: "Tracking" },
    { key: "statusOut", label: "Status: out for delivery", def: "Out for delivery", group: "Tracking" },
    { key: "statusDelivered", label: "Status: delivered", def: "Delivered", group: "Tracking" },
    { key: "statusProblem", label: "Status: problem", def: "Delivery problem", group: "Tracking" },
    { key: "where", label: "“Latest place”", def: "Latest update", group: "Tracking" },
    { key: "history", label: "Timeline heading", def: "Tracking history", group: "Tracking" },
    { key: "carrierOnly", label: "Live updates are on the carrier's page", def: "Live updates are on the carrier's page. Open the tracking link.", long: true, group: "Result" },
  ],
  returns: [
    { key: "heading", label: "Heading", def: "Request a return", group: "Form" },
    { key: "sub", label: "Text under the heading", def: "Enter your order number and the email you used at checkout, then choose what you'd like to return.", long: true, group: "Form" },
    { key: "order", label: "Order number box", def: "Order number (e.g. 1001)", group: "Form" },
    { key: "email", label: "Email box", def: "Email", group: "Form" },
    { key: "button", label: "Find order button", def: "Find my order", group: "Form" },
    { key: "notFound", label: "Not found", def: "We couldn't find an order with that number and email. Please check both.", long: true, group: "Form" },
    { key: "unavailable", label: "Lookup not available", def: "Order lookup isn't available right now. Please try again in a moment.", long: true, group: "Form" },
    { key: "howPaid", label: "“How to be paid back”", def: "How would you like to be paid back?", group: "Paying back" },
    { key: "optRefund", label: "Refund option", def: "Refund to my original payment ({amount})", group: "Paying back" },
    { key: "optCredit", label: "Store credit option", def: "Store credit ({amount})", group: "Paying back" },
    { key: "optCreditBonus", label: "Store credit with a bonus", def: "Get {amount} store credit instead of a {refund} refund", group: "Paying back" },
    { key: "optExchange", label: "Exchange option", def: "Exchange for another size or colour", group: "Paying back" },
    { key: "exChoose", label: "Choose the new item", def: "Choose the new one for {item}", group: "Paying back" },
    { key: "exSame", label: "Same price", def: "same price", group: "Paying back" },
    { key: "exNone", label: "Nothing else in stock", def: "Nothing else in stock for {item}.", group: "Paying back" },
    { key: "exMore", label: "Shopper pays more", def: "You pay {amount} more for this exchange.", group: "Paying back" },
    { key: "exLess", label: "Shopper gets money back", def: "We refund {amount} to your original payment.", group: "Paying back" },
    { key: "exEven", label: "Even exchange", def: "An even exchange: no payment either way.", group: "Paying back" },
    { key: "creditStore", label: "Credit in their account", def: "Your store credit: {amount}", group: "Paying back" },
    { key: "creditGift", label: "Gift card code", def: "Your gift card code", group: "Paying back" },
    { key: "creditCode", label: "Discount code", def: "Your discount code", group: "Paying back" },
    { key: "creditOnce", label: "Note under a code", def: "Use it in one order.", group: "Paying back" },
    { key: "copy", label: "Copy button", def: "Copy", group: "Paying back" },
    { key: "copied", label: "After copying", def: "Copied", group: "Paying back" },
    { key: "pick", label: "“Choose items”", def: "Which items would you like to return?", group: "Choosing items" },
    { key: "reason", label: "“Reason”", def: "Reason", group: "Choosing items" },
    { key: "reasons", label: "Reasons (one per line)", def: "Wrong size\nNot as expected\nArrived damaged\nChanged my mind\nOther", long: true, max: 400, group: "Choosing items" },
    { key: "note", label: "“Anything else?”", def: "Anything else we should know? (optional)", group: "Choosing items" },
    { key: "send", label: "Send button", def: "Send return request", group: "Choosing items" },
    { key: "thanks", label: "After sending", def: "Thanks! We've received your request and will email you the next steps.", long: true, group: "After" },
    { key: "already", label: "Already requested", def: "You've already sent a return request for this order. We'll be in touch soon.", long: true, group: "After" },
    { key: "tooLate", label: "Too late", def: "This order is outside our return window.", long: true, group: "After" },
    { key: "thanksCreditLater", label: "After sending, credit comes with the items", def: "Your return is approved. Your credit is sent once we receive the items. Here is how to send them back.", long: true, group: "After" },
    { key: "thanksApproved", label: "After sending, approved at once", def: "Your return is approved. Here is how to send it back.", long: true, group: "After" },
    { key: "yourReturns", label: "“Your returns”", def: "Your returns for this order", group: "After" },
    { key: "sendTo", label: "“Send the items to”", def: "Send the items to", group: "After" },
    { key: "shopperPays", label: "Shopper pays shipping", def: "You pay for the return shipping.", long: true, group: "After" },
    { key: "merchantPays", label: "We send a label", def: "We will email you a return label.", long: true, group: "After" },
    { key: "nothing", label: "Nothing to return", def: "Nothing in this order can be returned.", long: true, group: "After" },
  ],
};

export const ORDER_PAGE_SIZES: SizeSpec[] = [
  { key: "heading", label: "Heading", cssVar: "--ucs-op-h", min: 16, max: 56, def: 30 },
  { key: "text", label: "Text", cssVar: "--ucs-op-t", min: 11, max: 24, def: 15 },
  { key: "input", label: "Box height", cssVar: "--ucs-op-in", min: 34, max: 64, def: 46 },
  { key: "image", label: "Product pictures", cssVar: "--ucs-op-img", min: 32, max: 120, def: 56 },
  BUTTON_TEXT,
  BUTTON_HEIGHT,
];

export type RecSource = "together" | "collection" | "picks";
/** One row of products under the order (Track page, Growth). */
export type RecRow = { on: boolean; heading: string; source: RecSource; picks: { handle: string; title: string }[] };
export type Recs = { like: RecRow; complete: RecRow; count: number; button: string; added: string };

export const DEFAULT_RECS: Recs = {
  like: { on: false, heading: "You may also like", source: "collection", picks: [] },
  complete: { on: false, heading: "Complete your order", source: "together", picks: [] },
  count: 4,
  button: "Add to cart",
  added: "Added",
};

export type OrderPageDesign = {
  scheme: string;
  kind: OrderPageKind;
  /** Track page only: product recommendations under the order. */
  recs: Recs;
  text: Record<string, string>;
  rules: { days: number };
  look: { align: "left" | "center"; maxWidth: number; accent: string; onAccent: string; card: string; radius: number };
  space: { top: number; bottom: number };
  sizes: Sizes;
};

const baseLook: OrderPageDesign["look"] = { align: "center", maxWidth: 640, accent: "#121212", onAccent: "#ffffff", card: "#f6f6f6", radius: 12 };

export const defaultOrderPage = (kind: OrderPageKind): OrderPageDesign => ({
  scheme: "",
  kind,
  recs: DEFAULT_RECS,
  text: Object.fromEntries(TEXTS[kind].map((t) => [t.key, t.def])),
  rules: { days: 30 },
  look: baseLook,
  space: { top: 48, bottom: 48 },
  sizes: defaultSizes(ORDER_PAGE_SIZES),
});

type Patch = { look?: Partial<OrderPageDesign["look"]> };
export const ORDER_PAGE_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "soft", title: "Soft card, centred", patch: { look: { align: "center", card: "#f6f6f6", accent: "#121212", onAccent: "#ffffff", radius: 12 } } },
  { key: "plain", title: "Plain, left", patch: { look: { align: "left", card: "#ffffff", accent: "#121212", onAccent: "#ffffff", radius: 4 } } },
  { key: "warm", title: "Warm", patch: { look: { align: "center", card: "#fff6ea", accent: "#c2410c", onAccent: "#ffffff", radius: 18 } } },
  { key: "round", title: "Rounded, dark button", patch: { look: { align: "center", card: "#f1f1f1", accent: "#111111", onAccent: "#facc15", radius: 28 } } },
];

export function applyOrderPagePreset(c: OrderPageDesign, key: string): OrderPageDesign {
  const p = ORDER_PAGE_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
function recRow(raw: unknown, d: RecRow): RecRow {
  const r = obj(raw);
  const picks = (Array.isArray(r.picks) ? r.picks : []).slice(0, 12).flatMap((x) => {
    const p = obj(x);
    const handle = str(p.handle, "", 255).trim();
    return /^[a-z0-9][a-z0-9_-]*$/.test(handle) ? [{ handle, title: str(p.title, handle, 120) }] : [];
  });
  return { on: bool(r.on, d.on), heading: str(r.heading, d.heading, 60), source: pick(r.source, ["together", "collection", "picks"] as const, d.source), picks };
}
export function withRecs(raw: unknown): Recs {
  const r = obj(raw);
  return { like: recRow(r.like, DEFAULT_RECS.like), complete: recRow(r.complete, DEFAULT_RECS.complete), count: num(r.count, 1, 8, DEFAULT_RECS.count), button: str(r.button, DEFAULT_RECS.button, 30), added: str(r.added, DEFAULT_RECS.added, 30) };
}

export function withOrderPageDefaults(raw: unknown, kind: OrderPageKind): OrderPageDesign {
  const r = obj(raw);
  const d = defaultOrderPage(kind);
  const t = obj(r.text), k = obj(r.look), s = obj(r.space), ru = obj(r.rules);
  return {
    scheme: schemeId(r.scheme),
    kind,
    recs: withRecs(r.recs),
    text: Object.fromEntries(TEXTS[kind].map((x) => [x.key, str(t[x.key], x.def, x.max ?? (x.long ? 300 : 80))])),
    rules: { days: num(ru.days, 0, 365, d.rules.days) },
    look: {
      align: pick(k.align, ["left", "center"] as const, d.look.align),
      maxWidth: num(k.maxWidth, 360, 1200, d.look.maxWidth),
      accent: color(k.accent, d.look.accent),
      onAccent: color(k.onAccent, d.look.onAccent),
      card: color(k.card, d.look.card),
      radius: num(k.radius, 0, 40, d.look.radius),
    },
    space: { top: num(s.top, 0, 120, d.space.top), bottom: num(s.bottom, 0, 120, d.space.bottom) },
    sizes: withSizes(r.sizes, ORDER_PAGE_SIZES),
  };
}

export function orderPageVars(c: OrderPageDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pt": `${c.space.top}px`,
    "--ucs-pb": `${c.space.bottom}px`,
    "--ucs-accent": c.look.accent,
    "--ucs-on-accent": c.look.onAccent,
    "--ucs-op-card": c.look.card,
    "--ucs-op-r": `${c.look.radius}px`,
    "--ucs-btn-radius": `${c.look.radius}px`,
    "--ucs-op-max": `${c.look.maxWidth}px`,
  };
  Object.assign(v, sizeVars(c.sizes, ORDER_PAGE_SIZES));
  return v;
}

export const orderPageClass = (c: OrderPageDesign) => `ucs ucs-op ucs-op--${c.look.align}`;

/** The storefront copy, read by ucs-track.liquid / ucs-returns.liquid and ucs-orders.js. */
export function toStorefrontOrderPage(c: OrderPageDesign) {
  return {
    cls: orderPageClass(c),
    css: Object.entries(orderPageVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    t: c.text,
    days: c.rules.days,
    // The Track page asks the server for products only when a row is on (proxy.track.tsx).
    recs: c.kind === "track" && (c.recs.like.on || c.recs.complete.on)
      ? { count: c.recs.count, button: c.recs.button, added: c.recs.added, rows: (["like", "complete"] as const).filter((k) => c.recs[k].on).map((k) => ({ key: k, heading: c.recs[k].heading, source: c.recs[k].source, picks: c.recs[k].picks.map((p) => p.handle) })) }
      : null,
  };
}
