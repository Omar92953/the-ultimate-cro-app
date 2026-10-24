/**
 * What the store's plan allows in the loyalty program: on from Growth, everything on Pro (config.ts `forPlan`),
 * with the monthly limits of plans.ts (loyalty orders and emails; usage.server.ts lets a store go over them).
 */
import type { AdminClient } from "../admin.server";
import { getPlan } from "../billing.server";
import { atLeast, type PlanKey } from "../plans";
import { extrasFor } from "../usage.server";
import { forPlan, type LoyaltyConfig } from "./config";

export type LoyaltyAccess = { plan: PlanKey; on: boolean; pro: boolean; ordersExtra: boolean; emailsExtra: boolean };

export const accessFor = (plan: PlanKey, extras: { loyaltyOrders?: boolean; loyaltyEmails?: boolean } = {}): LoyaltyAccess => ({
  plan,
  on: atLeast(plan, "growth"),
  pro: atLeast(plan, "pro"),
  ordersExtra: !!extras.loyaltyOrders,
  emailsExtra: !!extras.loyaltyEmails,
});

export async function loyaltyAccess(admin: AdminClient, shop: string) {
  const [{ plan }, extras] = await Promise.all([getPlan(admin, shop), extrasFor(shop)]);
  return accessFor(plan, extras);
}

/** The settings the program runs with on this plan. */
export const planned = (c: LoyaltyConfig, a: LoyaltyAccess): LoyaltyConfig => ({ ...forPlan(c, a.pro), usage: { plan: a.plan, ordersExtra: a.ordersExtra, emailsExtra: a.emailsExtra } });
