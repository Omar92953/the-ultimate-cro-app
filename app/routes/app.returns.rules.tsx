/**
 * Return rules (Tracking & Returns → Returns → Rules): the return window, products that can't be
 * returned, which reasons are approved at once, and what shoppers are told after approval (return
 * address, who pays shipping, extra words). Stored in $app:cro_design "return_rules".
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
import { withReturnRulesDefaults, type ReturnRules } from "../lib/return-rules";
import { Button, Checkbox, NumberField, OptionalSetting, Select, Switch, TextArea, TextField } from "../components/fields";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { SaveControls, changed } from "../components/SaveControls";
import { EditorLayout } from "../components/EditorLayout";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const [{ rules, saved }, page] = await Promise.all([getReturnRules(admin), getOrderPage(admin, "returns")]);
  const reasons = String(page.config.text.reasons ?? "").split("\n").map((r) => r.trim()).filter(Boolean);
  return { rules, saved, reasons };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const rules = await saveReturnRules(admin, JSON.parse(String(form.get("rules"))));
    return { ok: true, error: null, rules };
  } catch (e) {
    return { ok: false, error: errorMessage(e), rules: null };
  }
};

export default function ReturnRulesPage() {
  const data = useLoaderData<typeof loader>();
  const [rules, setRules] = useState<ReturnRules>(data.rules);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [loaded, setLoaded] = useState(data.rules);
  if (loaded !== data.rules) {
    setLoaded(data.rules);
    setRules(data.rules);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.ok) shopify.toast.show("Saved");
    else shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
  }, [fetcher.state, fetcher.data, shopify]);
  const set = (patch: Partial<ReturnRules>) => setRules((r) => ({ ...r, ...patch }));
  const toggleReason = (reason: string, on: boolean) => set({ autoApprove: { ...rules.autoApprove, reasons: on ? [...new Set([...rules.autoApprove.reasons, reason])] : rules.autoApprove.reasons.filter((x) => x !== reason) } });
  const clean = withReturnRulesDefaults(rules);

  return (
    <s-page heading="Return rules" inlineSize="large">
      <CategoryCrumb feature="returns" />
      <DemoButton feature="returns" />
      <Button slot="secondary-actions" href="/app/returns/saving">
        Return saving rules (Pro)
      </Button>
      <SaveControls dirty={changed(rules, data.rules)} saving={fetcher.state !== "idle"} saved={data.saved} onSave={() => fetcher.submit({ rules: JSON.stringify(clean) }, { method: "post" })} onDiscard={() => setRules(data.rules)} />
      <s-stack gap="base">
        <FeatureTabs feature="returns" />
        <EditorLayout
          side={
            <s-section heading="How it works">
              <s-paragraph>A shopper&apos;s request becomes a Shopify return. Requests inside these rules reach you in Returns; the reasons you tick below are approved at once. Shopify emails the shopper when you approve, decline, add a label and refund.</s-paragraph>
            </s-section>
          }
        >
          <s-section heading="1. Who can return what">
            <s-stack gap="base">
              <OptionalSetting label="Only recent orders can be returned" initiallyOn={rules.days > 0} onOn={() => set({ days: 30 })} onOff={() => set({ days: 0 })}>
                <NumberField label="Days after the order" details="Older orders can't ask for a return on your page." suffix="days" min={1} max={365} step={1} value={rules.days} onValue={(v) => set({ days: Math.max(1, v) })} />
              </OptionalSetting>
              <TextField label="Products that can't be returned" details="Product tags, separated by commas. Products with one of these tags are not offered on the Returns page, for example final-sale." value={rules.excludeTags} onValue={(v) => set({ excludeTags: v })} placeholder="final-sale, personalised" />
            </s-stack>
          </s-section>
          <s-section heading="2. Approve some reasons at once">
            <s-stack gap="base">
              <Switch label="Approve returns automatically" details="Shopify approves the return the moment the shopper sends it, and tells them how to send it back." checked={rules.autoApprove.on} onValue={(v) => set({ autoApprove: { ...rules.autoApprove, on: v } })} />
              {rules.autoApprove.on ? (
                <s-stack gap="small-200">
                  <s-text type="strong">For these reasons</s-text>
                  {data.reasons.map((r) => (
                    <Checkbox key={r} label={r} checked={rules.autoApprove.reasons.includes(r)} onValue={(v) => toggleReason(r, v)} />
                  ))}
                  <s-text color="subdued">The reasons are the ones on your Returns page (Returns → Style → Content).</s-text>
                </s-stack>
              ) : null}
            </s-stack>
          </s-section>
          <s-section heading="3. What shoppers are told after approval">
            <s-stack gap="base">
              <TextArea label="Return address" rows={3} value={rules.address} onValue={(v) => set({ address: v })} details="Shown to the shopper once the return is approved." />
              <Select label="Return shipping" value={rules.shipping} onValue={(v) => set({ shipping: v === "merchant" ? "merchant" : "shopper" })} options={[{ value: "shopper", label: "The shopper pays and ships it themselves" }, { value: "merchant", label: "I send a return label (you add it on each return)" }]} />
              <TextArea label="Extra words (optional)" rows={2} value={rules.instructions} onValue={(v) => set({ instructions: v })} details="For example “Pack the items in the original box.”" />
            </s-stack>
          </s-section>
        </EditorLayout>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
