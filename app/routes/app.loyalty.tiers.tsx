/**
 * Loyalty → VIP tiers: tiers by points earned or money spent, over the member's lifetime or the last 12 months.
 * Each tier multiplies order points, can give a bonus once, can be the only tier for some rewards (Rewards page),
 * and can tag customers in Shopify ("Loyalty Gold"). Members move up or down when their orders change and daily.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { errorMessage } from "../lib/admin.server";
import { getProgram, reviewTiers, saveProgramConfig } from "../lib/loyalty/program.server";
import { publishLoyalty } from "../lib/loyalty/storefront.server";
import { MAX_TIERS, type LoyaltyConfig, type Tier } from "../lib/loyalty/config";
import { Button, Checkbox, NumberField, Switch, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Segmented } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { loyaltyAccess, planned } from "../lib/loyalty/plan.server";
import { ProNote } from "../components/ProNote";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [p, access] = await Promise.all([getProgram(session.shop), loyaltyAccess(admin, session.shop)]);
  const counts = await db.loyaltyMember.groupBy({ by: ["tier"], where: { shop: session.shop }, _count: { _all: true } });
  return { pro: access.pro, config: p.config, saved: p.saved, counts: Object.fromEntries(counts.map((c) => [c.tier, c._count._all])) as Record<string, number> };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveProgramConfig(session.shop, JSON.parse(String(form.get("config"))));
    // Tiers or their limits changed: every member is placed again now.
    // On Growth tiers are kept but not used (planned turns them off).
    await reviewTiers(session.shop, planned(config, await loyaltyAccess(admin, session.shop)));
    await publishLoyalty(admin, session.shop);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};

type C = LoyaltyConfig;

export default function LoyaltyTiers() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [cfg, setCfg] = useState<C>(d.config);
  const [loaded, setLoaded] = useState(d.config);
  if (loaded !== d.config) {
    setLoaded(d.config);
    setCfg(d.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else shopify.toast.show("Saved. Members are placed in their tiers again.");
  }, [fetcher.state, fetcher.data, shopify]);
  const tiers = (patch: Partial<C["tiers"]>) => setCfg((c) => ({ ...c, tiers: { ...c.tiers, ...patch } }));
  const setTier = (i: number, patch: Partial<Tier>) => tiers({ list: cfg.tiers.list.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const spent = cfg.tiers.basis === "spent";

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(cfg, d.config)} saving={fetcher.state !== "idle"} saved={d.saved} onSave={() => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(d.config)} />
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="VIP tiers reward your best customers: more points per order, a bonus on reaching a tier, and rewards only they can get." />
        {d.pro ? null : <ProNote text="VIP tiers work on the Pro plan. Set them up now: members are placed in them as soon as the store is on Pro." />}

        <HomeRow title="Tiers">
          <s-stack gap="base">
            <Switch label="VIP tiers are on" checked={cfg.tiers.on} onValue={(v) => tiers({ on: v })} />
            <s-stack gap="small-200">
              <s-text>A member reaches a tier by</s-text>
              <Segmented label="A member reaches a tier by" value={cfg.tiers.basis} onChange={(v) => tiers({ basis: v })} options={[{ value: "points", label: `${cfg.unit.many[0].toUpperCase()}${cfg.unit.many.slice(1)} earned` }, { value: "spent", label: "Money spent" }]} />
            </s-stack>
            <s-stack gap="small-200">
              <s-text>Counted over</s-text>
              <Segmented label="Counted over" value={cfg.tiers.period} onChange={(v) => tiers({ period: v })} options={[{ value: "lifetime", label: "All time" }, { value: "year", label: "The last 12 months" }]} />
            </s-stack>
            <s-text color="subdued">{cfg.tiers.period === "year" ? "Members move down when they no longer reach their tier over the last 12 months (checked daily)." : "Members keep the highest tier they reached."}</s-text>
            <Checkbox label="Tag customers in Shopify with their tier" details="For example “Loyalty Gold”, to use in customer segments, Shopify Flow and discounts." checked={cfg.tiers.tag} onValue={(v) => tiers({ tag: v })} />
          </s-stack>
        </HomeRow>

        <HomeRow title={`Your tiers (${cfg.tiers.list.length})`}>
          <s-stack gap="base">
            {cfg.tiers.list.map((t, i) => (
              <s-box key={t.id} padding="small-200" borderWidth="base" borderRadius="base">
                <s-grid gridTemplateColumns="minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto" gap="small-200" alignItems="end">
                  <TextField label="Name" maxLength={30} value={t.name} details={`${d.counts[t.id] ?? 0} members now`} onValue={(v) => setTier(i, { name: v })} />
                  <NumberField label={i === 0 ? "Everyone starts here" : spent ? "Money spent from" : `${cfg.unit.many[0].toUpperCase()}${cfg.unit.many.slice(1)} from`} disabled={i === 0} min={0} max={10000000} step={spent ? 50 : 100} value={t.min} onValue={(v) => setTier(i, { min: v })} />
                  <NumberField label="Points times" details="1.5 = half again on every order" min={1} max={10} step={0.25} value={t.multiplier} onValue={(v) => setTier(i, { multiplier: v })} />
                  <NumberField label="Bonus on reaching it" suffix={cfg.unit.many} min={0} max={100000} step={10} value={t.bonus} onValue={(v) => setTier(i, { bonus: v })} />
                  {i > 0 ? (
                    <Button variant="tertiary" tone="critical" icon="delete" accessibilityLabel={`Remove ${t.name}`} onClick={() => tiers({ list: cfg.tiers.list.filter((_, j) => j !== i) })}>
                      Remove
                    </Button>
                  ) : (
                    <span />
                  )}
                </s-grid>
              </s-box>
            ))}
            {cfg.tiers.list.length < MAX_TIERS ? (
              <s-stack direction="inline">
                <Button icon="plus" onClick={() => tiers({ list: [...cfg.tiers.list, { id: `t${Date.now().toString(36).slice(-6)}`, name: "New tier", min: (cfg.tiers.list.at(-1)?.min ?? 0) + 1000, multiplier: 1, bonus: 0 }] })}>
                  Add a tier
                </Button>
              </s-stack>
            ) : null}
          </s-stack>
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
