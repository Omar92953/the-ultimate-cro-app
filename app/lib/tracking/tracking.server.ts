/**
 * Where a shipment's tracking comes from, per store (docs/research/tracking-returns.md §9):
 * webhook pushes, the merchant's own key, our included live tracking (Pro, 500 shipments a month), then
 * Shopify's own fulfillment data. The shopper's page reads the cache; the provider is asked for a new number
 * once, then a few times a day in the background, and not at all after delivery or 60 days.
 */
import db from "../../db.server";
import type { PlanKey } from "../plans";
import { atLeast } from "../plans";
import { RuleError } from "../rules";
import { LIVE_MONTHLY_LIMIT, TRACK_SOURCES, buildTracking, cleanCarrierLinks, isFresh, sourceAllowed, sourcesToTry, type CarrierLink, type TrackSource, type Tracking } from "../tracking";
import { detectProvider, ownAccount, providerById, PROVIDERS, type Provider, type Shipment } from "./provider.server";
import { decrypt, encrypt, last4, newSecret, sameSecret } from "./secret.server";

const month = () => new Date().toISOString().slice(0, 7);
export const appBase = () => (process.env.SHOPIFY_APP_URL ?? "").replace(/\/$/, "");

/* ---------------------------------------------------------------- settings -- */
export async function getTrackingConfig(shop: string, plan: PlanKey) {
  const c = await db.trackingConfig.findUnique({ where: { shop } });
  const used = (await db.trackingUsage.findUnique({ where: { shop_month: { shop, month: month() } } }))?.count ?? 0;
  const source = (TRACK_SOURCES as readonly string[]).includes(c?.source ?? "") ? (c!.source as TrackSource) : "shopify";
  return {
    chosen: !!c,
    // Advanced sources on a plan below Pro fall back to Basic tracking (Shopify's data).
    source: sourceAllowed(plan, source) ? source : ("shopify" as TrackSource),
    /** Advanced tracking (live, own key, webhook) is on this plan. */
    advanced: atLeast(plan, "pro"),
    /** Our live tracking account is set up (TRACKING_PROVIDER_KEY); without it live tracking can't be chosen. */
    liveReady: !!ownAccount().key,
    carrierLinks: readLinks(c?.carrierLinks),
    keyLast4: c?.keyCipher ? c.keyLast4 : "",
    hasKey: !!c?.keyCipher,
    webhookUrl: c?.webhookSecret ? `${appBase()}/tracking/hook/${encodeURIComponent(shop)}/${c.webhookSecret}` : "",
    live: { used, limit: LIVE_MONTHLY_LIMIT, available: atLeast(plan, "pro") },
  };
}

export async function saveSource(shop: string, plan: PlanKey, source: string) {
  if (!(TRACK_SOURCES as readonly string[]).includes(source)) throw new RuleError("Choose where tracking should come from.", "input", false);
  const s = source as TrackSource;
  if (!sourceAllowed(plan, s)) throw new RuleError("Advanced tracking (live tracking, your own key or a webhook link) is on the Pro plan.", "plan");
  if (s === "live" && !ownAccount().key) throw new RuleError("Live tracking isn't switched on yet. Use your own key or a webhook link for now.", "input", false);
  const cur = await db.trackingConfig.findUnique({ where: { shop } });
  if (s === "own" && !cur?.keyCipher) throw new RuleError("Paste and test your key first.", "input", false);
  const webhookSecret = s === "webhook" && !cur?.webhookSecret ? newSecret() : (cur?.webhookSecret ?? "");
  await db.trackingConfig.upsert({ where: { shop }, create: { shop, source: s, webhookSecret }, update: { source: s, webhookSecret, updatedAt: new Date() } });
}

/** Tests the key against every supported service; saves it encrypted only when one accepts it. */
export async function saveKey(shop: string, plan: PlanKey, raw: string) {
  if (!atLeast(plan, "pro")) throw new RuleError("Your own tracking key is part of Advanced tracking, on the Pro plan.", "plan");
  const key = raw.trim();
  if (key.length < 8 || key.length > 200 || /\s/.test(key)) throw new RuleError("That does not look like a key. Paste it exactly as the service shows it.", "input", false);
  const found = await detectProvider(key);
  if (!found.ok) throw new RuleError(found.error, "input", false);
  await db.trackingConfig.upsert({ where: { shop }, create: { shop, source: "own", keyCipher: encrypt(key), keyLast4: last4(key), provider: found.provider.id }, update: { keyCipher: encrypt(key), keyLast4: last4(key), provider: found.provider.id, source: "own", updatedAt: new Date() } });
}

