/** OAuth token endpoint: a code (with PKCE) or a refresh token for an access token. */
import type { ActionFunctionArgs } from "react-router";
import { exchange } from "../lib/mcp/auth.server";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

export const loader = () => new Response(null, { status: 204, headers: CORS });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const form = new URLSearchParams(await request.text());
  try {
    const t = await exchange(form);
    return Response.json(
      { access_token: t.access, token_type: "Bearer", expires_in: t.expiresIn, refresh_token: t.refreshToken || undefined },
      { headers: { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache" } },
    );
  } catch (e) {
    const code = e instanceof Error && /^[a-z_]+$/.test(e.message) ? e.message : "invalid_request";
    return Response.json({ error: code }, { status: 400, headers: { ...CORS, "Cache-Control": "no-store" } });
  }
};
