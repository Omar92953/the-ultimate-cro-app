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
import { MAX_CAMPAIGNS, MAX_RULES, SOCIAL_LABEL, SOCIAL_NETWORKS, pointsLabel, type LoyaltyConfig, type ProductRule } from "../lib/loyalty/config";
import { Button, Checkbox, DateField, NumberField, Select, Switch, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro } from "../components/ui";
import { loyaltyAccess } from "../lib/loyalty/plan.server";
import { ProNote } from "../components/ProNote";
import { FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [p, access] = await Promise.all([getProgram(session.shop), loyaltyAccess(admin, session.shop)]);
  return { pro: access.pro, config: p.config, saved: p.saved };
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
  const social = (patch: Partial<C["earn"]["social"]>) => earn("social", patch);
  const linkFor = (n: (typeof SOCIAL_NETWORKS)[number]) => cfg.earn.social.links.find((l) => l.network === n)?.url ?? "";
  const setLink = (n: (typeof SOCIAL_NETWORKS)[number], url: string) => social({ links: [...cfg.earn.social.links.filter((l) => l.network !== n), ...(url.trim() ? [{ network: n, url: url.trim() }] : [])] });
  const setRule = (i: number, patch: Partial<ProductRule>) => setCfg((c) => ({ ...c, productRules: c.productRules.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setCamp = (i: number, patch: Partial<C["campaigns"][number]>) => setCfg((c) => ({ ...c, campaigns: c.campaigns.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  async function pickItems(i: number, kind: ProductRule["kind"]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selected: any = await shopify.resourcePicker({ type: kind === "products" ? "product" : "collection", multiple: true, action: "select" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (selected) setRule(i, { items: selected.slice(0, 50).map((x: any) => ({ id: String(x.id), title: String(x.title) })) });
  }
  const today = new Date().toISOString().slice(0, 10);

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

        <HomeRow title="Birthday and social media">
          <s-stack gap="base">
            <Switch label="Points on their birthday" details="Members add their birthday once in the rewards widget; the points come on that day every year." checked={cfg.earn.birthday.on} onValue={(v) => earn("birthday", { on: v })} />
            {cfg.earn.birthday.on ? <NumberField label="Birthday points" suffix={cfg.unit.many} min={0} max={100000} step={10} value={cfg.earn.birthday.points} onValue={(v) => earn("birthday", { points: v })} /> : null}
            <Switch label="Points for following you" details="Once per network. Networks can't confirm a follow, so it is the shopper's word." checked={cfg.earn.social.on} onValue={(v) => social({ on: v })} />
            {cfg.earn.social.on ? (
              <>
                <NumberField label="Points per network" suffix={cfg.unit.many} min={0} max={100000} step={10} value={cfg.earn.social.points} onValue={(v) => social({ points: v })} />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  {SOCIAL_NETWORKS.map((n) => (
                    <TextField key={n} label={`${SOCIAL_LABEL[n]} page`} placeholder="https://" value={linkFor(n)} onValue={(v) => setLink(n, v)} />
                  ))}
                </s-grid>
              </>
            ) : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Product reviews">
          <s-stack gap="base">
            <Switch label="Points for a product review" details="Once per review: reviews from Customer reviews when you approve them (written by a signed in member), and Judge.me reviews once published (connect Judge.me on Integrations)." checked={cfg.earn.review.on} onValue={(v) => earn("review", { on: v })} />
            {cfg.earn.review.on ? (
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <NumberField label="Review points" suffix={cfg.unit.many} min={0} max={100000} step={10} value={cfg.earn.review.points} onValue={(v) => earn("review", { points: v })} />
                <NumberField label="More with a photo" suffix={cfg.unit.many} min={0} max={100000} step={10} value={cfg.earn.review.photo} onValue={(v) => earn("review", { photo: v })} />
              </s-grid>
            ) : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Bonus campaigns">
          {d.pro ? null : <ProNote text="Bonus campaigns work on the Pro plan. They are kept and start on Pro." />}
          <s-stack gap="base">
            <s-text color="subdued">Orders placed between two dates earn more, for example double points for a weekend sale. The widget says so while it runs.</s-text>
            {cfg.campaigns.map((x, i) => (
              <s-grid key={x.id} gridTemplateColumns="minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto" gap="small-200" alignItems="end">
                <TextField label="Name" maxLength={40} value={x.name} onValue={(v) => setCamp(i, { name: v })} />
                <NumberField label="Points times" min={1} max={10} step={0.5} value={x.multiplier} onValue={(v) => setCamp(i, { multiplier: v })} />
                <DateField label="From" value={x.from} onValue={(v) => setCamp(i, { from: v })} />
                <DateField label="To" value={x.to} onValue={(v) => setCamp(i, { to: v })} />
                <Button variant="tertiary" tone="critical" icon="delete" accessibilityLabel={`Remove ${x.name}`} onClick={() => setCfg((c) => ({ ...c, campaigns: c.campaigns.filter((_, j) => j !== i) }))}>
                  Remove
                </Button>
              </s-grid>
            ))}
            {cfg.campaigns.length < MAX_CAMPAIGNS ? (
              <s-stack direction="inline">
                <Button icon="plus" onClick={() => setCfg((c) => ({ ...c, campaigns: [...c.campaigns, { id: `c${Date.now().toString(36).slice(-6)}`, name: "Double points", multiplier: 2, from: today, to: today }] }))}>
                  Add a campaign
                </Button>
              </s-stack>
            ) : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Products and collections">
          {d.pro ? null : <ProNote text="Product and collection rates work on the Pro plan. On Growth every product earns the main rate." />}
          <s-stack gap="base">
            <s-text color="subdued">Give some products or collections their own points, or none (gift cards, sale items). The first rule that matches a product counts.</s-text>
            {cfg.productRules.map((x, i) => (
              <s-box key={x.id} padding="small-200" borderWidth="base" borderRadius="base">
                <s-stack gap="small-200">
                  <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr) auto" gap="small-200" alignItems="end">
                    <Select label="Applies to" value={x.kind} onValue={(v) => setRule(i, { kind: v as ProductRule["kind"], items: [] })} options={[{ value: "products", label: "These products" }, { value: "collections", label: "These collections" }]} />
                    <NumberField label="Points per 1 of your currency" details="0 = these earn nothing" min={0} max={1000} step={0.5} value={x.perUnit} onValue={(v) => setRule(i, { perUnit: v })} />
                    <Button variant="tertiary" tone="critical" icon="delete" onClick={() => setCfg((c) => ({ ...c, productRules: c.productRules.filter((_, j) => j !== i) }))}>
                      Remove
                    </Button>
                  </s-grid>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <Button onClick={() => pickItems(i, x.kind)}>{x.items.length ? "Change" : x.kind === "products" ? "Choose products" : "Choose collections"}</Button>
                    <s-text color="subdued">{x.items.length ? x.items.map((it) => it.title).join(", ") : "None chosen yet: the rule is saved once it has some."}</s-text>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
            {cfg.productRules.length < MAX_RULES ? (
              <s-stack direction="inline">
                <Button icon="plus" onClick={() => setCfg((c) => ({ ...c, productRules: [...c.productRules, { id: `p${Date.now().toString(36).slice(-6)}`, kind: "products", items: [], perUnit: 0 }] }))}>
                  Add a rule
                </Button>
              </s-stack>
            ) : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Cashback instead of points">
          {d.pro ? null : <ProNote text="Cashback works on the Pro plan. On Growth orders earn points." />}
          <s-stack gap="base">
            <Switch label="Orders earn store credit instead of points" details="A percent of each paid order goes to the member's store credit once the pending days are over. Shopify uses store credit at checkout by itself. Other ways to earn still give points." checked={cfg.cashback.on} onValue={(v) => setCfg((c) => ({ ...c, cashback: { ...c.cashback, on: v } }))} />
            {cfg.cashback.on ? <NumberField label="Cashback" suffix="%" min={1} max={50} step={1} value={cfg.cashback.percent} onValue={(v) => setCfg((c) => ({ ...c, cashback: { ...c.cashback, percent: v } }))} /> : null}
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
