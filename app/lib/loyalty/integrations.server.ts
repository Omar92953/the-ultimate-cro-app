/**
 * Services connected to the loyalty program (Pro), each with the store's own key (encrypted, shown as its
 * last 4 characters):
 *   Klaviyo and Omnisend: every loyalty event (points earned, reward redeemed, tier changed, points expiring...)
 *     goes to the member's profile there with their points, tier and referral code, for the store's own flows;
 *   Judge.me: published reviews earn review points, like approved reviews from the app's Customer reviews;
 *   Shopify Flow: triggers (extensions/cro-flow-*) once the store has a workflow using them, and the
 *     "Add loyalty points" action.
 * Events wait in LoyaltyOutbox and go out with the loyalty run (sync.server.ts), so a slow service never
 * slows an order or the widget.
 */
import { appSecret } from "../app-secret.server";
import db from "../../db.server";
import { decrypt, encrypt, last4 } from "../tracking/secret.server";
import type { LoyaltyConfig } from "./config";
import { getProgram, memberFor, record } from "./program.server";
import { getPlan } from "../billing.server";
import { atLeast } from "../plans";
import { gql, type AdminClient } from "../admin.server";
import { excludedTags } from "./config";
import { isExcluded } from "./points";

import { createHmac, timingSafeEqual } from "node:crypto";
import { EVENT_NAMES, EVENT_TARGETS, FLOW_ACTION, FLOW_TRIGGERS, INTEGRATIONS, INTEGRATION_INFO, type IntegrationKind } from "./integrations";

export { EVENT_NAMES, INTEGRATIONS, INTEGRATION_INFO, type IntegrationKind };

type Fetch = typeof fetch;
const KLAVIYO_REVISION = "2026-10-15";

/* ------------------------------------------------------------- connect -- */
// Which event services are on, per store (a minute per server process; forgotten when the store changes them).
type Target = IntegrationKind | "flow";
const cache = new Map<string, { at: number; targets: Target[] }>();
export const forgetTargets = (shop: string) => cache.delete(shop);
export async function eventTargets(shop: string): Promise<Target[]> {
  const hit = cache.get(shop);
  if (hit && Date.now() - hit.at < 60_000) return hit.targets;
  const rows = await db.loyaltyIntegration.findMany({ where: { shop, on: true, kind: { in: [...EVENT_TARGETS, "flow"] } }, select: { kind: true } });
  const targets = rows.map((r) => r.kind as Target);
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
  if (!EVENT_NAMES[kind] && !FLOW_TRIGGERS[kind]) return 0;
  let n = 0;
  for (const target of await eventTargets(shop)) {
    if (target === "flow" ? !FLOW_TRIGGERS[kind] : !EVENT_NAMES[kind]) continue;
    try {
      await db.loyaltyOutbox.create({ data: { shop, memberId, target, kind, data: JSON.stringify(data), dedupe: dedupe ? `${target}:${dedupe}` : null } });
      n++;
    } catch {
      // Queued before.
    }
  }
  return n;
}

type Member = { id: number; customerId: string; email: string; points: number; pending: number; lifetime: number; tier: string; referralCode: string; blocked: boolean };

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

/** The Shopify Flow trigger payload for one event: its fields by their names in extensions/cro-flow-* (exported for the tests). */
export function flowPayload(c: LoyaltyConfig, m: Member, row: { kind: string; data: string }) {
  let d: EventData = {};
  try {
    d = JSON.parse(row.data || "{}");
  } catch {
    d = {};
  }
  const customer_id = Number(m.customerId);
  if (row.kind === "earned") return { customer_id, Points: d.points ?? 0, Balance: m.points, "Order name": d.order ?? "" };
  if (row.kind === "reward" || row.kind === "credit") return { customer_id, Reward: d.reward ?? "", Code: d.code ?? "", Balance: m.points };
  if (row.kind === "tier" || row.kind === "tierDown") return { customer_id, Tier: d.tier ?? "", "Moved up": row.kind === "tier" };
  return { customer_id, Balance: m.points, "Expires on": (d.date ?? "").slice(0, 10) };
}

