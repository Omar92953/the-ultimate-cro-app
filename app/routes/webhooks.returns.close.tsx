import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { atLeast } from "../lib/plans";
import { planContext } from "../lib/rules.server";
import { getReturnRules } from "../lib/shopify-returns.server";
import { giveCreditWhenClosed } from "../lib/return-saving.server";

/**
 * A return was closed (by this app or by the merchant in Shopify's own admin). When it is an approved store credit return waiting for
 * its items, closing it means the items are in: the credit goes out (lib/return-saving.server.ts giveCreditWhenClosed).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, shop } = await authenticate.webhook(request);
  const p = payload as { admin_graphql_api_id?: string; id?: number | string } | null;
  const id = p?.admin_graphql_api_id ?? (p?.id ? `gid://shopify/Return/${p.id}` : "");
  if (admin && id) {
    try {
      const { plan } = await planContext(admin, shop);
      const { rules } = await getReturnRules(admin);
      await giveCreditWhenClosed(admin, shop, id, rules, atLeast(plan, "pro"));
    } catch (e) {
      // Answer 200 anyway (a retry would repeat the same failure): the merchant can still click "Items received: give the credit".
      console.error(`Credit on close ${shop}:`, e instanceof Error ? e.message : e);
    }
  }
  return new Response();
};
