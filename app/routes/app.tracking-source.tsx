/**
 * Tracking & Returns → where tracking comes from (Growth and Pro): Shopify's data, live tracking (a monthly number of
 * shipments by plan; hidden while plans.ts LIVE_TRACKING is off), the merchant's own tracking service key, or a webhook
 * link from any carrier or 3PL. Plus links for
 * carriers Shopify has no tracking link for (any plan with the Track page). Our live provider is never named.
 */
import { copyText } from "../lib/copy-text";
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { planContext } from "../lib/rules.server";
import { LIVE_TRACKING, atLeast } from "../lib/plans";
import { isRuleError } from "../lib/rules";
import { MAX_CARRIER_LINKS, carrierLinkProblem, type CarrierLink, type TrackSource } from "../lib/tracking";
import { trackingGuide } from "../lib/tracking-guide";
import { getTrackingConfig, regenerateSecret, removeKey, saveCarrierLinks, saveKey, saveSource } from "../lib/tracking/tracking.server";
import { Button, PasswordField, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Pill } from "../components/ui";
import { UsageBars } from "../components/UsageBars";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { plan } = await planContext(admin, session.shop);
  return { cfg: await getTrackingConfig(session.shop, plan), pro: atLeast(plan, "pro"), shop: session.shop };
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
    else if (intent === "links") await saveCarrierLinks(session.shop, JSON.parse(String(form.get("links") ?? "[]")));
    else throw new Error("Unknown action.");
    return { ok: true, error: null, intent, upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: "", upgrade: isRuleError(e) && e.upgrade };
  }
};

const choices = (live: number): { key: TrackSource; title: string; text: string }[] => [
  { key: "shopify", title: "Shopify's tracking data", text: "Free, every country, every carrier you add a tracking number for. Shows the status, the tracking number, the expected date and any updates Shopify gets from the carrier." },
  { key: "live", title: "Live tracking", text: `Up to ${live.toLocaleString()} shipments a month, included on your plan. Where the parcel is now and its full history, from 3,500+ carriers worldwide, found from the tracking number. Over the limit, the page uses Shopify's data.` },
  { key: "own", title: "Your own tracking service key", text: "Already use 17TRACK, AfterShip, TrackingMore or Ship24? Paste its key and the page uses it, with no limit from CRO Toolbox. Between them they follow thousands of carriers worldwide." },
  { key: "webhook", title: "Webhook link, for any carrier or 3PL", text: "For a shipping company, warehouse or service that can send updates to a link. Every update it sends shows on the Track page. Updates from 17TRACK, AfterShip, TrackingMore and Ship24 are read as they are." },
];

/** The ways to connect a shipping company, shown as option cards; each button goes where that way is set up. */
const WAYS: ({ title: string; text: string; button: string; to: string } | { title: string; text: string; button: string; href: string })[] = [
  { title: "Your courier's Shopify app", text: "Many couriers have a Shopify app that adds the tracking number and its updates to your orders. The Track page shows what Shopify gets, with nothing more to set up.", button: "Find its app", href: "https://apps.shopify.com/search?q=shipping%20tracking" },
  { title: "Tracking service", text: "17TRACK, AfterShip, TrackingMore or Ship24 follows thousands of couriers for you. Paste its key.", button: "Paste key", to: "src-own" },
  { title: "Webhook link", text: "Your courier, warehouse or a tracking service sends each update to your private link.", button: "Get link", to: "src-webhook" },
  { title: "Carrier link", text: "Each shipment links to the courier's own tracking page.", button: "Add link", to: "carrier-links" },
  { title: "Type updates yourself", text: "For a courier with no tracking system: add its updates on a shipment.", button: "Open Shipments", to: "/app/tracking-shipments" },
];

