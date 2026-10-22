/**
 * Loyalty program data: the store's settings, its members and every change to their points (the ledger).
 * A member's `points` and `pending` always equal the sum of their ledger rows by status, because every change
 * goes through `record` in one transaction. `dedupe` makes a change happen once however often an order is read.
 */
import db from "../../db.server";
import { withLoyaltyDefaults, excludedTags, type LoyaltyConfig } from "./config";
import { isExcluded, multiplierFor, newReferralCode, orderBase, orderCredit, orderPoints, tierFor, type OrderFacts } from "./points";

const DAY = 86_400_000;

/* ----------------------------------------------------------------- program -- */
export async function getProgram(shop: string) {
  const row = await db.loyaltyProgram.findUnique({ where: { shop } });
  let raw: unknown = {};
  try {
    raw = JSON.parse(row?.config ?? "{}");
  } catch {
    raw = {};
  }
  return { on: !!row?.on, config: withLoyaltyDefaults(raw), syncedAt: row?.syncedAt ?? null, saved: !!row };
}

export async function saveProgramConfig(shop: string, raw: unknown) {
  const config = withLoyaltyDefaults(raw);
  await db.loyaltyProgram.upsert({ where: { shop }, create: { shop, config: JSON.stringify(config) }, update: { config: JSON.stringify(config), updatedAt: new Date() } });
  return config;
}

/**
 * On: orders paid from now on earn points, or also those of the last `pastDays` days (0, 30 or 90) the first time.
 * Off: nothing is earned or sent; members keep their points.
 */
export async function setProgramOn(shop: string, on: boolean, pastDays = 0) {
  const row = await db.loyaltyProgram.findUnique({ where: { shop } });
  const from = new Date(Date.now() - (row?.syncedAt ? 0 : Math.min(90, Math.max(0, pastDays))) * DAY);
  // Turned on again after a pause: from now (orders paid while it was off don't earn).
  const syncedAt = on && !row?.on ? (row?.syncedAt ? new Date() : from) : row?.syncedAt ?? null;
  await db.loyaltyProgram.upsert({ where: { shop }, create: { shop, on, syncedAt }, update: { on, syncedAt, updatedAt: new Date() } });
}

/* ----------------------------------------------------------------- members -- */
type Customer = NonNullable<OrderFacts["customer"]>;

/** The member for this customer: found, or made when `create` (with a referral code nobody in the store has). */
export async function memberFor(shop: string, c: Customer, create: boolean) {
  const found = await db.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId: c.id } } });
  if (found) {
    // Keep the contact details fresh (they are used for the member's emails).
    if ((c.email && c.email !== found.email) || (c.firstName && c.firstName !== found.firstName) || (c.locale && c.locale !== found.locale)) {
      return db.loyaltyMember.update({ where: { id: found.id }, data: { email: c.email || found.email, firstName: c.firstName || found.firstName, locale: c.locale || found.locale } });
    }
    return found;
  }
  if (!create) return null;
  for (let i = 0; i < 5; i++) {
    const referralCode = newReferralCode();
    if (await db.loyaltyMember.findFirst({ where: { shop, referralCode }, select: { id: true } })) continue;
    try {
      return await db.loyaltyMember.create({ data: { shop, customerId: c.id, email: c.email, firstName: c.firstName, locale: c.locale, referralCode } });
    } catch {
      // Made at the same moment by another read: use that one.
      const again = await db.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId: c.id } } });
      if (again) return again;
    }
  }
  return null;
}

export type LedgerChange = { kind: string; points: number; status?: "available" | "pending"; orderId?: string; amount?: number; multiplier?: number; credit?: number; note?: string; dedupe?: string; availableAt?: Date; /** Spending: all of it or nothing (throws NOT_ENOUGH), checked in the same update so two clicks can't overspend. */ strict?: boolean };

export class NotEnoughPoints extends Error {
  constructor() {
    super("NOT_ENOUGH");
  }
}

