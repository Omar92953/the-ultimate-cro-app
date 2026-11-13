/**
 * The two server calls of the after-purchase offer extension (cro-post-purchase), used by the routes
 * api.post-purchase.offer and api.post-purchase.sign. Body: { token } (from Shopify, signed with the
 * app's secret). Called from checkout, on another origin, so every answer carries the CORS headers
 * (lib/cors.ts) and the routes' loaders answer the preflight.
 */
import { unauthenticated } from "../shopify.server";
import { corsJson as json, preflight } from "./cors";
import { currentOffer, getPostPurchase, signOfferChangeset, verifyPostPurchaseToken } from "./post-purchase.server";

/** The token from the body, or a ready error answer. */
async function readToken(request: Request): Promise<string | Response> {
  const pre = preflight(request);
  if (pre) return pre;
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    return String(((await request.json()) as { token?: unknown }).token ?? "");
  } catch {
    return json({ error: "Bad request" }, 400);
  }
}

/**
 * POST /api/post-purchase/offer, before the extension shows the offer: { offer } with the product's
 * current name, picture and price, or { offer: null } when there's nothing to show.
 */
export async function offerAction(request: Request) {
  const token = await readToken(request);
  if (token instanceof Response) return token;
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
}

/**
 * POST /api/post-purchase/sign, when the shopper accepts: { token }, the signed change (the saved
 * offer for that shop) that the extension applies.
 */
export async function signAction(request: Request) {
  const token = await readToken(request);
  if (token instanceof Response) return token;
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
}

export type ConnectionCheck = { label: string; ok: boolean; detail: string };

/**
 * "Test connection" on the After-purchase offer page: the same calls the extension makes at checkout,
 * from outside (the preflight and a POST to the public address saved in the offer), plus whether the
 * product can be sold now. A check that can't run reports why instead of failing the page.
 */
export async function checkConnection(admin: Parameters<typeof getPostPurchase>[0]): Promise<ConnectionCheck[]> {
  const { saved, config } = await getPostPurchase(admin);
  const checks: ConnectionCheck[] = [];
  const url = config.url;
  checks.push({ label: "Offer saved with the app address", ok: saved && !!url, detail: saved ? (url ? url : "Save the offer again.") : "Save the offer first." });
  checks.push({ label: "Offer is on", ok: config.on, detail: config.on ? "On" : "Turn the offer on." });
  if (url) {
    const target = `${url}/api/post-purchase/offer`;
    const timed = () => AbortSignal.timeout(8000);
    try {
      const res = await fetch(target, { method: "OPTIONS", headers: { Origin: "https://extensions.shopifycdn.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" }, signal: timed() });
      const ok = res.status >= 200 && res.status < 300 && res.headers.get("access-control-allow-origin") === "*";
      checks.push({ label: "Checkout can reach the app (preflight)", ok, detail: `Answered ${res.status}` });
    } catch (e) {
      checks.push({ label: "Checkout can reach the app (preflight)", ok: false, detail: e instanceof Error ? e.message : "No answer" });
    }
    try {
      // A test token the server must refuse: proves the route answers and its answer is readable cross origin.
      const res = await fetch(target, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ token: "connection-test" }), signal: timed() });
      const ok = res.status === 401 && res.headers.get("access-control-allow-origin") === "*";
      checks.push({ label: "The app answers the offer request", ok, detail: `Answered ${res.status}` });
    } catch (e) {
      checks.push({ label: "The app answers the offer request", ok: false, detail: e instanceof Error ? e.message : "No answer" });
    }
  }
  if (config.product) {
    try {
      const offer = await currentOffer(admin, { ...config, on: true });
      checks.push({ label: "Product is active and in stock", ok: !!offer, detail: offer ? offer.title : "Make the product active and in stock, or choose another one." });
    } catch (e) {
      checks.push({ label: "Product is active and in stock", ok: false, detail: e instanceof Error ? e.message : "Couldn't check" });
    }
  } else {
    checks.push({ label: "Product is active and in stock", ok: false, detail: "Choose a product." });
  }
  return checks;
}
