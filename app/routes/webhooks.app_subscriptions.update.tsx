import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlan, keepWithinPlan } from "../lib/billing.server";

/** Statuses after which the store no longer pays for that subscription. */
const ENDED = new Set(["CANCELLED", "DECLINED", "EXPIRED", "FROZEN"]);

/**
 * A subscription changed (plan picked, changed, cancelled, frozen). The plan is read again at once and the store's offers
 * are kept within it, even when the merchant never opens the app again. When the subscription ended and Shopify then lists
 * none, Free is confirmed (audit 2026-11-14, A6: without the Partner API keys a cancelled store kept every paid offer on).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, shop } = await authenticate.webhook(request);
  const status = String((payload as { app_subscription?: { status?: string } } | null)?.app_subscription?.status ?? "").toUpperCase();
  if (admin) {
    try {
      const info = await getPlan(admin, shop, true);
      await keepWithinPlan(admin, shop, info, { confirmed: ENDED.has(status) });
    } catch (e) {
      // Answer 200 anyway: the next time the merchant opens the app, the plan is checked again.
      console.error(`Plan change ${shop}:`, e instanceof Error ? e.message : e);
    }
  }
  return new Response();
};