/**
 * Adds one change to a member's points and their balance together. A change with a `dedupe` key that was
 * already made does nothing (returns null). Taking points away never takes more than the member has.
 */
export async function record(shop: string, memberId: number, ch: LedgerChange) {
  const status = ch.status ?? "available";
  try {
    return await db.$transaction(async (tx) => {
      if (ch.dedupe && (await tx.loyaltyEvent.findUnique({ where: { shop_dedupe: { shop, dedupe: ch.dedupe } }, select: { id: true } }))) return null;
      if (ch.strict && ch.points < 0) {
        const took = await tx.loyaltyMember.updateMany({ where: { id: memberId, points: { gte: -ch.points }, blocked: false }, data: { points: { increment: ch.points }, lastActivity: new Date() } });
        if (!took.count) throw new NotEnoughPoints();
        return tx.loyaltyEvent.create({ data: { shop, memberId, kind: ch.kind, points: ch.points, status: "available", orderId: ch.orderId ?? "", note: (ch.note ?? "").slice(0, 200), dedupe: ch.dedupe ?? null } });
      }
      const m = await tx.loyaltyMember.findUniqueOrThrow({ where: { id: memberId } });
      let points = ch.points;
      if (points < 0) points = -Math.min(-points, Math.max(0, status === "pending" ? m.pending : m.points));
      const ev = await tx.loyaltyEvent.create({ data: { shop, memberId, kind: ch.kind, points, status, orderId: ch.orderId ?? "", amount: ch.amount ?? 0, multiplier: ch.multiplier ?? 1, credit: ch.credit ?? 0, note: (ch.note ?? "").slice(0, 200), dedupe: ch.dedupe ?? null, availableAt: ch.availableAt ?? new Date() } });
      const earned = points > 0 && !["adjust", "import"].includes(ch.kind) ? points : 0;
      await tx.loyaltyMember.update({
        where: { id: memberId },
        data: {
          ...(status === "pending" ? { pending: { increment: points } } : { points: { increment: points } }),
          lifetime: { increment: earned },
          spent: { increment: ch.amount ?? 0 },
          lastActivity: new Date(),
        },
      });
      return ev;
    });
  } catch (e) {
    // Two reads of the same order at once: the unique dedupe key keeps it to one.
    if (e instanceof Error && /Unique constraint/i.test(e.message)) return null;
    throw e;
  }
}

/* ------------------------------------------------------------------ orders -- */
/**
 * Brings one order's points to what it is worth now: its points when it is paid (pending first), a first order
 * bonus, and points taken back after a refund, an edit or a cancellation. Safe to run again and again.
 */
