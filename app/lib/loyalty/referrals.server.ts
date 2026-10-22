/**
 * Refer a friend and affiliate links (Pro loyalty).
 *
 * Referrals: one store discount, "Loyalty referrals", holds every member's code (the member's `referralCode`).
 * Anyone can use a code once; the member is rewarded only when the order is the friend's first, after the fraud
 * checks in `referralRefusal`. The gift (points or store credit) is pending like order points and is taken back
 * when the friend's order is cancelled or refunded in full.
 *
 * Affiliates: each creator or partner has their own discount with their own code. Orders with it are counted
 * as their sales (net of refunds); the store pays them itself.
 *
 * The discount ids live in LoyaltyProgram.state. When the referral discount has to be made again (its type
 * changed, or it was deleted in Shopify), `gen` goes up and member codes are added to the new one again.
 */
import { randomBytes } from "node:crypto";
import db from "../../db.server";
import { AdminError, errorMessage, gql, type AdminClient } from "../admin.server";
import { cleanCode, type Affiliate, type FriendKind, type LoyaltyConfig } from "./config";
import type { OrderFacts } from "./points";
import { record } from "./program.server";
import { notify } from "./mailer.server";
import { LOYALTY_TAG } from "./rewards.server";

const DAY = 86_400_000;
export const REFERRAL_TAG = "cro-referral";
export const REFERRAL_TITLE = "Loyalty referrals";

type DiscKind = "basic" | "shipping";
type Disc = { id: string; kind: DiscKind; on: boolean; sig: string };
export type ReferralState = { ref?: Disc & { gen: number }; aff?: Record<string, Disc & { code: string }> };

const money = (n: number) => n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;
const idOf = (gid: string) => gid.split("/").pop() ?? gid;
const discKind = (k: FriendKind): DiscKind => (k === "shipping" ? "shipping" : "basic");
const sigOf = (f: { kind: FriendKind; value: number; minimum: number }, extra = "") => JSON.stringify([f.kind, f.value, f.minimum, extra]);

/* ------------------------------------------------------------------ state -- */
export async function getReferralState(shop: string): Promise<ReferralState> {
  const row = await db.loyaltyProgram.findUnique({ where: { shop }, select: { state: true } });
  try {
    const s = JSON.parse(row?.state ?? "{}");
    return s && typeof s === "object" ? (s as ReferralState) : {};
  } catch {
    return {};
  }
}
async function saveReferralState(shop: string, s: ReferralState) {
  await db.loyaltyProgram.updateMany({ where: { shop }, data: { state: JSON.stringify(s) } });
}

/* -------------------------------------------------------------- discounts -- */
/**
 * The Shopify discount input for a friend's discount (exported for the tests). With `code` it is for creating;
 * without, for updating (the code stays, and a minimum of 0 removes the one set before).
 */
export function friendDiscountInput(f: { kind: FriendKind; value: number; minimum: number }, o: { title: string; code?: string; oncePerCustomer: boolean; tags: string[] }) {
  const minimumRequirement =
    f.minimum > 0
      ? { subtotal: { greaterThanOrEqualToSubtotal: money(f.minimum) } }
      : o.code
        ? undefined
        : { quantity: { greaterThanOrEqualToQuantity: null }, subtotal: { greaterThanOrEqualToSubtotal: null } };
  const base = {
    title: o.title,
    ...(o.code ? { code: o.code, startsAt: new Date().toISOString() } : {}),
    context: { all: "ALL" },
    appliesOncePerCustomer: o.oncePerCustomer,
    tags: o.tags,
    ...(minimumRequirement ? { minimumRequirement } : {}),
  };
  if (f.kind === "shipping") return { kind: "shipping" as const, input: { ...base, destination: { all: true }, combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: false } } };
  const value = f.kind === "percent" ? { percentage: f.value / 100 } : { discountAmount: { amount: money(f.value), appliesOnEachItem: false } };
  // Combines with product discounts: the app's own upsells and bundles are product discounts.
  return { kind: "basic" as const, input: { ...base, customerGets: { value, items: { all: true } }, combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true } } };
}
type DiscInput = ReturnType<typeof friendDiscountInput>;

