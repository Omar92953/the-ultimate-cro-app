/**
 * A/B tests for offers (Pro): shoppers are split evenly between version A (the offer as saved) and up to three
 * other versions, B, C and D (other words, discount or style). Results are real: shoppers counted by the offer blocks and the store's own orders.
 * Logic: lib/ab-tests.ts and lib/ab-tests.server.ts.
 */
import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, gql } from "../lib/admin.server";
import { listRules } from "../lib/cro.server";
import { planContext } from "../lib/rules.server";
import { isRuleError } from "../lib/rules";
import { applyWinner, createTest, listTests, stopTest, testResults } from "../lib/ab-tests.server";
import { AB_CHANGE_LABELS, AB_GROUPS, MAX_VERSIONS, challengers, groupsOf, isGroup, type AbResult, type AbTest } from "../lib/ab-tests";
import { Button, NumberField, Select, TextField } from "../components/fields";
import { PageIntro, Pill } from "../components/ui";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { AbResults as Results } from "../components/AbResults";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [tests, rules, shop] = await Promise.all([listTests(admin), listRules(admin), gql(admin, `#graphql query CroShopCurrency { shop { currencyCode } }`).catch(() => null)]);
  const results = await testResults(admin, session.shop, tests.slice(0, 10)).catch(() => ({}) as Record<string, AbResult>);
  return {
    tests,
    results,
    currency: (shop?.shop?.currencyCode as string) ?? "USD",
    offers: rules.filter((r) => r.active && r.handle).map((r) => ({ handle: r.handle!, name: r.name, kind: r.kind, headline: r.headline, subheadline: r.subheadline, buttonLabel: r.buttonLabel, discountLabel: r.discountLabel, discountPercent: r.discountPercent, tiers: r.tiers, upsellType: r.upsellType, design: r.design ?? 1, drawer: r.placements.includes("drawer") })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const intent = String(form.get("intent"));
    const p = await planContext(admin, session.shop);
    if (intent === "create") {
      await createTest(admin, { plan: p.plan, trial: null }, { name: String(form.get("name") ?? ""), offer: String(form.get("offer")), versions: JSON.parse(String(form.get("versions") ?? "[]")) });
    } else if (intent === "stop") await stopTest(admin, String(form.get("id")));
    else if (intent === "apply") {
      const winner = form.get("winner");
      await applyWinner(admin, String(form.get("id")), isGroup(winner) ? winner : "A");
    }
    else throw new Error("Unknown action.");
    return { ok: true, error: null, intent, upgrade: false };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent: "", upgrade: isRuleError(e) && e.upgrade };
  }
};

