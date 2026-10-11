/**
 * POST /api/post-purchase/offer — called by the cro-post-purchase extension before it shows the
 * offer. Body: { token } (from Shopify, signed with the app's secret). Answers { offer } with the
 * product's current name, picture and price, or { offer: null } when there's nothing to show.
 * Called from checkout, so it answers cross-origin requests.
 */
import type { ActionFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";
import { currentOffer, getPostPurchase, verifyPostPurchaseToken } from "../lib/post-purchase.server";

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
  let shop: string;
  try {
    ({ shop } = await verifyPostPurchaseToken(token));
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const { admin } = await unauthenticated.admin(shop);
    const { config } = await getPostPurchase(admin);
    return json({ offer: await currentOffer(admin, config) });
  } catch {
    return json({ offer: null });
  }
};
