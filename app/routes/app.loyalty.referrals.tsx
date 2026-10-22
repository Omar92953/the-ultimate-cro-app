/**
 * Loyalty → Referrals: refer a friend (each member's code gives a friend a discount on their first order, and
 * the member a gift when that order is paid) and affiliate codes for creators and partners, with their sales.
 * Saving brings the Shopify discounts in line (lib/loyalty/referrals.server.ts).
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
import { referralStats, syncReferralDiscounts } from "../lib/loyalty/referrals.server";
import { MAX_AFFILIATES, cleanCode, pointsLabel, type Affiliate, type FriendKind, type LoyaltyConfig } from "../lib/loyalty/config";
import { Button, NumberField, Select, Switch, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Panel, Pill, Segmented, StatGrid, StatTile } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";
import css from "../components/TrackingHub.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [p, stats, shop] = await Promise.all([
    getProgram(session.shop),
    referralStats(session.shop),
    gql(admin, `#graphql
      query CroRefShop { shop { currencyCode primaryDomain { url } } }`).catch(() => null),
  ]);
  return { on: p.on, config: p.config, saved: p.saved, stats, currency: String(shop?.shop?.currencyCode ?? "USD"), domain: String(shop?.shop?.primaryDomain?.url ?? `https://${session.shop}`).replace(/\/$/, "") };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const config = await saveProgramConfig(session.shop, JSON.parse(String(form.get("config"))));
    const { on } = await getProgram(session.shop);
    const errors = await syncReferralDiscounts(admin, session.shop, config, on);
    await publishLoyalty(admin, session.shop);
    return { ok: !errors.length, error: errors.length ? `Saved, but Shopify refused: ${errors.join(" ")}` : null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};

type C = LoyaltyConfig;
const KIND_OPTIONS: { value: FriendKind; label: string }[] = [
  { value: "percent", label: "Percent off the order" },
  { value: "amount", label: "Amount off the order" },
  { value: "shipping", label: "Free shipping" },
];
const STATUS: Record<string, { label: string; tone?: "ok" | "warn" }> = { rewarded: { label: "Rewarded", tone: "ok" }, refused: { label: "Refused", tone: "warn" }, reversed: { label: "Taken back" } };

export default function LoyaltyReferrals() {
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
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true, duration: 10000 });
    else shopify.toast.show("Saved");
  }, [fetcher.state, fetcher.data, shopify]);

  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency }).format(n);
  const ref = cfg.referral;
  const setRef = (patch: Partial<C["referral"]>) => setCfg((c) => ({ ...c, referral: { ...c.referral, ...patch } }));
  const setFriend = (patch: Partial<C["referral"]["friend"]>) => setRef({ friend: { ...ref.friend, ...patch } });
  const setAff = (i: number, patch: Partial<Affiliate>) => setCfg((c) => ({ ...c, affiliates: c.affiliates.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const offer = (k: FriendKind, v: number) => (k === "percent" ? `${v}% off` : k === "amount" ? `${money(v)} off` : "free shipping");
  const gift = ref.gift.kind === "points" ? pointsLabel(cfg, ref.gift.value) : `${money(ref.gift.value)} in store credit`;
  const s = d.stats;
  const codes = cfg.affiliates.map((a) => a.code);
  const invalid = cfg.affiliates.some((a, i) => a.code.length < 3 || codes.indexOf(a.code) !== i) ? "Fix the affiliate codes first" : "";

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(cfg, d.config)} saving={fetcher.state !== "idle"} saved={d.saved} onSave={() => (invalid ? shopify.toast.show(invalid, { isError: true }) : fetcher.submit({ config: JSON.stringify(cfg) }, { method: "post" }))} onDiscard={() => setCfg(d.config)} />
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="Members share their own link. A friend gets a discount on their first order, and the member gets a gift once that order is paid. Affiliate codes count the sales of creators and partners." />

        <HomeRow title="Refer a friend">
          <s-stack gap="base">
            <Switch label="Referrals are on" details={d.on ? "Members see their link in the rewards widget and on the Rewards page." : "Codes start working when the program is on (Loyalty home)."} checked={ref.on} onValue={(v) => setRef({ on: v })} />
            <s-grid gridTemplateColumns="minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)" gap="base" alignItems="end">
              <Select label="The friend gets" value={ref.friend.kind} options={KIND_OPTIONS} onValue={(v) => setFriend({ kind: v as FriendKind, value: v === "percent" ? Math.min(100, Math.max(1, Math.round(ref.friend.value))) : ref.friend.value })} />
              {ref.friend.kind === "shipping" ? <span /> : <NumberField label={ref.friend.kind === "percent" ? "Percent off" : "Amount off"} suffix={ref.friend.kind === "percent" ? "%" : d.currency} min={ref.friend.kind === "percent" ? 1 : 0.01} max={ref.friend.kind === "percent" ? 100 : 100000} step={1} value={ref.friend.value} onValue={(v) => setFriend({ value: v })} />}
              <NumberField label="Order minimum" details="0 = no minimum" suffix={d.currency} min={0} max={100000} step={5} value={ref.friend.minimum} onValue={(v) => setFriend({ minimum: v })} />
            </s-grid>
            <s-stack gap="small-200">
              <s-text>The member gets</s-text>
              <Segmented label="The member gets" value={ref.gift.kind} onChange={(v) => setRef({ gift: { kind: v, value: v === ref.gift.kind ? ref.gift.value : v === "points" ? 200 : 5 } })} options={[{ value: "points", label: `${cfg.unit.many[0].toUpperCase()}${cfg.unit.many.slice(1)}` }, { value: "credit", label: "Store credit" }]} />
            </s-stack>
            <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap="base" alignItems="end">
              <NumberField label={ref.gift.kind === "points" ? "Gift" : "Store credit"} suffix={ref.gift.kind === "points" ? cfg.unit.many : d.currency} min={ref.gift.kind === "points" ? 1 : 0.01} max={100000} step={ref.gift.kind === "points" ? 50 : 1} value={ref.gift.value} onValue={(v) => setRef({ gift: { ...ref.gift, value: v } })} />
              <NumberField label="Rewarded referrals per member" details="In any 30 days. 0 = no limit" min={0} max={1000} step={1} value={ref.monthly} onValue={(v) => setRef({ monthly: v })} />
            </s-grid>
            <s-text color="subdued">{`A friend gets ${offer(ref.friend.kind, ref.friend.value)}${ref.friend.minimum > 0 ? ` on orders from ${money(ref.friend.minimum)}` : ""}. The member gets ${gift}${cfg.pendingDays > 0 ? `, usable ${cfg.pendingDays} days after the order like order points` : ""}.`}</s-text>
          </s-stack>
        </HomeRow>

        <HomeRow title="Fraud rules">
          <s-stack gap="small-200">
            <s-text>A referral is rewarded only when all of these are true:</s-text>
            <s-unordered-list>
              <s-list-item>The order is paid and not cancelled. A cancelled or fully refunded order takes the gift back.</s-list-item>
              <s-list-item>It is the friend&apos;s first order in the store, and this friend was never referred before.</s-list-item>
              <s-list-item>The friend is not the member: another customer with another email.</s-list-item>
              <s-list-item>{ref.monthly > 0 ? `The member has fewer than ${ref.monthly} rewarded referrals in the last 30 days.` : "There is no limit on referrals per member."}</s-list-item>
              <s-list-item>The member is not blocked (Members page).</s-list-item>
            </s-unordered-list>
            <s-text color="subdued">Each code works once per customer. Refused referrals are listed below with the reason.</s-text>
          </s-stack>
        </HomeRow>

        <HomeRow title="Last 30 days" bare>
          <Panel>
            <StatGrid>
              <StatTile label="Referred orders" value={s.referred.toLocaleString()} note="First orders of friends, rewarded" />
              <StatTile label="Sales from referrals" value={money(s.sales)} note="Their order subtotals" />
              <StatTile label="Refused" value={s.refused.toLocaleString()} note={s.reversed ? `${s.reversed} more taken back after refunds` : "By the fraud rules"} />
              <StatTile label="Affiliate sales" value={money(s.affiliateSales)} note="Orders with an affiliate code" />
            </StatGrid>
          </Panel>
        </HomeRow>

        <HomeRow title="Latest referrals">
          {s.latest.length ? (
            <div className={css.list}>
              {s.latest.map((r) => (
                <div key={r.id} className={css.item}>
                  <span>{`${r.order} · ${money(r.amount)} · referred by ${r.member || "a member"} · ${new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}${r.reason ? ` · ${r.reason}` : ""}`}</span>
                  <Pill tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <s-text color="subdued">No referrals yet. When a friend orders with a member&apos;s code, it shows here.</s-text>
          )}
        </HomeRow>

        <HomeRow title={`Affiliates (${cfg.affiliates.length})`} subtitle="A code for each creator or partner. Orders with it count as their sales; pay them their commission yourself.">
          <s-stack gap="base">
            {cfg.affiliates.map((a, i) => {
              const sold = d.stats.affiliates[a.id] ?? { orders: 0, sales: 0 };
              const dup = codes.indexOf(a.code) !== i;
              return (
                <s-box key={a.id} padding="base" borderWidth="base" borderRadius="base">
                  <s-stack gap="base">
                    <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                      <Switch label={a.on ? "On" : "Off"} checked={a.on} onValue={(v) => setAff(i, { on: v })} />
                      <Button variant="tertiary" tone="critical" icon="delete" accessibilityLabel={`Remove ${a.name}`} onClick={() => setCfg((c) => ({ ...c, affiliates: c.affiliates.filter((_, j) => j !== i) }))}>
                        Remove
                      </Button>
                    </s-stack>
                    <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)" gap="base" alignItems="end">
                      <TextField label="Name" maxLength={60} value={a.name} onValue={(v) => setAff(i, { name: v })} />
                      <TextField label="Code" maxLength={30} value={a.code} error={a.code.length < 3 ? "At least 3 letters or digits" : dup ? "Another affiliate has this code" : undefined} details="Letters and digits, no spaces" onValue={(v) => setAff(i, { code: cleanCode(v) })} />
                      <NumberField label="Commission" details="Percent of their sales" suffix="%" min={0} max={100} step={1} value={a.commission} onValue={(v) => setAff(i, { commission: v })} />
                      <Select label="Their followers get" value={a.kind} options={KIND_OPTIONS} onValue={(v) => setAff(i, { kind: v as FriendKind })} />
                      {a.kind === "shipping" ? <span /> : <NumberField label={a.kind === "percent" ? "Percent off" : "Amount off"} suffix={a.kind === "percent" ? "%" : d.currency} min={a.kind === "percent" ? 1 : 0.01} max={a.kind === "percent" ? 100 : 100000} step={1} value={a.value} onValue={(v) => setAff(i, { value: v })} />}
                      <NumberField label="Order minimum" details="0 = no minimum" suffix={d.currency} min={0} max={100000} step={5} value={a.minimum} onValue={(v) => setAff(i, { minimum: v })} />
                    </s-grid>
                    <s-text color="subdued">{`${sold.orders} orders · ${money(sold.sales)} in sales · ${money((sold.sales * a.commission) / 100)} commission · Link: ${d.domain}/discount/${a.code}`}</s-text>
                  </s-stack>
                </s-box>
              );
            })}
            {cfg.affiliates.length < MAX_AFFILIATES ? (
              <s-stack direction="inline">
                <Button icon="plus" onClick={() => setCfg((c) => ({ ...c, affiliates: [...c.affiliates, { id: `a${Date.now().toString(36).slice(-6)}`, on: true, name: "New affiliate", code: `PARTNER${c.affiliates.length + 1}`, kind: "percent", value: 10, minimum: 0, commission: 10 }] }))}>
                  Add an affiliate
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
