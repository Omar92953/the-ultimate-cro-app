/**
 * Loyalty → Languages: the rewards widget, the Rewards page, reward names and emails in the store's other languages
 * (config.ts `LoyaltyLanguage`, lib/loyalty/languages.ts). An empty box uses the main text. Seven languages come
 * translated by the app (`BUILT_IN`); the store can change every word.
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage } from "../lib/admin.server";
import { getProgram, saveProgramConfig } from "../lib/loyalty/program.server";
import { publishLoyalty } from "../lib/loyalty/storefront.server";
import { MAX_LANGUAGES, type LoyaltyConfig, type LoyaltyLanguage } from "../lib/loyalty/config";
import { BUILT_IN, LANGUAGES, languageName, prefill } from "../lib/loyalty/languages";
import { EMAIL_INFO, EMAIL_KINDS, type EmailKind } from "../lib/loyalty/emails";
import { allTextGroups } from "../lib/loyalty/texts";
import { Button, Select, TextArea, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Pill } from "../components/ui";
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
    // Only the languages change: the rest of the program is read again, so a save elsewhere is never undone.
    const { config } = await getProgram(session.shop);
    const saved = await saveProgramConfig(session.shop, { ...config, languages: JSON.parse(String(form.get("languages") ?? "[]")) });
    await publishLoyalty(admin, session.shop);
    return { ok: true, error: null, languages: saved.languages };
  } catch (e) {
    return { ok: false, error: errorMessage(e), languages: null };
  }
};

type L = LoyaltyLanguage;
type EmailPart = "subject" | "heading" | "body" | "button";

/** How many boxes of a language are filled in, of how many there are. */
function filled(l: L, c: LoyaltyConfig) {
  const words = allTextGroups().flatMap((g) => g.keys);
  const boxes = [
    ...words.map(([k]) => l.texts[k] ?? ""),
    l.unit.one, l.unit.many, l.page.title, l.page.sub,
    ...c.page.how.flatMap((_, i) => [l.page.how[i]?.t ?? "", l.page.how[i]?.x ?? ""]),
    ...c.page.faq.flatMap((_, i) => [l.page.faq[i]?.q ?? "", l.page.faq[i]?.a ?? ""]),
    ...c.rewards.map((r) => l.rewards[r.id] ?? ""),
    ...EMAIL_KINDS.flatMap((k) => (["subject", "heading", "body", "button"] as EmailPart[]).map((p) => l.emails[k]?.[p] ?? "")),
    l.footer, l.unsubscribe,
  ];
  return { done: boxes.filter(Boolean).length, all: boxes.length };
}

