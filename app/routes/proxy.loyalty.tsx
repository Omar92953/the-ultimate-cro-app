/**
 * The loyalty widget on the store posts here through the app proxy (/apps/ucro/loyalty). Shopify signs every
 * request and adds `logged_in_customer_id`, so a shopper only ever sees and spends their own points.
 * Intents: "me" (balance, history, rewards got), "join" (when joining is manual), "redeem" (spend points).
 * Only on Pro with the program on.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";
import { getPlan } from "../lib/billing.server";
import { atLeast } from "../lib/plans";
import { getProgram, memberFor } from "../lib/loyalty/program.server";
import { syncCustomer } from "../lib/loyalty/sync.server";
import { NotEnoughPoints, memberRewards, redeem } from "../lib/loyalty/rewards.server";
import { eventLabel } from "../lib/loyalty/labels";
import { AdminError, gql } from "../lib/admin.server";
import { excludedTags } from "../lib/loyalty/config";
import { isExcluded } from "../lib/loyalty/points";

// A member's own orders are read again when they open the widget, at most once a minute (per server process).
const lastRead = new Map<string, number>();

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  if (!admin || !session) return json({ ok: false, error: "unavailable" }, 503);
  const shop = session.shop;
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: "bad request" }, 400);
  if (tooMany(request, shop, "loyalty", 40)) return json({ ok: false, error: "too many" }, 429);
  const program = await getProgram(shop);
  if (!program.on) return json({ ok: false, error: "off" });
  const { plan } = await getPlan(admin, shop);
  if (!atLeast(plan, "pro")) return json({ ok: false, error: "off" });
  const customerId = new URL(request.url).searchParams.get("logged_in_customer_id") ?? "";
  if (!/^\d+$/.test(customerId)) return json({ ok: true, member: null, guest: true });

  const intent = String(body.intent ?? "me");
  try {
    if (intent === "me") {
      const key = `${shop}|${customerId}`;
      if (Date.now() - (lastRead.get(key) ?? 0) > 60_000) {
        lastRead.set(key, Date.now());
        if (lastRead.size > 20000) lastRead.clear();
        await syncCustomer(shop, admin, customerId).catch(() => null);
      }
    }
    let m = await db.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId } } });
    if (!m && intent === "join") {
      // Joining from the widget: the customer's email and tags from Shopify (excluded tags can't join).
      const c = await gql(admin, `#graphql
        query CroLoyaltyJoin($id: ID!) { customer(id: $id) { locale tags defaultEmailAddress { emailAddress } } }`, { id: `gid://shopify/Customer/${customerId}` }).catch(() => null);
      const tags: string[] = c?.customer?.tags ?? [];
      if (isExcluded(tags, excludedTags(program.config))) return json({ ok: true, member: null, guest: false, canJoin: false });
      m = await memberFor(shop, { id: customerId, email: String(c?.customer?.defaultEmailAddress?.emailAddress ?? "").toLowerCase(), firstName: "", locale: c?.customer?.locale ?? "", tags }, true);
    }
    if (!m) return json({ ok: true, member: null, guest: false, canJoin: true });
    if (m.blocked) return json({ ok: true, member: null, guest: false, canJoin: false });

    let got = null;
    if (intent === "redeem") {
      got = await redeem(admin, shop, program.config, m.id, String(body.reward ?? ""));
      m = (await db.loyaltyMember.findUnique({ where: { id: m.id } }))!;
    }
    const history = await db.loyaltyEvent.findMany({ where: { shop, memberId: m.id }, orderBy: { createdAt: "desc" }, take: 12, select: { kind: true, note: true, points: true, status: true, createdAt: true } });
    return json({
      ok: true,
      got,
      member: {
        points: m.points,
        pending: m.pending,
        code: m.referralCode,
        history: history.map((e) => ({ l: eventLabel(e.kind, e.note), p: e.points, s: e.status, d: e.createdAt.toISOString().slice(0, 10) })),
        rewards: await memberRewards(shop, m.id),
      },
    });
  } catch (e) {
    if (e instanceof NotEnoughPoints) return json({ ok: false, error: "not enough" });
    if (e instanceof AdminError) return json({ ok: false, error: e.message });
    console.error(`[proxy/loyalty] ${shop}:`, e instanceof Error ? e.message : e);
    return json({ ok: false, error: "unavailable" }, 500);
  }
};