/** Sends what is queued for one store (up to 200 a run). A refused key turns that service's sending off with the reason. */
export async function sendEvents(shop: string, c: LoyaltyConfig, http: Fetch = fetch, now = new Date(), admin?: AdminClient) {
  const rows = await db.loyaltyOutbox.findMany({ where: { shop, status: "queued" }, orderBy: { id: "asc" }, take: 200 });
  const out = { sent: 0, skipped: 0, failed: 0 };
  if (!rows.length) return out;
  const integrations = await db.loyaltyIntegration.findMany({ where: { shop, kind: { in: [...EVENT_TARGETS, "flow"] } } });
  const members = await db.loyaltyMember.findMany({ where: { shop, id: { in: [...new Set(rows.map((r) => r.memberId))] } } });
  const refused = new Set<string>();
  const done = (id: number, data: { status: string; reason?: string; sentAt?: Date }) => db.loyaltyOutbox.update({ where: { id }, data: { reason: "", ...data } });
  for (const r of rows) {
    const i = integrations.find((x) => x.kind === r.target);
    const m = members.find((x) => x.id === r.memberId);
    const flow = r.target === "flow";
    const key = i && !flow ? decrypt(i.key) : "";
    const skip = !i || !i.on || refused.has(r.target) ? "Not connected" : flow && !admin ? "Not connected" : !flow && !key ? "The key can't be read; connect again" : !m || m.blocked ? "Not a member" : !m.email ? "No email address" : r.createdAt.getTime() < now.getTime() - 3 * 86_400_000 ? "Waited too long" : "";
    if (skip) {
      await done(r.id, { status: "skipped", reason: skip });
      out.skipped++;
      continue;
    }
    if (flow) {
      const sent = await gql(admin!, `#graphql
        mutation CroFlowTrigger($handle: String!, $payload: JSON!) { flowTriggerReceive(handle: $handle, payload: $payload) { userErrors { field message } } }`, { handle: FLOW_TRIGGERS[r.kind], payload: flowPayload(c, m!, r) }).then(() => "", (e) => (e instanceof Error ? e.message : "Not sent"));
      await done(r.id, sent ? { status: "failed", reason: sent.slice(0, 200) } : { status: "sent", sentAt: now });
      if (sent) out.failed++;
      else out.sent++;
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

/** Events that can't go out on this plan: marked skipped with the reason. */
export const skipEvents = (shop: string, reason: string) => db.loyaltyOutbox.updateMany({ where: { shop, status: "queued" }, data: { status: "skipped", reason } });

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
  if (!atLeast((await getPlan(admin, shop)).plan, "growth")) return null;
  return approvedReviewPoints(shop, p.config, reviewId, email, photo);
}

/* ---------------------------------------------------------------- Flow --- */
/** Flow signs its calls like webhooks: base64 HMAC SHA256 of the raw body with the app's secret. */
export function flowSigned(raw: string, header: string | null) {
  // No secret: nothing is accepted (never a signature anyone could make with an empty key).
  let secret: string;
  try {
    secret = appSecret();
  } catch {
    return false;
  }
  const want = Buffer.from(createHmac("sha256", secret).update(raw, "utf8").digest("base64"));
  const got = Buffer.from(String(header ?? ""));
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Flow says whether the store has a workflow using a loyalty trigger: triggers are sent only then. */
export async function flowLifecycle(shop: string, body: { flow_trigger_definition_id?: string; has_enabled_flow?: boolean; timestamp?: string }) {
  const id = String(body.flow_trigger_definition_id ?? "");
  if (!id) return;
  const row = await db.loyaltyIntegration.findUnique({ where: { shop_kind: { shop, kind: "flow" } } });
  let defs: Record<string, { on: boolean; at: string }> = {};
  try {
    defs = JSON.parse(row?.state || "{}").defs ?? {};
  } catch {
    defs = {};
  }
  const at = String(body.timestamp ?? new Date().toISOString());
  // Older news than what is kept changes nothing.
  if (defs[id] && defs[id].at > at) return;
  defs[id] = { on: !!body.has_enabled_flow, at };
  const on = Object.values(defs).some((d) => d.on);
  const state = JSON.stringify({ defs });
  await db.loyaltyIntegration.upsert({ where: { shop_kind: { shop, kind: "flow" } }, create: { shop, kind: "flow", on, state }, update: { on, state, updatedAt: new Date() } });
  forgetTargets(shop);
}

const customerNumber = (v: unknown) => {
  const s = String(v ?? "");
  const n = s.match(/(\d+)$/)?.[1] ?? "";
  return /^\d{1,20}$/.test(n) ? n : "";
};

/**
 * The "Add loyalty points" action: adds (or with a negative number takes away) points for a customer, once
 * per action run. The customer joins the program when they aren't a member yet. Errors come back to Flow in
 * plain words (Flow shows a 4xx `message` to the merchant and doesn't retry it).
 */
export async function flowAddPoints(admin: AdminClient, shop: string, body: { handle?: string; action_run_id?: string; properties?: Record<string, unknown> }): Promise<{ status: number; message: string }> {
  if (body.handle && body.handle !== FLOW_ACTION) return { status: 400, message: "Unknown action." };
  const p = await getProgram(shop);
  if (!p.on) return { status: 422, message: "The loyalty program is off in CRO Toolbox." };
  if (!atLeast((await getPlan(admin, shop)).plan, "pro")) return { status: 422, message: "The loyalty program needs the Pro plan of CRO Toolbox." };
  const props = body.properties ?? {};
  const customerId = customerNumber(props.customer_id);
  const points = Math.round(Number(props.points));
  if (!customerId) return { status: 422, message: "No customer for this action." };
  if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 1_000_000) return { status: 422, message: "Points must be a whole number other than 0." };
  let m = await db.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId } } });
  if (!m) {
    const d = await gql(admin, `#graphql
      query CroFlowCustomer($id: ID!) { customer(id: $id) { locale tags defaultEmailAddress { emailAddress marketingState } } }`, { id: `gid://shopify/Customer/${customerId}` });
    if (!d.customer) return { status: 422, message: "This customer doesn't exist any more." };
    const tags: string[] = d.customer.tags ?? [];
    if (isExcluded(tags, excludedTags(p.config))) return { status: 422, message: "This customer has a tag that keeps them out of the loyalty program." };
    m = await memberFor(shop, { id: customerId, email: String(d.customer.defaultEmailAddress?.emailAddress ?? "").toLowerCase(), firstName: "", locale: d.customer.locale ?? "", tags, marketing: d.customer.defaultEmailAddress?.marketingState === "SUBSCRIBED" }, true);
  }
  if (!m) return { status: 500, message: "The member could not be made. Try again." };
  if (m.blocked) return { status: 422, message: "This member is blocked in CRO Toolbox." };
  const note = String(props.note ?? "").trim().slice(0, 200) || "Shopify Flow";
  const runId = String(body.action_run_id ?? "").slice(0, 120);
  await record(shop, m.id, { kind: "flow", points, note, ...(runId ? { dedupe: `flow:${runId}` } : {}) });
  return { status: 200, message: "" };
}
