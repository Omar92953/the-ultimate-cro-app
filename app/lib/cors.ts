/**
 * Cross-origin answers for routes called from Shopify's sandboxes (the post-purchase extension runs on
 * another origin). A POST with `Content-Type: application/json` makes the browser send an OPTIONS
 * preflight first, and React Router sends OPTIONS to the route's loader, not its action: the loader
 * must answer it, or the browser blocks the POST and the extension silently shows nothing (App Store
 * rejection 5.6.1, 2026-11-11).
 */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** JSON with the CORS headers, so the caller can read errors too. */
export const corsJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** The preflight answer for OPTIONS; null for any other method. */
export const preflight = (request: Request) => (request.method === "OPTIONS" ? new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } }) : null);

/** Loader for a POST only route: answers the preflight, 405 for anything else. */
export const postOnlyLoader = ({ request }: { request: Request }) => preflight(request) ?? corsJson({ error: "Method not allowed" }, 405);
