/**
 * The MCP endpoint (streamable HTTP, stateless): POST one JSON-RPC message or a batch with a bearer token.
 * Docs: docs/plans/mcp-server.md. Not part of the app UI; no Shopify admin session here.
 */
import { tooLarge } from "../lib/body-limit.server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { appUrl, grantFor } from "../lib/mcp/auth.server";
import { handleBody } from "../lib/mcp/server.server";

const MAX_BYTES = 256 * 1024;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...headers } });

// A GET would open a server-sent stream; this server only answers POSTs (allowed by the spec).
export const loader = async ({ request }: LoaderFunctionArgs) =>
  request.method === "OPTIONS" ? new Response(null, { status: 204, headers: CORS }) : new Response("Use POST.", { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return new Response("Use POST.", { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });
  const grant = await grantFor(request.headers.get("authorization"));
  if (!grant) {
    return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": `Bearer resource_metadata="${appUrl()}/.well-known/oauth-protected-resource"` });
  }
  if (tooLarge(request, MAX_BYTES)) return new Response("Too large", { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const answer = await handleBody(grant, body);
  return answer === null ? new Response(null, { status: 202, headers: CORS }) : json(answer);
};
