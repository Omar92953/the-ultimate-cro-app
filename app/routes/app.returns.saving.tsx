/**
 * Return saving rules (Pro): before a refund the shopper can choose store credit (with an optional bonus), the
 * app approves returns by rule, and returned items can go back in stock. Stored with the return rules
 * ($app:cro_design "return_rules", the `saving` part). Logic: lib/return-rules.ts, lib/return-saving.server.ts.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getOrderPage } from "../lib/designs.server";
import { getReturnRules, saveReturnRules } from "../lib/shopify-returns.server";
import { planContext } from "../lib/rules.server";
import { requireFeature } from "../lib/rules";
import { withSaving, type AutoRule, type Saving } from "../lib/return-rules";
import { Button, Checkbox, NumberField, Select, Switch, TextField } from "../components/fields";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { SaveControls, changed } from "../components/SaveControls";
import { EditorLayout } from "../components/EditorLayout";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const [{ rules, saved }, page] = await Promise.all([getReturnRules(admin), getOrderPage(admin, "returns")]);
  const reasons = String(page.config.text.reasons ?? "").split("\n").map((r) => r.trim()).filter(Boolean);
  return { saving: rules.saving, saved, reasons };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const { plan, trial } = await planContext(admin, session.shop);
    requireFeature(plan, "return_saving", trial);
    const { rules } = await getReturnRules(admin);
    const saved = await saveReturnRules(admin, { ...rules, saving: withSaving(JSON.parse(String(form.get("saving")))) });
    return { ok: true, error: null, saving: saved.saving };
  } catch (e) {
    return { ok: false, error: errorMessage(e), saving: null };
  }
};

const BLANK_RULE: AutoRule = { reasons: [], tags: "", maxValue: 0, maxDays: 0 };

export default function ReturnSaving() {
  const data = useLoaderData<typeof loader>();
  const [s, setS] = useState<Saving>(data.saving);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.saving);
  if (loaded !== data.saving) {
    setLoaded(data.saving);
    setS(data.saving);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Saved");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);
  const exchange = (patch: Partial<Saving["exchange"]>) => setS((x) => ({ ...x, exchange: { ...x.exchange, ...patch } }));
  const credit = (patch: Partial<Saving["credit"]>) => setS((x) => ({ ...x, credit: { ...x.credit, ...patch } }));
  const rule = (i: number, patch: Partial<AutoRule>) => setS((x) => ({ ...x, rules: x.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const clean = withSaving(s);

  return (
    <s-page heading="Return saving rules" inlineSize="large">
      <CategoryCrumb feature="return_saving" />
      <SaveControls dirty={changed(s, data.saving)} saving={fetcher.state !== "idle"} saved={data.saved} onSave={() => fetcher.submit({ saving: JSON.stringify(clean) }, { method: "post" })} onDiscard={() => setS(data.saving)} />
      <s-stack gap="base">
        <FeatureTabs feature="return_saving" />
        <EditorLayout
          side={
            <s-section heading="How it works">
              <s-paragraph>Shoppers on your Returns page can also exchange for another size or colour. Before a refund, the shopper can choose store credit (you can add a bonus).</s-paragraph>
              <s-paragraph>
                {s.creditWhen === "received"
                  ? "Credit is given when the items arrive: you click “Items received: give the credit” on the return in Returns. Approving the return gives no credit yet."
                  : "Credit is given when you approve the return, or at once when a rule approves it."}{" "}
                It is a refund to store credit on the shopper&apos;s customer account, so the order shows the money as refunded, with your bonus added on top. For a guest order it is a Shopify gift card, otherwise a single use discount code for the exact amount.
              </s-paragraph>
              <s-paragraph>An exchange for something dearer waits for payment: the shopper pays the difference, and “Items arrived: ship the exchange” works only once the order owes nothing.</s-paragraph>
              <s-paragraph>Refunds to the original payment stay available for every shopper.</s-paragraph>
            </s-section>
          }
        >
          <s-section heading="1. Store credit instead of a refund">
            <s-stack gap="base">
              <Switch label="Offer store credit on the Returns page" checked={s.credit.on} onValue={(v) => credit({ on: v })} />
              {s.credit.on ? (
                <s-stack gap="base">
                <Select label="Give the credit" value={s.creditWhen} onValue={(v) => setS((x) => ({ ...x, creditWhen: v === "approved" ? "approved" : "received" }))} options={[{ value: "received", label: "When the items are received (you click “Items received”)" }, { value: "approved", label: "At once, when the return is approved" }]} details="The shopper sees when the credit comes: “Your credit is sent once we receive the items”." />
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <NumberField label="Bonus on top of the refund value" details="For example 10 turns a $50 refund into $55 of credit." suffix="%" min={0} max={100} step={1} value={s.credit.bonus} onValue={(v) => credit({ bonus: v })} />
                  <NumberField label="Credit lasts" details="0 = it never expires." suffix="days" min={0} max={3650} step={1} value={s.credit.expiryDays} onValue={(v) => credit({ expiryDays: v })} />
                </s-grid>
                </s-stack>
              ) : null}
            </s-stack>
          </s-section>
          <s-section heading="Exchanges">
            <s-stack gap="base">
              <Switch label="Let shoppers exchange for another size or colour" details="They pick another variant of the same product that is in stock. The Shopify return is made when you approve; the new shipment is held until you say the items arrived." checked={s.exchange.on} onValue={(v) => exchange({ on: v })} />
              {s.exchange.on ? <Checkbox label="Also when the new item costs more" checked={s.exchange.extra} onValue={(v) => exchange({ extra: v })} /> : null}
              {s.exchange.on && s.exchange.extra ? <s-text color="subdued">The shopper sees the difference before they send the request. After you approve, Shopify holds the shipment for payment: send the invoice from the order in your Shopify admin. A cheaper exchange is refunded the difference.</s-text> : null}
            </s-stack>
          </s-section>
          <s-section heading="2. Approve returns by rule">
            <s-stack gap="base">
              <s-text color="subdued">A return that matches any rule is approved at once (and gets its credit, if the shopper chose it). A rule matches when every condition you set holds; leave a condition empty to ignore it.</s-text>
              {s.rules.map((r, i) => (
                <s-box key={i} padding="small-200" borderWidth="base" borderRadius="base">
                  <s-stack gap="small-200">
                    <s-text type="strong">Rule {i + 1}</s-text>
                    <s-text color="subdued">Reasons (none ticked = any reason)</s-text>
                    <s-stack direction="inline" gap="base">
                      {data.reasons.map((reason) => (
                        <Checkbox key={reason} label={reason} checked={r.reasons.includes(reason)} onValue={(v) => rule(i, { reasons: v ? [...r.reasons, reason] : r.reasons.filter((x) => x !== reason) })} />
                      ))}
                    </s-stack>
                    <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
                      <TextField label="Product tags" details="Any item with one of these tags (comma separated)." value={r.tags} onValue={(v) => rule(i, { tags: v })} placeholder="tshirts, basics" />
                      <NumberField label="Order value up to" details="0 = any value." min={0} max={1000000} step={1} value={r.maxValue} onValue={(v) => rule(i, { maxValue: v })} />
                      <NumberField label="Days since delivery up to" details="0 = any. Needs a delivery date." suffix="days" min={0} max={365} step={1} value={r.maxDays} onValue={(v) => rule(i, { maxDays: v })} />
                    </s-grid>
                    <s-stack direction="inline">
                      <Button variant="tertiary" tone="critical" onClick={() => setS((x) => ({ ...x, rules: x.rules.filter((_, j) => j !== i) }))}>
                        Remove this rule
                      </Button>
                    </s-stack>
                  </s-stack>
                </s-box>
              ))}
              {s.rules.length < 10 ? (
                <s-stack direction="inline">
                  <Button onClick={() => setS((x) => ({ ...x, rules: [...x.rules, { ...BLANK_RULE }] }))}>Add a rule</Button>
                </s-stack>
              ) : null}
            </s-stack>
          </s-section>
          <s-section heading="3. Put returned items back in stock">
            <Switch label="Restock items when the return is processed" details="At your first active location. Off: restock in the Shopify admin as usual." checked={s.restock} onValue={(v) => setS((x) => ({ ...x, restock: v }))} />
          </s-section>
        </EditorLayout>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
