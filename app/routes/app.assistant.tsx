/**
 * Settings → Connect an AI assistant (Starter and up). The connector address for claude.ai and Claude Desktop,
 * a personal access token for developer clients, the connections with Disconnect, and what assistants did.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { atLeast, PLANS } from "../lib/plans";
import { planContext } from "../lib/rules.server";
import { appUrl, createPersonalToken, listGrants, requestByPairingCode, revokeGrant, sweepMcp, type McpScope } from "../lib/mcp/auth.server";
import { tooMany } from "../lib/proxy-guard.server";
import { MCP_MIN_PLAN } from "../lib/mcp/server.server";
import { recentAudit } from "../lib/mcp/limits.server";
import { errorMessage } from "../lib/admin.server";
import { Button, Checkbox, Select, TextField } from "../components/fields";
import { Pill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const p = await planContext(admin, session.shop);
  const allowed = atLeast(p.plan, MCP_MIN_PLAN);
  sweepMcp().catch(() => null);
  const [grants, audit] = allowed ? await Promise.all([listGrants(session.shop), recentAudit(session.shop)]) : [[], []];
  return { allowed, plan: PLANS[p.plan].name, planUrl: p.planUrl, url: `${appUrl()}/mcp`, grants: grants.map((g) => ({ ...g, createdAt: g.createdAt.toISOString(), lastUsedAt: g.lastUsedAt?.toISOString() ?? null })), audit: audit.map((a) => ({ id: a.id, tool: a.tool, summary: a.summary, result: a.result, at: a.createdAt.toISOString() })) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const p = await planContext(admin, session.shop);
    if (!atLeast(p.plan, MCP_MIN_PLAN)) throw new Error("Connecting an AI assistant needs the Starter plan or higher.");
    if (form.get("intent") === "revoke") {
      await revokeGrant(session.shop, String(form.get("id")));
      return { ok: true, error: null, token: null, req: null };
    }
    if (form.get("intent") === "pair") {
      // The code shown on the page the assistant opened: it names the waiting request, the store is this signed in one.
      if (tooMany(request, session.shop, "mcp-pair", 10)) throw new Error("Too many tries. Please wait a few minutes.");
      const r = await requestByPairingCode(String(form.get("code") ?? ""));
      if (!r) throw new Error("That code is not right or has expired. Start again from your assistant.");
      return { ok: true, error: null, token: null, req: r.id };
    }
    const scope: McpScope = form.get("scope") === "build" ? "build" : "read";
    const t = await createPersonalToken(session.shop, String(form.get("name") ?? ""), scope, form.get("publish") === "true");
    return { ok: true, error: null, token: t.token, req: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e), token: null, req: null };
  }
};

const when = (iso: string) => new Date(iso).toLocaleString();

export default function Assistant() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [pairCode, setPairCode] = useState("");
  const [name, setName] = useState("This computer");
  const [scope, setScope] = useState("build");
  const [publish, setPublish] = useState(false);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.error) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);
  useEffect(() => {
    if (fetcher.data?.req) navigate(`/app/mcp-connect?req=${encodeURIComponent(fetcher.data.req)}`);
  }, [fetcher.data?.req, navigate]);
  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => shopify.toast.show("Copied"), () => shopify.toast.show("Select the text and copy it", { isError: true }));

  return (
    <s-page heading="Connect an AI assistant" inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app/settings">
        Settings
      </s-link>
      <s-stack gap="base">
        {!d.allowed ? (
          <s-banner tone="info" heading={`Connecting an AI assistant needs the Starter plan or higher (you are on ${d.plan})`}>
            <s-link href={d.planUrl} target="_top">
              Change plan
            </s-link>
          </s-banner>
        ) : null}
        <s-section heading="Claude (claude.ai and Claude Desktop)">
          <s-stack gap="small-200">
            <s-paragraph>Add this address as a custom connector, then sign in when Claude asks. You choose what it may do, inside Shopify. Everything it builds is a draft you publish yourself, unless you allow publishing.</s-paragraph>
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text type="strong">{d.url}</s-text>
              <Button onClick={() => copy(d.url)}>Copy</Button>
            </s-stack>
            <s-text color="subdued">In Claude: Settings, Connectors, Add custom connector. It sees your offers, designs, products and collections, never orders or customers.</s-text>
          </s-stack>
        </s-section>
        {d.allowed ? (
          <s-section heading="Finish connecting">
            <s-stack gap="small-200">
              <s-paragraph>When Claude opens a page that shows a connection code, enter it here to choose what the assistant may do.</s-paragraph>
              <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="end">
                <TextField label="Connection code" value={pairCode} onValue={setPairCode} maxLength={11} />
                <Button variant="primary" loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ intent: "pair", code: pairCode }, { method: "post" })}>
                  Continue
                </Button>
              </s-grid>
            </s-stack>
          </s-section>
        ) : null}
        {d.allowed ? (
          <>
            <s-section heading="Connected">
              {d.grants.length ? (
                <s-stack gap="small-200">
                  {d.grants.map((g) => (
                    <s-stack key={g.id} direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
                      <s-stack gap="small-100">
                        <s-text type="strong">
                          {g.name} <Pill>{g.kind === "token" ? "Personal token" : g.scope === "build" ? (g.allowPublish ? "Build and publish" : "Build drafts") : "Read only"}</Pill>
                        </s-text>
                        <s-text color="subdued">
                          Connected {when(g.createdAt)} · {g.lastUsedAt ? `last used ${when(g.lastUsedAt)}` : "not used yet"}
                        </s-text>
                      </s-stack>
                      <Button tone="critical" variant="tertiary" onClick={() => fetcher.submit({ intent: "revoke", id: g.id }, { method: "post" })}>
                        Disconnect
                      </Button>
                    </s-stack>
                  ))}
                </s-stack>
              ) : (
                <s-paragraph>Nothing is connected.</s-paragraph>
              )}
            </s-section>
            <s-section heading="Personal access token (developer tools)">
              <s-stack gap="base">
                <s-text color="subdued">For tools like Claude Code that send a header: use the address above with the header Authorization: Bearer and the token. The token is shown once.</s-text>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <TextField label="Name" value={name} onValue={setName} maxLength={60} />
                  <Select label="What may it do?" value={scope} onValue={setScope} options={[{ value: "read", label: "Read only" }, { value: "build", label: "Read and build drafts" }]} />
                </s-grid>
                {scope === "build" ? <Checkbox label="Allow publishing" checked={publish} onValue={setPublish} /> : null}
                <s-stack direction="inline">
                  <Button loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ name, scope, publish: String(publish) }, { method: "post" })}>
                    Create token
                  </Button>
                </s-stack>
                {fetcher.data?.token ? (
                  <s-banner tone="success" heading="Copy this token now. It is not shown again.">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-text type="strong">{fetcher.data.token}</s-text>
                      <Button onClick={() => copy(fetcher.data!.token!)}>Copy</Button>
                    </s-stack>
                  </s-banner>
                ) : null}
              </s-stack>
            </s-section>
            <s-section heading="What assistants did (last 100 calls)">
              {d.audit.length ? (
                <s-stack gap="small-100">
                  {d.audit.map((a) => (
                    <s-text key={a.id}>
                      {when(a.at)} · <b>{a.tool}</b> {a.summary ? `(${a.summary})` : ""} · {a.result === "ok" ? "done" : a.result === "rule" ? "refused by a rule" : a.result === "denied" ? "not allowed" : a.result === "limited" ? "slowed down" : "failed"}
                    </s-text>
                  ))}
                </s-stack>
              ) : (
                <s-paragraph>No calls yet.</s-paragraph>
              )}
            </s-section>
          </>
        ) : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
