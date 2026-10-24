/**
 * A tracking provider: registers a tracking number, reads its events and says whether a key works.
 * Providers are never named in the app or on the store (white label): the merchant sees "live tracking" and
 * a key box. Only the tracking number is sent (docs/research/tracking-returns.md §9).
 */
import { buildTracking, type TrackEvent, type Tracking, type TrackStatus } from "../tracking";

export type Shipment = { number: string; carrier: string; country: string };
export type Provider = {
  id: string;
  /** Does this key work with this service? { ok: true } or the message to show. */
  test(key: string): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Starts following a number (a no-op when the service follows it on its own). */
  register(key: string, s: Shipment): Promise<void>;
  /** The current events, or null when the service knows nothing about the number yet. */
  fetch(key: string, s: Shipment): Promise<Tracking | null>;
  /** A pushed update (webhook) from this service: the number and its tracking, or null when not ours. */
  parsePush?(body: unknown): { number: string; tracking: Tracking } | null;
};

const SEVENTEEN = "https://api.17track.net/track/v2.2";
const STATUS: Record<string, TrackStatus> = { InfoReceived: "info", InTransit: "transit", AvailableForPickup: "out", OutForDelivery: "out", Delivered: "delivered", DeliveryFailure: "problem", Exception: "problem", Expired: "problem" };

type Json = Record<string, unknown>;
const o = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The service's track_info (also what its push carries) in our shape. Exported for the tests. */
export function fromTrackInfo(info: unknown): Tracking | null {
  const t = o(info);
  const latest = o(o(t.latest_status));
  const events: TrackEvent[] = arr(o(t.tracking).providers).flatMap((p) =>
    arr(o(p).events).map((e) => {
      const ev = o(e), addr = o(ev.address);
      return { status: STATUS[String(ev.stage)] ?? "info", city: String(addr.city ?? ""), province: String(addr.state ?? ""), country: String(addr.country ?? ""), message: String(ev.description ?? ""), at: String(ev.time_iso ?? ev.time_utc ?? "") };
    }),
  );
  const status = STATUS[String(latest.status)];
  if (!events.length && !status) return null;
  const eta = o(o(t.time_metrics).estimated_delivery_date);
  const built = buildTracking({ events, estimated: eta.to ?? eta.from, status });
  return built;
}

/**
 * 17TRACK's carrier code for the carrier name Shopify has ("Bosta", "Aramex", "J&T Express (EG)"), so a local
 * courier's number isn't left to auto-detection. Only an unambiguous name match counts. Exported for the tests.
 */
export function carrierKeyFrom(list: { key: number; _name: string }[], company: string): number | null {
  const norm = (v: string) => v.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, "");
  const want = norm(company);
  if (!want) return null;
  const exact = list.filter((c) => c._name.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff()]+/g, "") === company.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff()]+/g, ""));
  if (exact.length === 1) return exact[0].key;
  const loose = list.filter((c) => norm(c._name) === want);
  return loose.length === 1 ? loose[0].key : null;
}

// 17TRACK's public list of carriers its API knows (about 3,500), read once a day.
const CARRIER_LIST = "https://res.17track.net/asset/carrier/info/apicarrier.all.json";
let carriers: { at: number; list: { key: number; _name: string }[] } | null = null;
async function seventeenCarrier(company: string): Promise<number | null> {
  if (!company.trim()) return null;
  if (!carriers || Date.now() - carriers.at > 86_400_000) {
    try {
      const res = await fetch(CARRIER_LIST, { signal: AbortSignal.timeout(6000) });
      const list = res.ok ? ((await res.json()) as { key: number; _name: string }[]) : [];
      carriers = { at: Date.now(), list: Array.isArray(list) ? list.filter((c) => typeof c?.key === "number" && typeof c?._name === "string") : [] };
    } catch {
      carriers = { at: Date.now() - 86_400_000 + 3_600_000, list: carriers?.list ?? [] }; // try again in an hour
    }
  }
  return carrierKeyFrom(carriers.list, company);
}

