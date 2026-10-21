/**
 * Tracking on the Track page (docs/research/tracking-returns.md §9): one shape for every source (Shopify's own
 * fulfillment events, live tracking, the merchant's own key, a webhook), and where the data comes from.
 * Pure (no Shopify or database calls): the shopper's page, the app and the tests all use it.
 */

import { atLeast, type PlanKey } from "./plans";

export const TRACK_STATUSES = ["info", "transit", "out", "delivered", "problem"] as const;
/** Info received, In transit, Out for delivery, Delivered, Problem. */
export type TrackStatus = (typeof TRACK_STATUSES)[number];
export const TRACK_STATUS_LABEL: Record<TrackStatus, string> = { info: "Info received", transit: "In transit", out: "Out for delivery", delivered: "Delivered", problem: "Problem" };

export type TrackEvent = { status: TrackStatus; city: string; province: string; country: string; message: string; at: string };
export type Tracking = {
  status: TrackStatus;
  /** The latest place, "City, Province, Country", when known. */
  place: string;
  estimated: string | null;
  delivered: string | null;
  events: TrackEvent[];
};

export const TRACK_SOURCES = ["shopify", "live", "own", "webhook"] as const;
export type TrackSource = (typeof TRACK_SOURCES)[number];
/**
 * Basic tracking (Growth, with the Track page): Shopify's own data. Advanced tracking (Pro): live tracking from our
 * account, the store's own tracking service key, or a webhook from any carrier or 3PL (Omar, 2026-10-21).
 */
export const SOURCE_PLAN = { shopify: "growth", live: "pro", own: "pro", webhook: "pro" } as const;
export const sourceAllowed = (plan: PlanKey, s: TrackSource) => atLeast(plan, SOURCE_PLAN[s]);
/** Live tracking included on Pro: shipments registered per month. */
export const LIVE_MONTHLY_LIMIT = 500;
/** Order of preference when a source has nothing (docs §9.4). */
export const FALLBACK_ORDER: TrackSource[] = ["webhook", "own", "live", "shopify"];

/** The sources to try, from the one the merchant chose down the preference order. */
export function sourcesToTry(chosen: TrackSource): TrackSource[] {
  const from = FALLBACK_ORDER.indexOf(chosen);
  return from < 0 ? ["shopify"] : FALLBACK_ORDER.slice(from);
}

/** A fulfillment event's status from Shopify (FulfillmentEventStatus) to ours. */
export function fromShopifyEvent(status: string | null | undefined): TrackStatus {
  switch (String(status ?? "").toUpperCase()) {
    case "DELIVERED":
    case "PICKED_UP":
      return "delivered";
    case "OUT_FOR_DELIVERY":
    case "READY_FOR_PICKUP":
      return "out";
    case "IN_TRANSIT":
    case "CONFIRMED":
      return "transit";
    case "FAILURE":
    case "ATTEMPTED_DELIVERY":
      return "problem";
    default:
      return "info";
  }
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export function place(e: Pick<TrackEvent, "city" | "province" | "country">): string {
  return [e.city, e.province, e.country].map((x) => x.trim()).filter(Boolean).join(", ");
}

const iso = (v: unknown): string | null => {
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Cleans events from any source: newest first, at most 40, texts short, bad dates dropped. */
export function cleanEvents(raw: unknown): TrackEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((x): TrackEvent[] => {
      const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const at = iso(o.at);
      const status = (TRACK_STATUSES as readonly string[]).includes(String(o.status)) ? (o.status as TrackStatus) : "info";
      return at ? [{ status, city: clip(o.city, 60), province: clip(o.province, 60), country: clip(o.country, 60), message: clip(o.message, 200), at }] : [];
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 40);
}

/** The overall status: the newest event's, unless it was delivered (then delivered always wins). */
export function overallStatus(events: TrackEvent[], delivered: string | null): TrackStatus {
  if (delivered || events.some((e) => e.status === "delivered")) return "delivered";
  return events[0]?.status ?? "info";
}

export function buildTracking(input: { events: unknown; estimated?: unknown; delivered?: unknown; status?: unknown }): Tracking {
  const events = cleanEvents(input.events);
  const delivered = iso(input.delivered) ?? events.find((e) => e.status === "delivered")?.at ?? null;
  const given = (TRACK_STATUSES as readonly string[]).includes(String(input.status)) ? (input.status as TrackStatus) : null;
  return { status: delivered ? "delivered" : (given ?? overallStatus(events, null)), place: events[0] ? place(events[0]) : "", estimated: iso(input.estimated), delivered, events };
}

/** Is this cached answer fresh enough to show without asking the source again? */
export function isFresh(row: { checkedAt: Date | string; status: string; createdAt: Date | string }, now = Date.now(), everyHours = 6): boolean {
  if (row.status === "delivered") return true;
  const age = now - Date.parse(String(row.createdAt));
  if (age > 60 * 86_400_000) return true; // stopped after 60 days: nothing new is asked
  return now - Date.parse(String(row.checkedAt)) < everyHours * 3_600_000;
}

/* ---------------------------------------------------------- carrier links -- */
/**
 * A link for a carrier Shopify has no tracking link for (a local courier): its name as typed in the fulfillment,
 * and its tracking page with {number} where the tracking number goes. "*" is used for any carrier without a link.
 */
export type CarrierLink = { name: string; url: string };
export const MAX_CARRIER_LINKS = 20;
const carrierKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "");

export function cleanCarrierLinks(raw: unknown): CarrierLink[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: CarrierLink[] = [];
  for (const x of list) {
    const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
    const name = clip(o.name, 60);
    const url = clip(o.url, 300);
    if (!name || !/^https:\/\/[^\s]+$/.test(url) || !url.includes("{number}")) continue;
    if (out.some((l) => carrierKey(l.name) === carrierKey(name))) continue;
    out.push({ name, url });
    if (out.length >= MAX_CARRIER_LINKS) break;
  }
  return out;
}

/** Is this a link the merchant can save? Null when fine, else what to fix. */
export function carrierLinkProblem(l: CarrierLink): string | null {
  if (!l.name.trim()) return "Type the carrier's name as it shows in your fulfillments.";
  if (!/^https:\/\/[^\s]+$/.test(l.url.trim())) return "The link must start with https://.";
  if (!l.url.includes("{number}")) return "Put {number} where the tracking number goes.";
  return null;
}

/** The tracking page for this shipment from the store's carrier links, or "" when none fits. */
export function carrierUrl(links: CarrierLink[], company: string | null | undefined, number: string | null | undefined): string {
  if (!number) return "";
  const k = carrierKey(company ?? "");
  const hit = (k && links.find((l) => carrierKey(l.name) === k)) || links.find((l) => l.name.trim() === "*");
  return hit ? hit.url.split("{number}").join(encodeURIComponent(number)) : "";
}
