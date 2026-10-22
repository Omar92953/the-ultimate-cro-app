/**
 * Loyalty → Members: search by email or referral code, with points, pending points, lifetime points and orders.
 * Import and export: members as CSV, and points by email from a CSV with a preview first (lib/loyalty/csv.server.ts).
 */
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getProgram, listMembers } from "../lib/loyalty/program.server";
import { MAX_IMPORT_ROWS, applyImport, membersCsv, planImport, previewOf, readImport } from "../lib/loyalty/csv.server";
import type { ImportMode } from "../lib/loyalty/csv.server";
import { errorMessage } from "../lib/admin.server";
import { Button, DropZone, TextField } from "../components/fields";
import { HomeRow, HomeRows, PageIntro, Pill, Segmented } from "../components/ui";
import { FeatureTabs } from "../components/FeatureNav";
import css from "../components/OfferList.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const members = await listMembers(session.shop, q, 100);
  return { q, maxRows: MAX_IMPORT_ROWS, members: members.map((m) => ({ id: m.id, email: m.email, points: m.points, pending: m.pending, lifetime: m.lifetime, orders: m.orders, blocked: m.blocked, joinedAt: m.joinedAt.toISOString() })) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  try {
    const { config } = await getProgram(session.shop);
    if (intent === "export") return { ok: true as const, intent, ...(await membersCsv(session.shop, config)) };
    const text = String(form.get("csv") ?? "");
    const mode: ImportMode = form.get("mode") === "add" ? "add" : "set";
    if (text.length > 2_000_000) return { ok: false as const, intent, error: "The file is too big. Split it and import each part." };
    if (intent === "preview") {
      const read = readImport(text);
      if (read.error) return { ok: false as const, intent, error: read.error, problems: read.problems.slice(0, 20) };
      const plan = await planImport(admin, session.shop, config, read.rows, mode);
      return { ok: true as const, intent, mode, preview: previewOf(plan, read.problems), token: Math.random().toString(36).slice(2, 12) };
    }
    if (intent === "import") return { ok: true as const, intent, done: await applyImport(admin, session.shop, config, text, mode, String(form.get("token") ?? "")) };
    throw new Error("Unknown action.");
  } catch (e) {
    return { ok: false as const, intent, error: errorMessage(e) };
  }
};

const STATUS_LABEL: Record<string, string> = { change: "Points change", new: "Joins the program", no_customer: "No customer with this email", blocked: "Blocked member, skipped", excluded: "Excluded by tag, skipped" };

