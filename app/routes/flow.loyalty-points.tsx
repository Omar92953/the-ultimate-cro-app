/**
 * Shopify Flow's "Add loyalty points" action (extensions/cro-flow-add-points) posts here. Flow signs the body
 * with the app's secret; each action run counts once (lib/loyalty/integrations.server.ts `flowAddPoints`).
 */
import type { ActionFunctionArgs } from "react-router";
import { flowAddPoints, flowSigned } from "../lib/loyalty/integrations.server";

const reply = (status: number, message = "") => new Response(JSON.stringify(message ? { message } : {}), { status, headers: { "Content-Type": "application/json" } });

export const loader = () => new Response("Use POST.", { status: 405, headers: { Allow: "POST" } });

export const action = async ({ request }: ActionFunctionArgs) => {
  const raw = await request.text();
  if (!flowSigned(raw, request.headers.get("x-shopify-hmac-sha256"))) return reply(401, "Not signed by Shopify.");
  let body: { shopify_domain?: string; handle?: string; action_run_id?: string; properties?: Record<string, unknown> };
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, "Send JSON.");
  }
  const shop = String(body.shopify_domain ?? "");
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(shop)) return reply(400, "Unknown store.");
  try {
    const { unauthenticated } = await import("../shopify.server");
    const { admin } = await unauthenticated.admin(shop);
    const r = await flowAddPoints(admin, shop, body);
    return reply(r.status, r.message);
  } catch (e) {
    console.error(`[flow] ${shop}:`, e instanceof Error ? e.message : e);
    // 5xx: Flow tries again later.
    return reply(503, "CRO Toolbox could not add the points right now.");
  }
};