export async function syncOrder(shop: string, c: LoyaltyConfig, o: OrderFacts, now = new Date()) {
  if (!o.customer || isExcluded(o.customer.tags, excludedTags(c))) return null;
  const existing = await db.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId: o.customer.id } } });
  const rows = existing ? await db.loyaltyEvent.findMany({ where: { shop, memberId: existing.id, orderId: o.id, kind: { in: ["order", "refund", "cancel"] } } }) : [];
  const orderRow = rows.find((r) => r.kind === "order");
  // An order keeps the multiplier it was first earned with (tier and campaign), so a later refund uses the same.
  const multiplier = orderRow ? orderRow.multiplier : multiplierFor(c, existing?.tier ?? "", o.createdAt);
  const cashback = orderRow ? orderRow.credit > 0 || (orderRow.points === 0 && c.cashback.on) : c.cashback.on;
  const target = cashback ? 0 : orderPoints(c, o, multiplier);
  const credit = cashback ? orderCredit(c, o) : 0;
  if (!existing && (!c.autoJoin || (target <= 0 && credit <= 0))) return null;
  const m = existing ?? (await memberFor(shop, o.customer, true));
  if (!m || m.blocked) return null;
  const current = rows.reduce((n, r) => n + r.points, 0);
  const currentCredit = Math.round(rows.reduce((n, r) => n + r.credit, 0) * 100) / 100;
  const net = orderBase({ ...c, earn: { ...c.earn, order: { ...c.earn.order, shipping: true, taxes: true } } }, o);
  const pendingUntil = new Date(now.getTime() + c.pendingDays * DAY);
  const pendingNow = c.pendingDays > 0;

  if (!orderRow && (target > 0 || credit > 0)) {
    await record(shop, m.id, { kind: "order", points: target, credit, multiplier, status: pendingNow ? "pending" : "available", availableAt: pendingUntil, orderId: o.id, amount: net, note: o.name, dedupe: `order:${o.id}` });
    await db.loyaltyMember.update({ where: { id: m.id }, data: { orders: { increment: 1 } } });
    if (c.earn.firstOrder.on && c.earn.firstOrder.points > 0 && m.orders === 0) {
      await record(shop, m.id, { kind: "first_order", points: c.earn.firstOrder.points, status: pendingNow ? "pending" : "available", availableAt: pendingUntil, orderId: o.id, note: o.name, dedupe: `first:${m.id}` });
    }
    await updateTier(shop, c, m.id);
    return { member: m.id, points: target, credit };
  }
  if (orderRow && (target < current || credit < currentCredit)) {
    // A refund or cancellation: taken back from the same place the points are now (pending or usable).
    // Store credit already given stays given (Shopify has it); only credit still waiting is lowered.
    const still = orderRow.status === "pending";
    const spentBack = rows.reduce((n, r) => n + r.amount, 0) - net;
    const creditBack = orderRow.issuedAt ? 0 : Math.round((credit - currentCredit) * 100) / 100;
    await record(shop, m.id, { kind: o.cancelled ? "cancel" : "refund", points: target - current, credit: creditBack, status: still ? "pending" : "available", availableAt: orderRow.availableAt, orderId: o.id, amount: -Math.max(0, spentBack), note: o.name, dedupe: `${o.cancelled ? "cancel" : "refund"}:${o.id}:${target}:${credit}` });
    await updateTier(shop, c, m.id);
    return { member: m.id, points: target - current, credit: creditBack };
  }
  return null;
}

/* ------------------------------------------------------------------ tiers -- */
/** What a member's tier is measured on: points earned or money spent, over their lifetime or the last 12 months. */
export async function tierValue(shop: string, c: LoyaltyConfig, memberId: number, now = new Date()) {
  const m = await db.loyaltyMember.findUniqueOrThrow({ where: { id: memberId } });
  if (c.tiers.period === "lifetime") return c.tiers.basis === "spent" ? m.spent : m.lifetime;
  const since = new Date(now.getTime() - 365 * DAY);
  if (c.tiers.basis === "spent") {
    const s = await db.loyaltyEvent.aggregate({ where: { shop, memberId, createdAt: { gte: since } }, _sum: { amount: true } });
    return s._sum.amount ?? 0;
  }
  const s = await db.loyaltyEvent.aggregate({ where: { shop, memberId, createdAt: { gte: since }, points: { gt: 0 }, kind: { notIn: ["adjust", "import"] } }, _sum: { points: true } });
  return s._sum.points ?? 0;
}

/** Moves a member to the tier they reached (up or down) and gives that tier's bonus the first time. */
export async function updateTier(shop: string, c: LoyaltyConfig, memberId: number, now = new Date()) {
  if (!c.tiers.on) return null;
  const t = tierFor(c, await tierValue(shop, c, memberId, now));
  const id = t?.id ?? "";
  const m = await db.loyaltyMember.findUniqueOrThrow({ where: { id: memberId } });
  if (m.tier === id) return null;
  await db.loyaltyMember.update({ where: { id: memberId }, data: { tier: id, tierSince: now } });
  if (t && t.bonus > 0) await record(shop, memberId, { kind: "tier", points: t.bonus, note: t.name, dedupe: `tier:${memberId}:${t.id}` });
  return t;
}

