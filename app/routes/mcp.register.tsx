/** OAuth dynamic client registration (RFC 7591): an assistant introduces itself. */
import type { ActionFunctionArgs } from "react-router";
import { registerClient } from "../lib/mcp/auth.server";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

export const loader = () => new Response(null, { status: 204, headers: CORS });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const body = await request.json();
    return Response.json(await registerClient(body && typeof body === "object" ? body : {}), { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: "invalid_client_metadata", error_description: e instanceof Error ? e.message : "Bad request" }, { status: 400, headers: CORS });
  }
};
