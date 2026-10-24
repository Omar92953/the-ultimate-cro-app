/**
 * The app's secret (the client secret from the Partner Dashboard). Every signature the app makes or checks uses it:
 * Flow requests, unsubscribe links, the Postmark webhook key, post-purchase tokens, pop up codes, the assistant
 * connection code. In production a missing secret is an error (the server refuses to start, shopify.server.ts), never
 * an empty or known key that anyone could sign with. Local development uses a fixed one.
 */
export function appSecret(): string {
  const s = process.env.SHOPIFY_API_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SHOPIFY_API_SECRET is not set: the app can't sign or check anything.");
  return "development-only";
}
