import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { listReturns, setReturnStatus } from "../lib/orders-lookup.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { Button } from "../components/fields";
import { Explainer, Pill } from "../components/ui";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [returns, theme] = await Promise.all([listReturns(session.shop).catch(() => []), getThemeStatus(admin, session.shop).catch(() => null)]);
  return { returns, shop: session.shop, inTheme: theme ? theme.installed.returns : null, addLink: sectionLinks(session.shop).returns };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const status = String(form.get("status"));
  if (!["pending", "approved", "declined", "done"].includes(status)) return { ok: false, error: "Unknown status." };
  try {
    await setReturnStatus(session.shop, Number(form.get("id")), status as "pending" | "approved" | "declined" | "done");
    return { ok: true, error: null, status };
  } catch (e) {
    return { ok: false, error: errorMessage(e), status: null };
  }
};

const LABEL: Record<string, { text: string; tone: "ok" | "warn" | "muted" }> = {
  pending: { text: "New", tone: "warn" },
  approved: { text: "Approved", tone: "ok" },
  declined: { text: "Declined", tone: "muted" },
  done: { text: "Done", tone: "muted" },
};

export default function ReturnRequests() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show(`Marked as ${LABEL[fetcher.data.status ?? "pending"].text.toLowerCase()}`);
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);
  const set = (id: number, status: string) => fetcher.submit({ id: String(id), status }, { method: "post" });
  const fresh = data.returns.filter((r) => r.status === "pending").length;
  const orderLink = (id: string) => `https://${data.shop}/admin/orders/${id.split("/").pop()}`;

  return (
    <s-page heading="Returns" inlineSize="large">
      <CategoryCrumb feature="returns" />
      <Button slot="primary-action" variant="primary" href="/app/pages/returns">
        Design the page
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to a page"}
      </Button>
      <s-stack gap="base">
        <FeatureTabs feature="returns" />
        <Explainer
          what="A Returns page for your store: shoppers find their order with its number and email, choose the items and a reason."
          how="Requests arrive here. Open the order in Shopify to arrange the return or refund, then mark the request approved, declined or done, and email the shopper the next steps."
          example="Order #1042: 1 × Linen shirt (Medium), “Wrong size”. You approve it and send the return address."
        />
        {fresh ? <s-banner tone="warning" heading={`${fresh} new return request${fresh === 1 ? "" : "s"}`} /> : null}
        <s-section heading={data.returns.length ? `${data.returns.length} request${data.returns.length === 1 ? "" : "s"}` : "No return requests yet"}>
          {data.returns.length ? (
            <s-stack gap="small-300">
              {data.returns.map((r) => (
                <s-box key={r.id} padding="small-300" borderWidth="base" borderRadius="base">
                  <s-stack gap="small-200">
                    <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-link href={orderLink(r.orderId)} target="_top">
                          {r.orderName}
                        </s-link>
                        <Pill tone={LABEL[r.status]?.tone ?? "muted"}>{LABEL[r.status]?.text ?? r.status}</Pill>
                        <s-text color="subdued">
                          {new Date(r.createdAt).toLocaleDateString()} · {r.email}
                        </s-text>
                      </s-stack>
                      <s-stack direction="inline" gap="small-200">
                        {r.status !== "approved" ? <Button onClick={() => set(r.id, "approved")}>Approve</Button> : null}
                        {r.status !== "declined" ? (
                          <Button variant="tertiary" onClick={() => set(r.id, "declined")}>
                            Decline
                          </Button>
                        ) : null}
                        {r.status !== "done" ? (
                          <Button variant="tertiary" onClick={() => set(r.id, "done")}>
                            Done
                          </Button>
                        ) : null}
                      </s-stack>
                    </s-stack>
                    <s-text>
                      {r.items.map((i) => `${i.quantity} × ${i.title}${i.variant ? ` (${i.variant})` : ""}`).join(", ")}: <b>{r.reason}</b>
                    </s-text>
                    {r.note ? <s-text color="subdued">“{r.note}”</s-text> : null}
                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          ) : (
            <s-paragraph>When a shopper sends a return request from your Returns page, it shows here.</s-paragraph>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