async function createDiscount(admin: AdminClient, d: DiscInput): Promise<string> {
  const data =
    d.kind === "shipping"
      ? await gql(admin, `#graphql
          mutation CroRefShip($d: DiscountCodeFreeShippingInput!) { discountCodeFreeShippingCreate(freeShippingCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { d: d.input })
      : await gql(admin, `#graphql
          mutation CroRefBasic($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { d: d.input });
  const id = (d.kind === "shipping" ? data.discountCodeFreeShippingCreate : data.discountCodeBasicCreate)?.codeDiscountNode?.id;
  if (!id) throw new AdminError("Shopify did not make the discount.");
  return id;
}

async function updateDiscount(admin: AdminClient, id: string, d: DiscInput) {
  if (d.kind === "shipping")
    await gql(admin, `#graphql
      mutation CroRefShipUp($id: ID!, $d: DiscountCodeFreeShippingInput!) { discountCodeFreeShippingUpdate(id: $id, freeShippingCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { id, d: d.input });
  else
    await gql(admin, `#graphql
      mutation CroRefBasicUp($id: ID!, $d: DiscountCodeBasicInput!) { discountCodeBasicUpdate(id: $id, basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { id, d: d.input });
}

async function setActive(admin: AdminClient, id: string, on: boolean) {
  if (on)
    await gql(admin, `#graphql
      mutation CroRefOn($id: ID!) { discountCodeActivate(id: $id) { codeDiscountNode { id } userErrors { field message } } }`, { id });
  else
    await gql(admin, `#graphql
      mutation CroRefOff($id: ID!) { discountCodeDeactivate(id: $id) { codeDiscountNode { id } userErrors { field message } } }`, { id });
}

/** Deleted, or already gone. */
async function deleteDiscount(admin: AdminClient, id: string) {
  await gql(admin, `#graphql
    mutation CroRefDel($id: ID!) { discountCodeDelete(id: $id) { deletedCodeDiscountId userErrors { field message } } }`, { id }).catch(() => null);
}

/** Still in Shopify (the store can delete it there). */
async function exists(admin: AdminClient, id: string) {
  const data = await gql(admin, `#graphql
    query CroRefExists($id: ID!) { node(id: $id) { id } }`, { id });
  return !!data.node?.id;
}

async function addCodes(admin: AdminClient, discountId: string, codes: string[]) {
  for (let i = 0; i < codes.length; i += 250)
    await gql(admin, `#graphql
      mutation CroRefCodes($id: ID!, $codes: [DiscountRedeemCodeInput!]!) { discountRedeemCodeBulkAdd(discountId: $id, codes: $codes) { bulkCreation { id } userErrors { field message } } }`, { id: discountId, codes: codes.slice(i, i + 250).map((code) => ({ code })) });
}

/** The members' referral discount. Returns true when a new one was made (codes must be added to it again). */
async function syncMemberDiscount(admin: AdminClient, c: LoyaltyConfig, active: boolean, s: ReferralState) {
  const want = active && c.referral.on;
  const r = s.ref;
  if (!want) {
    if (r?.on) {
      await setActive(admin, r.id, false).catch(() => null);
      r.on = false;
    }
    return false;
  }
  const kind = discKind(c.referral.friend.kind);
  const sig = sigOf(c.referral.friend);
  if (!r || r.kind !== kind || !(await exists(admin, r.id))) {
    if (r) await deleteDiscount(admin, r.id);
    const d = friendDiscountInput(c.referral.friend, { title: REFERRAL_TITLE, code: `REFER-${randomBytes(4).toString("hex").toUpperCase()}`, oncePerCustomer: true, tags: [LOYALTY_TAG, REFERRAL_TAG] });
    s.ref = { id: await createDiscount(admin, d), kind, on: true, sig, gen: (r?.gen ?? 0) + 1 };
    return !!r;
  }
  if (r.sig !== sig) {
    await updateDiscount(admin, r.id, friendDiscountInput(c.referral.friend, { title: REFERRAL_TITLE, oncePerCustomer: true, tags: [LOYALTY_TAG, REFERRAL_TAG] }));
    r.sig = sig;
  }
  if (!r.on) {
    await setActive(admin, r.id, true);
    r.on = true;
  }
  return false;
}

/** One affiliate's discount: made, changed, turned on or off. A new code or type means a new discount. */
async function syncAffiliate(admin: AdminClient, a: Affiliate, active: boolean, cur: (Disc & { code: string }) | undefined) {
  const want = active && a.on;
  const kind = discKind(a.kind);
  const sig = sigOf(a, a.name);
  const title = `Affiliate: ${a.name} (${a.code})`;
  const tags = [LOYALTY_TAG, "cro-affiliate"];
  if (cur && (cur.code !== a.code || cur.kind !== kind)) {
    await deleteDiscount(admin, cur.id);
    cur = undefined;
  }
  if (cur && want && !(await exists(admin, cur.id))) cur = undefined;
  if (!cur) return want ? { id: await createDiscount(admin, friendDiscountInput(a, { title, code: a.code, oncePerCustomer: false, tags })), kind, on: true, sig, code: a.code } : undefined;
  if (want && cur.sig !== sig) {
    await updateDiscount(admin, cur.id, friendDiscountInput(a, { title, oncePerCustomer: false, tags }));
    cur.sig = sig;
  }
  if (cur.on !== want) {
    await setActive(admin, cur.id, want).catch((e) => {
      if (want) throw e;
    });
    cur.on = want;
  }
  return cur;
}

/**
 * Brings the store's referral and affiliate discounts in line with the settings. `active` is false when the
 * program is off or the store left Pro: every discount is turned off (kept, so shared links work again later).
 * Returns Shopify's refusals in plain words, for example a code another discount already uses.
 */
export async function syncReferralDiscounts(admin: AdminClient, shop: string, c: LoyaltyConfig, active: boolean): Promise<string[]> {
  const s = await getReferralState(shop);
  const errors: string[] = [];
  let remade = false;
  try {
    remade = await syncMemberDiscount(admin, c, active, s);
  } catch (e) {
    errors.push(`Referrals: ${errorMessage(e)}`);
  }
  const aff = { ...(s.aff ?? {}) };
  for (const [id, d] of Object.entries(aff)) {
    if (c.affiliates.some((a) => a.id === id)) continue;
    await deleteDiscount(admin, d.id);
    delete aff[id];
  }
  for (const a of c.affiliates) {
    try {
      const next = await syncAffiliate(admin, a, active, aff[a.id]);
      if (next) aff[a.id] = next;
      else delete aff[a.id];
    } catch (e) {
      // A code taken by another discount: nothing is kept for it, so the next save tries again.
      if (aff[a.id] && aff[a.id].code !== a.code) delete aff[a.id];
      errors.push(`${a.name}: ${errorMessage(e)}`);
    }
  }
  s.aff = aff;
  await saveReferralState(shop, s);
  if (remade) await refreshMemberCodes(admin, shop, s).catch((e) => errors.push(`Referrals: ${errorMessage(e)}`));
  return errors;
}

/** A member's code, added to the referral discount when it isn't on the current one yet. */
export async function ensureMemberCode(admin: AdminClient, s: ReferralState, m: { id: number; referralCode: string; codeGen: number }) {
  const r = s.ref;
  if (!r?.on || !m.referralCode || m.codeGen === r.gen) return false;
  await addCodes(admin, r.id, [m.referralCode]);
  await db.loyaltyMember.update({ where: { id: m.id }, data: { codeGen: r.gen } });
  return true;
}

/** After the referral discount was made again: codes members already had go on the new one (`take` per run). */
export async function refreshMemberCodes(admin: AdminClient, shop: string, s: ReferralState, take = 250) {
  const r = s.ref;
  if (!r?.on) return 0;
  const ms = await db.loyaltyMember.findMany({ where: { shop, codeGen: { gt: 0, not: r.gen }, referralCode: { not: "" } }, select: { id: true, referralCode: true }, take });
  if (!ms.length) return 0;
  await addCodes(admin, r.id, ms.map((m) => m.referralCode));
  await db.loyaltyMember.updateMany({ where: { id: { in: ms.map((m) => m.id) } }, data: { codeGen: r.gen } });
  return ms.length;
}

/* ----------------------------------------------------------------- orders -- */
export type RefusalInput = {
  referrer: { blocked: boolean; customerId: string; email: string };
  friend: { id: string; email: string } | null;
  friendReferredBefore: boolean;
  rewardedLast30: number;
  monthly: number;
  firstOrder: boolean;
};

/** Why a referral is not rewarded, in plain words ("" = it is rewarded). Pure, for the tests. */
export function referralRefusal(x: RefusalInput): string {
  if (x.referrer.blocked) return "The member is blocked";
  if (!x.friend) return "The order has no customer";
  if (x.friend.id === x.referrer.customerId || (!!x.friend.email && x.friend.email === x.referrer.email)) return "The member used their own code";
  if (x.friendReferredBefore) return "This friend was referred before";
  if (x.monthly > 0 && x.rewardedLast30 >= x.monthly) return `The member reached ${x.monthly} referrals in 30 days`;
  if (!x.firstOrder) return "Not the friend's first order";
  return "";
}

async function isFirstOrder(admin: AdminClient, customerId: string, orderId: string) {
  const data = await gql(admin, `#graphql
    query CroRefFirst($id: ID!) { customer(id: $id) { orders(first: 1, sortKey: CREATED_AT) { nodes { id } } } }`, { id: `gid://shopify/Customer/${customerId}` });
  const first: string | undefined = data.customer?.orders?.nodes?.[0]?.id;
  return !first || idOf(first) === orderId;
}

const live = (o: OrderFacts) => o.paid && !o.cancelled && o.subtotal > 0;

/** A friend's order with a member's code: rewarded or refused once; the gift is taken back when the order is. */
async function referralOrder(admin: AdminClient, shop: string, c: LoyaltyConfig, o: OrderFacts, m: { id: number; blocked: boolean; customerId: string; email: string }, now: Date) {
  const row = await db.loyaltyReferral.findUnique({ where: { shop_kind_orderId: { shop, kind: "referral", orderId: o.id } } });
  if (row) {
    if (row.status === "rewarded" && !live(o)) {
      const ev = await db.loyaltyEvent.findUnique({ where: { shop_dedupe: { shop, dedupe: `ref:${o.id}` } } });
      // Credit already given stays given (Shopify has it); points and credit still waiting are taken back.
      if (ev) await record(shop, ev.memberId, { kind: "referral_back", points: -ev.points, credit: ev.issuedAt ? 0 : -ev.credit, status: ev.status === "pending" ? "pending" : "available", availableAt: ev.availableAt, orderId: o.id, note: o.name, dedupe: `ref-back:${o.id}` });
      await db.loyaltyReferral.update({ where: { id: row.id }, data: { status: "reversed", amount: 0 } });
    } else if (row.status === "rewarded" && round2(o.subtotal) !== row.amount) {
      await db.loyaltyReferral.update({ where: { id: row.id }, data: { amount: round2(o.subtotal) } });
    }
    return row.status;
  }
  if (!c.referral.on || !live(o)) return null;
  const friend = o.customer ? { id: o.customer.id, email: o.customer.email } : null;
  const since = new Date(now.getTime() - 30 * DAY);
  const [before, last30] = friend
    ? await Promise.all([
        db.loyaltyReferral.count({ where: { shop, kind: "referral", friendCustomerId: friend.id, status: { in: ["rewarded", "reversed"] } } }),
        db.loyaltyReferral.count({ where: { shop, kind: "referral", referrerId: m.id, status: "rewarded", createdAt: { gte: since } } }),
      ])
    : [0, 0];
  const input: RefusalInput = { referrer: m, friend, friendReferredBefore: before > 0, rewardedLast30: last30, monthly: c.referral.monthly, firstOrder: true };
  let reason = referralRefusal(input);
  if (!reason && friend && !(await isFirstOrder(admin, friend.id, o.id))) reason = referralRefusal({ ...input, firstOrder: false });
  const made = await db.loyaltyReferral
    .create({ data: { shop, kind: "referral", referrerId: m.id, friendCustomerId: friend?.id ?? "", orderId: o.id, orderName: o.name, amount: round2(o.subtotal), status: reason ? "refused" : "rewarded", reason } })
    .catch(() => null); // Read twice at once: the unique key keeps one row.
  if (!made || reason) return made?.status ?? null;
  const g = c.referral.gift;
  await record(shop, m.id, { kind: "referral", points: g.kind === "points" ? g.value : 0, credit: g.kind === "credit" ? g.value : 0, status: c.pendingDays > 0 ? "pending" : "available", availableAt: new Date(now.getTime() + c.pendingDays * DAY), orderId: o.id, note: o.name, dedupe: `ref:${o.id}` });
  if (friend) await db.loyaltyMember.updateMany({ where: { shop, customerId: friend.id, referredBy: null }, data: { referredBy: m.id } });
  await notify(shop, c, m.id, "referral", g.kind === "points" ? { giftPoints: g.value } : { giftCredit: g.value }, `referral:${o.id}`);
  return "rewarded";
}

/** An order with an affiliate's code: one row, its sales kept net of refunds. */
async function affiliateOrder(shop: string, a: Affiliate, o: OrderFacts) {
  const amount = o.paid && !o.cancelled ? round2(Math.max(0, o.subtotal)) : 0;
  const status = amount > 0 ? "counted" : "reversed";
  const row = await db.loyaltyReferral.findUnique({ where: { shop_kind_orderId: { shop, kind: "affiliate", orderId: o.id } } });
  if (!row) {
    if (!o.paid || o.cancelled) return null;
    return db.loyaltyReferral.create({ data: { shop, kind: "affiliate", affiliateId: a.id, friendCustomerId: o.customer?.id ?? "", orderId: o.id, orderName: o.name, amount, status } }).catch(() => null);
  }
  if (row.amount !== amount || row.status !== status) return db.loyaltyReferral.update({ where: { id: row.id }, data: { amount, status } });
  return row;
}

/** The order's discount codes: a member's referral code or an affiliate's code. Safe to run again and again. */
export async function matchCodes(admin: AdminClient, shop: string, c: LoyaltyConfig, o: OrderFacts, now = new Date()) {
  const codes = [...new Set((o.codes ?? []).map(cleanCode).filter((x) => x.length >= 3))];
  for (const code of codes) {
    const a = c.affiliates.find((x) => x.code === code);
    if (a) {
      await affiliateOrder(shop, a, o);
      continue;
    }
    const m = await db.loyaltyMember.findFirst({ where: { shop, referralCode: code } });
    if (m) await referralOrder(admin, shop, c, o, m, now);
  }
}

/* ----------------------------------------------------------------- proxy --- */
/** What a shared code gives (the widget's banner), or null when it isn't a live referral or affiliate code. */
export async function codeOffer(admin: AdminClient, shop: string, c: LoyaltyConfig, raw: string) {
  const code = cleanCode(raw);
  if (code.length < 3) return null;
  const s = await getReferralState(shop);
  const a = c.affiliates.find((x) => x.on && x.code === code);
  if (a) return s.aff?.[a.id]?.on ? { k: a.kind, v: a.value, m: a.minimum } : null;
  if (!c.referral.on || !s.ref?.on) return null;
  const m = await db.loyaltyMember.findFirst({ where: { shop, referralCode: code, blocked: false } });
  if (!m) return null;
  await ensureMemberCode(admin, s, m).catch(() => null);
  return { k: c.referral.friend.kind, v: c.referral.friend.value, m: c.referral.friend.minimum };
}

/* ----------------------------------------------------------------- admin --- */
/** The Referrals page: the last `days` days of referrals, each affiliate's sales, and the latest referrals. */
export async function referralStats(shop: string, days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const [groups, affiliates, latest] = await Promise.all([
    db.loyaltyReferral.groupBy({ by: ["kind", "status"], where: { shop, createdAt: { gte: since } }, _count: { _all: true }, _sum: { amount: true } }),
    db.loyaltyReferral.groupBy({ by: ["affiliateId"], where: { shop, kind: "affiliate", status: "counted" }, _count: { _all: true }, _sum: { amount: true } }),
    db.loyaltyReferral.findMany({ where: { shop, kind: "referral" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const g = (kind: string, status: string) => groups.find((x) => x.kind === kind && x.status === status);
  const members = await db.loyaltyMember.findMany({ where: { id: { in: [...new Set(latest.map((r) => r.referrerId).filter((x): x is number => x != null))] } }, select: { id: true, email: true } });
  return {
    referred: g("referral", "rewarded")?._count._all ?? 0,
    sales: round2(g("referral", "rewarded")?._sum.amount ?? 0),
    refused: g("referral", "refused")?._count._all ?? 0,
    reversed: g("referral", "reversed")?._count._all ?? 0,
    affiliateSales: round2(g("affiliate", "counted")?._sum.amount ?? 0),
    affiliates: Object.fromEntries(affiliates.map((x) => [x.affiliateId, { orders: x._count._all, sales: round2(x._sum.amount ?? 0) }])) as Record<string, { orders: number; sales: number }>,
    latest: latest.map((r) => ({ id: r.id, order: r.orderName, amount: r.amount, status: r.status, reason: r.reason, date: r.createdAt.toISOString(), member: members.find((m) => m.id === r.referrerId)?.email ?? "", memberId: r.referrerId })),
  };
}
