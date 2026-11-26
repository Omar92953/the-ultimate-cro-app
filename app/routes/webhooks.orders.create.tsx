import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { addPurchaseFromWebhook } from "../lib/boosters.server";
import { forgetOrders } from "../lib/short-cache.server";

/**
 * Keeps the sales pop-up list of recent purchases fresh (product, time, optional city), and makes
 * Home and Analytics read the orders again on their next visit, so the new order shows at once.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, shop } = await authenticate.webhook(request);
  forgetOrders(shop);
  if (!admin) return new Response(); // app uninstalled meanwhile
  try {
    await addPurchaseFromWebhook(admin, payload);
  } catch (e) {
    console.error(`[orders/create] ${shop}:`, e);
  }
  return new Response();
};
