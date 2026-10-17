import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { forgetShop, namesToForget } from "./lib/short-cache.server";
import { planContext } from "./lib/rules.server";
import { requirePage } from "./lib/rules";
import { warnIfApiKeyDiffers } from "./lib/api-key-check.server";
import { timed } from "./lib/timing.server";

warnIfApiKeyDiffers();

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
/**
 * Admin requests; any save (non-GET) clears that shop's short-lived read cache (short-cache.server.ts).
 * A save on a page the shop's plan doesn't include is refused here, in one place for every page
 * (the app frame already shows an upgrade card instead of those pages — this only stops a crafted
 * request). Plans: lib/plans.ts.
 */
const admin: typeof shopify.authenticate.admin = async (request) => {
  const result = await timed("auth", () => shopify.authenticate.admin(request));
  if (request.method !== "GET" && request.method !== "HEAD") {
    const url = new URL(request.url);
    // Only what this save can change is forgotten (short-cache.server.ts namesToForget).
    const small = (request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
    const intent = small ? (await request.clone().formData().catch(() => null))?.get("intent") : null;
    forgetShop(result.session.shop, namesToForget(url.pathname, typeof intent === "string" ? intent : null));
    const { plan, trial } = await planContext(result.admin, result.session.shop);
    try {
      requirePage(plan, url.pathname, url.search, trial);
    } catch (e) {
      throw new Response(e instanceof Error ? e.message : "This needs a higher plan.", { status: 403 });
    }
  }
  return result;
};
export const authenticate = { ...shopify.authenticate, admin };
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
