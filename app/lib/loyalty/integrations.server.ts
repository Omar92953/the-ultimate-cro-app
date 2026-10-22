/**
 * Services connected to the loyalty program (Pro), each with the store's own key (encrypted, shown as its
 * last 4 characters):
 *   Klaviyo and Omnisend: every loyalty event (points earned, reward redeemed, tier changed, points expiring...)
 *     goes to the member's profile there with their points, tier and referral code, for the store's own flows;
 *   Judge.me: published reviews earn review points, like approved reviews from the app's Customer reviews.
 * Events wait in LoyaltyOutbox and go out with the loyalty run (sync.server.ts), so a slow service never
 * slows an order or the widget.
 */
import db from "../../db.server";
import { decrypt, encrypt, last4 } from "../tracking/secret.server";
import type { LoyaltyConfig } from "./config";
import { getProgram, record } from "./program.server";
import { getPlan } from "../billing.server";
import { atLeast } from "../plans";
import type { AdminClient } from "../admin.server";

import { EVENT_NAMES, EVENT_TARGETS, INTEGRATIONS, INTEGRATION_INFO, type IntegrationKind } from "./integrations";

export { EVENT_NAMES, INTEGRATIONS, INTEGRATION_INFO, type IntegrationKind };

type Fetch = typeof fetch;
const KLAVIYO_REVISION = "2026-10-15";

/* ------------------------------------------------------------- connect -- */
// Which event services are on, per store (a minute per server process; forgotten when the store changes them).
const cache = new Map<string, { at: number; targets: IntegrationKind[] }>();
export const forgetTargets = (shop: string) => cache.delete(shop);
export async function eventTargets(shop: string): Promise<IntegrationKind[]> {
  const hit = cache.get(shop);
  if (hit && Date.now() - hit.at < 60_000) return hit.targets;
  const rows = await db.loyaltyIntegration.findMany({ where: { shop, on: true, kind: { in: EVENT_TARGETS } }, select: { kind: true } });
  const targets = rows.map((r) => r.kind as IntegrationKind);
  cache.set(shop, { at: Date.now(), targets });
  if (cache.size > 5000) cache.clear();
  return targets;
}

/** Asks the service whether the key works. Only a refused key counts as wrong (401 or 403). */
export async function checkKey(kind: IntegrationKind, key: string, shop: string, http: Fetch = fetch): Promise<string | null> {
  const res =
    kind === "klaviyo"
      ? await http("https://a.klaviyo.com/api/accounts/", { headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: KLAVIYO_REVISION, Accept: "application/vnd.api+json" } })
      : kind === "omnisend"
        ? await http("https://api.omnisend.com/v5/contacts?limit=1", { headers: { "X-API-KEY": key, Accept: "application/json" } })
        : await http(`https://api.judge.me/api/v1/reviews?${new URLSearchParams({ api_token: key, shop_domain: shop, per_page: "1" })}`, { headers: { Accept: "application/json" } });
  if (res.status === 401 || res.status === 403) return `${INTEGRATION_INFO[kind].title} refused this key. Check that it is the ${INTEGRATION_INFO[kind].key.toLowerCase()} with the access listed.`;
  return null;
}

/** Connects a service with the store's key. Judge.me starts from the reviews published from now on. */
export async function connect(shop: string, kind: IntegrationKind, rawKey: string, http: Fetch = fetch) {
  const key = rawKey.trim();
  if (key.length < 8 || key.length > 300 || /\s/.test(key)) throw new Error(`Paste the ${INTEGRATION_INFO[kind].key.toLowerCase()} from ${INTEGRATION_INFO[kind].title}.`);
  const wrong = await checkKey(kind, key, shop, http);
  if (wrong) throw new Error(wrong);
  const state = kind === "judgeme" ? JSON.stringify({ cursor: await latestJudgeMeId(key, shop, http).catch(() => 0) }) : "{}";
  await db.loyaltyIntegration.upsert({ where: { shop_kind: { shop, kind } }, create: { shop, kind, key: encrypt(key), last4: last4(key), on: true, state }, update: { key: encrypt(key), last4: last4(key), on: true, state, error: "", updatedAt: new Date() } });
  forgetTargets(shop);
}