/** Every member's tier again (daily, for tiers measured over the last 12 months). */
export async function reviewTiers(shop: string, c: LoyaltyConfig, now = new Date()) {
  if (!c.tiers.on) return 0;
  let changed = 0;
  for (const m of await db.loyaltyMember.findMany({ where: { shop, blocked: false }, select: { id: true } })) if (await updateTier(shop, c, m.id, now)) changed++;
  return changed;
}

/* --------------------------------------------------------- birthday, social -- */
/** The member adds their birthday ("MM-DD") once; the store can change it later. */
export async function setBirthday(shop: string, memberId: number, mmdd: string) {
  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(mmdd)) return false;
  const done = await db.loyaltyMember.updateMany({ where: { id: memberId, shop, birthday: "" }, data: { birthday: mmdd } });
  return done.count > 0;
}

/** Birthday points for members whose birthday is today (once a year). */
export async function birthdayPoints(shop: string, c: LoyaltyConfig, now = new Date()) {
  if (!c.earn.birthday.on || c.earn.birthday.points <= 0) return 0;
  const today = now.toISOString().slice(5, 10);
  const year = now.getUTCFullYear();
  let n = 0;
  for (const m of await db.loyaltyMember.findMany({ where: { shop, birthday: today, blocked: false }, select: { id: true } })) {
    if (await record(shop, m.id, { kind: "birthday", points: c.earn.birthday.points, note: String(year), dedupe: `birthday:${m.id}:${year}` })) n++;
  }
  return n;
}

/** Points for following the store on one network, once per network. */
export async function socialPoints(shop: string, c: LoyaltyConfig, memberId: number, network: string) {
  if (!c.earn.social.on || !c.earn.social.links.some((l) => l.network === network)) return null;
  return record(shop, memberId, { kind: "social", points: c.earn.social.points, note: network, dedupe: `social:${memberId}:${network}` });
}

/* ---------------------------------------------------------------- signups -- */
/** A customer account was made or activated: the member joins and gets the signup points once. */
export async function syncSignup(shop: string, c: LoyaltyConfig, customer: Customer & { accountActive: boolean }) {
  if (!customer.accountActive || isExcluded(customer.tags, excludedTags(c))) return null;
  if (!c.autoJoin && !(await db.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId: customer.id } } }))) return null;
  const m = await memberFor(shop, customer, true);
  if (!m || m.blocked || !c.earn.signup.on || c.earn.signup.points <= 0) return null;
  return record(shop, m.id, { kind: "signup", points: c.earn.signup.points, note: "Account created", dedupe: `signup:${customer.id}` });
}

/* ------------------------------------------------------------------- jobs -- */
/** Pending points whose day came: usable now. All stores at once. */
export async function releasePending(now = new Date()) {
  const due = await db.loyaltyEvent.findMany({ where: { status: "pending", availableAt: { lte: now } }, select: { id: true, memberId: true, points: true }, take: 2000 });
  for (const e of due) {
    await db.$transaction([
      db.loyaltyEvent.update({ where: { id: e.id }, data: { status: "available" } }),
      db.loyaltyMember.update({ where: { id: e.memberId }, data: { pending: { decrement: e.points }, points: { increment: e.points } } }),
    ]);
  }
  return due.length;
}

/** Points of members with no order or redemption for `days` days expire (all of them, in one ledger row). */
export async function expireInactive(shop: string, c: LoyaltyConfig, now = new Date()) {
  if (!c.expiry.on) return 0;
  const before = new Date(now.getTime() - c.expiry.days * DAY);
  const stale = await db.loyaltyMember.findMany({ where: { shop, points: { gt: 0 }, lastActivity: { lt: before } }, select: { id: true, points: true } });
  for (const m of stale) await record(shop, m.id, { kind: "expire", points: -m.points, note: `No activity for ${c.expiry.days} days`, dedupe: `expire:${m.id}:${now.toISOString().slice(0, 10)}` });
  return stale.length;
}