async function call(key: string, path: string, body: unknown) {
  const res = await fetch(`${SEVENTEEN}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "17token": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
  if (res.status === 401 || res.status === 403) return { code: -1, data: {} as Json };
  const j = o(await res.json().catch(() => ({})));
  return { code: Number(j.code ?? -1), data: o(j.data) };
}

const seventeen: Provider = {
  id: "seventeen",
  async test(key) {
    try {
      const r = await call(key, "/getquota", {});
      return r.code === 0 ? { ok: true } : { ok: false, error: "This key was not accepted." };
    } catch {
      return { ok: false, error: "The service could not be reached. Try again in a moment." };
    }
  },
  async register(key, s) {
    const carrier = await seventeenCarrier(s.carrier).catch(() => null);
    await call(key, "/register", [carrier ? { number: s.number, carrier } : { number: s.number }]);
  },
  async fetch(key, s) {
    const carrier = await seventeenCarrier(s.carrier).catch(() => null);
    const r = await call(key, "/gettrackinfo", [carrier ? { number: s.number, carrier } : { number: s.number }]);
    if (r.code !== 0) return null;
    return fromTrackInfo(o(arr(r.data.accepted)[0]).track_info);
  },
  parsePush(body) {
    const b = o(body), d = o(b.data);
    const number = String(d.number ?? "");
    const t = fromTrackInfo(d.track_info);
    return number && t ? { number, tracking: t } : null;
  },
};

/* --------------------------------------------------------------- AfterShip -- */
// Tracking API 2026-07 (github.com/AfterShip/tracking-sdk-nodejs): header as-api-key, envelope { meta: { code }, data }.
const AFTERSHIP = "https://api.aftership.com/tracking/2026-07";
const AS_STATUS: Record<string, TrackStatus> = { Pending: "info", InfoReceived: "info", InTransit: "transit", OutForDelivery: "out", AvailableForPickup: "out", Delivered: "delivered", AttemptFail: "problem", Exception: "problem", Expired: "problem" };

/** An AfterShip tracking (API answer or webhook msg) in our shape. Exported for the tests. */
export function fromAfterShip(raw: unknown): Tracking | null {
  const t = o(raw);
  const events: TrackEvent[] = arr(t.checkpoints).map((c) => {
    const e = o(c);
    return { status: AS_STATUS[String(e.tag)] ?? "info", city: String(e.city ?? e.location ?? ""), province: String(e.state ?? ""), country: String(e.country_region_name ?? e.country_region ?? ""), message: String(e.message ?? ""), at: String(e.checkpoint_time ?? "") };
  });
  const status = AS_STATUS[String(t.tag)];
  if (!events.length && (!status || t.tag === "Pending")) return null;
  const eta = o(t.courier_estimated_delivery_date).estimated_delivery_date ?? o(t.aftership_estimated_delivery_date).estimated_delivery_date ?? o(t.latest_estimated_delivery).datetime;
  return buildTracking({ events, estimated: eta, delivered: t.shipment_delivery_date, status });
}

async function asCall(key: string, path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(`${AFTERSHIP}${path}`, { method: init.method, headers: { "Content-Type": "application/json", "as-api-key": key }, body: init.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(6000) });
  const j = o(await res.json().catch(() => ({})));
  return { status: res.status, code: Number(o(j.meta).code ?? res.status), data: o(j.data) };
}

const aftership: Provider = {
  id: "aftership",
  async test(key) {
    try {
      const r = await asCall(key, "/couriers", { method: "GET" });
      return r.status === 200 ? { ok: true } : { ok: false, error: "This key was not accepted." };
    } catch {
      return { ok: false, error: "The service could not be reached. Try again in a moment." };
    }
  },
  async register(key, s) {
    // An existing tracking answers 4003; either way the number is followed.
    await asCall(key, "/trackings", { method: "POST", body: { tracking_number: s.number } });
  },
  async fetch(key, s) {
    const r = await asCall(key, `/trackings?tracking_numbers=${encodeURIComponent(s.number)}`, { method: "GET" });
    if (r.status !== 200) return null;
    return fromAfterShip(arr(r.data.trackings).find((t) => String(o(t).tracking_number) === s.number) ?? arr(r.data.trackings)[0]);
  },
  parsePush(body) {
    const msg = o(o(body).msg);
    const number = String(msg.tracking_number ?? "");
    if (!number || (!Array.isArray(msg.checkpoints) && !msg.tag)) return null;
    const t = fromAfterShip(msg);
    return t ? { number, tracking: t } : null;
  },
};

/* ------------------------------------------------------------- TrackingMore -- */
// API v4 (github.com/TrackingMore-API/trackingmore-sdk-go): header Tracking-Api-Key, envelope { meta: { code }, data }.
const TRACKINGMORE = "https://api.trackingmore.com/v4";
const TM_STATUS: Record<string, TrackStatus> = { pending: "info", notfound: "info", inforeceived: "info", transit: "transit", pickup: "out", delivered: "delivered", undelivered: "problem", exception: "problem", expired: "problem" };

/** A TrackingMore tracking (API answer or webhook data) in our shape. Exported for the tests. */
export function fromTrackingMore(raw: unknown): Tracking | null {
  const t = o(raw);
  const info = (k: string) =>
    arr(o(t[k]).trackinfo).map((c) => {
      const e = o(c);
      const city = String(e.city ?? "") || String(e.location ?? "");
      return { status: TM_STATUS[String(e.checkpoint_delivery_status)] ?? "info", city, province: String(e.state ?? ""), country: String(e.country_iso2 ?? ""), message: String(e.tracking_detail ?? ""), at: String(e.checkpoint_date ?? "") } as TrackEvent;
    });
  const events = [...info("origin_info"), ...info("destination_info")];
  const status = TM_STATUS[String(t.delivery_status)];
  if (!events.length && (!status || t.delivery_status === "pending" || t.delivery_status === "notfound")) return null;
  const delivered = o(o(t.destination_info).milestone_date).delivery_date || o(o(t.origin_info).milestone_date).delivery_date;
  return buildTracking({ events, estimated: t.scheduled_delivery_date, delivered, status });
}

async function tmCall(key: string, path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(`${TRACKINGMORE}${path}`, { method: init.method, headers: { "Content-Type": "application/json", Accept: "application/json", "Tracking-Api-Key": key }, body: init.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(6000) });
  const j = o(await res.json().catch(() => ({})));
  return { status: res.status, code: Number(o(j.meta).code ?? res.status), data: j.data };
}

const trackingmore: Provider = {
  id: "trackingmore",
  async test(key) {
    try {
      const r = await tmCall(key, "/couriers/all", { method: "GET" });
      return r.status === 200 && r.code === 200 ? { ok: true } : { ok: false, error: "This key was not accepted." };
    } catch {
      return { ok: false, error: "The service could not be reached. Try again in a moment." };
    }
  },
  async register(key, s) {
    // TrackingMore needs the carrier's code: detect it from the number first.
    const d = await tmCall(key, "/couriers/detect", { method: "POST", body: { tracking_number: s.number } });
    const courier = String(o(arr(d.data)[0]).courier_code ?? "");
    if (courier) await tmCall(key, "/trackings/create", { method: "POST", body: { tracking_number: s.number, courier_code: courier } });
  },
  async fetch(key, s) {
    const r = await tmCall(key, `/trackings/get?tracking_numbers=${encodeURIComponent(s.number)}`, { method: "GET" });
    if (r.status !== 200) return null;
    const list = Array.isArray(r.data) ? r.data : arr(o(r.data).items);
    return fromTrackingMore(list.find((t) => String(o(t).tracking_number) === s.number) ?? list[0]);
  },
  parsePush(body) {
    const d = o(o(body).data);
    const number = String(d.tracking_number ?? "");
    if (!number || !d.delivery_status) return null;
    const t = fromTrackingMore(d);
    return t ? { number, tracking: t } : null;
  },
};

/* ------------------------------------------------------------------- Ship24 -- */
// Public API v1: Authorization: Bearer <key>. POST /trackers/track creates the tracker (once) and answers its results.
const SHIP24 = "https://api.ship24.com/public/v1";
const S24_STATUS: Record<string, TrackStatus> = { pending: "info", info_received: "info", in_transit: "transit", out_for_delivery: "out", available_for_pickup: "out", delivered: "delivered", failed_attempt: "problem", exception: "problem", expired: "problem" };

/** One Ship24 tracking result (API answer or webhook) in our shape. Exported for the tests. */
export function fromShip24(raw: unknown): Tracking | null {
  const t = o(raw), sh = o(t.shipment);
  const events: TrackEvent[] = arr(t.events).map((x) => {
    const e = o(x);
    return { status: S24_STATUS[String(e.statusMilestone)] ?? "info", city: String(e.location ?? ""), province: "", country: "", message: String(e.status ?? ""), at: String(e.occurrenceDatetime ?? e.datetime ?? "") };
  });
  const status = S24_STATUS[String(sh.statusMilestone)];
  if (!events.length && (!status || sh.statusMilestone === "pending")) return null;
  return buildTracking({ events, estimated: o(sh.delivery).estimatedDeliveryDate, status });
}

async function s24Call(key: string, path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(`${SHIP24}${path}`, { method: init.method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: init.body ? JSON.stringify(init.body) : undefined, signal: AbortSignal.timeout(8000) });
  const j = o(await res.json().catch(() => ({})));
  return { status: res.status, data: o(j.data) };
}

const ship24: Provider = {
  id: "ship24",
  async test(key) {
    try {
      const r = await s24Call(key, "/trackers?limit=1", { method: "GET" });
      return r.status === 200 ? { ok: true } : { ok: false, error: "This key was not accepted." };
    } catch {
      return { ok: false, error: "The service could not be reached. Try again in a moment." };
    }
  },
  async register() {
    // fetch() below creates the tracker on its first call.
  },
  async fetch(key, s) {
    const r = await s24Call(key, "/trackers/track", { method: "POST", body: { trackingNumber: s.number } });
    if (r.status !== 200 && r.status !== 201) return null;
    return fromShip24(arr(r.data.trackings)[0]);
  },
  parsePush(body) {
    const first = o(arr(o(body).trackings)[0]);
    const number = String(o(first.tracker).trackingNumber ?? "");
    if (!number) return null;
    const t = fromShip24(first);
    return t ? { number, tracking: t } : null;
  },
};

/** The services the app can talk to; a merchant's key is tried against each (17TRACK, AfterShip, TrackingMore, Ship24). */
export const PROVIDERS: Provider[] = [seventeen, aftership, trackingmore, ship24];
export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null;

/** Which service accepts this key? Tries each; the first that accepts wins. */
export async function detectProvider(key: string): Promise<{ ok: true; provider: Provider } | { ok: false; error: string }> {
  let last = "This key was not accepted.";
  // Keys that say whose they are (AfterShip "asat_", Ship24 "apik_") are tried with that service first.
  const first = key.startsWith("asat_") ? "aftership" : key.startsWith("apik_") ? "ship24" : "";
  const order = [...PROVIDERS].sort((a, b) => Number(b.id === first) - Number(a.id === first));
  for (const p of order) {
    const r = await p.test(key);
    if (r.ok) return { ok: true, provider: p };
    last = r.error;
  }
  return { ok: false, error: last };
}

/** Our own account's key (Pro live tracking). Empty until Omar adds it: live tracking then falls back to Shopify data. */
export const ownAccount = () => ({ provider: PROVIDERS[0], key: process.env.TRACKING_PROVIDER_KEY ?? "" });