/** Import and export: the members as CSV, and points by email from a CSV, previewed before anything changes. */
function ImportExport({ maxRows }: { maxRows: number }) {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [mode, setMode] = useState<ImportMode>("set");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const busy = (i: string) => fetcher.state !== "idle" && fetcher.formData?.get("intent") === i;
  const d = fetcher.data;
  const preview = d && d.ok && "preview" in d && d.mode === mode ? d : null;
  useEffect(() => {
    if (fetcher.state !== "idle" || !d) return;
    if (!d.ok) return void shopify.toast.show(d.error || "Something went wrong", { isError: true });
    if ("csv" in d) {
      if (!d.count) return void shopify.toast.show("No members yet");
      const url = URL.createObjectURL(new Blob([d.csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "loyalty-members.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else if ("done" in d && d.done) {
      shopify.toast.show(`${d.done.changed} member${d.done.changed === 1 ? "" : "s"} changed, ${d.done.created} joined`);
    }
  }, [fetcher.state, d, shopify]);
  const send = (intent: string, extra: Record<string, string> = {}) => file && fetcher.submit({ intent, csv: file.text, mode, ...extra }, { method: "post" });
  return (
    <HomeRow title="Import and export" subtitle="Download every member, or bring points in from a CSV, for example from another loyalty app.">
      <s-stack gap="base">
        <s-stack direction="inline" gap="small-200">
          <Button icon="export" loading={busy("export")} onClick={() => fetcher.submit({ intent: "export" }, { method: "post" })}>
            Export members (CSV)
          </Button>
        </s-stack>
        <s-divider />
        <s-text type="strong">Import points</s-text>
        <s-text color="subdued">{`A CSV with an email column and a points column, up to ${maxRows.toLocaleString()} rows. Emails that belong to a customer of the store but aren't members yet join the program. Nothing changes until you check the preview and import.`}</s-text>
        <Segmented<ImportMode>
          label="What the points column does"
          value={mode}
          onChange={setMode}
          options={[
            { value: "set", label: "Set points to this number" },
            { value: "add", label: "Add this number" },
          ]}
        />
        <DropZone label={file ? `Chosen: ${file.name}` : "Choose a CSV file"} accept=".csv,text/csv" onFiles={(files) => void files[0].text().then((text) => setFile({ name: files[0].name, text }))} />
        {file ? (
          <s-stack direction="inline" gap="small-200">
            <Button loading={busy("preview")} onClick={() => send("preview")}>
              Preview
            </Button>
          </s-stack>
        ) : null}
        {d && !d.ok && d.intent === "preview" && "problems" in d && d.problems?.length ? (
          <s-banner tone="critical" heading={d.error}>
            {d.problems.map((p) => `Line ${p.line}: ${p.reason}`).join(". ")}
          </s-banner>
        ) : null}
        {preview && file ? (
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text type="strong">{`${preview.preview.change} members change, ${preview.preview.created} join, ${preview.preview.same} stay the same, ${preview.preview.skipped} skipped`}</s-text>
              <s-text color="subdued">{`${preview.preview.delta >= 0 ? "Adds" : "Takes away"} ${Math.abs(preview.preview.delta).toLocaleString()} points in all. Imported points don't count toward VIP tiers.`}</s-text>
              {preview.preview.sample.length ? (
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Email</s-table-header>
                    <s-table-header>What happens</s-table-header>
                    <s-table-header format="numeric">Now</s-table-header>
                    <s-table-header format="numeric">After</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {preview.preview.sample.map((r) => (
                      <s-table-row key={r.line}>
                        <s-table-cell>{r.email}</s-table-cell>
                        <s-table-cell>{STATUS_LABEL[r.status] ?? r.status}</s-table-cell>
                        <s-table-cell>{r.current.toLocaleString()}</s-table-cell>
                        <s-table-cell>{["change", "new"].includes(r.status) ? r.next.toLocaleString() : r.current.toLocaleString()}</s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
              ) : null}
              {preview.preview.sample.length < preview.preview.change + preview.preview.created + preview.preview.skipped ? <s-text color="subdued">The first 50 rows are shown.</s-text> : null}
              {preview.preview.problemCount ? <s-text color="subdued">{`${preview.preview.problemCount} line${preview.preview.problemCount === 1 ? "" : "s"} can't be used: ${preview.preview.problems.slice(0, 5).map((p) => `line ${p.line}, ${p.reason}`).join("; ")}${preview.preview.problemCount > 5 ? "; and more" : ""}.`}</s-text> : null}
              <s-stack direction="inline" gap="small-200">
                <Button variant="primary" disabled={!preview.preview.change && !preview.preview.created} loading={busy("import")} onClick={() => send("import", { token: preview.token })}>
                  {`Import ${preview.preview.change + preview.preview.created} member${preview.preview.change + preview.preview.created === 1 ? "" : "s"}`}
                </Button>
              </s-stack>
            </s-stack>
          </s-box>
        ) : null}
      </s-stack>
    </HomeRow>
  );
}

export default function LoyaltyMembers() {
  const d = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <s-page heading="Loyalty program" inlineSize="large">
      <HomeRows>
        <FeatureTabs feature="loyalty" />
        <PageIntro text="Everyone in the program, newest activity first. Open a member to see their history or change their points." />
        <HomeRow title="Members" bare>
          <section className={css.list}>
            <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="end">
              <TextField label="Search" placeholder="Email or referral code" value={q} onValue={setQ} />
              <Button onClick={() => navigate(q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "?")}>Search</Button>
            </s-grid>
            {d.members.length ? (
              <div className={css.table} role="table" aria-label="Members">
                <div className={`${css.row} ${css.header}`} role="row">
                  <span role="columnheader">Member</span>
                  <span role="columnheader">Ready</span>
                  <span role="columnheader" className={css.num}>Lifetime</span>
                  <span role="columnheader" className={css.num}>Orders</span>
                </div>
                {d.members.map((m) => (
                  <div key={m.id} className={css.row} role="row">
                    <span className={css.main} role="cell">
                      <a className={css.name} href={`/app/loyalty/members/${m.id}`} onClick={(e) => (e.preventDefault(), navigate(`/app/loyalty/members/${m.id}`))}>
                        {m.email || `Member ${m.id}`}
                      </a>
                      <span className={css.sub}>
                        <span>{`Joined ${new Date(m.joinedAt).toLocaleDateString()}`}</span>
                        {m.blocked ? <Pill>Blocked</Pill> : null}
                      </span>
                    </span>
                    <span role="cell" className={css.stat} data-label="Ready">
                      {m.points.toLocaleString()}
                      {m.pending ? <span className={css.muted}>{` +${m.pending.toLocaleString()} pending`}</span> : null}
                    </span>
                    <span role="cell" className={`${css.num} ${css.stat}`} data-label="Lifetime">
                      {m.lifetime.toLocaleString()}
                    </span>
                    <span role="cell" className={`${css.num} ${css.stat}`} data-label="Orders">
                      {m.orders}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={css.empty}>
                <strong>{d.q ? "No member matches" : "No members yet"}</strong>
                <span>{d.q ? "Try another email or code." : "Customers join with their first paid order or their account once the program is on."}</span>
              </div>
            )}
          </section>
        </HomeRow>
        <ImportExport maxRows={d.maxRows} />
      </HomeRows>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