/* ----------------------------------------------------------- carrier links -- */
const readLinks = (raw: string | null | undefined): CarrierLink[] => {
  try {
    return cleanCarrierLinks(JSON.parse(raw ?? "[]"));
  } catch {
    return [];
  }
};

/** Links for carriers Shopify has no tracking link for (Basic and Advanced tracking). */
export async function saveCarrierLinks(shop: string, raw: unknown) {
  const links = cleanCarrierLinks(raw);
  await db.trackingConfig.upsert({ where: { shop }, create: { shop, carrierLinks: JSON.stringify(links) }, update: { carrierLinks: JSON.stringify(links), updatedAt: new Date() } });
  return links;
}

export async function carrierLinksFor(shop: string): Promise<CarrierLink[]> {
  return readLinks((await db.trackingConfig.findUnique({ where: { shop }, select: { carrierLinks: true } }))?.carrierLinks);
}

export async function removeKey(shop: string) {
  const c = await db.trackingConfig.findUnique({ where: { shop } });
  if (!c) return;
  await db.trackingConfig.update({ where: { shop }, data: { keyCipher: "", keyLast4: "", provider: "", source: c.source === "own" ? "shopify" : c.source } });
}

export async function regenerateSecret(shop: string) {
  const webhookSecret = newSecret();
  await db.trackingConfig.upsert({ where: { shop }, create: { shop, webhookSecret }, update: { webhookSecret } });
}

/* ------------------------------------------------------------------- cache -- */
const toRow = (t: Tracking) => JSON.stringify(t);
const fromRow = (data: string): Tracking | null => {
  try {
    const t = JSON.parse(data) as Partial<Tracking>;
    return buildTracking({ events: t.events, estimated: t.estimated, delivered: t.delivered, status: t.status });
  } catch {
    return null;
  }
};

/** Where a cached answer came from: a tracking source, or the merchant's own typed updates. */
export type TrackVia = TrackSource | "manual";

async function store(shop: string, s: Shipment, via: TrackVia, t: Tracking) {
  await db.trackingCache.upsert({
    where: { shop_number: { shop, number: s.number } },
    create: { shop, number: s.number, carrier: s.carrier.slice(0, 60), via, status: t.status, data: toRow(t) },
    update: { via, status: t.status, data: toRow(t), checkedAt: new Date() },
  });
}

/** A push from the merchant's carrier or service (the per shop webhook link). Returns false when the link or body is wrong. */
export async function ingestPush(shop: string, secret: string, body: unknown): Promise<boolean> {
  const c = await db.trackingConfig.findUnique({ where: { shop } });
  if (!c || !sameSecret(c.webhookSecret, secret)) return false;
  let hit: { number: string; tracking: Tracking } | null = null;
  for (const p of PROVIDERS) if (!hit && p.parsePush) hit = p.parsePush(body);
  if (!hit) {
    // Our own plain format: { number, status?, estimated?, delivered?, events: [{ status, city, province, country, message, at }] }
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const number = String(b.number ?? b.tracking_number ?? "").slice(0, 80);
    if (!number) return false;
    hit = { number, tracking: buildTracking({ events: b.events, estimated: b.estimated, delivered: b.delivered, status: b.status }) };
  }
  await store(shop, { number: hit.number, carrier: "", country: "" }, "webhook", hit.tracking);
  return true;
}

/* ------------------------------------------------------------------ resolve -- */
const inflight = new Set<string>();

async function viaProvider(shop: string, via: "own" | "live", provider: Provider, key: string, s: Shipment, plan: PlanKey): Promise<Tracking | null> {
  const row = await db.trackingCache.findUnique({ where: { shop_number: { shop, number: s.number } } });
  const mine = row && row.via === via ? row : null;
  const refresh = async () => {
    const flight = `${shop}:${s.number}`;
    if (inflight.has(flight)) return null;
    inflight.add(flight);
    try {
      if (!mine) {
        if (via === "live") {
          const used = await db.trackingUsage.upsert({ where: { shop_month: { shop, month: month() } }, create: { shop, month: month(), count: 0 }, update: {} });
          if (used.count >= LIVE_MONTHLY_LIMIT || !atLeast(plan, "pro")) return null;
          await db.trackingUsage.update({ where: { shop_month: { shop, month: month() } }, data: { count: { increment: 1 } } });
        }
        await provider.register(key, s);
      }
      const t = await provider.fetch(key, s);
      if (t) await store(shop, s, via, t);
      else if (mine) await db.trackingCache.update({ where: { id: mine.id }, data: { checkedAt: new Date() } });
      return t;
    } catch {
      return null;
    } finally {
      inflight.delete(flight);
    }
  };
  if (mine) {
    const cached = fromRow(mine.data);
    if (!isFresh(mine)) void refresh(); // answered from the cache now, refreshed in the background
    return cached;
  }
  return refresh();
}

