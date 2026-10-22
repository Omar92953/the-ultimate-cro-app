/**
 * What the store's plan allows in the loyalty program: on from Growth, everything on Pro (config.ts `forPlan`),
 * with the member and email limits of plans.ts.
 */
import type { AdminClient } from "../admin.server";
import { getPlan } from "../billing.server";
import { atLeast, limitOf, type PlanKey } from "../plans";
import { forPlan, type LoyaltyConfig } from "./config";

export type LoyaltyAccess = { plan: PlanKey; on: boolean; pro: boolean; memberCap: number | null; emails: number };

export const accessFor = (plan: PlanKey): LoyaltyAccess => ({
  plan,
  on: atLeast(plan, "growth"),
  pro: atLeast(plan, "pro"),
  memberCap: limitOf(plan, "loyaltyMembers"),
  emails: limitOf(plan, "loyaltyEmails") ?? Number.MAX_SAFE_INTEGER,
});

export async function loyaltyAccess(admin: AdminClient, shop: string) {
  return accessFor((await getPlan(admin, shop)).plan);
}

/** The settings the program runs with on this plan. */
export const planned = (c: LoyaltyConfig, a: LoyaltyAccess) => forPlan(c, a.pro, a.memberCap);
