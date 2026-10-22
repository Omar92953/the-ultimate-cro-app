/**
 * Loyalty → Members: export the members as CSV, and import points by email from a CSV (for example from another
 * loyalty app). An import is read twice: first for a preview of what will change, then to apply it. Every change
 * is a ledger row of kind "import" through `record` (lib/loyalty/program.server.ts), so balances always add up;
 * the preview's token makes a double click apply it once. An email that isn't a member yet becomes one when it
 * belongs to a customer of the store (found by email; names are never read).
 */
import db from "../../db.server";
import { AdminError, gql, type AdminClient } from "../admin.server";
import { excludedTags, type LoyaltyConfig } from "./config";
import { isExcluded } from "./points";
import { memberFor, record } from "./program.server";

export const MAX_IMPORT_ROWS = 5000;
export type ImportMode = "set" | "add";

/* ------------------------------------------------------------------ export -- */
/** A CSV cell: quoted, and a leading = + - @ made harmless so a spreadsheet never runs it as a formula. */
export const cell = (v: unknown) => {
  const s = String(v ?? "");
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};
export const toCsv = (cols: string[], rows: unknown[][]) => [cols.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");

export async function membersCsv(shop: string, c: LoyaltyConfig) {
  const members = await db.loyaltyMember.findMany({ where: { shop }, orderBy: { joinedAt: "asc" }, select: { email: true, points: true, pending: true, tier: true, referralCode: true, joinedAt: true } });
  const tierName = new Map(c.tiers.list.map((t) => [t.id, t.name]));
  return {
    count: members.length,
    csv: toCsv(["email", "points", "pending", "tier", "referral_code", "joined"], members.map((m) => [m.email, m.points, m.pending, m.tier ? tierName.get(m.tier) ?? m.tier : "", m.referralCode, m.joinedAt.toISOString().slice(0, 10)])),
  };
}

/* ------------------------------------------------------------------ import -- */
/** RFC 4180 CSV: quoted cells with commas, quotes ("") and line breaks; comma or semicolon separated. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) row.push(cur), (cur = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur), rows.push(row), (row = []), (cur = "");
    } else cur += ch;
  }
  if (cur || row.length) row.push(cur), rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type ImportRow = { line: number; email: string; points: number };
export type ImportRead = { rows: ImportRow[]; problems: { line: number; reason: string }[]; error: string | null };

/** The rows of an import: an "email" column and a "points" column (also "balance" or "points balance"), any order. */
export function readImport(text: string): ImportRead {
  const all = parseCsv(text);
  if (!all.length) return { rows: [], problems: [], error: "The file is empty." };
  const head = all[0].map((h) => h.trim().toLowerCase().replace(/[\s_]+/g, " "));
  const ei = head.findIndex((h) => h === "email" || h === "email address" || h === "e mail");
  const pi = head.findIndex((h) => ["points", "balance", "points balance", "point balance"].includes(h));
  if (ei < 0 || pi < 0) return { rows: [], problems: [], error: "The first row needs an email column and a points column." };
  const body = all.slice(1);
  if (body.length > MAX_IMPORT_ROWS) return { rows: [], problems: [], error: `Up to ${MAX_IMPORT_ROWS.toLocaleString("en-US")} rows at a time. This file has ${body.length.toLocaleString("en-US")}. Split it and import each part.` };
  const rows: ImportRow[] = [], problems: ImportRead["problems"] = [];
  const seen = new Map<string, number>();
  body.forEach((r, i) => {
    const line = i + 2;
    const email = (r[ei] ?? "").trim().toLowerCase();
    const raw = (r[pi] ?? "").trim().replace(/[\s,]/g, "");
    const points = Number(raw);
    if (!EMAIL.test(email)) return void problems.push({ line, reason: email ? `"${email.slice(0, 60)}" is not an email` : "No email" });
    if (!raw || !Number.isInteger(points) || Math.abs(points) > 1_000_000) return void problems.push({ line, reason: `"${raw.slice(0, 20)}" is not a whole number of points` });
    if (seen.has(email)) return void problems.push({ line, reason: `${email} is also on line ${seen.get(email)}; only the first is used` });
    seen.set(email, line);
    rows.push({ line, email, points });
  });
  return { rows, problems, error: rows.length ? null : problems.length ? "No row can be used." : "The file has no rows under the first one." };
}

type Found = { id: string; email: string; locale: string; tags: string[]; marketing: boolean };

/** The store's customers with these emails (50 a query). Only id, email, locale, tags and marketing consent are read. */
async function customersByEmail(admin: AdminClient, emails: string[]) {
  const out = new Map<string, Found>();
  for (let i = 0; i < emails.length; i += 50) {
    const part = emails.slice(i, i + 50);
    const d = await gql(admin, `#graphql
      query CroLoyaltyImportCustomers($q: String!, $first: Int!) { customers(first: $first, query: $q) { nodes { id locale tags defaultEmailAddress { emailAddress marketingState } } } }`, { q: part.map((e) => `email:"${e.replace(/["\\]/g, "")}"`).join(" OR "), first: part.length });
    for (const n of d.customers?.nodes ?? []) {
      const email = String(n.defaultEmailAddress?.emailAddress ?? "").toLowerCase();
      if (email && part.includes(email) && !out.has(email)) out.set(email, { id: String(n.id).split("/").pop()!, email, locale: n.locale ?? "", tags: n.tags ?? [], marketing: n.defaultEmailAddress?.marketingState === "SUBSCRIBED" });
    }
  }
  return out;
}

export type PlanStatus = "change" | "same" | "new" | "no_customer" | "blocked" | "excluded";
export type PlanRow = { line: number; email: string; status: PlanStatus; current: number; next: number; memberId: number | null; customer: Found | null };

/** What the import would do to each row: `set` makes the member's ready points this number, `add` adds it (negative takes away, never below 0). */
export async function planImport(admin: AdminClient, shop: string, c: LoyaltyConfig, rows: ImportRow[], mode: ImportMode): Promise<PlanRow[]> {
  const emails = rows.map((r) => r.email);
  const members = new Map<string, { id: number; points: number; blocked: boolean }>();
  for (let i = 0; i < emails.length; i += 500) {
    for (const m of await db.loyaltyMember.findMany({ where: { shop, email: { in: emails.slice(i, i + 500) } }, select: { id: true, email: true, points: true, blocked: true } })) {
      if (!members.has(m.email.toLowerCase())) members.set(m.email.toLowerCase(), m);
    }
  }
  const unknown = emails.filter((e) => !members.has(e));
  const customers = unknown.length ? await customersByEmail(admin, unknown) : new Map<string, Found>();
  const excluded = excludedTags(c);
  return rows.map((r) => {
    const m = members.get(r.email);
    const current = m?.points ?? 0;
    const next = Math.max(0, mode === "set" ? r.points : current + r.points);
    const base = { line: r.line, email: r.email, current, next, memberId: m?.id ?? null, customer: null };
    if (m) return { ...base, status: m.blocked ? "blocked" : next === current ? "same" : "change" };
    const cu = customers.get(r.email) ?? null;
    if (!cu) return { ...base, status: "no_customer" };
    if (isExcluded(cu.tags, excluded)) return { ...base, customer: cu, status: "excluded" };
    return { ...base, customer: cu, status: next === 0 ? "same" : "new" };
  });
}

/** Counts and the first rows of each kind, for the preview. */
export function previewOf(plan: PlanRow[], problems: ImportRead["problems"]) {
  const count = (s: PlanStatus) => plan.filter((p) => p.status === s).length;
  const delta = plan.filter((p) => p.status === "change" || p.status === "new").reduce((n, p) => n + (p.next - p.current), 0);
  return {
    rows: plan.length,
    change: count("change"),
    created: count("new"),
    same: count("same"),
    skipped: count("no_customer") + count("blocked") + count("excluded"),
    delta,
    sample: plan.filter((p) => p.status !== "same").slice(0, 50).map((p) => ({ line: p.line, email: p.email, status: p.status, current: p.current, next: p.next })),
    problems: problems.slice(0, 50),
    problemCount: problems.length,
  };
}

/** Applies a previewed import. `token` (from the preview) makes it happen once per member however often it is sent. */
export async function applyImport(admin: AdminClient, shop: string, c: LoyaltyConfig, text: string, mode: ImportMode, token: string) {
  if (!/^[a-z0-9]{8,32}$/.test(token)) throw new AdminError("Preview the file again before importing.");
  const read = readImport(text);
  if (read.error) throw new AdminError(read.error);
  const plan = await planImport(admin, shop, c, read.rows, mode);
  let changed = 0, created = 0;
  for (const p of plan) {
    if (p.status !== "change" && p.status !== "new") continue;
    let id = p.memberId;
    if (!id && p.customer) {
      const m = await memberFor(shop, { id: p.customer.id, email: p.customer.email, firstName: "", locale: p.customer.locale, tags: p.customer.tags, marketing: p.customer.marketing }, true, c.memberCap ?? null);
      // At the plan's member limit nobody new joins (the rest of the file still updates members).
      if (!m) continue;
      id = m.id;
      created++;
      // Made just now: its points are 0, so "set" and "add" both add the number.
    }
    const now = p.memberId ? (await db.loyaltyMember.findUnique({ where: { id: id! }, select: { points: true } }))?.points ?? 0 : 0;
    const diff = mode === "set" ? p.next - now : p.next - p.current;
    if (!diff) continue;
    const ev = await record(shop, id!, { kind: "import", points: diff, note: mode === "set" ? "CSV import, points set" : "CSV import, points added", dedupe: `import:${token}:${id}` });
    if (ev && p.memberId) changed++;
  }
  return { changed, created };
}