export async function setIntegrationOn(shop: string, kind: IntegrationKind, on: boolean) {
  await db.loyaltyIntegration.updateMany({ where: { shop, kind }, data: { on, updatedAt: new Date() } });
  forgetTargets(shop);
}
export async function disconnect(shop: string, kind: IntegrationKind) {
  await db.loyaltyIntegration.deleteMany({ where: { shop, kind } });
  forgetTargets(shop);
}

/** The Integrations page: each service's state (never the key itself). */
export async function integrationList(shop: string) {
  const rows = await db.loyaltyIntegration.findMany({ where: { shop } });
  const since = new Date(Date.now() - 30 * 86_400_000);
  const sent = await db.loyaltyOutbox.groupBy({ by: ["target", "status"], where: { shop, createdAt: { gte: since } }, _count: { _all: true } });
  return Object.fromEntries(
    INTEGRATIONS.map((k) => {
      const r = rows.find((x) => x.kind === k);
      const count = (status: string) => sent.find((s) => s.target === k && s.status === status)?._count._all ?? 0;
      return [k, r ? { connected: true, on: r.on, last4: r.last4, error: r.error, sent: count("sent"), failed: count("failed") } : { connected: false, on: false, last4: "", error: "", sent: 0, failed: 0 }];
    }),
  ) as Record<IntegrationKind, { connected: boolean; on: boolean; last4: string; error: string; sent: number; failed: number }>;
}

/* -------------------------------------------------------------- events -- */
export type EventData = { points?: number; credit?: number; order?: string; date?: string; reward?: string; code?: string; tier?: string; giftPoints?: number; giftCredit?: number };

/** Queues one loyalty event for each event service the store has on. The same `dedupe` is queued once per service. */
export async function queueEvents(shop: string, memberId: number, kind: string, data: EventData, dedupe?: string) {
  const name = EVENT_NAMES[kind];
  if (!name) return 0;
  let n = 0;
  for (const target of await eventTargets(shop)) {
    try {
      await db.loyaltyOutbox.create({ data: { shop, memberId, target, kind, data: JSON.stringify(data), dedupe: dedupe ? `${target}:${dedupe}` : null } });
      n++;
    } catch {
      // Queued before.
    }
  }
  return n;
}

type Member = { id: number; email: string; points: number; pending: number; lifetime: number; tier: string; referralCode: string; blocked: boolean };

/** What the services keep on the member's profile. */
export function profileProperties(c: LoyaltyConfig, m: Member) {
  const tier = c.tiers.on ? c.tiers.list.find((t) => t.id === m.tier)?.name ?? "" : "";
  return { points: m.points, pending: m.pending, lifetime: m.lifetime, tier, referralCode: c.referral.on ? m.referralCode : "" };
}

