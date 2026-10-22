/**
 * Spending points on a reward: the points go first (all or nothing), then Shopify makes the reward:
 *   amount, percent, free shipping, free product: a one use discount code for this customer only, valid
 *   `days` days (tagged "cro-loyalty" so Analytics can count the orders that used it);
 *   store credit: credit on the customer's store credit account, used at checkout by itself.
 * If Shopify refuses, the points come back. Every reward is kept in LoyaltyReward for the member's list.
 */
import { randomBytes } from "node:crypto";
import db from "../../db.server";
import { AdminError, gql, type AdminClient } from "../admin.server";
import type { LoyaltyConfig, Reward } from "./config";
import { NotEnoughPoints, record } from "./program.server";

const DAY = 86_400_000;
export const LOYALTY_TAG = "cro-loyalty";

const money = (n: number) => n.toFixed(2);

/** The Shopify discount input for a code reward (exported for the tests). */
export function rewardDiscountInput(r: Reward, code: string, customerGid: string, endsAt: Date) {
  const base = {
    title: `Loyalty reward: ${r.title} (${code})`,
    code,
    startsAt: new Date().toISOString(),
    endsAt: endsAt.toISOString(),
    usageLimit: 1,
    appliesOncePerCustomer: true,
    tags: [LOYALTY_TAG],
    context: { customers: { add: [customerGid] } },
    ...(r.minimum > 0 ? { minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: money(r.minimum) } } } : {}),
  };
  if (r.kind === "shipping") return { kind: "shipping" as const, input: { ...base, destination: { all: true }, combinesWith: { productDiscounts: true, orderDiscounts: true, shippingDiscounts: false } } };
  const value =
    r.kind === "percent"
      ? { percentage: r.value / 100 }
      : r.kind === "product"
        ? { discountAmount: { amount: money(r.product?.price ?? 0), appliesOnEachItem: false } }
        : { discountAmount: { amount: money(r.value), appliesOnEachItem: false } };
  const items = r.kind === "product" && r.product ? { products: { productsToAdd: [r.product.id] } } : { all: true };
  // Combines with product discounts: the app's own upsells and bundles are product discounts.
  return { kind: "basic" as const, input: { ...base, customerGets: { value, items }, combinesWith: { productDiscounts: true, orderDiscounts: false, shippingDiscounts: true } } };
}

async function makeCode(admin: AdminClient, r: Reward, customerId: string): Promise<{ code: string; discountId: string; expiresAt: Date }> {
  const code = `RWD-${randomBytes(4).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(Date.now() + r.days * DAY);
  const d = rewardDiscountInput(r, code, `gid://shopify/Customer/${customerId}`, expiresAt);
  const data =
    d.kind === "shipping"
      ? await gql(admin, `#graphql
          mutation CroLoyaltyShipCode($d: DiscountCodeFreeShippingInput!) { discountCodeFreeShippingCreate(freeShippingCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { d: d.input })
      : await gql(admin, `#graphql
          mutation CroLoyaltyCode($d: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } } }`, { d: d.input });
  const out = d.kind === "shipping" ? data.discountCodeFreeShippingCreate : data.discountCodeBasicCreate;
  const errors = (out?.userErrors ?? []) as { message: string }[];
  if (errors.length || !out?.codeDiscountNode?.id) throw new AdminError(errors[0]?.message ?? "Shopify did not make the code.");
  return { code, discountId: out.codeDiscountNode.id, expiresAt };
}

async function giveCredit(admin: AdminClient, r: Reward, customerId: string) {
  const shop = await gql(admin, `#graphql
    query CroShopCurrency { shop { currencyCode } }`);
  const data = await gql(admin, `#graphql
    mutation CroLoyaltyCredit($id: ID!, $input: StoreCreditAccountCreditInput!) { storeCreditAccountCredit(id: $id, creditInput: $input) { storeCreditAccountTransaction { amount { amount } } userErrors { message } } }`, {
    id: `gid://shopify/Customer/${customerId}`,
    input: { creditAmount: { amount: money(r.value), currencyCode: shop.shop.currencyCode } },
  });
  const errors = (data.storeCreditAccountCredit?.userErrors ?? []) as { message: string }[];
  if (errors.length) throw new AdminError(errors[0].message);
}

export type GotReward = { id: number; title: string; kind: string; code: string; expiresAt: string | null };

/** Spends a member's points on one reward. Throws NotEnoughPoints, or an AdminError when Shopify refuses (points given back). */
export async function redeem(admin: AdminClient, shop: string, c: LoyaltyConfig, memberId: number, rewardId: string): Promise<GotReward> {
  const r = c.rewards.find((x) => x.id === rewardId && x.on);
  if (!r) throw new AdminError("This reward isn't available any more.");
  const m = await db.loyaltyMember.findFirst({ where: { id: memberId, shop } });
  if (!m || m.blocked) throw new AdminError("This account can't use rewards.");
  if (m.points < r.points) throw new NotEnoughPoints();
  const nonce = randomBytes(6).toString("hex");
  await record(shop, m.id, { kind: "redeem", points: -r.points, note: r.title, dedupe: `redeem:${m.id}:${nonce}`, strict: true });
  try {
    if (r.kind === "credit") {
      await giveCredit(admin, r, m.customerId);
      const row = await db.loyaltyReward.create({ data: { shop, memberId: m.id, rewardId: r.id, kind: r.kind, title: r.title, points: r.points, value: r.value } });
      return { id: row.id, title: r.title, kind: r.kind, code: "", expiresAt: null };
    }
    const made = await makeCode(admin, r, m.customerId);
    const row = await db.loyaltyReward.create({ data: { shop, memberId: m.id, rewardId: r.id, kind: r.kind, title: r.title, points: r.points, value: r.value, code: made.code, discountId: made.discountId, expiresAt: made.expiresAt } });
    return { id: row.id, title: r.title, kind: r.kind, code: made.code, expiresAt: made.expiresAt.toISOString() };
  } catch (e) {
    // Shopify refused: the member gets the points back at once.
    await record(shop, m.id, { kind: "adjust", points: r.points, note: "Reward could not be made, points returned", dedupe: `redeem-back:${m.id}:${nonce}` });
    throw e instanceof AdminError ? e : new AdminError("The reward could not be made. Your points were returned.");
  }
}

/** A member's rewards that are still worth showing: codes not used and not expired, and the last credits. */
export async function memberRewards(shop: string, memberId: number) {
  const now = new Date();
  const rows = await db.loyaltyReward.findMany({ where: { shop, memberId, usedAt: null }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.filter((r) => !r.expiresAt || r.expiresAt > now).map((r) => ({ id: r.id, title: r.title, kind: r.kind, code: r.code, expiresAt: r.expiresAt?.toISOString() ?? null }));
}

export { NotEnoughPoints };
