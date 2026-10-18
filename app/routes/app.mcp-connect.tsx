/**
 * The merchant's "yes" for an AI assistant that started connecting (mcp.authorize). Inside the admin, so
 * the merchant is signed in: they choose read only or read and build, and whether it may publish.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { atLeast } from "../lib/plans";
import { planContext } from "../lib/rules.server";
import { approveRequest, denyRequest, getRequest, type McpScope } from "../lib/mcp/auth.server";
import { MCP_MIN_PLAN } from "../lib/mcp/server.server";
import { errorMessage } from "../lib/admin.server";
import { tooMany } from "../lib/proxy-guard.server";
import { Button, Checkbox, Select } from "../components/fields";

// Opened from the "Open CRO Toolbox in Shopify" button on /mcp/authorize (?req=...): the request is already chosen, so Allow is one click.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const req = new URL(request.url).searchParams.get("req") ?? "";
  const [pending, p] = await Promise.all([req ? getRequest(req) : null, planContext(admin, session.shop)]);
  return { req, clientName: pending?.clientName ?? "", expired: !pending, shop: session.shop, allowed: atLeast(p.plan, MCP_MIN_PLAN), planUrl: p.planUrl };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const req = String(form.get("req") ?? "");
  try {
    if (tooMany(request, session.shop, "mcp-connect", 20)) throw new Error("Too many tries. Please wait a few minutes.");
    if (form.get("intent") === "deny") return { ok: true, error: null, url: await denyRequest(req), denied: true };
    const p = await planContext(admin, session.shop);
    if (!atLeast(p.plan, MCP_MIN_PLAN)) throw new Error("Connecting an AI assistant needs the Starter plan or higher.");
    const scope: McpScope = form.get("scope") === "build" ? "build" : "read";
    const url = await approveRequest(req, session.shop, scope, form.get("publish") === "true");
    return { ok: true, error: null, url, denied: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), url: null, denied: false };
  }
};

export default function McpConnect() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [scope, setScope] = useState("build");
  const [publish, setPublish] = useState(false);
  const done = fetcher.data?.ok ? fetcher.data : null;
  // Back to the assistant: a top level jump; the button below is the fallback when the browser blocks it.
  useEffect(() => {
    if (done?.url) window.open(done.url, "_top");
  }, [done?.url]);

  return (
    <s-page heading="Connect an AI assistant" inlineSize="small">
      <s-link slot="breadcrumb-actions" href="/app/settings">
        Settings
      </s-link>
      <s-section>
        {done ? (
          <s-stack gap="base">
            <s-text type="strong">{done.denied ? "No access was given." : "Connected."}</s-text>
            {done.url ? (
              <s-link href={done.url} target="_top">
                {done.denied ? "Back to your assistant" : "Return to your assistant"}
              </s-link>
            ) : null}
          </s-stack>
        ) : d.expired ? (
          <s-banner tone="warning" heading="This connection request expired">
            Start it again from your assistant.
          </s-banner>
        ) : !d.allowed ? (
          <s-stack gap="base">
            <s-banner tone="warning" heading="Connecting an AI assistant needs the Starter plan or higher" />
            <Button href={d.planUrl} target="_top" variant="primary">
              See plans
            </Button>
          </s-stack>
        ) : (
          <s-stack gap="base">
            <s-paragraph>
              <b>{d.clientName}</b> wants to work with CRO Toolbox on <b>{d.shop}</b>. It can see your offers, designs, products and collections, never your orders or customers.
            </s-paragraph>
            <Select label="What may it do?" value={scope} onValue={setScope} options={[{ value: "read", label: "Read only" }, { value: "build", label: "Read and build (everything it builds is a draft)" }]} />
            {scope === "build" ? <Checkbox label="Allow publishing" checked={publish} onValue={setPublish} /> : null}
            <s-text color="subdued">{scope === "build" && publish ? "It can also make its drafts live on your store." : "Nothing it builds goes live until you publish it in the app."} You can disconnect it any time in Settings.</s-text>
            {fetcher.data?.error ? <s-banner tone="critical" heading={fetcher.data.error} /> : null}
            <s-stack direction="inline" gap="small-200">
              <Button variant="primary" loading={fetcher.state !== "idle"} onClick={() => fetcher.submit({ req: d.req, scope, publish: String(publish) }, { method: "post" })}>
                Allow
              </Button>
              <Button variant="tertiary" onClick={() => fetcher.submit({ req: d.req, intent: "deny" }, { method: "post" })}>
                Don&apos;t allow
              </Button>
            </s-stack>
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