/** Tracking for one shipment from the first source that has it; `shopify` is what Shopify itself knows. */
export async function resolveTracking(shop: string, plan: PlanKey, s: Shipment, shopify: Tracking | null): Promise<{ tracking: Tracking | null; via: TrackVia }> {
  if (!s.number) return { tracking: shopify, via: "shopify" };
  // Updates the merchant typed (a courier with no system) come first: they are the store's own word.
  if (atLeast(plan, "pro")) {
    const typed = await db.trackingCache.findUnique({ where: { shop_number: { shop, number: s.number } } });
    const t = typed?.via === "manual" ? fromRow(typed.data) : null;
    if (t) return { tracking: t, via: "manual" };
  }
  const cfg = await db.trackingConfig.findUnique({ where: { shop } });
  const picked = (TRACK_SOURCES as readonly string[]).includes(cfg?.source ?? "") ? (cfg!.source as TrackSource) : "shopify";
  const chosen = sourceAllowed(plan, picked) ? picked : "shopify";
  for (const src of sourcesToTry(chosen)) {
    if (src === "webhook") {
      const row = await db.trackingCache.findUnique({ where: { shop_number: { shop, number: s.number } } });
      const t = row?.via === "webhook" ? fromRow(row.data) : null;
      if (t) return { tracking: t, via: "webhook" };
    } else if (src === "own" && cfg?.keyCipher) {
      const key = decrypt(cfg.keyCipher);
      const provider = providerById(cfg.provider);
      const t = key && provider ? await viaProvider(shop, "own", provider, key, s, plan) : null;
      if (t) return { tracking: t, via: "own" };
    } else if (src === "live" && atLeast(plan, "pro")) {
      const acct = ownAccount();
      const t = acct.key ? await viaProvider(shop, "live", acct.provider, acct.key, s, plan) : null;
      if (t) return { tracking: t, via: "live" };
    } else if (src === "shopify") {
      return { tracking: shopify, via: "shopify" };
    }
  }
  return { tracking: shopify, via: "shopify" };
}

/** Adds one update the merchant typed for a shipment (Advanced tracking): it shows on the Track page from then on. */
export async function addManualUpdate(shop: string, plan: PlanKey, number: string, carrier: string, input: { status: unknown; place: unknown; message: unknown }) {
  if (!atLeast(plan, "pro")) throw new RuleError("Typing your own tracking updates is part of Advanced tracking, on the Pro plan.", "plan");
  const n = String(number).trim().slice(0, 80);
  if (!n) throw new RuleError("This shipment has no tracking number.", "input", false);
  const row = await db.trackingCache.findUnique({ where: { shop_number: { shop, number: n } } });
  const before = row?.via === "manual" ? (fromRow(row.data)?.events ?? []) : [];
  const [city, province, country] = String(input.place ?? "").split(",").map((x) => x.trim());
  const event = { status: input.status, city: city ?? "", province: province ?? "", country: country ?? "", message: String(input.message ?? ""), at: new Date().toISOString() };
  const t = buildTracking({ events: [event, ...before] });
  await store(shop, { number: n, carrier: carrier.slice(0, 60), country: "" }, "manual", t);
  return t;
}

/** Removes the typed updates of a shipment: the Track page goes back to the store's tracking source. */
export async function clearManualUpdates(shop: string, number: string) {
  await db.trackingCache.deleteMany({ where: { shop, number: String(number).slice(0, 80), via: "manual" } });
}

export async function removeShopTracking(shop: string) {
  await db.trackingConfig.deleteMany({ where: { shop } });
  await db.trackingCache.deleteMany({ where: { shop } });
  await db.trackingUsage.deleteMany({ where: { shop } });
}

/** Old cache rows (past the 60 day window plus a month) and usage older than a year. */
export async function sweepTracking() {
  await db.trackingCache.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } } });
}

