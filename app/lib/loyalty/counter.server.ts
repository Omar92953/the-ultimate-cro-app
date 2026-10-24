/**
 * Spending points outside the storefront: in Shopify Plus checkout (api.loyalty.checkout.tsx) and at the POS counter
 * (api.loyalty.pos.tsx). Both come with a Shopify session token that names the store (and, in checkout, the signed
 * in customer); the rules are the storefront's (lib/loyalty/rewards.server.ts `redeem`).
 */
import db from "../../db.server";
import { unauthenticated } from "../../shopify.server";
import { errorMessage } from "../admin.server";
import { getProgram } from "./program.server";
import { loyaltyAccess, planned } from "./plan.server";
import { NotEnoughPoints, redeem } from "./rewards.server";
import { pushMemberAccounts } from "./account.server";
export { customerIdOf, rewardsFor, shopOf, summaryOf } from "./counter";

/** The store's admin and program as its plan runs it (Growth without the Pro parts), when loyalty is on; otherwise null. */
export async function counterContext(shop: string) {
  const program = await getProgram(shop);
  if (!program.on) return null;
  const { admin } = await unauthenticated.admin(shop);
  const access = await loyaltyAccess(admin, shop);
  if (!access.on) return null;
  return { admin, config: planned(program.config, access) };
}

export async function memberOf(shop: string, customerId: string) {
  return db.loyaltyMember.findUnique({ where: { shop_customerId: { shop, customerId } } });
}

/** Spends the points on one reward and writes the member's metafield at once, so the code shows on their account. */
export async function redeemAtCounter(ctx: NonNullable<Awaited<ReturnType<typeof counterContext>>>, shop: string, memberId: number, rewardId: string) {
  try {
    const got = await redeem(ctx.admin, shop, ctx.config, memberId, rewardId);
    await pushMemberAccounts(ctx.admin, shop, ctx.config, [memberId]).catch((e) => console.error(`[loyalty] account metafield ${shop}:`, errorMessage(e)));
    const m = await db.loyaltyMember.findUnique({ where: { id: memberId }, select: { points: true } });
    return { ok: true as const, reward: got, points: m?.points ?? 0 };
  } catch (e) {
    if (e instanceof NotEnoughPoints) return { ok: false as const, error: "not enough" };
    return { ok: false as const, error: errorMessage(e) };
  }
}