/** The request one event becomes (exported for the tests). */
export function eventRequest(target: IntegrationKind, key: string, c: LoyaltyConfig, m: Member, row: { id: number; kind: string; data: string; createdAt: Date }): { url: string; init: { method: string; headers: Record<string, string>; body: string } } {
  let d: EventData = {};
  try {
    d = JSON.parse(row.data || "{}");
  } catch {
    d = {};
  }
  const p = profileProperties(c, m);
  const props = { ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined && v !== "")), balance: m.points, pending: m.pending, unit: c.unit.many };
  if (target === "klaviyo")
    return {
      url: "https://a.klaviyo.com/api/events",
      init: {
        method: "POST",
        headers: { Authorization: `Klaviyo-API-Key ${key}`, revision: KLAVIYO_REVISION, "Content-Type": "application/vnd.api+json", Accept: "application/vnd.api+json" },
        body: JSON.stringify({
          data: {
            type: "event",
            attributes: {
              properties: props,
              time: row.createdAt.toISOString(),
              unique_id: `cro-loyalty-${row.id}`,
              metric: { data: { type: "metric", attributes: { name: EVENT_NAMES[row.kind] } } },
              profile: { data: { type: "profile", attributes: { email: m.email, properties: { "Loyalty points": p.points, "Loyalty pending points": p.pending, "Loyalty lifetime points": p.lifetime, "Loyalty tier": p.tier, "Loyalty referral code": p.referralCode } } } },
            },
          },
        }),
      },
    };
  return {
    url: "https://api.omnisend.com/v5/events",
    init: {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        eventName: EVENT_NAMES[row.kind],
        origin: "api",
        eventTime: row.createdAt.toISOString(),
        contact: { email: m.email, customProperties: { loyaltyPoints: p.points, loyaltyPendingPoints: p.pending, loyaltyLifetimePoints: p.lifetime, loyaltyTier: p.tier, loyaltyReferralCode: p.referralCode } },
        properties: props,
      }),
    },
  };
}

/** Sends what is queued for one store (up to 200 a run). A refused key turns that service's sending off with the reason. */
export async function sendEvents(shop: string, c: LoyaltyConfig, http: Fetch = fetch, now = new Date()) {
  const rows = await db.loyaltyOutbox.findMany({ where: { shop, status: "queued" }, orderBy: { id: "asc" }, take: 200 });
  const out = { sent: 0, skipped: 0, failed: 0 };
  if (!rows.length) return out;
  const integrations = await db.loyaltyIntegration.findMany({ where: { shop, kind: { in: EVENT_TARGETS } } });
  const members = await db.loyaltyMember.findMany({ where: { shop, id: { in: [...new Set(rows.map((r) => r.memberId))] } } });
  const refused = new Set<string>();
  const done = (id: number, data: { status: string; reason?: string; sentAt?: Date }) => db.loyaltyOutbox.update({ where: { id }, data: { reason: "", ...data } });
  for (const r of rows) {
    const i = integrations.find((x) => x.kind === r.target);
    const m = members.find((x) => x.id === r.memberId);
    const key = i ? decrypt(i.key) : null;
    const skip = !i || !i.on || refused.has(r.target) ? "Not connected" : !key ? "The key can't be read; connect again" : !m || m.blocked ? "Not a member" : !m.email ? "No email address" : r.createdAt.getTime() < now.getTime() - 3 * 86_400_000 ? "Waited too long" : "";
    if (skip) {
      await done(r.id, { status: "skipped", reason: skip });
      out.skipped++;
      continue;
    }
    const req = eventRequest(r.target as IntegrationKind, key!, c, m!, r);
    const res = await http(req.url, req.init).catch(() => null);
    if (res && res.status >= 200 && res.status < 300) {
      await done(r.id, { status: "sent", sentAt: now });
      out.sent++;
      continue;
    }
    const why = !res ? "No answer" : res.status === 401 || res.status === 403 ? "The key was refused" : `${INTEGRATION_INFO[r.target as IntegrationKind].title} answered ${res.status}`;
    await done(r.id, { status: "failed", reason: why });
    out.failed++;
    if (res && (res.status === 401 || res.status === 403)) {
      refused.add(r.target);
      await db.loyaltyIntegration.update({ where: { id: i!.id }, data: { on: false, error: `${INTEGRATION_INFO[r.target as IntegrationKind].title} refused the key. Connect it again.` } });
      forgetTargets(shop);
    }
  }
  return out;
}

/* ------------------------------------------------------------- reviews -- */
type JudgeMeReview = { id: number; rating?: number; hidden?: boolean; curated?: string; reviewer?: { email?: string | null } | null; pictures?: unknown[] | null };

