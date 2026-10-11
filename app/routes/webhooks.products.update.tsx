import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { repriceKitsWith } from "../lib/kits.server";

/**
 * A product changed: if it's an item of a bundle product (kit), recalculate the kit's prices and
 * compare-at price (lib/kits.server.ts). Our own price writes to a kit also land here; a kit is
 * never an item of another kit, so that stops at once.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, shop } = await authenticate.webhook(request);
  const id = (payload as { admin_graphql_api_id?: string } | null)?.admin_graphql_api_id;
  if (admin && id) {
    try {
      await repriceKitsWith(admin, id);
    } catch (e) {
      // Answer 200 anyway: a retry wouldn't help, and the next save or price change fixes it.
      console.error(`Kit prices for ${shop}:`, e);
    }
  }
  return new Response();
};
