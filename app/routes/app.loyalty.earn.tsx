/** Loyalty → Earn points: what members earn for orders and accounts, when points can be used and when they expire. */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getProgram, saveProgramConfig } from "../lib/loyalty/program.server";
import { publishLoyalty } from "../lib/loyalty/storefront.server";
import { pointsLabel, type LoyaltyConfig } from "../lib/loyalty/config";
import { Checkbox, NumberField, Switch, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const p = await getProgram(session.shop);
  return { config: p.config, saved: p.saved };
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

export default function LoyaltyEarn() {
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
  const earn = <K extends keyof C["earn"]>(k: K, patch: Partial<C["earn"][K]>) => setCfg((c) => ({ ...c, earn: { ...c.earn, [k]: { ...c.earn[k], ...patch } } }));
  const example = Math.floor(50 * cfg.earn.order.perUnit);

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(cfg, d.config)} saving={fetcher.state !== "idle"} saved={d.saved} onSave={() => fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(d.config)} />
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="What members earn points for. Points from an order count once it is paid; a refund or cancellation takes them back." />

        <HomeRow title="Orders">
          <s-stack gap="base">
            <Switch label="Points for paid orders" checked={cfg.earn.order.on} onValue={(v) => earn("order", { on: v })} />
            {cfg.earn.order.on ? (
              <>
                <NumberField label="Points per 1 of your currency" details={`An order of 50 earns ${pointsLabel(cfg, example)}. Use 0.5 for 1 point per 2.`} min={0} max={1000} step={0.5} value={cfg.earn.order.perUnit} onValue={(v) => earn("order", { perUnit: v })} />
                <Checkbox label="Count shipping" checked={cfg.earn.order.shipping} onValue={(v) => earn("order", { shipping: v })} />
                <Checkbox label="Count taxes" checked={cfg.earn.order.taxes} onValue={(v) => earn("order", { taxes: v })} />
              </>
            ) : null}
            <Switch label="Extra points on the first order" checked={cfg.earn.firstOrder.on} onValue={(v) => earn("firstOrder", { on: v })} />
            {cfg.earn.firstOrder.on ? <NumberField label="First order bonus" suffix={cfg.unit.many} min={0} max={100000} step={10} value={cfg.earn.firstOrder.points} onValue={(v) => earn("firstOrder", { points: v })} /> : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Accounts">
          <s-stack gap="base">
            <Switch label="Points for creating an account" details="Once per customer, when their account is active." checked={cfg.earn.signup.on} onValue={(v) => earn("signup", { on: v })} />
            {cfg.earn.signup.on ? <NumberField label="Account points" suffix={cfg.unit.many} min={0} max={100000} step={10} value={cfg.earn.signup.points} onValue={(v) => earn("signup", { points: v })} /> : null}
            <Checkbox label="Customers join by themselves" details="With their first paid order or their account. Off: only customers who press Join in the rewards widget." checked={cfg.autoJoin} onValue={(v) => setCfg((c) => ({ ...c, autoJoin: v }))} />
            <TextField label="Customers who can't join (tags)" details="Separated by commas, for example wholesale." value={cfg.excludeTags} onValue={(v) => setCfg((c) => ({ ...c, excludeTags: v }))} />
          </s-stack>
        </HomeRow>

        <HomeRow title="When points can be used and when they expire">
          <s-stack gap="base">
            <NumberField label="Pending days" suffix="days" details="Order points wait this long before members can use them, so returns can't be gamed. 0 = at once." min={0} max={90} step={1} value={cfg.pendingDays} onValue={(v) => setCfg((c) => ({ ...c, pendingDays: v }))} />
            <Switch label="Points expire" details="All of a member's points expire after this many days with no order and no reward." checked={cfg.expiry.on} onValue={(v) => setCfg((c) => ({ ...c, expiry: { ...c.expiry, on: v } }))} />
            {cfg.expiry.on ? <NumberField label="Expire after" suffix="days" min={30} max={3650} step={30} value={cfg.expiry.days} onValue={(v) => setCfg((c) => ({ ...c, expiry: { ...c.expiry, days: v } }))} /> : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Name of the points">
          <s-grid gridTemplateColumns="1fr 1fr" gap="base">
            <TextField label="One" placeholder="point" maxLength={20} value={cfg.unit.one} onValue={(v) => setCfg((c) => ({ ...c, unit: { ...c.unit, one: v } }))} />
            <TextField label="Many" placeholder="points" maxLength={20} value={cfg.unit.many} onValue={(v) => setCfg((c) => ({ ...c, unit: { ...c.unit, many: v } }))} />
          </s-grid>
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
