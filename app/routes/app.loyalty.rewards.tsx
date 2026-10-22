/**
 * Loyalty → Rewards: what members spend points on (amount or percent off, free shipping, a free product,
 * store credit). The widget's look is on Loyalty → Look. Saving also saves the storefront copy
 * (lib/loyalty/storefront.server.ts).
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getProgram, saveProgramConfig } from "../lib/loyalty/program.server";
import { publishLoyalty } from "../lib/loyalty/storefront.server";
import { MAX_REWARDS, REWARD_KINDS, REWARD_KIND_LABEL, type LoyaltyConfig, type Reward, type RewardKind } from "../lib/loyalty/config";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [p, shop] = await Promise.all([getProgram(session.shop), gql(admin, `#graphql
    query CroLoyaltyShop { shop { currencyCode } }`).catch(() => null)]);
  return { config: p.config, saved: p.saved, currency: shop?.shop?.currencyCode ?? "USD" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveProgramConfig(session.shop, JSON.parse(String(form.get("config"))));
    await publishLoyalty(admin, session.shop);
    return { ok: true, error: null, config };
  } catch (e) {
    return { ok: false, error: errorMessage(e), config: null };
  }
};

type C = LoyaltyConfig;
const newId = () => `r${Date.now().toString(36).slice(-6)}`;

export default function LoyaltyRewards() {
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
    else shopify.toast.show("Saved");
  }, [fetcher.state, fetcher.data, shopify]);
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
    } catch {
      return `${n} ${d.currency}`;
    }
  };
  // A reward's title follows its kind and value until the merchant types their own.
  const auto = (r: Reward) => (r.kind === "amount" ? `${money(r.value)} off your order` : r.kind === "percent" ? `${r.value}% off your order` : r.kind === "shipping" ? "Free shipping" : r.kind === "credit" ? `${money(r.value)} store credit` : r.product ? `Free ${r.product.title}` : "A free product");
  const setReward = (i: number, patch: Partial<Reward>) =>
    setCfg((c) => ({
      ...c,
      rewards: c.rewards.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        return patch.title === undefined && r.title === auto(r) ? { ...next, title: auto(next) } : next;
      }),
    }));
  async function pickProduct(i: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected: any = await shopify.resourcePicker({ type: "product", multiple: false, action: "select" } as any);
    const p = selected?.[0];
    if (!p) return;
    setReward(i, { product: { id: String(p.id), title: String(p.title), price: Number(p.variants?.[0]?.price ?? 0) } });
  }

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(cfg, d.config)} saving={fetcher.state !== "idle"} saved={d.saved} onSave={() => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(d.config)} />
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="What members spend their points on. Each code works once, only for that member, and only until it expires; store credit is used at checkout by itself." />

        <HomeRow title={`Rewards (${cfg.rewards.length})`}>
          <s-stack gap="base">
            {cfg.rewards.map((r, i) => (
              <s-box key={r.id} padding="base" borderWidth="base" borderRadius="base">
                <s-stack gap="base">
                  <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                    <Switch label={r.title || "Reward"} details={r.on ? "Members can get it." : "Hidden from members."} checked={r.on} onValue={(v) => setReward(i, { on: v })} />
                    <Button variant="tertiary" tone="critical" icon="delete" onClick={() => setCfg((c) => ({ ...c, rewards: c.rewards.filter((_, j) => j !== i) }))}>
                      Remove
                    </Button>
                  </s-stack>
                  <s-grid gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))" gap="base">
                    <Select label="Reward" value={r.kind} onValue={(v) => setReward(i, { kind: v as RewardKind, value: v === "percent" ? 10 : v === "amount" || v === "credit" ? 5 : 0 })} options={REWARD_KINDS.map((k) => ({ value: k, label: REWARD_KIND_LABEL[k] }))} />
                    <NumberField label="Costs" suffix={cfg.unit.many} min={1} max={1000000} step={50} value={r.points} onValue={(v) => setReward(i, { points: v })} />
                    {r.kind === "amount" || r.kind === "credit" ? <NumberField label="Amount" suffix={d.currency} min={0.01} max={100000} step={1} value={r.value} onValue={(v) => setReward(i, { value: v })} /> : null}
                    {r.kind === "percent" ? <NumberField label="Percent off" suffix="%" min={1} max={100} step={1} value={r.value} onValue={(v) => setReward(i, { value: v })} /> : null}
                    {r.kind !== "credit" ? <NumberField label="Code works for" suffix="days" min={1} max={365} step={1} value={r.days} onValue={(v) => setReward(i, { days: v })} /> : null}
                    {r.kind !== "credit" && r.kind !== "product" ? <NumberField label="Minimum order" suffix={d.currency} min={0} max={100000} step={5} value={r.minimum} onValue={(v) => setReward(i, { minimum: v })} /> : null}
                  </s-grid>
                  {r.kind === "product" ? (
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <Button onClick={() => pickProduct(i)}>{r.product ? "Change product" : "Choose the product"}</Button>
                      <s-text color="subdued">{r.product ? `${r.product.title}: one is free (up to ${money(r.product.price)}). It can be a product you don't list in the store.` : "Choose the product members get for free."}</s-text>
                    </s-stack>
                  ) : null}
                  <TextField label="Name shoppers see" maxLength={60} value={r.title} onValue={(v) => setReward(i, { title: v })} />
                  {cfg.tiers.on ? (
                    <s-stack gap="small-200">
                      <s-text>Only for these VIP tiers (none ticked: everyone)</s-text>
                      <s-stack direction="inline" gap="base">
                        {cfg.tiers.list.map((t) => (
                          <Checkbox key={t.id} label={t.name} checked={r.tiers.includes(t.id)} onValue={(v) => setReward(i, { tiers: v ? [...r.tiers, t.id] : r.tiers.filter((x) => x !== t.id) })} />
                        ))}
                      </s-stack>
                    </s-stack>
                  ) : null}
                </s-stack>
              </s-box>
            ))}
            {cfg.rewards.length < MAX_REWARDS ? (
              <s-stack direction="inline">
                <Button icon="plus" onClick={() => setCfg((c) => ({ ...c, rewards: [...c.rewards, { id: newId(), on: true, kind: "amount", title: `${money(10)} off your order`, points: 1000, value: 10, minimum: 0, days: 30, product: null, tiers: [] }] }))}>
                  Add a reward
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
