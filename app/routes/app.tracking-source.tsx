/**
 * Tracking & Returns → where tracking comes from (setup step 1): Shopify data, live tracking (Pro), the
 * merchant's own key, or a webhook link. The provider is never named; key steps are generic.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { planContext } from "../lib/rules.server";
import { atLeast } from "../lib/plans";
import { isRuleError } from "../lib/rules";
import { LIVE_MONTHLY_LIMIT, type TrackSource } from "../lib/tracking";
import { getTrackingConfig, regenerateSecret, removeKey, saveKey, saveSource } from "../lib/tracking/tracking.server";
import { Button, PasswordField } from "../components/fields";
import { Pill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { plan } = await planContext(admin, session.shop);
  return { cfg: await getTrackingConfig(session.shop, plan), pro: atLeast(plan, "pro") };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const { plan } = await planContext(admin, session.shop);
    const intent = String(form.get("intent"));
    if (intent === "source") await saveSource(session.shop, plan, String(form.get("source")));
    else if (intent === "key") await saveKey(session.shop, plan, String(form.get("key")));
    else if (intent === "remove-key") await removeKey(session.shop);
    else if (intent === "secret") await regenerateSecret(session.shop);
    else throw new Error("Unknown action.");
    return { ok: true, error: null, intent, upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: "", upgrade: isRuleError(e) && e.upgrade };
  }
};

const CHOICES: { key: TrackSource; title: string; text: string }[] = [
  { key: "shopify", title: "Shopify's tracking data", text: "Free, every country. Shows the status, tracking number, estimated delivery and any events Shopify has for the shipment." },
  { key: "live", title: "Live tracking", text: `Included on Pro, up to ${LIVE_MONTHLY_LIMIT} shipments a month. Shows where the parcel is now and the full history, from most carriers worldwide. Over the limit, the page uses Shopify's data.` },
  { key: "own", title: "Your own key", text: "Paste a key from your shipping company or tracking service. No limit from us." },
  { key: "webhook", title: "Webhook link", text: "For carriers or services that send you updates. Give them the link and every update shows on the Track page." },
];

export default function TrackingSource() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [key, setKey] = useState("");
  // A key that was accepted is not kept in the box.
  const [seen, setSeen] = useState(d.cfg.keyLast4);
  if (seen !== d.cfg.keyLast4) {
    setSeen(d.cfg.keyLast4);
    setKey("");
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) return void shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    shopify.toast.show(fetcher.data.intent === "key" ? "Connected" : "Saved");
  }, [fetcher.state, fetcher.data, shopify]);
  const busy = fetcher.state !== "idle";
  // The key error stays next to the field (the toast comes and goes).
  const keyFailed = !!fetcher.data && !fetcher.data.ok && !!key.trim();
  const choose = (source: TrackSource) => fetcher.submit({ intent: "source", source }, { method: "post" });
  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => shopify.toast.show("Copied"), () => shopify.toast.show("Select the text and copy it", { isError: true }));

  return (
    <s-page heading="Where should tracking come from?" inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app/tracking-returns">
        Tracking &amp; Returns
      </s-link>
      <Button slot="primary-action" href="/app/tracking-returns">
        Back to Tracking &amp; Returns
      </Button>
      <s-stack gap="base">
        <s-text color="subdued">The Track page always shows the carrier&apos;s tracking link too. You can change this any time.</s-text>
        {CHOICES.map((c) => {
          const locked = c.key === "live" && !d.pro;
          const on = d.cfg.source === c.key;
          return (
            <s-section key={c.key} heading={c.title}>
              <s-stack gap="small-200">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  {on ? <Pill tone="ok">In use</Pill> : locked ? <Pill>Pro plan</Pill> : null}
                </s-stack>
                <s-text color="subdued">{c.text}</s-text>
                {c.key === "live" && d.pro ? <s-text color="subdued">{`${d.cfg.live.used} of ${d.cfg.live.limit} shipments used this month`}</s-text> : null}
                {c.key === "own" ? (
                  <s-stack gap="small-200">
                    {d.cfg.hasKey ? (
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <Pill tone="ok">Connected</Pill>
                        <s-text color="subdued">{`Key ending ${d.cfg.keyLast4}`}</s-text>
                        <Button variant="tertiary" tone="critical" onClick={() => fetcher.submit({ intent: "remove-key" }, { method: "post" })}>
                          Remove
                        </Button>
                      </s-stack>
                    ) : null}
                    <s-text color="subdued">Sign in to your shipping company or tracking service, open Settings, then API or Developers, create a key and paste it here. We test it before saving.</s-text>
                    <PasswordField label={d.cfg.hasKey ? "Replace the key" : "Key"} value={key} onValue={setKey} error={keyFailed && !busy ? fetcher.data?.error ?? undefined : undefined} />
                    <s-stack direction="inline">
                      <Button loading={busy && fetcher.formData?.get("intent") === "key"} disabled={!key.trim()} onClick={() => fetcher.submit({ intent: "key", key }, { method: "post" })}>
                        Test and save
                      </Button>
                    </s-stack>
                  </s-stack>
                ) : null}
                {c.key === "webhook" && d.cfg.webhookUrl ? (
                  <s-stack gap="small-200">
                    <s-text type="strong">{d.cfg.webhookUrl}</s-text>
                    <s-stack direction="inline" gap="small-200">
                      <Button onClick={() => copy(d.cfg.webhookUrl)}>Copy</Button>
                      <Button variant="tertiary" onClick={() => fetcher.submit({ intent: "secret" }, { method: "post" })}>
                        Make a new link
                      </Button>
                    </s-stack>
                    <s-text color="subdued">Send a POST with JSON: number, status (info, transit, out, delivered or problem), estimated, and events (status, city, province, country, message, at). A new link stops the old one.</s-text>
                  </s-stack>
                ) : null}
                <s-stack direction="inline">
                  {on ? null : locked ? (
                    <Button href="/app/plans" variant="primary">
                      See plans
                    </Button>
                  ) : (
                    <Button loading={busy && fetcher.formData?.get("source") === c.key} disabled={c.key === "own" && !d.cfg.hasKey} onClick={() => choose(c.key)}>
                      Use this
                    </Button>
                  )}
                </s-stack>
              </s-stack>
            </s-section>
          );
        })}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

/** A save that did not change anything (a key that failed its test) leaves the page as it is. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ actionResult, defaultShouldRevalidate }) => (actionResult && (actionResult as { ok?: boolean }).ok === false ? false : defaultShouldRevalidate);
