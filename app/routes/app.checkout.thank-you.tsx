/**
 * Checkout → Thank-you page: the modules shown after an order (next-order code, a message, social
 * links, "You may also like"), in the order set here. Shown by the cro-thank-you checkout UI
 * extension once the merchant adds its block in the checkout editor.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { createNextOrderCode, getThankYou, saveThankYou } from "../lib/thank-you.server";
import { checkCount } from "../lib/billing.server";
import { MODULE_TYPES, newModule, type ModuleType, type ThankYouModule } from "../lib/thank-you";
import { CategoryCrumb } from "../components/FeatureNav";
import { DemoButton } from "../components/DemoButton";
import { Button, NumberField, Select, Switch, TextArea, TextField } from "../components/fields";
import { PageIntro } from "../components/ui";
import { SaveControls } from "../components/SaveControls";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const data = await getThankYou(admin);
  return { ...data, editor: `https://${session.shop}/admin/settings/checkout/editor?page=thank-you` };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    if (form.get("intent") === "code") {
      const code = await createNextOrderCode(admin, String(form.get("code") ?? ""), Number(form.get("percent")));
      return { ok: true as const, error: null, code, intent: "code" as const };
    }
    const { shopId } = await getThankYou(admin);
    const config = JSON.parse(String(form.get("config") ?? "{}"));
    // Free: 2 modules on (plans.ts thankYouModules).
    const on = Array.isArray(config?.modules) ? config.modules.filter((m: { on?: boolean }) => m?.on !== false).length : 0;
    const limit = await checkCount(admin, session.shop, "thankYouModules", 0, on);
    if (limit) return { ok: false as const, error: limit.error, code: null, intent: "save" as const };
    await saveThankYou(admin, shopId, config);
    return { ok: true as const, error: null, code: null, intent: "save" as const };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e), code: null, intent: String(form.get("intent") ?? "save") };
  }
};

export default function ThankYouPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [modules, setModules] = useState<ThankYouModule[]>(data.config.modules);
  const [sent, setSent] = useState(JSON.stringify(data.config.modules));
  const [percent, setPercent] = useState(10);
  const [add, setAdd] = useState<ModuleType>("code");
  const dirty = JSON.stringify(modules) !== (fetcher.data?.ok && fetcher.data.intent === "save" ? sent : JSON.stringify(data.config.modules));

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else if (fetcher.data.intent === "code") shopify.toast.show(`Discount code ${fetcher.data.code} created`);
    else shopify.toast.show("Saved");
  }, [fetcher.state, fetcher.data, shopify]);

  const save = () => {
    setSent(JSON.stringify(modules));
    fetcher.submit({ config: JSON.stringify({ modules }) }, { method: "post" });
  };
  const update = (id: string, patch: Partial<ThankYouModule>) => setModules(modules.map((m) => (m.id === id ? ({ ...m, ...patch } as ThankYouModule) : m)));
  const move = (i: number, d: number) => {
    const list = [...modules];
    const [m] = list.splice(i, 1);
    list.splice(i + d, 0, m);
    setModules(list);
  };

  return (
    <s-page heading="Thank-you page" inlineSize="large">
      <CategoryCrumb feature="thank_you" />
      <DemoButton feature="thank_you" />
      <SaveControls dirty={dirty} saving={fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "code"} saved={data.saved} onSave={save} onDiscard={() => setModules(JSON.parse(fetcher.data?.ok && fetcher.data.intent === "save" ? sent : JSON.stringify(data.config.modules)))} />
      <Button slot="secondary-actions" href={data.editor} target="_blank">
        Open checkout editor
      </Button>
      <s-stack gap="base">
        <PageIntro text="Make the thank you page start the next order: a code to come back, your socials and products to discover." />
        {!data.saved ? (
          <s-banner tone="info" heading="One step in Shopify">
            In the checkout editor, open the Thank you page, click Add app block and choose CRO Toolbox thank-you page.{" "}
            <s-link href={data.editor} target="_blank">
              Open checkout editor
            </s-link>
          </s-banner>
        ) : null}

        <s-grid gridTemplateColumns="minmax(0, 1.2fr) minmax(0, 1fr)" gap="base">
          <s-stack gap="base">
            {modules.length === 0 ? (
              <s-section>
                <s-paragraph>No modules yet. Add one below.</s-paragraph>
              </s-section>
            ) : null}
            {modules.map((m, i) => (
              <s-section key={m.id} heading={MODULE_TYPES.find((t) => t.type === m.type)!.title}>
                <s-stack gap="base">
                  <Switch label="Show it" checked={m.on} onValue={(on) => update(m.id, { on })} />
                  <TextField label="Heading" value={m.heading} maxLength={80} onValue={(heading) => update(m.id, { heading })} />
                  {m.type === "code" ? (
                    <>
                      <TextArea label="Text" rows={2} maxLength={240} value={m.text} onValue={(text) => update(m.id, { text })} />
                      <TextField label="Discount code" details="An existing code from Discounts, or create it here." value={m.code} maxLength={40} onValue={(code) => update(m.id, { code: code.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} />
                      <s-stack direction="inline" gap="base" alignItems="end">
                        <NumberField label="Percent off" suffix="%" min={1} max={100} step={1} value={percent} onValue={setPercent} />
                        <Button disabled={!m.code} loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "code"} onClick={() => fetcher.submit({ intent: "code", code: m.code, percent: String(percent) }, { method: "post" })}>
                          Create this code in Discounts
                        </Button>
                      </s-stack>
                      <s-text color="subdued">Created as a code for everything, once per customer, with no end date. You can change it later under Discounts.</s-text>
                    </>
                  ) : null}
                  {m.type === "note" ? (
                    <>
                      <TextArea label="Message" rows={3} maxLength={400} value={m.text} onValue={(text) => update(m.id, { text })} />
                      <Select
                        label="Color"
                        value={m.tone}
                        options={[
                          { value: "info", label: "Blue (information)" },
                          { value: "success", label: "Green (good news)" },
                        ]}
                        onValue={(v) => update(m.id, { tone: v === "success" ? "success" : "info" })}
                      />
                    </>
                  ) : null}
                  {m.type === "social" ? (
                    <>
                      <TextField label="Text" value={m.text} maxLength={240} onValue={(text) => update(m.id, { text })} />
                      {m.links.map((l, j) => (
                        <s-grid key={j} gridTemplateColumns="1fr 2fr auto" gap="small-200" alignItems="end">
                          <TextField label="Button" value={l.label} maxLength={30} onValue={(label) => update(m.id, { links: m.links.map((x, k) => (k === j ? { ...x, label } : x)) })} />
                          <TextField label="Link" placeholder="https://instagram.com/yourstore" value={l.url} maxLength={300} error={l.url && !/^https:\/\//.test(l.url) ? "Starts with https://" : undefined} onValue={(url) => update(m.id, { links: m.links.map((x, k) => (k === j ? { ...x, url } : x)) })} />
                          <Button variant="tertiary" tone="critical" icon="delete" accessibilityLabel="Remove link" onClick={() => update(m.id, { links: m.links.filter((_, k) => k !== j) })}>
                            Remove
                          </Button>
                        </s-grid>
                      ))}
                      {m.links.length < 6 ? (
                        <s-stack direction="inline">
                          <Button icon="plus" onClick={() => update(m.id, { links: [...m.links, { label: "", url: "" }] })}>
                            Add a link
                          </Button>
                        </s-stack>
                      ) : null}
                    </>
                  ) : null}
                  {m.type === "products" ? (
                    <>
                      <Select label="Collection" value={m.collection} options={data.collections.map((c) => ({ value: c.handle, label: c.title }))} onValue={(collection) => update(m.id, { collection })} />
                      <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                        <NumberField label="Products" min={1} max={6} step={1} value={m.count} onValue={(count) => update(m.id, { count: Math.min(6, Math.max(1, Math.round(count))) })} />
                        <TextField label="Link text" value={m.button} maxLength={30} onValue={(button) => update(m.id, { button })} />
                      </s-grid>
                      <s-text color="subdued">Products the shopper just bought are left out.</s-text>
                    </>
                  ) : null}
                  <s-stack direction="inline" gap="small-200">
                    <Button variant="tertiary" icon="arrow-up" disabled={i === 0} onClick={() => move(i, -1)}>
                      Up
                    </Button>
                    <Button variant="tertiary" icon="arrow-down" disabled={i === modules.length - 1} onClick={() => move(i, 1)}>
                      Down
                    </Button>
                    <Button variant="tertiary" tone="critical" icon="delete" onClick={() => setModules(modules.filter((x) => x.id !== m.id))}>
                      Remove
                    </Button>
                  </s-stack>
                </s-stack>
              </s-section>
            ))}
            <s-section heading="Add a module">
              <s-stack gap="base">
                <Select label="Module" value={add} options={MODULE_TYPES.map((t) => ({ value: t.type, label: `${t.title}: ${t.help}` }))} onValue={(v) => setAdd(v as ModuleType)} />
                <s-stack direction="inline">
                  <Button icon="plus" disabled={modules.length >= 10} onClick={() => setModules([...modules, newModule(add)])}>
                    Add
                  </Button>
                </s-stack>
              </s-stack>
            </s-section>
          </s-stack>
          <s-box>
            <ThankYouPreview modules={modules.filter((m) => m.on)} currency={data.currency} />
          </s-box>
        </s-grid>
      </s-stack>
    </s-page>
  );
}

/** A sketch of Shopify's thank-you page with the modules under the order confirmation. */
function ThankYouPreview({ modules, currency }: { modules: ThankYouModule[]; currency: string }) {
  const card: React.CSSProperties = { border: "1px solid #dedede", borderRadius: 8, padding: 14, display: "grid", gap: 8, background: "#fff" };
  const btn: React.CSSProperties = { border: "1px solid #c9c9c9", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#fff" };
  const price = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
    } catch {
      return String(n);
    }
  };
  return (
    <div style={{ position: "sticky", top: 16, background: "#f5f5f5", borderRadius: 12, padding: 16, display: "grid", gap: 12, fontSize: 13, color: "#1a1a1a", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ width: 30, height: 30, borderRadius: 999, border: "2px solid #1a7f37", color: "#1a7f37", display: "grid", placeItems: "center", fontWeight: 700 }}>✓</span>
        <span>
          <span style={{ display: "block", fontSize: 11, color: "#707070" }}>Confirmation #A1B2C3</span>
          <b style={{ fontSize: 16 }}>Thank you, Mariam!</b>
        </span>
      </div>
      <div style={{ ...card, color: "#707070" }}>Your order is confirmed. You’ll receive an email shortly.</div>
      {modules.length === 0 ? <div style={{ ...card, color: "#707070", textAlign: "center" }}>Your modules show here</div> : null}
      {modules.map((m) => {
        if (m.type === "note")
          return (
            <div key={m.id} style={{ ...card, background: m.tone === "success" ? "#eaf6ee" : "#eaf2fd", borderColor: m.tone === "success" ? "#b7dfc2" : "#b9d3f5" }}>
              {m.heading ? <b>{m.heading}</b> : null}
              {m.text ? <span>{m.text}</span> : null}
            </div>
          );
        if (m.type === "code")
          return (
            <div key={m.id} style={card}>
              {m.heading ? <b style={{ fontSize: 14 }}>{m.heading}</b> : null}
              {m.text ? <span>{m.text}</span> : null}
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ border: "1px dashed #999", borderRadius: 6, padding: "6px 12px", fontWeight: 700, letterSpacing: 1 }}>{m.code || "YOURCODE"}</span>
                <span style={btn}>Copy code</span>
              </span>
            </div>
          );
        if (m.type === "social")
          return (
            <div key={m.id} style={card}>
              {m.heading ? <b style={{ fontSize: 14 }}>{m.heading}</b> : null}
              {m.text ? <span>{m.text}</span> : null}
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {m.links.map((l, i) => (
                  <span key={i} style={btn}>
                    {l.label || "Link"}
                  </span>
                ))}
              </span>
            </div>
          );
        return (
          <div key={m.id} style={card}>
            {m.heading ? <b style={{ fontSize: 14 }}>{m.heading}</b> : null}
            <span style={{ display: "grid", gridTemplateColumns: m.count > 1 ? "1fr 1fr" : "1fr", gap: 10 }}>
              {Array.from({ length: Math.min(m.count, 4) }, (_, i) => (
                <span key={i} style={{ display: "grid", gap: 4 }}>
                  <span style={{ aspectRatio: "1", borderRadius: 6, background: ["#e9e2d8", "#dfe7ef", "#e7e0ee", "#e2ece3"][i] }} />
                  <b style={{ fontSize: 12 }}>Product {i + 1}</b>
                  <span style={{ fontSize: 12 }}>{price(450 + i * 150)}</span>
                  <span style={{ fontSize: 12, textDecoration: "underline" }}>{m.button || "Shop now"}</span>
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
