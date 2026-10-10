import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getBoosters, getRecent, refreshRecent, saveBoosters } from "../lib/boosters.server";
import { TRUST_BADGES, type BoostersConfig, type TrustBadgeKey } from "../lib/boosters";
import { sectionLinks } from "../lib/sections.server";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { Card, CardGrid, CardText, Explainer, Pill } from "../components/ui";
import { CategoryCrumb } from "../components/FeatureNav";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [config, recent] = await Promise.all([getBoosters(admin), getRecent(admin).catch(() => [])]);
  return { config, recent, embedLink: sectionLinks(session.shop).boosters };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "refresh") {
      const list = await refreshRecent(admin);
      return { ok: true, error: null, intent: "refresh", count: list.length };
    }
    await saveBoosters(admin, JSON.parse(String(form.get("config"))) as BoostersConfig);
    return { ok: true, error: null, intent: "save", count: 0 };
  } catch (e) {
    const msg = errorMessage(e);
    return {
      ok: false,
      intent: String(form.get("intent") || "save"),
      count: 0,
      error: /access|protected|scope|approved/i.test(msg)
        ? "Shopify hasn't allowed this app to read orders yet. Ask for “Protected customer data” access in the Partner Dashboard (Apps → this app → API access)."
        : msg,
    };
  }
};

const DEVICES = [
  { value: "all", label: "Desktop and mobile" },
  { value: "desktop", label: "Desktop only" },
  { value: "mobile", label: "Mobile only" },
];

