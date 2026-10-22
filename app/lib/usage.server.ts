/**
 * Plan limits a store can go over (plans.ts METERS): live tracked shipments, loyalty orders and loyalty emails a
 * month. Below the limit nothing changes. At the limit the work stops for the month (tracking uses Shopify's data,
 * orders stop earning, emails wait), unless the store turned "Allow extra" on: then it goes on and each unit over
 * is a billable event for Shopify App Pricing (App Events API), sent by `reportUsage`.
 *
 * Reporting needs an API key made in the Dev Dashboard: APP_EVENTS_CLIENT_ID and APP_EVENTS_CLIENT_SECRET in
 * Render (Omar types them). Until then units over are kept as "queued" and sent once the key is there.
 */
import { createHash } from "node:crypto";
import db from "../db.server";
import { limitOf, METERS, METER_KEYS, type MeterKey, type PlanKey } from "./plans";

const month = (d = new Date()) => d.toISOString().slice(0, 7);
const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/** How much of each limit the store used this month. */
export async function usedThisMonth(shop: string, meter: MeterKey, now = new Date()): Promise<number> {
  if (meter === "liveShipments") return (await db.trackingUsage.findUnique({ where: { shop_month: { shop, month: month(now) } } }))?.count ?? 0;
  if (meter === "loyaltyOrders") return db.loyaltyEvent.count({ where: { shop, kind: "order", createdAt: { gte: monthStart(now) } } });
  return db.loyaltyEmail.count({ where: { shop, status: "sent", sentAt: { gte: monthStart(now) } } });
}

export async function extrasFor(shop: string): Promise<Record<MeterKey, boolean>> {
  const rows = await db.usageExtra.findMany({ where: { shop } });
  return Object.fromEntries(METER_KEYS.map((k) => [k, !!rows.find((r) => r.meter === k)?.on])) as Record<MeterKey, boolean>;
}

export async function setExtra(shop: string, meter: MeterKey, on: boolean) {
  await db.usageExtra.upsert({ where: { shop_meter: { shop, meter } }, create: { shop, meter, on }, update: { on, updatedAt: new Date() } });
}

/**
 * One more unit of `meter`: true when it is within the plan's limit, or over it with extra on (then the unit is
 * queued for billing under `key`, which makes the same unit count once). False: stop for this month.
 * `used` is the count before this unit.
 */
export async function allowUnit(shop: string, plan: PlanKey, meter: MeterKey, used: number, key: string, extra?: boolean, now = new Date()) {
  const limit = limitOf(plan, meter);
  if (limit === null || used < limit) return true;
  if (limit === 0) return false; // Not on this plan at all.
  const on = extra ?? (await db.usageExtra.findUnique({ where: { shop_meter: { shop, meter } } }))?.on ?? false;
  if (!on) return false;
  await db.usageEvent.create({ data: { shop, meter, month: month(now), key: `${meter}:${key}`.slice(0, 64) } }).catch(() => null);
  return true;
}

export type MeterUsage = { meter: MeterKey; title: string; unit: string; used: number; limit: number; extra: boolean; over: number; price: number; per: number; atLimit: string };

/** The usage bars: each limit on this plan, how much is used, and what extra costs. */
export async function usageSummary(shop: string, plan: PlanKey, now = new Date()): Promise<MeterUsage[]> {
  const extras = await extrasFor(shop);
  const out: MeterUsage[] = [];
  for (const meter of METER_KEYS) {
    const limit = limitOf(plan, meter);
    if (!limit) continue;
    const m = METERS[meter];
    const over = await db.usageEvent.count({ where: { shop, meter, month: month(now) } });
    out.push({ meter, title: m.title, unit: m.unit, used: await usedThisMonth(shop, meter, now), limit, extra: extras[meter], over, price: m.price, per: m.per, atLimit: m.atLimit });
  }
  return out;
}

/* ------------------------------------------------------------- billing -- */
let token: { value: string; until: number } | null = null;
type Fetch = typeof fetch;

async function accessToken(http: Fetch) {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const res = await http("https://api.shopify.com/auth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.APP_EVENTS_CLIENT_ID, client_secret: process.env.APP_EVENTS_CLIENT_SECRET, grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Shopify refused the App Events key (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in?: number };
  token = { value: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

/** Sends the queued units over a limit to Shopify App Pricing, one billable event each (all stores, 200 a run). */
export async function reportUsage(shopIds: (shop: string) => Promise<string | null>, http: Fetch = fetch, now = new Date()) {
  if (!process.env.APP_EVENTS_CLIENT_ID || !process.env.APP_EVENTS_CLIENT_SECRET) return 0;
  // Events outside the current billing cycle are refused, so last month's queue is closed.
  await db.usageEvent.updateMany({ where: { status: "queued", month: { not: month(now) } }, data: { status: "failed", reason: "Not sent within its month" } });
  const rows = await db.usageEvent.findMany({ where: { status: "queued" }, orderBy: { id: "asc" }, take: 200 });
  let sent = 0;
  for (const r of rows) {
    try {
      const shopId = await shopIds(r.shop);
      if (!shopId) throw new Error("No shop id");
      const res = await http("https://api.shopify.com/app/2026-10/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await accessToken(http)}` },
        body: JSON.stringify({ event_handle: METERS[r.meter as MeterKey].handle, attributes: { value: 1 }, idempotency_key: createHash("sha256").update(`${r.shop}|${r.key}`).digest("hex"), timestamp: r.createdAt.toISOString(), shop_id: shopId }),
      });
      if (res.status === 202 || res.ok) {
        await db.usageEvent.update({ where: { id: r.id }, data: { status: "sent", sentAt: new Date(), reason: "" } });
        sent++;
      } else await db.usageEvent.update({ where: { id: r.id }, data: { reason: `Shopify answered ${res.status}` } });
    } catch (e) {
      await db.usageEvent.update({ where: { id: r.id }, data: { reason: (e instanceof Error ? e.message : "Not sent").slice(0, 200) } });
    }
  }
  return sent;
}