export default function AbTests() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [offer, setOffer] = useState(d.offers[0]?.handle ?? "");
  const rule = d.offers.find((o) => o.handle === offer);
  const [name, setName] = useState("");
  // Versions B, C and D: what each changes. `at` is the one being edited.
  const [versions, setVersions] = useState<Record<string, unknown>[]>([{}]);
  const [at, setAt] = useState(0);
  const b = versions[at] ?? {};
  const [form, setForm] = useState(offer);
  if (form !== offer) {
    setForm(offer);
    setVersions([{}]);
    setAt(0);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true });
    else shopify.toast.show(fetcher.data.intent === "create" ? "Test started" : fetcher.data.intent === "stop" ? "Test stopped" : "Done");
  }, [fetcher.state, fetcher.data, shopify]);
  const money = useMemo(() => (v: number) => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: d.currency }).format(v); } catch { return `${v.toFixed(2)} ${d.currency}`; } }, [d.currency]);
  const busy = fetcher.state !== "idle";
  const set = (patch: Record<string, unknown>) => setVersions((all) => all.map((v, i) => (i === at ? { ...v, ...patch } : v)));
  const letter = AB_GROUPS[at + 1];
  const shown = <K extends string>(key: K, fallback: string) => (typeof b[key] === "string" ? (b[key] as string) : fallback);
  const tiers = (b.tiers as { qty: number; pct: number; value?: string; label?: string; badge?: string }[] | undefined) ?? rule?.tiers ?? [];
  const running = d.tests.filter((t) => t.status === "running");
  const past = d.tests.filter((t) => t.status !== "running");

  const card = (t: AbTest) => (
    <s-section key={t.id} heading={t.name}>
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <Pill tone={t.status === "running" ? "ok" : undefined}>{t.status === "running" ? "Running" : t.status === "paused" ? "Paused (needs Pro)" : t.status === "applied" ? `Ended: version ${t.winner} chosen` : "Stopped"}</Pill>
          <s-text color="subdued">Started {new Date(t.startedAt).toLocaleDateString()}{t.endedAt ? `, ended ${new Date(t.endedAt).toLocaleDateString()}` : ""}</s-text>
        </s-stack>
        {challengers(t).map((v, i) => (
          <s-text key={i} color="subdued">{`Version ${AB_GROUPS[i + 1]} changes: ${Object.keys(v).map((k) => AB_CHANGE_LABELS[k] ?? k).join(", ")}.`}</s-text>
        ))}
        {d.results[t.id] ? <Results r={d.results[t.id]} money={money} /> : null}
        {t.status === "running" ? (
          <s-stack direction="inline" gap="small-200">
            {groupsOf(t)
              .filter((g) => g !== "A")
              .map((g) => (
                <Button key={g} variant={d.results[t.id]?.leader === g ? "primary" : "secondary"} loading={busy} onClick={() => fetcher.submit({ intent: "apply", id: t.id, winner: g }, { method: "post" })}>
                  {`Use version ${g}`}
                </Button>
              ))}
            <Button loading={busy} onClick={() => fetcher.submit({ intent: "apply", id: t.id, winner: "A" }, { method: "post" })}>Keep version A</Button>
            <Button variant="tertiary" loading={busy} onClick={() => fetcher.submit({ intent: "stop", id: t.id }, { method: "post" })}>Stop without choosing</Button>
          </s-stack>
        ) : null}
      </s-stack>
    </s-section>
  );

  return (
    <s-page heading="A/B tests" inlineSize="large">
      <CategoryCrumb feature="ab_tests" />
      <s-stack gap="base">
        <FeatureTabs feature="ab_tests" />
        <PageIntro text="Show your shoppers up to four versions of an offer, split evenly, and see which one sells more." />
        {fetcher.data && !fetcher.data.ok && fetcher.data.upgrade ? <s-banner tone="warning" heading="This needs a higher plan" /> : null}
        {running.map(card)}
        <s-section heading="Start a test">
          {!d.offers.length ? (
            <s-paragraph>You need an upsell or cross sell that is switched on. Create one in Offers, then come back.</s-paragraph>
          ) : (
            <s-stack gap="base">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <Select label="Offer to test" value={offer} onValue={setOffer} options={d.offers.map((o) => ({ value: o.handle, label: `${o.name} (${o.kind === "upsell" ? "upsell" : "cross sell"})` }))} />
                <TextField label="Name of the test" value={name} onValue={setName} placeholder={rule ? `${rule.name}: bigger discount` : ""} maxLength={80} />
              </s-grid>
              {rule ? (
                <>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    {versions.map((_, i) => (
                      <Button key={i} variant={i === at ? "primary" : "secondary"} onClick={() => setAt(i)}>
                        {`Version ${AB_GROUPS[i + 1]}`}
                      </Button>
                    ))}
                    {versions.length < MAX_VERSIONS - 1 ? (
                      <Button icon="plus" variant="tertiary" onClick={() => { setVersions((all) => [...all, {}]); setAt(versions.length); }}>
                        Add a version
                      </Button>
                    ) : null}
                    {versions.length > 1 ? (
                      <Button variant="tertiary" tone="critical" onClick={() => { setVersions((all) => all.filter((_, i) => i !== at)); setAt(0); }}>
                        {`Remove version ${letter}`}
                      </Button>
                    ) : null}
                  </s-stack>
                  <s-text color="subdued">{`Change only what you want to test in version ${letter}. Anything left as it is stays the same as version A. Shoppers are split evenly between all ${versions.length + 1} versions.`}</s-text>
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <TextField label="Headline" value={shown("headline", rule.headline)} onValue={(v) => set({ headline: v })} />
                    <TextField label="Text under the headline" value={shown("subheadline", rule.subheadline)} onValue={(v) => set({ subheadline: v })} />
                    {rule.kind === "cross_sell" ? <TextField label="Button" value={shown("buttonLabel", rule.buttonLabel)} onValue={(v) => set({ buttonLabel: v })} /> : <span />}
                    <TextField label="Discount label" value={shown("discountLabel", rule.discountLabel)} onValue={(v) => set({ discountLabel: v })} />
                    {rule.kind === "cross_sell" ? (
                      <NumberField label="Discount" suffix="%" min={0} max={100} step={1} value={typeof b.discountPercent === "number" ? b.discountPercent : rule.discountPercent} onValue={(v) => set({ discountPercent: v })} />
                    ) : null}
                    <Select label="Style" value={String(typeof b.design === "number" ? b.design : rule.design)} onValue={(v) => set({ design: Number(v) })} options={[1, 2, 3, 4, 5].map((i) => ({ value: String(i), label: `Style ${i}` }))} />
                  </s-grid>
                  {rule.kind === "upsell" ? (
                    <s-stack gap="small-200">
                      <s-text type="strong">Discount of each tier</s-text>
                      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap="small-200">
                        {tiers.map((t, i) => (
                          <NumberField key={i} label={rule.upsellType === "variant" ? `${t.value}` : `Buy ${t.qty}`} suffix="%" min={0} max={90} step={1} value={t.pct} onValue={(v) => set({ tiers: tiers.map((x, j) => (j === i ? { ...x, pct: v } : x)) })} />
                        ))}
                      </s-grid>
                    </s-stack>
                  ) : null}
                  {rule.kind === "cross_sell" && rule.drawer ? <s-text color="subdued">This cross sell also shows in the cart drawer, which can only show version A&apos;s discount. Test the words and style, or take the drawer out of the offer to test the discount.</s-text> : null}
                  <s-stack direction="inline">
                    <Button
                      variant="primary"
                      loading={busy && fetcher.formData?.get("intent") === "create"}
                      onClick={() => {
                        // Only what differs from the offer is each version.
                        const diffs = versions.map((v) => {
                          const diff: Record<string, unknown> = {};
                          for (const k of ["headline", "subheadline", "buttonLabel", "discountLabel", "discountPercent", "design"] as const) if (v[k] !== undefined && v[k] !== (rule as Record<string, unknown>)[k]) diff[k] = v[k];
                          if (v.tiers && JSON.stringify(v.tiers) !== JSON.stringify(rule.tiers)) diff.tiers = v.tiers;
                          return diff;
                        });
                        fetcher.submit({ intent: "create", offer, name, versions: JSON.stringify(diffs) }, { method: "post" });
                      }}
                    >
                      Start the test
                    </Button>
                  </s-stack>
                </>
              ) : null}
            </s-stack>
          )}
        </s-section>
        {past.length ? <s-section heading="Earlier tests"><s-stack gap="base">{past.map(card)}</s-stack></s-section> : null}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
