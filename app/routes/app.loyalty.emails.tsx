/**
 * Loyalty → Emails: emails on or off, who they come from (the store's own address after 3 DNS records and
 * Verify, else the default sender with the store's address as Reply To), the look, each email's words with a
 * preview and a test send, and the latest emails with why any were skipped. Server side: lib/loyalty/mailer.server.ts.
 */
import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { errorMessage, gql } from "../lib/admin.server";
import { getProgram, saveProgramConfig } from "../lib/loyalty/program.server";
import { DEFAULT_FROM, emailLog, getSender, removeSender, sendTest, setupSender, verifySender } from "../lib/loyalty/mailer.server";
import { mailProvider } from "../lib/email/provider.server";
import { EMAIL_INFO, EMAIL_KINDS, MONTHLY_EMAILS, SAMPLE_WORDS, isFreeMailbox, isReminder, renderEmail, type EmailKind, type EmailText } from "../lib/loyalty/emails";
import { pointsLabel, withLoyaltyDefaults, type LoyaltyConfig } from "../lib/loyalty/config";
import { Button, ColorField, Select, Switch, TextArea, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Pill } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import { loyaltyAccess, planned } from "../lib/loyalty/plan.server";
import { ProNote } from "../components/ProNote";
import { UsageBars } from "../components/UsageBars";
import { limitOf } from "../lib/plans";
import { SaveControls, changed } from "../components/SaveControls";
import css from "../components/TrackingHub.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [p, log, sender, shop, access] = await Promise.all([
    getProgram(session.shop),
    emailLog(session.shop),
    getSender(session.shop),
    gql(admin, `#graphql
      query CroLoyaltyEmailShop { shop { name email contactEmail primaryDomain { url } } }`).catch(() => null),
    loyaltyAccess(admin, session.shop),
  ]);
  const provider = mailProvider();
  return {
    config: p.config,
    saved: p.saved,
    programOn: p.on,
    pro: access.pro,
    emailLimit: limitOf(access.plan, "loyaltyEmails") ?? MONTHLY_EMAILS,
    log,
    sender,
    ready: provider.ready(),
    domainsReady: provider.domainsReady(),
    defaultFrom: DEFAULT_FROM(),
    store: { name: String(shop?.shop?.name ?? "Your store"), email: String(shop?.shop?.contactEmail || shop?.shop?.email || ""), url: String(shop?.shop?.primaryDomain?.url ?? "") },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "save");
  try {
    const { config } = await getProgram(session.shop);
    if (intent === "save") {
      await saveProgramConfig(session.shop, JSON.parse(String(form.get("config"))));
      return { ok: true, error: null, intent, message: "Saved" };
    }
    if (intent === "sender") {
      if (!(await loyaltyAccess(admin, session.shop)).pro) throw new Error("Sending from your own address is on the Pro plan.");
      const email = String(form.get("email") ?? "");
      const s = await setupSender(session.shop, email);
      await saveProgramConfig(session.shop, { ...config, emails: { ...config.emails, sender: { email: s.email, name: String(form.get("name") ?? "") } } });
      return { ok: true, error: null, intent, message: s.verified ? "Verified. Emails now come from your address." : "Add the DNS records, then click Verify." };
    }
    if (intent === "verify") {
      const s = await verifySender(session.shop);
      return { ok: !!s?.verified, error: s?.verified ? null : "Not verified yet. DNS changes can take up to a few hours; try again later.", intent, message: "Verified. Emails now come from your address." };
    }
    if (intent === "removeSender") {
      await removeSender(session.shop);
      await saveProgramConfig(session.shop, { ...config, emails: { ...config.emails, sender: { email: "", name: "" } } });
      return { ok: true, error: null, intent, message: "Emails come from the default sender again." };
    }
    if (intent === "test") {
      // The words on the page now, saved or not.
      const access = await loyaltyAccess(admin, session.shop);
      const draft = planned(withLoyaltyDefaults({ ...config, ...JSON.parse(String(form.get("config") ?? "{}")) }), access);
      const sent = await sendTest(admin, session.shop, draft, String(form.get("kind")) as EmailKind, String(form.get("to") ?? "").trim(), undefined, limitOf(access.plan, "loyaltyEmails") ?? MONTHLY_EMAILS);
      return { ok: true, error: null, intent, message: `Test sent from ${sent.from}` };
    }
    return { ok: false, error: "Unknown action", intent, message: "" };
  } catch (e) {
    return { ok: false, error: errorMessage(e), intent, message: "" };
  }
};