export default function LoyaltyLanguages() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const c = d.config;
  const [langs, setLangs] = useState<L[]>(c.languages);
  const [open, setOpen] = useState<string>(c.languages[0]?.code ?? "");
  const [pick, setPick] = useState("");
  const [loaded, setLoaded] = useState(c);
  if (loaded !== c) {
    setLoaded(c);
    setLangs(c.languages);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not saved", { isError: true, duration: 8000 });
    else shopify.toast.show("Saved and live");
  }, [fetcher.state, fetcher.data, shopify]);

  const free = LANGUAGES.filter((x) => !langs.some((l) => l.code === x.code));
  const current = langs.find((l) => l.code === open) ?? null;
  const edit = (patch: (l: L) => L) => setLangs((all) => all.map((l) => (l.code === open ? patch(l) : l)));
  const add = () => {
    const code = pick || free[0]?.code;
    if (!code) return;
    setLangs((all) => [...all, prefill(c, code)]);
    setOpen(code);
    setPick("");
  };
  /** Empty boxes get the app's translation; the store's own words stay. */
  const fillEmpty = () =>
    edit((l) => {
      const t = prefill(c, l.code);
      const or = (a: string | undefined, b: string | undefined) => a || b || "";
      return {
        ...l,
        texts: { ...t.texts, ...Object.fromEntries(Object.entries(l.texts).filter(([, v]) => v)) },
        unit: { one: or(l.unit.one, t.unit.one), many: or(l.unit.many, t.unit.many) },
        page: {
          title: or(l.page.title, t.page.title),
          sub: or(l.page.sub, t.page.sub),
          how: c.page.how.map((_, i) => ({ t: or(l.page.how[i]?.t, t.page.how[i]?.t), x: or(l.page.how[i]?.x, t.page.how[i]?.x) })),
          faq: c.page.faq.map((_, i) => ({ q: or(l.page.faq[i]?.q, t.page.faq[i]?.q), a: or(l.page.faq[i]?.a, t.page.faq[i]?.a) })),
        },
        rewards: { ...t.rewards, ...Object.fromEntries(Object.entries(l.rewards).filter(([, v]) => v)) },
        emails: Object.fromEntries(EMAIL_KINDS.map((k) => [k, { subject: or(l.emails[k]?.subject, t.emails[k]?.subject), heading: or(l.emails[k]?.heading, t.emails[k]?.heading), body: or(l.emails[k]?.body, t.emails[k]?.body), button: or(l.emails[k]?.button, t.emails[k]?.button) }])),
        footer: or(l.footer, t.footer),
        unsubscribe: or(l.unsubscribe, t.unsubscribe),
      };
    });
  const howAt = (l: L, i: number) => l.page.how[i] ?? { t: "", x: "" };
  const faqAt = (l: L, i: number) => l.page.faq[i] ?? { q: "", a: "" };
  const setHow = (i: number, patch: Partial<{ t: string; x: string }>) => edit((l) => ({ ...l, page: { ...l.page, how: c.page.how.map((_, j) => (j === i ? { ...howAt(l, j), ...patch } : howAt(l, j))) } }));
  const setFaq = (i: number, patch: Partial<{ q: string; a: string }>) => edit((l) => ({ ...l, page: { ...l.page, faq: c.page.faq.map((_, j) => (j === i ? { ...faqAt(l, j), ...patch } : faqAt(l, j))) } }));
  const setEmail = (k: EmailKind, part: EmailPart, v: string) => edit((l) => ({ ...l, emails: { ...l.emails, [k]: { subject: "", heading: "", body: "", button: "", ...l.emails[k], [part]: v } } }));
  const save = () => fetcher.submit({ languages: JSON.stringify(langs) }, { method: "post" });
  const main = (s: string) => `Main: ${s}`;

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(langs, c.languages)} saving={fetcher.state !== "idle"} saved={d.saved} onSave={save} onDiscard={() => setLangs(c.languages)} />
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="Show the rewards widget, the Rewards page and the emails in your store's other languages. Shoppers see the language of the page they are on, and emails go in the language of the customer's account. An empty box uses your main text." />

        <HomeRow title="Your languages" action={<Pill>{`${langs.length} of ${MAX_LANGUAGES}`}</Pill>}>
          <s-stack gap="base">
            {langs.length ? (
              <s-stack gap="small-200">
                {langs.map((l) => {
                  const n = filled(l, c);
                  return (
                    <s-stack key={l.code} direction="inline" gap="base" alignItems="center">
                      <s-text type="strong">{languageName(l.code)}</s-text>
                      <Pill tone={n.done === n.all ? "ok" : "muted"}>{`${n.done} of ${n.all} words`}</Pill>
                      <Button variant={open === l.code ? "primary" : "secondary"} onClick={() => setOpen(l.code)}>
                        {open === l.code ? "Editing" : "Edit"}
                      </Button>
                      <Button variant="tertiary" tone="critical" onClick={() => setLangs((all) => all.filter((x) => x.code !== l.code))}>
                        Remove
                      </Button>
                    </s-stack>
                  );
                })}
              </s-stack>
            ) : (
              <s-text color="subdued">No other languages yet: shoppers see your main texts in every language.</s-text>
            )}
            {langs.length < MAX_LANGUAGES ? (
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="end">
                <Select label="Add a language" value={pick || free[0]?.code || ""} onValue={setPick} options={free.map((x) => ({ value: x.code, label: BUILT_IN[x.code] ? `${x.name}, translated by the app` : x.name }))} />
                <Button onClick={add}>Add</Button>
              </s-grid>
            ) : null}
            <s-text color="subdued">French, Spanish, German, Italian, Portuguese (Brazil), Dutch and Arabic come translated where you kept the default words. Check them and change any word. Then save.</s-text>
          </s-stack>
        </HomeRow>

        {current ? (
          <>
            <HomeRow title={`${languageName(current.code)}: points`} action={BUILT_IN[current.code] ? <Button onClick={fillEmpty}>Fill empty boxes with the app&apos;s translation</Button> : undefined}>
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <TextField label="One point" details={main(c.unit.one)} maxLength={20} value={current.unit.one} onValue={(v) => edit((l) => ({ ...l, unit: { ...l.unit, one: v } }))} />
                <TextField label="Many points" details={main(c.unit.many)} maxLength={20} value={current.unit.many} onValue={(v) => edit((l) => ({ ...l, unit: { ...l.unit, many: v } }))} />
              </s-grid>
            </HomeRow>

            {allTextGroups().map((g) => (
              <HomeRow key={g.title} title={`Widget: ${g.title}`}>
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  {g.keys.map(([k, label]) => (
                    <TextField key={k} label={label} details={main(c.widget.texts[k])} maxLength={200} value={current.texts[k] ?? ""} onValue={(v) => edit((l) => ({ ...l, texts: { ...l.texts, [k]: v } }))} />
                  ))}
                </s-grid>
              </HomeRow>
            ))}

            <HomeRow title="Rewards page">
              <s-stack gap="base">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  <TextField label="Title" details={main(c.page.title)} maxLength={60} value={current.page.title} onValue={(v) => edit((l) => ({ ...l, page: { ...l.page, title: v } }))} />
                  <TextField label="Text under the title" details={main(c.page.sub)} maxLength={200} value={current.page.sub} onValue={(v) => edit((l) => ({ ...l, page: { ...l.page, sub: v } }))} />
                </s-grid>
                {c.page.how.map((h, i) => (
                  <s-grid key={`how${i}`} gridTemplateColumns="1fr 2fr" gap="base">
                    <TextField label={`Step ${i + 1}`} details={main(h.t)} maxLength={40} value={howAt(current, i).t} onValue={(v) => setHow(i, { t: v })} />
                    <TextField label={`Step ${i + 1} text`} details={main(h.x)} maxLength={160} value={howAt(current, i).x} onValue={(v) => setHow(i, { x: v })} />
                  </s-grid>
                ))}
                {c.page.faq.map((f, i) => (
                  <s-stack key={`faq${i}`} gap="small-200">
                    <TextField label={`Question ${i + 1}`} details={main(f.q)} maxLength={160} value={faqAt(current, i).q} onValue={(v) => setFaq(i, { q: v })} />
                    <TextArea label={`Answer ${i + 1}`} details={main(f.a)} rows={2} maxLength={600} value={faqAt(current, i).a} onValue={(v) => setFaq(i, { a: v })} />
                  </s-stack>
                ))}
              </s-stack>
            </HomeRow>

            {c.rewards.length ? (
              <HomeRow title="Reward names">
                <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                  {c.rewards.map((r) => (
                    <TextField key={r.id} label={r.title} details={`${r.points.toLocaleString("en-US")} ${c.unit.many}`} maxLength={80} value={current.rewards[r.id] ?? ""} onValue={(v) => edit((l) => ({ ...l, rewards: { ...l.rewards, [r.id]: v } }))} />
                  ))}
                </s-grid>
              </HomeRow>
            ) : null}

            {EMAIL_KINDS.map((k) => {
              const m = c.emails.texts[k];
              const x = current.emails[k];
              return (
                <HomeRow key={k} title={`Email: ${EMAIL_INFO[k].title}`} subtitle={EMAIL_INFO[k].when}>
                  <s-stack gap="base">
                    <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                      <TextField label="Subject" details={main(m.subject)} maxLength={120} value={x?.subject ?? ""} onValue={(v) => setEmail(k, "subject", v)} />
                      <TextField label="Heading" details={main(m.heading)} maxLength={120} value={x?.heading ?? ""} onValue={(v) => setEmail(k, "heading", v)} />
                    </s-grid>
                    <TextArea label="Text" details={main(m.body)} rows={2} maxLength={600} value={x?.body ?? ""} onValue={(v) => setEmail(k, "body", v)} />
                    <TextField label="Button" details={main(m.button)} maxLength={40} value={x?.button ?? ""} onValue={(v) => setEmail(k, "button", v)} />
                  </s-stack>
                </HomeRow>
              );
            })}

            <HomeRow title="Emails: small print">
              <s-grid gridTemplateColumns="2fr 1fr" gap="base">
                <TextField label="Footer" details={main(c.emails.footer)} maxLength={300} value={current.footer} onValue={(v) => edit((l) => ({ ...l, footer: v }))} />
                <TextField label="Unsubscribe link" details={main("Unsubscribe")} maxLength={40} value={current.unsubscribe} onValue={(v) => edit((l) => ({ ...l, unsubscribe: v }))} />
              </s-grid>
            </HomeRow>
          </>
        ) : null}
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
