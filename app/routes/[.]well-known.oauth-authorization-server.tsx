/** OAuth discovery: where to register, authorize and get tokens (RFC 8414). */
import { appUrl } from "../lib/mcp/auth.server";

export const loader = () => {
  const base = appUrl();
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/mcp/authorize`,
      token_endpoint: `${base}/mcp/token`,
      registration_endpoint: `${base}/mcp/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["read", "build"],
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } },
  );
};