export default function TrackingSource() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  // A key that was accepted is not kept in the box.
  const [seen, setSeen] = useState(d.cfg.keyLast4);
  if (seen !== d.cfg.keyLast4) {
    setSeen(d.cfg.keyLast4);
    setKey("");
  }
  const [links, setLinks] = useState<CarrierLink[]>(d.cfg.carrierLinks);
  const [loadedLinks, setLoadedLinks] = useState(d.cfg.carrierLinks);
  if (loadedLinks !== d.cfg.carrierLinks) {
    setLoadedLinks(d.cfg.carrierLinks);
    setLinks(d.cfg.carrierLinks);
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
  const copy = async (v: string) => ((await copyText(v)) ? shopify.toast.show("Copied") : shopify.toast.show("Select the text and copy it", { isError: true }));
  const linkProblems = links.map(carrierLinkProblem);
  const linksDirty = JSON.stringify(links) !== JSON.stringify(d.cfg.carrierLinks);

  const choice = (c: ReturnType<typeof choices>[number]) => {
    const locked = c.key !== "shopify" && !d.cfg.advanced;
    const unavailable = c.key === "live" && !d.cfg.liveReady;
    const on = d.cfg.source === c.key;
    return (
      <s-section key={c.key} id={`src-${c.key}`} heading={c.title}>
        <s-stack gap="small-200">
          {on ? (
            <s-stack direction="inline">
              <Pill tone="ok">In use</Pill>
            </s-stack>
          ) : null}
          <s-text color="subdued">{c.text}</s-text>
          {c.key === "live" && d.cfg.advanced && d.cfg.liveReady ? <s-text color="subdued">{`${d.cfg.live.used} of ${d.cfg.live.limit} shipments used this month`}</s-text> : null}
          {c.key === "live" && unavailable ? <s-text color="subdued">Live tracking isn&apos;t switched on yet. Use your own key or a webhook link for now.</s-text> : null}
          {c.key === "own" && d.cfg.advanced ? (
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
              <s-text color="subdued">Sign in to your tracking service, open Settings, then API or Developers, create a key and paste it here. The app finds which service it belongs to, tests it before saving and keeps it encrypted.</s-text>
              <PasswordField label={d.cfg.hasKey ? "Replace the key" : "Key"} value={key} onValue={setKey} error={keyFailed && !busy ? fetcher.data?.error ?? undefined : undefined} />
              <s-stack direction="inline">
                <Button loading={busy && fetcher.formData?.get("intent") === "key"} disabled={!key.trim()} onClick={() => fetcher.submit({ intent: "key", key }, { method: "post" })}>
                  Test and save
                </Button>
              </s-stack>
            </s-stack>
          ) : null}
          {c.key === "webhook" && d.cfg.advanced && d.cfg.webhookUrl ? (
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
                See the plans
              </Button>
            ) : unavailable ? null : (
              <Button loading={busy && fetcher.formData?.get("source") === c.key} disabled={c.key === "own" && !d.cfg.hasKey} onClick={() => choose(c.key)}>
                Use this
              </Button>
            )}
          </s-stack>
        </s-stack>
      </s-section>
    );
  };

  return (
    <s-page heading="Where tracking comes from" inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app/tracking-returns">
        Tracking &amp; Returns
      </s-link>
      <Button slot="primary-action" href="/app/tracking-shipments">
        See your shipments
      </Button>
      <HomeRows>
        <PageIntro text="Every shipment shows its status on your Track page. Choose where that status comes from; the carrier's own tracking link always shows too. You can change this any time." />
        <HomeRow title="Any shipping company" subtitle={LIVE_TRACKING ? "Live tracking follows 3,500+ carriers. A company it doesn't know, like a local courier, still works:" : "Every courier works with one of these. Choose the one your shipping company offers:"} action={<Button icon="clipboard" onClick={() => copy(trackingGuide(d.shop))}>Copy AI guide</Button>}>
          <s-stack gap="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              {WAYS.map((w) => (
                <s-box key={w.title} padding="base" borderWidth="base" borderRadius="base">
                  <s-stack gap="small-200">
                    <s-text type="strong">{w.title}</s-text>
                    <s-text color="subdued">{w.text}</s-text>
                    <s-stack direction="inline">
                      {"href" in w ? (
                        <Button href={w.href} target="_blank">
                          {w.button}
                        </Button>
                      ) : (
                        <Button onClick={() => (w.to.startsWith("/") ? navigate(w.to) : document.getElementById(w.to)?.scrollIntoView({ behavior: "smooth", block: "start" }))}>{w.button}</Button>
                      )}
                    </s-stack>
                  </s-stack>
                </s-box>
              ))}
            </s-grid>
            <s-text color="subdued">Not sure which one fits? Copy AI guide, paste it into ChatGPT, Claude or Gemini, and it walks you through connecting your shipping company step by step.</s-text>
          </s-stack>
        </HomeRow>
        {d.cfg.advanced && LIVE_TRACKING ? (
          <HomeRow title="This month's live tracking">
            <UsageBars only={["liveShipments"]} />
          </HomeRow>
        ) : null}
        <HomeRow title="Tracking" subtitle={d.cfg.advanced ? `On your plan: every way below${LIVE_TRACKING ? `, with ${d.cfg.live.limit.toLocaleString()} live tracked shipments a month` : ""}. If one has nothing for a shipment, the next one is used, then Shopify's data.` : "On the Growth and Pro plans: updates from your shipping company or tracking service."} action={d.cfg.advanced ? null : <Pill>Growth plan</Pill>} bare>
          <s-stack gap="base">{choices(d.cfg.live.limit).filter((c) => LIVE_TRACKING || c.key !== "live").map(choice)}</s-stack>
        </HomeRow>
        <HomeRow title="A courier with no tracking system" subtitle="Type its updates yourself.">
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-text color="subdued">Open Shipments, choose “Add update” on a shipment and type its status and place. The Track page shows your updates first.</s-text>
            <Button href="/app/tracking-shipments">Open Shipments</Button>
          </s-stack>
        </HomeRow>
        <div id="carrier-links">
        <HomeRow title="Carriers without a tracking link" subtitle="For a local courier Shopify has no link for: the Track page builds the link from its name and your tracking number.">
          <s-stack gap="base">
            {links.map((l, i) => (
              <s-grid key={i} gridTemplateColumns="minmax(0, 1fr) minmax(0, 2fr) auto" gap="small-200" alignItems="start">
                <TextField label="Carrier name" details="As it shows on the fulfillment. * means any carrier without a link." value={l.name} maxLength={60} onValue={(v) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, name: v } : y)))} />
                <TextField label="Tracking page" placeholder="https://courier.com/track?n={number}" details="Put {number} where the tracking number goes." error={l.name || l.url ? (linkProblems[i] ?? undefined) : undefined} value={l.url} maxLength={300} onValue={(v) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, url: v } : y)))} />
                <Button variant="tertiary" tone="critical" icon="delete" accessibilityLabel={`Remove ${l.name || "this carrier"}`} onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </s-grid>
            ))}
            <s-stack direction="inline" gap="small-200">
              {links.length < MAX_CARRIER_LINKS ? (
                <Button icon="plus" onClick={() => setLinks((x) => [...x, { name: "", url: "" }])}>
                  Add a carrier
                </Button>
              ) : null}
              <Button variant="primary" disabled={!linksDirty || linkProblems.some(Boolean)} loading={busy && fetcher.formData?.get("intent") === "links"} onClick={() => fetcher.submit({ intent: "links", links: JSON.stringify(links) }, { method: "post" })}>
                Save carriers
              </Button>
            </s-stack>
          </s-stack>
        </HomeRow>
        </div>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

/** A save that did not change anything (a key that failed its test) leaves the page as it is. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ actionResult, defaultShouldRevalidate }) => (actionResult && (actionResult as { ok?: boolean }).ok === false ? false : defaultShouldRevalidate);