async function judgeMePage(key: string, shop: string, page: number, http: Fetch) {
  const res = await http(`https://api.judge.me/api/v1/reviews?${new URLSearchParams({ api_token: key, shop_domain: shop, per_page: "100", page: String(page), published: "true" })}`, { headers: { Accept: "application/json" } });
  if (res.status === 401 || res.status === 403) throw new Error("Judge.me refused the token. Connect it again.");
  if (!res.ok) throw new Error(`Judge.me answered ${res.status}`);
  const body = (await res.json()) as { reviews?: JudgeMeReview[] };
  return body.reviews ?? [];
}
async function latestJudgeMeId(key: string, shop: string, http: Fetch) {
  let max = 0;
  for (let page = 1; page <= 5; page++) {
    const list = await judgeMePage(key, shop, page, http);
    for (const r of list) max = Math.max(max, Number(r.id) || 0);
    if (list.length < 100) break;
  }
  return max;
}

const reviewPoints = (c: LoyaltyConfig, photo: boolean) => c.earn.review.points + (photo ? c.earn.review.photo : 0);

/** Judge.me: reviews published since the last read earn review points for the member with the reviewer's email. */
export async function judgeMeReviews(shop: string, c: LoyaltyConfig, http: Fetch = fetch) {
  if (!c.earn.review.on) return 0;
  const i = await db.loyaltyIntegration.findUnique({ where: { shop_kind: { shop, kind: "judgeme" } } });
  const key = i?.on ? decrypt(i.key) : null;
  if (!i || !key) return 0;
  let cursor = 0;
  try {
    cursor = Number(JSON.parse(i.state || "{}").cursor) || 0;
  } catch {
    cursor = 0;
  }
  let n = 0, max = cursor;
  try {
    // Pages until one is not full (Judge.me's order isn't documented, so every page up to 5 is looked at).
    for (let page = 1; page <= 5; page++) {
      const list = await judgeMePage(key, shop, page, http);
      for (const r of list) {
        const id = Number(r.id) || 0;
        max = Math.max(max, id);
        const email = String(r.reviewer?.email ?? "").trim().toLowerCase();
        if (id <= cursor || !email || r.hidden || r.curated === "spam") continue;
        const m = await db.loyaltyMember.findFirst({ where: { shop, email, blocked: false } });
        if (!m) continue;
        const points = reviewPoints(c, !!r.pictures?.length);
        if (points > 0 && (await record(shop, m.id, { kind: "review", points, note: "Judge.me", dedupe: `review:judgeme:${id}` }))) n++;
      }
      if (list.length < 100) break;
    }
    await db.loyaltyIntegration.update({ where: { id: i.id }, data: { state: JSON.stringify({ cursor: max }), error: "" } });
  } catch (e) {
    await db.loyaltyIntegration.update({ where: { id: i.id }, data: { error: e instanceof Error ? e.message.slice(0, 200) : "Judge.me could not be read" } });
  }
  return n;
}

/** The app's own Customer reviews: an approved review earns review points for the member who wrote it (once). */
export async function approvedReviewPoints(shop: string, c: LoyaltyConfig, reviewId: string, email: string, photo = false) {
  if (!c.earn.review.on || !email) return null;
  const m = await db.loyaltyMember.findFirst({ where: { shop, email: email.toLowerCase(), blocked: false } });
  if (!m) return null;
  const points = reviewPoints(c, photo);
  return points > 0 ? record(shop, m.id, { kind: "review", points, note: "Review", dedupe: `review:own:${reviewId}` }) : null;
}

/** A review was approved in Customer reviews: its writer's review points, when the program is on (Pro). */
export async function reviewApproved(admin: AdminClient, shop: string, reviewId: string, email: string, photo = false) {
  if (!email) return null;
  const p = await getProgram(shop);
  if (!p.on || !p.config.earn.review.on) return null;
  if (!atLeast((await getPlan(admin, shop)).plan, "pro")) return null;
  return approvedReviewPoints(shop, p.config, reviewId, email, photo);
}
