/**
 * Keeps the metafields the loyalty extensions read (lib/loyalty/account.ts) up to date, from the 10 minute loyalty
 * job (lib/loyalty/sync.server.ts):
 *   shop $app:loyalty: written when it changed (and with `on: false` when the program stops or the plan ends);
 *   customer $app:loyalty: written for members whose row changed since it was last written (`changedAt` is set by
 *   Prisma on every change, `pushedAt` here), 250 a run, 25 a call.
 */
import db from "../../db.server";
import { remember } from "../short-cache.server";
import { gql, type AdminClient } from "../admin.server";
import type { LoyaltyConfig } from "./config";
import { ACCOUNT_KEY, memberPayload, shopPayload } from "./account";

const PER_RUN = 250;
const PER_CALL = 25;
const lastShop = new Map<string, string>();

type SetResult = { metafieldsSet: { userErrors: { field: string[] | null; message: string }[] } };
const SET = `#graphql
  mutation CroLoyaltyAccountSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { field message } } }`;

/** The shop's id and storefront address (for referral links), kept an hour. */
const storeOf = (admin: AdminClient, shop: string) =>
  remember(shop, "loyalty-account-shop", 60 * 60_000, async () => {
    const d = await gql(admin, `#graphql
      query CroLoyaltyAccountShop { shop { id primaryDomain { url } } }`);
    return { id: String(d.shop.id), url: String(d.shop.primaryDomain?.url ?? "") };
  });

/** The shop's metafield, written only when it changed since the last write in this process. */
export async function pushShopAccount(admin: AdminClient, shop: string, c: LoyaltyConfig, active: boolean) {
  const store = await storeOf(admin, shop);
  const value = JSON.stringify(shopPayload(c, active, store.url));
  if (lastShop.get(shop) === value) return false;
  const r: SetResult = await gql(admin, SET, { metafields: [{ ownerId: store.id, namespace: "$app", key: ACCOUNT_KEY, type: "json", value }] });
  if (r.metafieldsSet.userErrors.length) throw new Error(r.metafieldsSet.userErrors.map((e) => e.message).join(" "));
  lastShop.set(shop, value);
  return true;
}

/** Members whose metafield is behind their row (or these members, at once: after a reward from checkout or POS). Returns how many were written. */
export async function pushMemberAccounts(admin: AdminClient, shop: string, c: LoyaltyConfig, only?: number[], now = new Date()) {
  const due: { id: number }[] = only
    ? only.map((id) => ({ id }))
    : await db.$queryRaw`SELECT "id" FROM "LoyaltyMember" WHERE "shop" = ${shop} AND ("pushedAt" IS NULL OR "changedAt" > "pushedAt") ORDER BY "id" LIMIT ${PER_RUN}`;
  if (!due.length) return 0;
  const store = await storeOf(admin, shop);
  let written = 0;
  for (let i = 0; i < due.length; i += PER_CALL) {
    const ids = due.slice(i, i + PER_CALL).map((x) => Number(x.id));
    const readAt = new Date();
    const [members, rewards, orders] = await Promise.all([
      db.loyaltyMember.findMany({ where: { shop, id: { in: ids } } }),
      db.loyaltyReward.findMany({ where: { shop, memberId: { in: ids }, code: { not: "" }, usedAt: null }, orderBy: { createdAt: "desc" }, take: ids.length * 10 }),
      db.loyaltyEvent.findMany({ where: { shop, memberId: { in: ids }, kind: { in: ["order", "first_order", "refund", "cancel"] }, orderId: { not: "" } }, orderBy: { createdAt: "desc" }, take: ids.length * 30, select: { memberId: true, orderId: true, points: true, status: true } }),
    ]);
    const metafields = members.map((m) => ({
      ownerId: `gid://shopify/Customer/${m.customerId}`,
      namespace: "$app",
      key: ACCOUNT_KEY,
      type: "json",
      value: JSON.stringify(
        memberPayload(
          c,
          m,
          rewards.filter((r) => r.memberId === m.id),
          orders.filter((o) => o.memberId === m.id).map((o) => ({ orderId: o.orderId, points: o.points, pending: o.status === "pending" })),
          store.url,
          now,
        ),
      ),
    }));
    if (metafields.length) {
      const r: SetResult = await gql(admin, SET, { metafields });
      // A customer deleted in Shopify can't be written: logged, and marked as written so it isn't tried every run.
      if (r.metafieldsSet.userErrors.length) console.error(`[loyalty] account metafields ${shop}:`, r.metafieldsSet.userErrors.map((e) => e.message).join(" ").slice(0, 300));
    }
    // Only rows that didn't change while this ran: a change made meanwhile is written next run.
    for (const id of ids) await db.loyaltyMember.updateMany({ where: { id, OR: [{ changedAt: null }, { changedAt: { lte: readAt } }] }, data: { pushedAt: readAt, changedAt: readAt } });
    written += members.length;
  }
  return written;
}

/** Both, for one store. `active`: the program is on and the store's plan includes it. */
export async function pushAccounts(admin: AdminClient, shop: string, c: LoyaltyConfig, active: boolean) {
  await pushShopAccount(admin, shop, c, active);
  return active ? pushMemberAccounts(admin, shop, c) : 0;
}
