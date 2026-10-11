/**
 * POST /api/post-purchase/sign — called by the cro-post-purchase extension when the shopper accepts
 * the offer. Body: { token } (the token Shopify gave the extension, signed with the app's secret).
 * Answers { token } — the signed change (the saved offer for that shop) that the extension applies.
 * Called from checkout, so it answers cross-origin requests.
 */
import type { ActionFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";
import { getPostPurchase, signOfferChangeset, verifyPostPurchaseToken } from "../lib/post-purchase.server";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export const loader = async () => json({ error: "Method not allowed" }, 405);

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let token = "";
  try {
    token = String(((await request.json()) as { token?: unknown }).token ?? "");
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  let verified: Awaited<ReturnType<typeof verifyPostPurchaseToken>>;
  try {
    verified = await verifyPostPurchaseToken(token);
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const { admin } = await unauthenticated.admin(verified.shop);
    const { config } = await getPostPurchase(admin);
    return json({ token: await signOfferChangeset(config, verified.referenceId) });
  } catch {
    return json({ error: "No offer" }, 404);
  }
};
