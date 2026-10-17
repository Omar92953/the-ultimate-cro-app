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
      return { ok: false, error: "We could not reach the service. Try again in a moment." };
    }
  },
  async register(key, s) {
    await call(key, "/register", [{ number: s.number }]);
  },
  async fetch(key, s) {
    const r = await call(key, "/gettrackinfo", [{ number: s.number }]);
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

/** The services the app can talk to; a merchant's key is tried against each. */
export const PROVIDERS: Provider[] = [seventeen];
export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? null;

/** Which service accepts this key? Tries each; the first that accepts wins. */
export async function detectProvider(key: string): Promise<{ ok: true; provider: Provider } | { ok: false; error: string }> {
  let last = "This key was not accepted.";
  for (const p of PROVIDERS) {
    const r = await p.test(key);
    if (r.ok) return { ok: true, provider: p };
    last = r.error;
  }
  return { ok: false, error: last };
}

/** Our own account's key (Pro live tracking). Empty until Omar adds it: live tracking then falls back to Shopify data. */
export const ownAccount = () => ({ provider: PROVIDERS[0], key: process.env.TRACKING_PROVIDER_KEY ?? "" });
