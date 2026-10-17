/** OAuth discovery: which server protects /mcp (RFC 9728). */
import { appUrl } from "../lib/mcp/auth.server";

export const loader = () =>
  Response.json({ resource: `${appUrl()}/mcp`, authorization_servers: [appUrl()], scopes_supported: ["read", "build"], bearer_methods_supported: ["header"] }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