export default function Boosters() {
  const data = useLoaderData<typeof loader>();
  const [cfg, setCfg] = useState<BoostersConfig>(data.config);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const busy = fetcher.state !== "idle";

  const [loaded, setLoaded] = useState(data.config);
  if (loaded !== data.config) {
    setLoaded(data.config);
    setCfg(data.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else shopify.toast.show(fetcher.data.intent === "refresh" ? `${fetcher.data.count} recent purchases loaded` : "Boosters saved");
  }, [fetcher.state, fetcher.data, shopify]);

  const set = <K extends keyof BoostersConfig>(k: K, patch: Partial<BoostersConfig[K]>) => setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));
  const save = () => fetcher.submit({ intent: "save", config: JSON.stringify(cfg) }, { method: "post" });
  const badgeOn = (key: TrustBadgeKey) => cfg.trust.badges.some((b) => b.key === key);
  const badgeLabel = (key: TrustBadgeKey) => cfg.trust.badges.find((b) => b.key === key)?.label ?? TRUST_BADGES.find((b) => b.key === key)!.label;
  const toggleBadge = (key: TrustBadgeKey, on: boolean) =>
    set("trust", {
      badges: on
        ? TRUST_BADGES.filter((b) => b.key === key || badgeOn(b.key)).map((b) => ({ key: b.key, label: b.key === key ? b.label : badgeLabel(b.key) }))
        : cfg.trust.badges.filter((b) => b.key !== key),
    });
  const renameBadge = (key: TrustBadgeKey, label: string) => set("trust", { badges: cfg.trust.badges.map((b) => (b.key === key ? { ...b, label } : b)) });

  return (
    <s-page heading="Conversion boosters" inlineSize="large">
      <CategoryCrumb feature="boosters" />
      <Button slot="primary-action" variant="primary" loading={busy && fetcher.formData?.get("intent") === "save"} onClick={save}>
        Save
      </Button>
      <Button slot="secondary-actions" href={data.embedLink} target="_top" icon="theme-edit">
        Turn on in theme
      </Button>
      <s-stack gap="base">
        <Explainer
          what="Four small boosters for product pages and the whole store: a sticky Add to cart bar, low-stock urgency, trust badges with your payment icons, and pop-ups of real recent purchases."
          how="Switch on “Conversion boosters” once in the theme editor's App embeds, then turn each booster on or off and edit it here. Everything shown to shoppers is real: stock comes from your inventory and pop-ups from real orders."
          example="A shopper scrolls down a product page: the bar with price and Add to cart follows them, “Only 3 left” shows under the price, and “Someone in Cairo bought Classic watch · 5 minutes ago” slides in."
        />
        {fetcher.data?.error ? <s-banner tone="critical">{fetcher.data.error}</s-banner> : null}

        <CardGrid cols={2}>
          <Card title="Sticky add to cart" badge={<Pill tone={cfg.sticky.enabled ? "ok" : "muted"}>{cfg.sticky.enabled ? "On" : "Off"}</Pill>}>
            <CardText>A bar with the product, price and Add to cart that appears once shoppers scroll past your button.</CardText>
            <Switch label="Show the sticky bar" checked={cfg.sticky.enabled} onValue={(v) => set("sticky", { enabled: v })} />
            <Select label="Position" value={cfg.sticky.position} onValue={(v) => set("sticky", { position: v as "bottom" | "top" })} options={[{ value: "bottom", label: "Bottom of the screen" }, { value: "top", label: "Top of the screen" }]} />
            <Select label="Devices" value={cfg.sticky.devices} onValue={(v) => set("sticky", { devices: v as "all" })} options={DEVICES} />
            <Checkbox label="Show the product image" checked={cfg.sticky.showImage} onValue={(v) => set("sticky", { showImage: v })} />
            <Checkbox label="Let shoppers pick size/colour in the bar" checked={cfg.sticky.showOptions} onValue={(v) => set("sticky", { showOptions: v })} />
            <TextField label="Button text" value={cfg.sticky.buttonText} onValue={(v) => set("sticky", { buttonText: v })} />
            <TextField label="Button colour" details="Empty = your theme's button colour. Example: #111111" value={cfg.sticky.buttonBg} onValue={(v) => set("sticky", { buttonBg: v })} />
          </Card>

          <Card title="Stock urgency" badge={<Pill tone={cfg.urgency.enabled ? "ok" : "muted"}>{cfg.urgency.enabled ? "On" : "Off"}</Pill>}>
            <CardText>“Only 3 left” above Add to cart, from your real stock, when a variant runs low.</CardText>
            <Switch label="Show low-stock urgency" checked={cfg.urgency.enabled} onValue={(v) => set("urgency", { enabled: v })} />
            <NumberField label="Show when stock is at or below" min={1} max={100} value={cfg.urgency.threshold} onValue={(v) => set("urgency", { threshold: v })} />
            <TextField label="Message" details="{count} becomes the number left." value={cfg.urgency.text} onValue={(v) => set("urgency", { text: v })} />
            <TextField label="When only one is left" value={cfg.urgency.lastOneText} onValue={(v) => set("urgency", { lastOneText: v })} />
            <Checkbox label="Show a stock bar" checked={cfg.urgency.showBar} onValue={(v) => set("urgency", { showBar: v })} />
            <TextField label="Colour" value={cfg.urgency.color} onValue={(v) => set("urgency", { color: v })} />
            <CardText>Only for products that track stock and stop selling at zero.</CardText>
          </Card>

          <Card title="Trust badges" badge={<Pill tone={cfg.trust.enabled ? "ok" : "muted"}>{cfg.trust.enabled ? "On" : "Off"}</Pill>}>
            <CardText>Reassurance under Add to cart: secure checkout, delivery, returns… plus the payment methods your store accepts.</CardText>
            <Switch label="Show trust badges" checked={cfg.trust.enabled} onValue={(v) => set("trust", { enabled: v })} />
            <TextField label="Heading (optional)" value={cfg.trust.heading} onValue={(v) => set("trust", { heading: v })} />
            <s-stack gap="small-200">
              {TRUST_BADGES.map((b) => (
                <s-stack key={b.key} direction="inline" gap="small-200" alignItems="center">
                  <Checkbox label="" checked={badgeOn(b.key)} onValue={(v) => toggleBadge(b.key, v)} />
                  <TextField label={b.label} value={badgeLabel(b.key)} disabled={!badgeOn(b.key)} onValue={(v) => renameBadge(b.key, v)} />
                </s-stack>
              ))}
            </s-stack>
            <Checkbox label="Show my store's payment icons" checked={cfg.trust.showPayments} onValue={(v) => set("trust", { showPayments: v })} />
            <Select label="Layout" value={cfg.trust.style} onValue={(v) => set("trust", { style: v as "row" | "grid" })} options={[{ value: "row", label: "In a row" }, { value: "grid", label: "Boxes, two per row" }]} />
          </Card>

          <Card title="Sales pop-ups" badge={<Pill tone={cfg.salesPop.enabled ? "ok" : "muted"}>{cfg.salesPop.enabled ? "On" : "Off"}</Pill>}>
            <CardText>Small notes of real recent purchases. Never invented: with no orders in the last days, nothing shows.</CardText>
            <Switch label="Show sales pop-ups" checked={cfg.salesPop.enabled} onValue={(v) => set("salesPop", { enabled: v })} />
            <Select label="Corner" value={cfg.salesPop.position} onValue={(v) => set("salesPop", { position: v as "bottom-left" })} options={[{ value: "bottom-left", label: "Bottom left" }, { value: "bottom-right", label: "Bottom right" }]} />
            <NumberField label="First one after (seconds)" min={2} max={120} value={cfg.salesPop.firstDelay} onValue={(v) => set("salesPop", { firstDelay: v })} />
            <NumberField label="Time between them (seconds)" min={5} max={600} value={cfg.salesPop.gap} onValue={(v) => set("salesPop", { gap: v })} />
            <NumberField label="Most per visit" min={1} max={20} value={cfg.salesPop.perVisit} onValue={(v) => set("salesPop", { perVisit: v })} />
            <NumberField label="Only orders from the last (days)" min={1} max={60} value={cfg.salesPop.maxAgeDays} onValue={(v) => set("salesPop", { maxAgeDays: v })} />
            <Checkbox label="Show the buyer's city" details="Uses the shipping city only — never names. Needs Shopify's approval for customer address data." checked={cfg.salesPop.showCity} onValue={(v) => set("salesPop", { showCity: v })} />
            <Select label="Devices" value={cfg.salesPop.devices} onValue={(v) => set("salesPop", { devices: v as "all" })} options={DEVICES} />
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <Button onClick={() => fetcher.submit({ intent: "refresh" }, { method: "post" })} loading={busy && fetcher.formData?.get("intent") === "refresh"}>
                Load recent orders
              </Button>
              <s-text color="subdued">{data.recent.length ? `${data.recent.length} purchases ready` : "No purchases loaded yet"}</s-text>
            </s-stack>
          </Card>
        </CardGrid>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
