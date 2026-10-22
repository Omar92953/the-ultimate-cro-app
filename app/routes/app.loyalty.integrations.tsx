/**
 * Loyalty → Integrations: Klaviyo and Omnisend get every loyalty event and the member's points on their
 * profile (for the store's own flows); Judge.me reviews earn review points. Keys are checked with the service,
 * stored encrypted and shown as their last 4 characters. Server side: lib/loyalty/integrations.server.ts.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getProgram } from "../lib/loyalty/program.server";
import db from "../db.server";
import { connect, disconnect, integrationList, setIntegrationOn } from "../lib/loyalty/integrations.server";
import { EVENT_NAMES, INTEGRATIONS, INTEGRATION_INFO, type IntegrationKind } from "../lib/loyalty/integrations";
import { Button, PasswordField, Switch } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Pill } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { loyaltyAccess } from "../lib/loyalty/plan.server";
import { ProNote } from "../components/ProNote";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [list, p, flow, access] = await Promise.all([integrationList(session.shop), getProgram(session.shop), db.loyaltyIntegration.findUnique({ where: { shop_kind: { shop: session.shop, kind: "flow" } }, select: { on: true } }), loyaltyAccess(admin, session.shop)]);
  return { pro: access.pro, list, reviewsOn: p.config.earn.review.on, events: [...new Set(Object.values(EVENT_NAMES))], flowOn: !!flow?.on };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const kind = String(form.get("kind")) as IntegrationKind;
  if (!(INTEGRATIONS as readonly string[]).includes(kind)) return { ok: false, error: "Unknown service", message: "" };
  try {
    if (intent === "connect" && !(await loyaltyAccess(admin, session.shop)).pro) throw new Error("Integrations are on the Pro plan.");
    if (intent === "connect") await connect(session.shop, kind, String(form.get("key") ?? ""));
    else if (intent === "on") await setIntegrationOn(session.shop, kind, form.get("on") === "true");
    else if (intent === "disconnect") await disconnect(session.shop, kind);
    const name = INTEGRATION_INFO[kind].title;
    return { ok: true, error: null, message: intent === "connect" ? `${name} connected` : intent === "disconnect" ? `${name} disconnected` : "Saved" };
  } catch (e) {
    return { ok: false, error: errorMessage(e), message: "" };
  }
};

const ABOUT: Record<IntegrationKind, string> = {
  klaviyo: "Every loyalty event goes to Klaviyo with the member's points, tier and referral code on their profile. Use them in your own Klaviyo flows and segments.",
  omnisend: "Every loyalty event goes to Omnisend with the member's points, tier and referral code on the contact. Use them in your own Omnisend automations.",
  judgeme: "Reviews published on Judge.me earn review points for the member with the reviewer's email (set the points on Earn points). Reviews from before connecting don't count.",
};

export default function LoyaltyIntegrations() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [keys, setKeys] = useState<Record<string, string>>({});
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not done", { isError: true, duration: 8000 });
    else shopify.toast.show(fetcher.data.message || "Saved");
  }, [fetcher.state, fetcher.data, shopify]);
  const busy = (intent: string, kind: string) => fetcher.state !== "idle" && fetcher.formData?.get("intent") === intent && fetcher.formData?.get("kind") === kind;

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="Connect the tools you already use. Your keys are stored encrypted and only their last 4 characters are shown." />
        {d.pro ? null : <ProNote text="Klaviyo, Omnisend, Judge.me and Shopify Flow work on the Pro plan. Product reviews from Customer reviews earn points on your plan too." />}

        {INTEGRATIONS.map((k) => {
          const s = d.list[k];
          const info = INTEGRATION_INFO[k];
          return (
            <HomeRow key={k} title={info.title} action={s.connected ? <Pill tone={s.on && !s.error ? "ok" : "warn"}>{s.error ? "Needs attention" : s.on ? "Connected" : "Paused"}</Pill> : <Pill>Not connected</Pill>}>
              <s-stack gap="base">
                <s-text>{ABOUT[k]}</s-text>
                {s.error ? (
                  <s-banner tone="critical" heading={`${info.title} needs attention`}>
                    <s-paragraph>{s.error}</s-paragraph>
                  </s-banner>
                ) : null}
                {k === "judgeme" && !d.reviewsOn ? <s-text color="subdued">Review points are off. Turn them on in Earn points → Product reviews.</s-text> : null}
                {s.connected ? (
                  <s-stack gap="small-200">
                    <s-text color="subdued">{`Key ending in ${s.last4}${k === "judgeme" ? "" : `. Last 30 days: ${s.sent} events sent${s.failed ? `, ${s.failed} failed` : ""}.`}`}</s-text>
                    <s-stack direction="inline" gap="base" alignItems="center">
                      <Switch label={s.on ? "On" : "Off"} checked={s.on} onValue={(v) => fetcher.submit({ intent: "on", kind: k, on: String(v) }, { method: "post" })} />
                      <Button variant="tertiary" tone="critical" loading={busy("disconnect", k)} onClick={() => fetcher.submit({ intent: "disconnect", kind: k }, { method: "post" })}>
                        Disconnect
                      </Button>
                    </s-stack>
                  </s-stack>
                ) : null}
                <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="end">
                  <PasswordField label={s.connected ? `New ${info.key.toLowerCase()}` : info.key} details={info.where} value={keys[k] ?? ""} onValue={(v) => setKeys((x) => ({ ...x, [k]: v }))} />
                  <Button variant={s.connected ? "secondary" : "primary"} loading={busy("connect", k)} disabled={!(keys[k] ?? "").trim()} onClick={() => {
                      fetcher.submit({ intent: "connect", kind: k, key: keys[k] ?? "" }, { method: "post" });
                      setKeys((x) => ({ ...x, [k]: "" }));
                    }}>
                    {s.connected ? "Replace key" : "Connect"}
                  </Button>
                </s-grid>
              </s-stack>
            </HomeRow>
          );
        })}

        <HomeRow title="Shopify Flow" action={<Pill tone={d.flowOn ? "ok" : undefined}>{d.flowOn ? "In use" : "Not used yet"}</Pill>}>
          <s-stack gap="small-200">
            <s-text>Nothing to connect: in Shopify Flow, search for CRO Toolbox.</s-text>
            <s-unordered-list>
              <s-list-item>Triggers: Loyalty points earned, Loyalty reward redeemed, Loyalty tier changed, Loyalty points expiring. Each one comes with the customer, so a workflow can tag them, send an email or add them to a segment.</s-list-item>
              <s-list-item>Action: Add loyalty points (a negative number takes points away), for example points for a customer&apos;s first review or a tag.</s-list-item>
            </s-unordered-list>
            <s-text color="subdued">Triggers are sent once a workflow that uses them is turned on.</s-text>
          </s-stack>
        </HomeRow>

        <HomeRow title="Events Klaviyo and Omnisend get">
          <s-stack gap="small-200">
            <s-text>Each one has the points, the member&apos;s balance and what happened (the order, the reward and its code, the tier). Pick them as the trigger of a flow.</s-text>
            <s-unordered-list>
              {d.events.map((e) => (
                <s-list-item key={e}>{e}</s-list-item>
              ))}
            </s-unordered-list>
            <s-text color="subdued">Profile properties: Loyalty points, Loyalty pending points, Loyalty lifetime points, Loyalty tier, Loyalty referral code (in Omnisend: loyaltyPoints, loyaltyPendingPoints, loyaltyLifetimePoints, loyaltyTier, loyaltyReferralCode).</s-text>
          </s-stack>
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
