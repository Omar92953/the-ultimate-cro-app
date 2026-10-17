/**
 * OAuth authorization endpoint. An assistant sends the merchant's browser here; we ask which store, then
 * hand over to the merchant's own Shopify admin (the app page /app/mcp-connect), where they are signed in and
 * choose what to allow. Nothing is granted on this page.
 */
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { startRequest } from "../lib/mcp/auth.server";

const SHOP = /^([a-z0-9][a-z0-9-]*)(\.myshopify\.com)?$/i;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = url.searchParams;
  try {
    let req = q.get("req");
    let clientName = "";
    if (!req) {
      if (q.get("response_type") !== "code") throw new Error("This address is for AI assistants that connect to CRO Toolbox. Start from your assistant.");
      const r = await startRequest({ clientId: q.get("client_id") ?? "", redirectUri: q.get("redirect_uri") ?? "", state: q.get("state") ?? "", challenge: q.get("code_challenge") ?? "", method: q.get("code_challenge_method") ?? "" });
      req = r.id;
      clientName = r.clientName;
    }
    const store = (q.get("shop") ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const m = SHOP.exec(store);
    if (m) return redirect(`https://admin.shopify.com/store/${m[1].toLowerCase()}/apps/${process.env.SHOPIFY_API_KEY}/app/mcp-connect?req=${encodeURIComponent(req)}`);
    return { req, clientName, error: store ? "That does not look like a store address. Use the part before .myshopify.com." : "" };
  } catch (e) {
    return { req: "", clientName: "", error: e instanceof Error ? e.message : "Something went wrong." };
  }
};

export default function Authorize() {
  const d = useLoaderData<typeof loader>();
  return (
    <main style={{ font: "16px/1.5 system-ui, sans-serif", maxWidth: 440, margin: "12vh auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Connect to CRO Toolbox</h1>
      {d.req ? (
        <form method="get">
          <p>{d.clientName ? `${d.clientName} wants to work with your CRO Toolbox.` : "An AI assistant wants to work with your CRO Toolbox."} Which store is it?</p>
          <input type="hidden" name="req" value={d.req} />
          <label style={{ display: "grid", gap: 4 }}>
            Your store address
            <input name="shop" placeholder="your-store.myshopify.com" autoComplete="off" style={{ padding: 10, font: "inherit", border: "1px solid #888", borderRadius: 8 }} />
          </label>
          {d.error ? <p style={{ color: "#b42318" }}>{d.error}</p> : null}
          <button type="submit" style={{ marginTop: 12, padding: "10px 16px", font: "inherit", fontWeight: 600, color: "#fff", background: "#121212", border: 0, borderRadius: 8 }}>
            Continue in Shopify
          </button>
          <p style={{ color: "#555", fontSize: 14 }}>You will choose what the assistant may do, inside your Shopify admin. Nothing is shared before you say yes.</p>
        </form>
      ) : (
        <p style={{ color: "#b42318" }}>{d.error}</p>
      )}
    </main>
  );
}
