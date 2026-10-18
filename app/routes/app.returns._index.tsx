/**
 * Returns (Tracking & Returns): the shoppers' requests as real Shopify returns. Approve or decline,
 * attach the return label (a link to the file) or tracking (Shopify emails it to the shopper), refund,
 * close. Rules: /app/returns/rules; the page shoppers use: /app/pages/returns.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getReturn, listReturns, updateReturn } from "../lib/orders-lookup.server";
import { attachLabel, closeReturn, declineReturn, getReturnRules, refundPlan, refundReturn, syncReturns } from "../lib/shopify-returns.server";
import { approveAndSettle, giveCreditOnReceipt } from "../lib/return-saving.server";
import { releaseExchange } from "../lib/return-exchange.server";
import { parseExchange } from "../lib/return-exchange";
import { planContext } from "../lib/rules.server";
import { atLeast } from "../lib/plans";
import { getThemeStatus } from "../lib/cro.server";
import { orderPageContext } from "../lib/order-page-setup.server";
import { RETURN_STATES, returnState } from "../lib/return-rules";
import { Button, TextField } from "../components/fields";
import { Explainer, Pill } from "../components/ui";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await syncReturns(admin, session.shop).catch(() => null);
  const [returns, theme] = await Promise.all([listReturns(session.shop).catch(() => []), getThemeStatus(admin, session.shop).catch(() => null)]);
  const ctx = await orderPageContext(admin, session.shop, theme);
  return { returns, shop: session.shop, inTheme: theme ? ctx.inPageTemplate && !!ctx.pages.returns : null, addLink: ctx.links.returns, creditWhen: (await getReturnRules(admin).catch(() => null))?.rules.saving.creditWhen ?? "received" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = Number(form.get("id"));
  try {
    const row = await getReturn(session.shop, id);
    if (!row) throw new Error("This request no longer exists. Reload the page.");
    // Requests made before returns became Shopify returns have no Shopify return: they only get marked.
    const shopifyId = row.returnId;
    if (intent === "approve") {
      // Approves; when the shopper chose store credit (Pro), gives it and processes the return.
      const { plan } = await planContext(admin, session.shop);
      const { rules } = await getReturnRules(admin);
      await approveAndSettle(admin, session.shop, id, rules, atLeast(plan, "pro"));
    } else if (intent === "credit-now") {
      // The items arrived: gives the store credit (and processes the return).
      const { plan } = await planContext(admin, session.shop);
      const { rules } = await getReturnRules(admin);
      await giveCreditOnReceipt(admin, session.shop, id, rules, atLeast(plan, "pro"));
    } else if (intent === "decline") {
      const note = String(form.get("note") ?? "").trim();
      if (shopifyId) await declineReturn(admin, shopifyId, note);
      await updateReturn(session.shop, id, { status: "declined", declineNote: note });
    } else if (intent === "label") {
      if (!shopifyId) throw new Error("Add the label in the Shopify admin: this request was made before returns used Shopify.");
      const labelUrl = String(form.get("labelUrl") ?? "").trim();
      const tracking = String(form.get("tracking") ?? "").trim();
      const trackingUrl = String(form.get("trackingUrl") ?? "").trim();
      if (!labelUrl && !tracking && !trackingUrl) throw new Error("Add a link to the label or a tracking number.");
      for (const u of [labelUrl, trackingUrl]) if (u && !/^https:\/\/\S+$/.test(u)) throw new Error("Links must start with https://");
      await attachLabel(admin, shopifyId, { labelUrl, tracking, trackingUrl });
      await updateReturn(session.shop, id, { labelUrl, tracking, trackingUrl });
    } else if (intent === "refund-quote") {
      // The amount Shopify would refund, shown before the merchant confirms.
      if (!shopifyId) throw new Error("Refund it in the Shopify admin: this request was made before returns used Shopify.");
      const plan = await refundPlan(admin, shopifyId);
      return { ok: true, error: null, intent, quote: { amount: plan.amount, currency: plan.currency } };
    } else if (intent === "refund") {
      if (!shopifyId) throw new Error("Refund it in the Shopify admin: this request was made before returns used Shopify.");
      const { rules } = await getReturnRules(admin);
      await refundReturn(admin, shopifyId, { restock: rules.saving.restock });
      // Marked refunded before closing: the returns/close webhook must not read this as "items received" and give credit too.
      await updateReturn(session.shop, id, { status: "refunded", refundedAt: new Date() });
      await closeReturn(admin, shopifyId).catch(() => null);
    } else if (intent === "ship-exchange") {
      // The items arrived: let the exchange ship.
      await releaseExchange(admin, session.shop, id);
    } else if (intent === "close") {
      // Marked closed first: closing in Shopify sends the returns/close webhook, which must not read this as "items received".
      await updateReturn(session.shop, id, { status: "closed" });
      if (shopifyId) await closeReturn(admin, shopifyId).catch(() => null);
    } else throw new Error("Unknown action.");
    return { ok: true, error: null, intent, quote: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent, quote: null };
  }
};

const DONE: Record<string, string> = { "credit-now": "The credit was given and the return processed.", approve: "Approved. Shopify emailed the shopper (credit is given now or when the items arrive, as set in Return saving rules; an exchange waits on hold until you say the items arrived).", "ship-exchange": "The exchange can ship now.", decline: "Declined. Shopify emailed the shopper.", label: "Label added. Shopify emailed it to the shopper.", refund: "Refunded. Shopify emailed the shopper.", close: "Closed" };

function Card({ r, shop, creditWhen }: { r: Awaited<ReturnType<typeof loader>>["returns"][number]; shop: string; creditWhen: string }) {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [declining, setDeclining] = useState(false);
  // Refund asks first: the amount Shopify will refund, then Confirm.
  const [dismissed, setDismissed] = useState<unknown>(null);
  const [note, setNote] = useState("");
  const [label, setLabel] = useState({ labelUrl: r.labelUrl, tracking: r.tracking, trackingUrl: r.trackingUrl });
  const busy = fetcher.state !== "idle";
  const confirmRefund = fetcher.data?.ok && fetcher.data.intent === "refund-quote" && fetcher.data !== dismissed ? fetcher.data.quote : null;
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok && fetcher.data.intent === "refund-quote") return;
    if (fetcher.data.ok) shopify.toast.show(DONE[fetcher.data.intent] ?? "Saved");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);
  const [uploading, setUploading] = useState(false);
  // Uploads the label file to Content → Files and puts its link in the box (Shopify emails the link).
  async function upload(file: File) {
    setUploading(true);
    try {
      const post = async (body: Record<string, string>) => (await (await fetch("/app/returns/label", { method: "POST", body: new URLSearchParams(body) })).json()) as { ok: boolean; error?: string; target?: { url: string; resourceUrl: string; parameters: { name: string; value: string }[]; image: boolean }; id?: string; url?: string | null };
      const start = await post({ intent: "start", filename: file.name, mimeType: file.type, fileSize: String(file.size) });
      if (!start.ok || !start.target) throw new Error(start.error || "Could not start the upload.");
      const body = new FormData();
      for (const p of start.target.parameters) body.append(p.name, p.value);
      body.append("file", file);
      const sent = await fetch(start.target.url, { method: "POST", body });
      if (!sent.ok) throw new Error("The upload did not go through. Please try again.");
      const done = await post({ intent: "finish", resourceUrl: start.target.resourceUrl, image: String(start.target.image) });
      if (!done.ok || !done.id) throw new Error(done.error || "Could not save the file.");
      for (let i = 0; i < 12; i++) {
        const st = await post({ intent: "status", id: done.id });
        if (!st.ok) throw new Error(st.error || "Could not read the file.");
        if (st.url) {
          setLabel((l) => ({ ...l, labelUrl: st.url! }));
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw new Error("Shopify is still processing the file. Try again in a minute.");
    } catch (e) {
      shopify.toast.show(e instanceof Error ? e.message : "Upload failed", { isError: true });
    } finally {
      setUploading(false);
    }
  }
  const send = (intent: string, extra: Record<string, string> = {}) => fetcher.submit({ intent, id: String(r.id), ...extra }, { method: "post" });
  const state = returnState(r.status);
  const meta = RETURN_STATES[state];
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-link href={`https://${shop}/admin/orders/${r.orderId.split("/").pop()}`} target="_top">
              {r.orderName}
            </s-link>
            {r.returnName ? <s-text color="subdued">{r.returnName}</s-text> : null}
            <Pill tone={meta.tone}>{meta.text}</Pill>
            <s-text color="subdued">
              {new Date(r.createdAt).toLocaleDateString()} · {r.email}
            </s-text>
          </s-stack>
          <s-stack direction="inline" gap="small-200">
            {state === "requested" ? (
              <>
                <Button variant="primary" loading={busy} onClick={() => send("approve")}>
                  Approve
                </Button>
                <Button variant="tertiary" onClick={() => setDeclining((d) => !d)}>
                  Decline
                </Button>
              </>
            ) : null}
            {state === "approved" && r.resolution === "exchange" ? (
              <>
                <Button variant="primary" loading={busy} onClick={() => send("ship-exchange")}>
                  Items arrived: ship the exchange
                </Button>
                <Button variant="tertiary" onClick={() => send("close")}>
                  Close
                </Button>
              </>
            ) : null}
            {state === "approved" && r.resolution === "credit" ? (
              <Button variant="primary" loading={busy} onClick={() => send("credit-now")}>
                Items received: give the credit
              </Button>
            ) : null}
            {state === "approved" && r.resolution !== "exchange" ? (
              <>
                <Button variant={r.resolution === "credit" ? "secondary" : "primary"} loading={busy} onClick={() => send("refund-quote")}>
                  Refund
                </Button>
                <Button variant="tertiary" onClick={() => send("close")}>
                  Close
                </Button>
              </>
            ) : null}
            {state === "refunded" || state === "credited" || state === "exchanged" ? (
              <Button variant="tertiary" onClick={() => send("close")}>
                Close
              </Button>
            ) : null}
          </s-stack>
        </s-stack>
        <s-text>
          {r.items.map((i) => `${i.quantity} × ${i.title}${i.variant ? ` (${i.variant})` : ""}`).join(", ")}: <b>{r.reason}</b>
        </s-text>
        {r.resolution === "exchange" ? (
          <s-stack gap="small-100">
            {(parseExchange(r.exchange)?.lines ?? []).map((l, i) => (
              <s-text key={i} color="subdued">
                Exchange: {l.qty} × {l.title}{l.from ? ` (${l.from})` : ""} for {l.to}
              </s-text>
            ))}
            {(() => {
              const diff = parseExchange(r.exchange)?.diff ?? 0;
              return <s-text color="subdued">{Math.abs(diff) < 0.005 ? "An even exchange." : diff > 0 ? `The shopper owes ${diff.toFixed(2)} ${r.currency}: send them an invoice from the order in Shopify, the shipment stays on hold until it is paid.` : `${(-diff).toFixed(2)} ${r.currency} is refunded to the shopper when you approve.`}</s-text>;
            })()}
          </s-stack>
        ) : null}
        {r.resolution === "credit" ? (
          <s-text color="subdued">
            {r.creditKind
              ? `Paid back with ${r.creditKind === "store_credit" ? "store credit" : r.creditKind === "gift_card" ? "a gift card" : "a discount code"}: ${r.creditAmount.toFixed(2)} ${r.currency}${r.creditCode ? ` (${r.creditCode})` : ""}.`
              : `The shopper chose store credit${r.quote ? ` (about ${r.quote.toFixed(2)} ${r.currency} of items${r.creditBonus ? `, plus a ${r.creditBonus}% bonus` : ""})` : ""}. ${creditWhen === "received" ? "It is given when you click “Items received”. The shopper is told it is sent once you have the items." : "It is given when you approve."}`}
          </s-text>
        ) : null}
        {r.note ? <s-text color="subdued">“{r.note}”</s-text> : null}
        {r.declineNote ? <s-text color="subdued">Declined: {r.declineNote}</s-text> : null}
        {!r.returnId && r.resolution !== "exchange" ? <s-text color="subdued">Made before returns used Shopify. Arrange the return and refund in the Shopify admin.</s-text> : null}
        {confirmRefund ? (
          <s-banner tone="warning" heading={`Refund ${confirmRefund.amount.toFixed(2)} ${confirmRefund.currency} to the original payment?`}>
            <s-stack direction="inline" gap="small-200">
              <Button variant="primary" tone="critical" loading={busy} onClick={() => send("refund")}>
                Refund {confirmRefund.amount.toFixed(2)} {confirmRefund.currency}
              </Button>
              <Button variant="tertiary" onClick={() => setDismissed(fetcher.data)}>
                Cancel
              </Button>
            </s-stack>
          </s-banner>
        ) : null}
        {declining ? (
          <s-stack gap="small-200">
            <TextField label="Message to the shopper (optional)" value={note} onValue={setNote} maxLength={500} />
            <s-stack direction="inline">
              <Button tone="critical" loading={busy} onClick={() => { send("decline", { note }); setDeclining(false); }}>
                Decline this return
              </Button>
            </s-stack>
          </s-stack>
        ) : null}
        {state === "approved" && r.returnId && r.resolution !== "exchange" ? (
          <s-stack gap="small-200">
            <s-text type="strong">Return label</s-text>
            <s-text color="subdued">Upload your label (a PDF or a picture), or paste a link to it, and/or add a tracking number. Shopify emails it to the shopper.</s-text>
            <input type="file" accept="application/pdf,image/*" disabled={uploading} aria-label="Upload the return label" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {uploading ? <s-text color="subdued">Uploading…</s-text> : null}
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="small-200">
              <TextField label="Link to the label" placeholder="https://" value={label.labelUrl} onValue={(v) => setLabel({ ...label, labelUrl: v })} />
              <TextField label="Tracking number" value={label.tracking} onValue={(v) => setLabel({ ...label, tracking: v })} />
              <TextField label="Tracking link" placeholder="https://" value={label.trackingUrl} onValue={(v) => setLabel({ ...label, trackingUrl: v })} />
            </s-grid>
            <s-stack direction="inline">
              <Button loading={busy} onClick={() => send("label", label)}>
                {r.labelUrl || r.tracking ? "Send again" : "Send to the shopper"}
              </Button>
            </s-stack>
          </s-stack>
        ) : null}
      </s-stack>
    </s-box>
  );
}

export default function ReturnRequests() {
  const data = useLoaderData<typeof loader>();
  const fresh = data.returns.filter((r) => returnState(r.status) === "requested").length;
  return (
    <s-page heading="Returns" inlineSize="large">
      <CategoryCrumb feature="returns" />
      <DemoButton feature="returns" />
      <Button slot="primary-action" variant="primary" href="/app/returns/rules">
        Return rules
      </Button>
      <Button slot="secondary-actions" href={data.addLink} target="_top" icon="theme-edit">
        {data.inTheme ? "Open in theme editor" : "Add to a page"}
      </Button>
      <s-stack gap="base">
        <FeatureTabs feature="returns" />
        <Explainer
          what="Shoppers ask for a return on your Returns page. Each request is a real Shopify return."
          how="Approve or decline it (Shopify emails the shopper), send the return label, then refund when the items arrive. Rules decide which requests are approved at once."
          example="Order #1042: 1 × Linen shirt (Medium), “Wrong size”. You approve it, add your label link and refund it when it arrives."
        />
        {fresh ? <s-banner tone="warning" heading={`${fresh} new return request${fresh === 1 ? "" : "s"}`} /> : null}
        <s-section heading={data.returns.length ? `${data.returns.length} request${data.returns.length === 1 ? "" : "s"}` : "No return requests yet"}>
          {data.returns.length ? (
            <s-stack gap="small-300">
              {data.returns.map((r) => (
                <Card key={r.id} r={r} shop={data.shop} creditWhen={data.creditWhen} />
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
