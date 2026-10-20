import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { alertGroups, clearTold, markTold, waitingEmails } from "../lib/stock.server";
import { getThemeStatus } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { Button } from "../components/fields";
import { PageIntro, Pill } from "../components/ui";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [groups, theme] = await Promise.all([alertGroups(admin, session.shop).catch(() => []), getThemeStatus(admin, session.shop).catch(() => null)]);
  return { groups, inTheme: theme ? theme.installed.stock : null, addLink: sectionLinks(session.shop).stock };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const variantId = String(form.get("variant") ?? "") || undefined;
  try {
    if (intent === "emails") {
      const rows = await waitingEmails(session.shop, variantId);
      return { ok: true, intent, rows: rows.map((r) => ({ email: r.email, product: r.productTitle, variant: r.variantTitle, asked: r.createdAt.toISOString().slice(0, 10) })), format: String(form.get("format") ?? "copy") };
    }
    if (intent === "told" && variantId) return { ok: true, intent, count: await markTold(session.shop, variantId) };
    if (intent === "clear") return { ok: true, intent, count: await clearTold(session.shop) };
    return { ok: false, error: "Unknown action." };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};

const csv = (rows: Record<string, string>[]) => {
  const cols = ["email", "product", "variant", "asked"];
  const q = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
};

export default function StockRequests() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    const d = fetcher.data;
    if (fetcher.state !== "idle" || !d) return;
    if (!d.ok) return void shopify.toast.show(("error" in d && d.error) || "Something went wrong", { isError: true });
    if ("rows" in d && d.rows) {
      if (!d.rows.length) return void shopify.toast.show("Nobody is waiting");
      if (d.format === "csv") {
        const url = URL.createObjectURL(new Blob([csv(d.rows)], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "back-in-stock-requests.csv";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        navigator.clipboard.writeText(d.rows.map((r) => r.email).join(", ")).then(
          () => shopify.toast.show(`${d.rows.length} email${d.rows.length === 1 ? "" : "s"} copied`),
          () => shopify.toast.show("Couldn't copy. Use Download CSV", { isError: true }),
        );
      }
    } else if (d.intent === "told") shopify.toast.show("Marked as told");
    else if (d.intent === "clear") shopify.toast.show("Cleared");
  }, [fetcher.state, fetcher.data, shopify]);

  const run = (fields: Record<string, string>) => fetcher.submit(fields, { method: "post" });
  const waiting = data.groups.reduce((n, g) => n + g.waiting, 0);
  const ready = data.groups.filter((g) => g.inStock && g.waiting > 0);

  return (
    <s-page heading="Back in stock & pre-order" inlineSize="large">
      <CategoryCrumb feature="stock" />
      <DemoButton feature="stock" />
      <Button slot="primary-action" variant="primary" href="/app/designs/stock">
        Style
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to product page"}
      </Button>
      <s-stack gap="base">
        <FeatureTabs feature="stock" />
        <PageIntro text="Shoppers ask to hear when a sold out product is back, and can pre order items that are out of stock but still for sale." />
        {data.inTheme === false ? (
          <s-banner tone="warning" heading="Not on your product page yet">
            Add the “Back in stock &amp; pre-order” block under the Add to cart button in the theme editor.
          </s-banner>
        ) : null}
        {ready.length ? (
          <s-banner tone="success" heading={`${ready.reduce((n, g) => n + g.waiting, 0)} people are waiting for products that are back in stock`}>
            Copy their emails below and let them know.
          </s-banner>
        ) : null}
        <s-section heading={data.groups.length ? `${waiting} waiting · ${data.groups.length} variant${data.groups.length === 1 ? "" : "s"}` : "No requests yet"}>
          {data.groups.length ? (
            <s-stack gap="small-300">
              <s-stack direction="inline" gap="small-200">
                <Button icon="clipboard" onClick={() => run({ intent: "emails", format: "copy" })}>
                  Copy all waiting emails
                </Button>
                <Button icon="export" onClick={() => run({ intent: "emails", format: "csv" })}>
                  Download CSV
                </Button>
                <Button variant="tertiary" onClick={() => run({ intent: "clear" })}>
                  Remove people already told
                </Button>
              </s-stack>
              {data.groups.map((g) => (
                <s-box key={g.variantId} padding="small-300" borderWidth="base" borderRadius="base">
                  <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <s-stack gap="small-100">
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-text type="strong">{g.productTitle || "Product"}</s-text>
                        {g.variantTitle && g.variantTitle !== "Default Title" ? <s-text color="subdued">{g.variantTitle}</s-text> : null}
                        {g.inStock === null ? null : g.inStock ? <Pill tone="ok">Back in stock{g.quantity !== null ? ` · ${g.quantity}` : ""}</Pill> : <Pill tone="muted">Sold out</Pill>}
                      </s-stack>
                      <s-text color="subdued">
                        {g.waiting} waiting{g.told ? ` · ${g.told} already told` : ""}
                      </s-text>
                    </s-stack>
                    {g.waiting ? (
                      <s-stack direction="inline" gap="small-200">
                        <Button onClick={() => run({ intent: "emails", variant: g.variantId, format: "copy" })}>Copy emails</Button>
                        <Button variant={g.inStock ? "primary" : "secondary"} onClick={() => run({ intent: "told", variant: g.variantId })}>
                          Mark as told
                        </Button>
                      </s-stack>
                    ) : null}
                  </s-stack>
                </s-box>
              ))}
            </s-stack>
          ) : (
            <s-paragraph>When a shopper asks to hear about a sold-out product, it shows here.</s-paragraph>
          )}
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