type C = LoyaltyConfig;
const STATUS: Record<string, { label: string; tone?: "ok" | "warn" }> = { sent: { label: "Sent", tone: "ok" }, skipped: { label: "Skipped" }, failed: { label: "Failed", tone: "warn" }, bounced: { label: "Bounced", tone: "warn" } };

export default function LoyaltyEmails() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [cfg, setCfg] = useState<C>(d.config);
  const [loaded, setLoaded] = useState(d.config);
  const [kind, setKind] = useState<EmailKind>("earned");
  const [to, setTo] = useState(d.store.email);
  // A free mailbox (Gmail...) can't be verified, so it isn't offered as the sender.
  const [senderEmail, setSenderEmail] = useState(d.sender?.email || d.config.emails.sender.email || (isFreeMailbox(d.store.email) ? "" : d.store.email));
  const [senderName, setSenderName] = useState(d.config.emails.sender.name);
  if (loaded !== d.config) {
    setLoaded(d.config);
    setCfg(d.config);
  }
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (!fetcher.data.ok) shopify.toast.show(fetcher.data.error || "Not done", { isError: true, duration: 8000 });
    else shopify.toast.show(fetcher.data.message || "Saved");
  }, [fetcher.state, fetcher.data, shopify]);

  const e = cfg.emails;
  const setEmails = (patch: Partial<C["emails"]>) => setCfg((c) => ({ ...c, emails: { ...c.emails, ...patch } }));
  const setText = (k: EmailKind, patch: Partial<EmailText>) => setEmails({ texts: { ...e.texts, [k]: { ...e.texts[k], ...patch } } });
  const busy = (i: string) => fetcher.state !== "idle" && fetcher.formData?.get("intent") === i;
  const own = d.pro && d.sender && d.sender.verified && e.sender.email === d.sender.email;
  const from = own ? `${e.sender.name || d.store.name} <${e.sender.email}>` : `${d.store.name} <${d.defaultFrom}>`;
  const words = useMemo(() => ({ ...SAMPLE_WORDS, unit: cfg.unit.many, balance: pointsLabel(cfg, 1250), points: pointsLabel(cfg, 120), gift: pointsLabel(cfg, 200) }), [cfg]);
  const preview = useMemo(() => renderEmail(e, kind, { name: d.store.name, url: d.store.url }, words, "#unsubscribe", d.store.url), [e, kind, d.store, words]);
  const t = e.texts[kind];
  const r = d.sender?.records;
  const records = r
    ? [
        { type: "TXT", host: r.dkimHost, value: r.dkimValue, ok: r.dkimVerified, what: "DKIM: proves the emails come from your domain" },
        { type: "CNAME", host: r.returnPathHost, value: r.returnPathValue, ok: r.returnPathVerified, what: "Return Path: bounces come back to the app" },
        { type: "TXT", host: `_dmarc.${d.sender!.domain}`, value: "v=DMARC1; p=none;", ok: d.sender!.dmarc, what: "DMARC: asked for by Gmail and Yahoo (skip it if your domain has one)" },
      ]
    : [];

  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <SaveControls dirty={changed(cfg, d.config)} saving={busy("save")} saved={d.saved} onSave={() => fetcher.submit({ intent: "save", config: JSON.stringify(cfg) }, { method: "post" })} onDiscard={() => setCfg(d.config)} />
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="Emails tell members what they earned, when a reward is ready and when points are about to expire. Reminders go only to customers subscribed to your email marketing." />

        <HomeRow title="Emails">
          <s-stack gap="base">
            <Switch label="Emails are on" details={d.programOn ? undefined : "They start when the program is on (Loyalty home)."} checked={e.on} onValue={(v) => setEmails({ on: v })} />
            <s-text color="subdued">{`Up to ${d.emailLimit.toLocaleString()} emails a month are included on your plan. Sent this month: ${d.log.month.toLocaleString()}.`}</s-text>
            <UsageBars only={["loyaltyEmails"]} />
            {!d.ready ? (
              <s-banner tone="warning" heading="Emails can't be sent yet">
                <s-paragraph>The email service is still being set up. Settings are saved now and emails start once it is ready.</s-paragraph>
              </s-banner>
            ) : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Sender" subtitle={`Emails come from ${from}${own ? "" : `, and replies go to ${d.store.email || "your store's email"}`}.`}>
          <s-stack gap="base">
            {d.pro ? null : <ProNote text="Sending from your own address is on the Pro plan. On your plan, emails come from the default sender with your address as Reply To." />}
            <s-text>Send from your own address (recommended): emails show your address, and inboxes trust them more. Add 3 DNS records where your domain is managed, then click Verify.</s-text>
            {isFreeMailbox(d.store.email) && !d.sender ? <s-text color="subdued">{`Your store's email (${d.store.email}) is a free address, which can't send for a store. Use an address at your own domain, or keep the default sender.`}</s-text> : null}
            <s-grid gridTemplateColumns="minmax(0, 1.4fr) minmax(0, 1fr) auto" gap="base" alignItems="end">
              <TextField label="Your sender address" placeholder="hello@yourstore.com" maxLength={254} value={senderEmail} onValue={setSenderEmail} />
              <TextField label="Sender name" placeholder={d.store.name} maxLength={60} value={senderName} onValue={setSenderName} />
              <Button loading={busy("sender")} disabled={!d.domainsReady || !d.pro} onClick={() => fetcher.submit({ intent: "sender", email: senderEmail, name: senderName }, { method: "post" })}>
                {d.sender ? "Update" : "Get the DNS records"}
              </Button>
            </s-grid>
            {d.sender ? (
              <s-stack gap="small-200">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-text type="strong">{d.sender.domain}</s-text>
                  <Pill tone={d.sender.verified ? "ok" : "warn"}>{d.sender.verified ? "Verified" : "Not verified yet"}</Pill>
                </s-stack>
                {records.map((x) => (
                  <s-box key={x.host} padding="small-200" borderWidth="base" borderRadius="base">
                    <s-stack gap="small-100">
                      <s-stack direction="inline" gap="small-200" alignItems="center">
                        <s-text type="strong">{x.type}</s-text>
                        <Pill tone={x.ok ? "ok" : undefined}>{x.ok ? "Found" : "Not found yet"}</Pill>
                        <s-text color="subdued">{x.what}</s-text>
                      </s-stack>
                      <s-text>{`Host: ${x.host}`}</s-text>
                      <s-text>{`Value: ${x.value}`}</s-text>
                    </s-stack>
                  </s-box>
                ))}
                <s-stack direction="inline" gap="small-200">
                  <Button variant="primary" loading={busy("verify")} onClick={() => fetcher.submit({ intent: "verify" }, { method: "post" })}>
                    Verify
                  </Button>
                  <Button variant="tertiary" tone="critical" loading={busy("removeSender")} onClick={() => fetcher.submit({ intent: "removeSender" }, { method: "post" })}>
                    Use the default sender
                  </Button>
                </s-stack>
                <s-text color="subdued">If the records stop working, emails come from the default sender until they work again.</s-text>
              </s-stack>
            ) : null}
          </s-stack>
        </HomeRow>

        <HomeRow title="Look">
          <s-grid gridTemplateColumns="minmax(0, 1.4fr) minmax(0, 1fr)" gap="base" alignItems="start">
            <TextField label="Logo" details="A link to your logo image (https). Empty: your store's name." placeholder="https://cdn.shopify.com/..." maxLength={500} value={e.logo} onValue={(v) => setEmails({ logo: v })} />
            <ColorField label="Button colour" value={e.accent} onValue={(v) => setEmails({ accent: v })} />
          </s-grid>
          <TextField label="Small print" details="Above the unsubscribe link. {store} is your store's name." maxLength={300} value={e.footer} onValue={(v) => setEmails({ footer: v })} />
        </HomeRow>

        <HomeRow title={`Your emails (${EMAIL_KINDS.filter((k) => e.texts[k].on).length} of ${EMAIL_KINDS.length} on)`}>
          <s-stack gap="small-200">
            {EMAIL_KINDS.map((k) => (
              <s-stack key={k} direction="inline" gap="base" alignItems="center" justifyContent="space-between">
                <s-stack gap="small-100">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-text type="strong">{EMAIL_INFO[k].title}</s-text>
                    {isReminder(k) ? <Pill>Reminder</Pill> : null}
                  </s-stack>
                  <s-text color="subdued">{EMAIL_INFO[k].when}</s-text>
                </s-stack>
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <Button variant="tertiary" onClick={() => setKind(k)}>
                    Edit
                  </Button>
                  <Switch label={e.texts[k].on ? "On" : "Off"} checked={e.texts[k].on} onValue={(v) => setText(k, { on: v })} />
                </s-stack>
              </s-stack>
            ))}
          </s-stack>
        </HomeRow>

        <HomeRow title="Edit and preview">
          <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1.2fr)" gap="large" alignItems="start">
            <s-stack gap="base">
              <Select label="Email" value={kind} options={EMAIL_KINDS.map((k) => ({ value: k, label: EMAIL_INFO[k].title }))} onValue={(v) => setKind(v as EmailKind)} />
              <TextField label="Subject" maxLength={120} value={t.subject} onValue={(v) => setText(kind, { subject: v })} />
              <TextField label="Heading" maxLength={120} value={t.heading} onValue={(v) => setText(kind, { heading: v })} />
              <TextArea label="Text" rows={3} maxLength={600} value={t.body} onValue={(v) => setText(kind, { body: v })} />
              <TextField label="Button" maxLength={40} value={t.button} onValue={(v) => setText(kind, { button: v })} />
              <s-text color="subdued">{`Words filled in: ${["unit", ...EMAIL_INFO[kind].words].map((w) => `{${w}}`).join(" ")}`}</s-text>
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="end">
                <TextField label="Send a test to" placeholder="you@example.com" maxLength={254} value={to} onValue={setTo} />
                <Button loading={busy("test")} disabled={!d.ready} onClick={() => fetcher.submit({ intent: "test", kind, to, config: JSON.stringify({ emails: cfg.emails, unit: cfg.unit }) }, { method: "post" })}>
                  Send test
                </Button>
              </s-grid>
            </s-stack>
            <s-stack gap="small-200">
              <s-text color="subdued">{`Subject: ${preview.subject}`}</s-text>
              <iframe title="Email preview" srcDoc={preview.html} sandbox="" style={{ width: "100%", height: 520, border: "1px solid #e3e3e3", borderRadius: 12, background: "#f4f4f5" }} />
            </s-stack>
          </s-grid>
        </HomeRow>

        <HomeRow title="Latest emails">
          {d.log.latest.length ? (
            <div className={css.list}>
              {d.log.latest.map((x) => (
                <div key={x.id} className={css.item}>
                  <span>{`${EMAIL_INFO[x.kind as EmailKind]?.title ?? x.kind} · ${x.to || "a member"} · ${new Date(x.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${x.reason ? ` · ${x.reason}` : ""}`}</span>
                  <Pill tone={STATUS[x.status]?.tone}>{STATUS[x.status]?.label ?? x.status}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <s-text color="subdued">No emails yet. When a member earns points, their email shows here.</s-text>
          )}
        </HomeRow>
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
