/**
 * OAuth authorization endpoint. An assistant sends the merchant's browser here. This page does NOT ask for the store address
 * (Shopify App Store rule 2.3.1: installation and sign in start from a Shopify surface, no typing a shop URL). It shows a short
 * connection code and tells the merchant to continue in CRO Toolbox inside their Shopify admin (Settings, Connect an AI assistant),
 * where the store is known from their signed in session. There they enter the code, choose what to allow, and are sent back to the
 * assistant (app/routes/app.assistant.tsx, app.mcp-connect.tsx). Nothing is granted on this page.
 */
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { pairingCode, startRequest } from "../lib/mcp/auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const q = new URL(request.url).searchParams;
  try {
    if (q.get("response_type") !== "code") throw new Error("This address is for AI assistants that connect to CRO Toolbox. Start from your assistant.");
    const r = await startRequest({ clientId: q.get("client_id") ?? "", redirectUri: q.get("redirect_uri") ?? "", state: q.get("state") ?? "", challenge: q.get("code_challenge") ?? "", method: q.get("code_challenge_method") ?? "" });
    return { code: pairingCode(r.id), clientName: r.clientName, error: "" };
  } catch (e) {
    return { code: "", clientName: "", error: e instanceof Error ? e.message : "Something went wrong." };
  }
};

export default function Authorize() {
  const d = useLoaderData<typeof loader>();
  return (
    <main style={{ font: "16px/1.5 system-ui, sans-serif", maxWidth: 480, margin: "12vh auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Connect to CRO Toolbox</h1>
      {d.code ? (
        <>
          <p>{d.clientName ? `${d.clientName} wants to work with your CRO Toolbox.` : "An AI assistant wants to work with your CRO Toolbox."} Continue in your Shopify admin:</p>
          <ol style={{ paddingLeft: 20 }}>
            <li>Open <b>CRO Toolbox</b> in your Shopify admin.</li>
            <li>Go to <b>Settings</b>, then <b>Connect an AI assistant</b>.</li>
            <li>Enter this connection code and choose what the assistant may do:</li>
          </ol>
          <p style={{ font: "600 28px/1.2 ui-monospace, monospace", letterSpacing: 2, background: "#f3f3f3", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>{d.code}</p>
          <p style={{ color: "#555", fontSize: 14 }}>The code works for 10 minutes. Nothing is shared before you say yes in Shopify.</p>
        </>
      ) : (
        <p style={{ color: "#b42318" }}>{d.error}</p>
      )}
    </main>
  );
}
