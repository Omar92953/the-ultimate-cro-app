/**
 * Shopify Flow tells the app when a store turns on (or off) a workflow that uses a loyalty trigger
 * (extensions/cro-flow-lifecycle). Triggers are sent only to stores that use them. Must answer within 5 seconds.
 */
import type { ActionFunctionArgs } from "react-router";
import { flowLifecycle, flowSigned } from "../lib/loyalty/integrations.server";

export const loader = () => new Response("Use POST.", { status: 405, headers: { Allow: "POST" } });

export const action = async ({ request }: ActionFunctionArgs) => {
  const raw = await request.text();
  if (!flowSigned(raw, request.headers.get("x-shopify-hmac-sha256"))) return new Response("Not signed", { status: 401 });
  try {
    const body = JSON.parse(raw);
    const shop = String(body.shopify_domain ?? "");
    if (/^[a-z0-9-]+\.myshopify\.com$/.test(shop)) await flowLifecycle(shop, body);
  } catch (e) {
    console.error("[flow lifecycle]", e instanceof Error ? e.message : e);
  }
  return new Response("ok");
};