/* ------------------------------------------------------------------ admin -- */
export async function adjustPoints(shop: string, memberId: number, points: number, note: string) {
  const m = await db.loyaltyMember.findFirst({ where: { id: memberId, shop } });
  if (!m || !Number.isInteger(points) || points === 0 || Math.abs(points) > 1_000_000) return null;
  return record(shop, m.id, { kind: "adjust", points, note: note.trim().slice(0, 200) || (points > 0 ? "Added by the store" : "Removed by the store") });
}

export async function setBlocked(shop: string, memberId: number, blocked: boolean) {
  await db.loyaltyMember.updateMany({ where: { id: memberId, shop }, data: { blocked } });
}

export async function listMembers(shop: string, q: string, take = 50) {
  const s = q.trim().toLowerCase();
  return db.loyaltyMember.findMany({ where: { shop, ...(s ? { OR: [{ email: { contains: s } }, { firstName: { contains: q.trim() } }, { referralCode: { equals: q.trim().toUpperCase() } }] } : {}) }, orderBy: { lastActivity: "desc" }, take });
}

export async function memberWithHistory(shop: string, id: number) {
  const m = await db.loyaltyMember.findFirst({ where: { id, shop } });
  if (!m) return null;
  const events = await db.loyaltyEvent.findMany({ where: { shop, memberId: id }, orderBy: { createdAt: "desc" }, take: 100 });
  return { member: m, events };
}

/** Numbers for the Loyalty home: members, points now, and points earned, expired and used in the last `days` days. */
export async function programStats(shop: string, days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const [members, sums, events] = await Promise.all([
    db.loyaltyMember.count({ where: { shop } }),
    db.loyaltyMember.aggregate({ where: { shop }, _sum: { points: true, pending: true } }),
    db.loyaltyEvent.groupBy({ by: ["kind"], where: { shop, createdAt: { gte: since } }, _sum: { points: true }, _count: { _all: true } }),
  ]);
  const by = (k: string[]) => events.filter((e) => k.includes(e.kind)).reduce((n, e) => n + (e._sum.points ?? 0), 0);
  return {
    members,
    newMembers: await db.loyaltyMember.count({ where: { shop, joinedAt: { gte: since } } }),
    points: sums._sum.points ?? 0,
    pending: sums._sum.pending ?? 0,
    earned: by(["order", "first_order", "signup"]),
    takenBack: -by(["refund", "cancel"]),
    expired: -by(["expire"]),
  };
}

/** Uninstall or shop/redact: every loyalty row of the store. */
export async function removeShopLoyalty(shop: string) {
  await db.loyaltyReward.deleteMany({ where: { shop } });
  await db.loyaltyEvent.deleteMany({ where: { shop } });
  await db.loyaltyMember.deleteMany({ where: { shop } });
  await db.loyaltyProgram.deleteMany({ where: { shop } });
}

/** customers/redact: that customer's member and ledger (by id, and by email when Shopify sends only that). */
export async function redactLoyaltyCustomer(shop: string, customerId: string, email: string) {
  const ms = await db.loyaltyMember.findMany({ where: { shop, OR: [...(customerId ? [{ customerId }] : []), ...(email ? [{ email: email.toLowerCase() }] : [])] }, select: { id: true } });
  if (!ms.length) return 0;
  const ids = ms.map((m) => m.id);
  await db.loyaltyReward.deleteMany({ where: { shop, memberId: { in: ids } } });
  await db.loyaltyEvent.deleteMany({ where: { shop, memberId: { in: ids } } });
  await db.loyaltyMember.deleteMany({ where: { shop, id: { in: ids } } });
  return ids.length;
}

/** customers/data_request: how many loyalty rows the store holds for that customer (counts only, never logged in full). */
export async function loyaltyHeldFor(shop: string, customerId: string, email: string) {
  const ms = await db.loyaltyMember.findMany({ where: { shop, OR: [...(customerId ? [{ customerId }] : []), ...(email ? [{ email: email.toLowerCase() }] : [])] }, select: { id: true } });
  const events = ms.length ? await db.loyaltyEvent.count({ where: { shop, memberId: { in: ms.map((m) => m.id) } } }) : 0;
  return { members: ms.length, events };
}
