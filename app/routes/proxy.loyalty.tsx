/**
 * The loyalty widget on the store posts here through the app proxy (/apps/ucro/loyalty). Shopify signs every
 * request and adds `logged_in_customer_id`, so a shopper only ever sees and spends their own points.
 * Intents: "me" (balance, history, rewards got), "join" (when joining is manual), "redeem" (spend points),
 * "ref" (what a shared referral or affiliate code gives; works for guests too).
 * From Growth with the program on (Pro parts only on Pro).
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";
import { loyaltyAccess, planned } from "../lib/loyalty/plan.server";
import { getProgram, memberFor, setBirthday, socialPoints, tierValue } from "../lib/loyalty/program.server";
import { syncCustomer } from "../lib/loyalty/sync.server";
import { codeOffer, ensureMemberCode, getReferralState } from "../lib/loyalty/referrals.server";
import { NotEnoughPoints, memberRewards, redeem } from "../lib/loyalty/rewards.server";
import { eventLabel } from "../lib/loyalty/labels";
import { AdminError, gql } from "../lib/admin.server";
import { excludedTags } from "../lib/loyalty/config";
import { isExcluded, nextTier } from "../lib/loyalty/points";

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
  const access = await loyaltyAccess(admin, shop);
  if (!access.on) return json({ ok: false, error: "off" });
  // The program as this plan runs it (Growth: without the Pro parts, with the member limit).
  program.config = planned(program.config, access);
  const intent = String(body.intent ?? "me");
  if (intent === "ref") {
    const ref = await codeOffer(admin, shop, program.config, String(body.code ?? "")).catch(() => null);
    return json({ ok: true, ref });
  }
  const customerId = new URL(request.url).searchParams.get("logged_in_customer_id") ?? "";
  if (!/^\d+$/.test(customerId)) return json({ ok: true, member: null, guest: true });

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
        query CroLoyaltyJoin($id: ID!) { customer(id: $id) { locale tags defaultEmailAddress { emailAddress marketingState } } }`, { id: `gid://shopify/Customer/${customerId}` }).catch(() => null);
      const tags: string[] = c?.customer?.tags ?? [];
      if (isExcluded(tags, excludedTags(program.config))) return json({ ok: true, member: null, guest: false, canJoin: false });
      m = await memberFor(shop, { id: customerId, email: String(c?.customer?.defaultEmailAddress?.emailAddress ?? "").toLowerCase(), firstName: "", locale: c?.customer?.locale ?? "", tags, marketing: c?.customer?.defaultEmailAddress?.marketingState === "SUBSCRIBED" }, true, program.config.memberCap ?? null);
    }
    if (!m) return json({ ok: true, member: null, guest: false, canJoin: true });
    if (m.blocked) return json({ ok: true, member: null, guest: false, canJoin: false });

    let got = null;
    if (intent === "birthday") await setBirthday(shop, m.id, String(body.date ?? ""));
    if (intent === "social") await socialPoints(shop, program.config, m.id, String(body.network ?? ""));
    if (intent === "redeem") {
      got = await redeem(admin, shop, program.config, m.id, String(body.reward ?? ""));
      m = (await db.loyaltyMember.findUnique({ where: { id: m.id } }))!;
    }
    const history = await db.loyaltyEvent.findMany({ where: { shop, memberId: m.id }, orderBy: { createdAt: "desc" }, take: 12, select: { kind: true, note: true, points: true, credit: true, status: true, createdAt: true } });
    const c = program.config;
    const tier = c.tiers.on ? c.tiers.list.find((t) => t.id === m!.tier) ?? null : null;
    const next = c.tiers.on ? nextTier(c, await tierValue(shop, c, m.id)) : null;
    // The member's code works only once it is on the referral discount (added the first time it is shown).
    let ref: string | null = null;
    if (c.referral.on && m.referralCode) {
      const s = await getReferralState(shop);
      if (s.ref?.on && (await ensureMemberCode(admin, s, m).then(() => true, () => false))) ref = m.referralCode;
    }
    const followed = c.earn.social.on ? (await db.loyaltyEvent.findMany({ where: { shop, memberId: m.id, kind: "social" }, select: { note: true } })).map((e) => e.note) : [];
    return json({
      ok: true,
      got,
      member: {
        points: m.points,
        pending: m.pending,
        code: m.referralCode,
        ref,
        history: history.map((e) => ({ l: eventLabel(e.kind, e.note), p: e.points, cr: e.credit, s: e.status, d: e.createdAt.toISOString().slice(0, 10) })),
        tier: tier ? { id: tier.id, n: tier.name } : null,
        next: next ? { n: next.tier.name, need: next.need, spent: c.tiers.basis === "spent" } : null,
        bday: !!m.birthday,
        followed,
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
