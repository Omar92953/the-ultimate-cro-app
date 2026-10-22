/**
 * Loyalty emails, server side. Events queue an email (`notify`, one LoyaltyEmail row, deduplicated); the
 * loyalty run (sync.server.ts, every 10 minutes) adds the scheduled ones (reward ready, points expiring, the
 * monthly summary) and sends what is queued. Each email is checked again before it goes: emails on, the email
 * on, the member not blocked or unsubscribed, marketing consent for reminders, and the store's fair use of
 * MONTHLY_EMAILS a month. Skipped emails keep the reason, for the log on the Emails page.
 *
 * Sender: the store's own address once its domain is verified (DKIM through Postmark), checked again daily;
 * until then, or if it stops verifying, "Store name <rewards@mail.crotoolbox.com>" with Reply To the store's email.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import db from "../../db.server";
import { gql, type AdminClient } from "../admin.server";
import { mailProvider, type DomainRecords, type MailProvider, type OutMail } from "../email/provider.server";
import { pointsLabel, type LoyaltyConfig } from "./config";
import { eventTargets, queueEvents } from "./integrations.server";
import { EMAIL_KINDS, MONTHLY_EMAILS, SAMPLE_WORDS, isFreeMailbox, isReminder, renderEmail, validEmail, type EmailKind } from "./emails";

const DAY = 86_400_000;
export const DEFAULT_FROM = () => process.env.LOYALTY_EMAIL_FROM || "rewards@mail.crotoolbox.com";
const appUrl = () => (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");
const secret = () => process.env.SHOPIFY_API_SECRET || "development-only";
const sign = (s: string) => createHmac("sha256", secret()).update(s).digest("base64url");

/* --------------------------------------------------------- unsubscribe -- */
export const unsubToken = (shop: string, memberId: number) => {
  const p = Buffer.from(`${shop}|${memberId}`).toString("base64url");
  return `${p}.${sign(`unsub:${p}`).slice(0, 24)}`;
};
export function readUnsubToken(t: string): { shop: string; memberId: number } | null {
  const [p, mac] = String(t).split(".");
  if (!p || !mac) return null;
  const want = Buffer.from(sign(`unsub:${p}`).slice(0, 24));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [shop, id] = Buffer.from(p, "base64url").toString("utf8").split("|");
  return /^[a-z0-9.-]+$/.test(shop ?? "") && /^\d+$/.test(id ?? "") ? { shop, memberId: Number(id) } : null;
}
export const unsubscribeUrl = (shop: string, memberId: number) => `${appUrl()}/email/unsubscribe?t=${unsubToken(shop, memberId)}`;

/** One-click unsubscribe: the member gets no more loyalty emails from this store. */
export async function unsubscribe(token: string) {
  const t = readUnsubToken(token);
  if (!t) return null;
  if (t.memberId > 0) await db.loyaltyMember.updateMany({ where: { id: t.memberId, shop: t.shop }, data: { emailOptOut: true } });
  return t;
}

/** The key in the bounce webhook's address (Postmark calls /webhooks/postmark?key=...). */
export const webhookKey = () => sign("postmark-webhook").slice(0, 32);
export const webhookUrl = () => `${appUrl()}/webhooks/postmark?key=${webhookKey()}`;

/** Bounces, spam complaints and Postmark unsubscribes: the member gets no more emails. */
export async function providerEvent(body: Record<string, unknown>) {
  const type = String(body.RecordType ?? "");
  const meta = (body.Metadata && typeof body.Metadata === "object" ? body.Metadata : {}) as Record<string, string>;
  const hard = type === "Bounce" ? ["HardBounce", "BadEmailAddress", "SpamNotification", "ManuallyDeactivated", "Blocked"].includes(String(body.Type ?? "")) : type === "SpamComplaint" || (type === "SubscriptionChange" && body.SuppressSending === true);
  if (!hard) return false;
  const shop = String(meta.shop ?? ""), memberId = Number(meta.member ?? 0);
  if (shop && memberId > 0) await db.loyaltyMember.updateMany({ where: { id: memberId, shop }, data: { emailOptOut: true } });
  const id = String(body.MessageID ?? "");
  if (shop && id) await db.loyaltyEmail.updateMany({ where: { shop, providerId: id }, data: { status: "bounced", reason: type === "Bounce" ? "The address bounced" : type === "SpamComplaint" ? "Marked as spam" : "Unsubscribed" } });
  return true;
}

/* ----------------------------------------------------------------- queue -- */
export type EmailData = { points?: number; credit?: number; order?: string; date?: string; reward?: string; code?: string; tier?: string; giftPoints?: number; giftCredit?: number; lifetime?: number };

/**
 * A loyalty event for a member: the email (when emails and that email are on) and the event for Klaviyo and
 * Omnisend (when connected). The same `dedupe` is queued once. True when anything was queued.
 */
export async function notify(shop: string, c: LoyaltyConfig, memberId: number, kind: EmailKind, data: EmailData = {}, dedupe?: string) {
  const events = await queueEvents(shop, memberId, kind, data, dedupe).catch(() => 0);
  if (!c.emails.on || !c.emails.texts[kind].on) return events > 0;
  try {
    await db.loyaltyEmail.create({ data: { shop, memberId, kind, data: JSON.stringify(data), dedupe: dedupe ?? null } });
    return true;
  } catch {
    return events > 0; // The email was queued before.
  }
}

/** The scheduled emails: welcome for new members, reward ready, points expiring, the monthly summary. */
export async function queueScheduled(shop: string, c: LoyaltyConfig, now = new Date()) {
  // Each one is looked for when its email is on, or when Klaviyo or Omnisend should get the event.
  const events = (await eventTargets(shop).catch(() => [])).length > 0;
  if (!c.emails.on && !events) return 0;
  let n = 0;
  const on = (k: EmailKind) => (c.emails.on && c.emails.texts[k].on) || (events && k !== "summary");
  const base = { shop, blocked: false, emailOptOut: false };
  if (on("welcome")) {
    for (const m of await db.loyaltyMember.findMany({ where: { ...base, joinedAt: { gte: new Date(now.getTime() - DAY) } }, select: { id: true }, take: 500 }))
      if (await notify(shop, c, m.id, "welcome", {}, `welcome:${m.id}`)) n++;
  }
  const rewards = c.rewards.filter((r) => r.on).sort((a, b) => a.points - b.points);
  if (on("ready") && rewards.length) {
    const ms = await db.loyaltyMember.findMany({ where: { ...base, points: { gte: rewards[0].points } }, select: { id: true, points: true, lifetime: true }, take: 2000 });
    const last = ms.length ? await db.loyaltyEmail.findMany({ where: { shop, kind: "ready", memberId: { in: ms.map((m) => m.id) } }, orderBy: { createdAt: "desc" }, select: { memberId: true, createdAt: true, data: true } }) : [];
    for (const m of ms) {
      const prev = last.find((x) => x.memberId === m.id);
      const prevLifetime = prev ? Number((JSON.parse(prev.data || "{}") as EmailData).lifetime ?? 0) : -1;
      // At most once in 30 days, and only after earning more since the last one.
      if (prev && (prev.createdAt.getTime() > now.getTime() - 30 * DAY || m.lifetime <= prevLifetime)) continue;
      const best = [...rewards].reverse().find((r) => r.points <= m.points) ?? rewards[0];
      if (await notify(shop, c, m.id, "ready", { reward: best.title, lifetime: m.lifetime }, `ready:${m.id}:${m.lifetime}`)) n++;
    }
  }
  if (on("expiring") && c.expiry.on) {
    const from = new Date(now.getTime() - c.expiry.days * DAY), to = new Date(now.getTime() - Math.max(0, c.expiry.days - 14) * DAY);
    for (const m of await db.loyaltyMember.findMany({ where: { ...base, points: { gt: 0 }, lastActivity: { gte: from, lt: to } }, select: { id: true, lastActivity: true }, take: 2000 })) {
      const ends = new Date(m.lastActivity.getTime() + c.expiry.days * DAY);
      if (await notify(shop, c, m.id, "expiring", { date: ends.toISOString() }, `expiring:${m.id}:${m.lastActivity.toISOString().slice(0, 10)}`)) n++;
    }
  }
  if (on("summary") && now.getUTCDate() === 1) {
    const month = now.toISOString().slice(0, 7);
    for (const m of await db.loyaltyMember.findMany({ where: { ...base, points: { gt: 0 } }, select: { id: true }, take: 5000 }))
      if (await notify(shop, c, m.id, "summary", {}, `summary:${m.id}:${month}`)) n++;
  }
  return n;
}

/* ---------------------------------------------------------------- sender -- */
export type SenderState = { email: string; domain: string; id: string; records: DomainRecords | null; verified: boolean; dmarc: boolean; checkedAt: string };
type ProgramState = { sender?: SenderState } & Record<string, unknown>;

async function getState(shop: string): Promise<ProgramState> {
  const row = await db.loyaltyProgram.findUnique({ where: { shop }, select: { state: true } });
  try {
    const s = JSON.parse(row?.state ?? "{}");
    return s && typeof s === "object" ? s : {};
  } catch {
    return {};
  }
}
/** Only the sender part is changed, the rest (referral discounts) is kept as it is now. */
async function saveSender(shop: string, sender: SenderState | undefined) {
  const s = await getState(shop);
  if (sender) s.sender = sender;
  else delete s.sender;
  await db.loyaltyProgram.updateMany({ where: { shop }, data: { state: JSON.stringify(s) } });
}
export const getSender = async (shop: string) => (await getState(shop)).sender ?? null;

async function hasDmarc(domain: string) {
  try {
    return (await resolveTxt(`_dmarc.${domain}`)).some((r) => r.join("").toUpperCase().startsWith("V=DMARC1"));
  } catch {
    return false;
  }
}

/** The store's own sender address: its domain is added to Postmark and the DNS records come back to show. */
export async function setupSender(shop: string, email: string, provider: MailProvider = mailProvider()) {
  const e = email.trim().toLowerCase();
  if (!validEmail(e)) throw new Error("Type a full email address, like hello@yourstore.com.");
  if (isFreeMailbox(e)) throw new Error("Free email addresses (Gmail, Outlook, Yahoo...) can't send for a store. Emails come from the default sender, with your address as Reply To.");
  if (!provider.domainsReady()) throw new Error("The email service is not set up yet.");
  const domain = e.split("@")[1];
  const records = await provider.addDomain(domain);
  const sender: SenderState = { email: e, domain, id: records.id, records, verified: records.dkimVerified, dmarc: await hasDmarc(domain), checkedAt: new Date().toISOString() };
  await saveSender(shop, sender);
  return sender;
}

/** The Verify button: asks Postmark to look at the DNS records again. */
export async function verifySender(shop: string, provider: MailProvider = mailProvider()) {
  const s = await getSender(shop);
  if (!s) return null;
  const records = await provider.verifyDomain(s.id);
  const next: SenderState = { ...s, records: records ?? s.records, verified: !!records?.dkimVerified, dmarc: await hasDmarc(s.domain), checkedAt: new Date().toISOString() };
  await saveSender(shop, next);
  return next;
}
export const removeSender = (shop: string) => saveSender(shop, undefined);

type Store = { name: string; email: string; url: string; currency: string };
async function storeInfo(admin: AdminClient): Promise<Store> {
  const d = await gql(admin, `#graphql
    query CroLoyaltyStore { shop { name email contactEmail currencyCode primaryDomain { url } } }`);
  return { name: String(d.shop?.name ?? "Our store"), email: String(d.shop?.contactEmail || d.shop?.email || ""), url: String(d.shop?.primaryDomain?.url ?? "").replace(/\/$/, ""), currency: String(d.shop?.currencyCode ?? "USD") };
}

const display = (name: string) => `"${name.replace(/["\\\r\n<>]/g, "").slice(0, 60)}"`;

/** Who the emails come from: the store's own verified address (checked again daily), else the default. */
export async function fromFor(shop: string, c: LoyaltyConfig, store: Store, provider: MailProvider, now = new Date()) {
  let s = await getSender(shop);
  const own = c.emails.sender.email;
  if (s && own && s.email === own && s.verified && provider.domainsReady() && now.getTime() - new Date(s.checkedAt).getTime() > DAY) {
    const r = await provider.getDomain(s.id).catch(() => s!.records);
    s = { ...s, records: r, verified: !!r?.dkimVerified, checkedAt: now.toISOString() };
    await saveSender(shop, s);
  }
  if (s && own && s.email === own && s.verified) return { from: `${display(c.emails.sender.name || store.name)} <${own}>`, replyTo: "", own: true };
  return { from: `${display(store.name)} <${DEFAULT_FROM()}>`, replyTo: store.email, own: false };
}

/** The words of one email, formatted for the store (points with its unit, money in its currency, dates). */
export function wordsFor(c: LoyaltyConfig, currency: string, balance: number, d: EmailData): Record<string, string> {
  const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }) : "");
  return {
    unit: c.unit.many,
    balance: pointsLabel(c, balance),
    points: d.points ? pointsLabel(c, d.points) : d.credit ? money(d.credit) : "",
    order: d.order ?? "",
    date: date(d.date),
    reward: d.reward ?? "",
    code: d.code ?? "",
    tier: d.tier ?? "",
    gift: d.giftPoints ? pointsLabel(c, d.giftPoints) : d.giftCredit ? money(d.giftCredit) : "",
  };
}

function mailFor(shop: string, c: LoyaltyConfig, store: Store, from: { from: string; replyTo: string }, kind: EmailKind, to: string, memberId: number, words: Record<string, string>, emailId: number): OutMail {
  const unsub = unsubscribeUrl(shop, memberId);
  const r = renderEmail(c.emails, kind, store, words, unsub, store.url);
  return {
    from: from.from,
    replyTo: from.replyTo || undefined,
    to,
    subject: r.subject,
    html: r.html,
    text: r.text,
    stream: isReminder(kind) ? "reminder" : "account",
    headers: [
      { name: "List-Unsubscribe", value: `<${unsub}>` },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ],
    tag: `loyalty-${kind}`,
    metadata: { shop, member: String(memberId), email: String(emailId) },
  };
}

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
export const emailsThisMonth = (shop: string, now = new Date()) => db.loyaltyEmail.count({ where: { shop, status: "sent", sentAt: { gte: monthStart(now) } } });

/** Sends what is queued for one store (up to 500 a run). Returns the counts. */
export async function sendQueued(admin: AdminClient, shop: string, c: LoyaltyConfig, now = new Date(), provider: MailProvider = mailProvider()) {
  const queued = await db.loyaltyEmail.findMany({ where: { shop, status: "queued" }, orderBy: { id: "asc" }, take: 500 });
  const out = { sent: 0, skipped: 0, failed: 0 };
  if (!queued.length) return out;
  const skip = async (ids: number[], reason: string) => {
    if (!ids.length) return;
    await db.loyaltyEmail.updateMany({ where: { id: { in: ids } }, data: { status: "skipped", reason } });
    out.skipped += ids.length;
  };
  if (!c.emails.on) return (await skip(queued.map((q) => q.id), "Emails are off"), out);
  if (!provider.ready()) return (await skip(queued.map((q) => q.id), "The email service is not set up yet"), out);
  const members = await db.loyaltyMember.findMany({ where: { shop, id: { in: [...new Set(queued.map((q) => q.memberId).filter((x): x is number => x != null))] } } });
  const store = await storeInfo(admin);
  const from = await fromFor(shop, c, store, provider, now);
  let used = await emailsThisMonth(shop, now);
  const ready: { row: (typeof queued)[number]; mail: OutMail }[] = [];
  const reasons = new Map<string, number[]>();
  const refuse = (id: number, why: string) => reasons.set(why, [...(reasons.get(why) ?? []), id]);
  for (const q of queued) {
    const m = members.find((x) => x.id === q.memberId);
    const kind = q.kind as EmailKind;
    if (!(EMAIL_KINDS as readonly string[]).includes(kind)) refuse(q.id, "Unknown email");
    else if (q.createdAt.getTime() < now.getTime() - 3 * DAY) refuse(q.id, "Waited too long");
    else if (!c.emails.texts[kind].on) refuse(q.id, "This email is off");
    else if (!m || m.blocked) refuse(q.id, "Not a member");
    else if (m.emailOptOut) refuse(q.id, "Unsubscribed");
    else if (!validEmail(m.email)) refuse(q.id, "No email address");
    else if (isReminder(kind) && !m.emailMarketing) refuse(q.id, "Not subscribed to email marketing");
    else if (used >= MONTHLY_EMAILS) refuse(q.id, `Monthly limit of ${MONTHLY_EMAILS.toLocaleString("en-US")} reached`);
    else {
      used++;
      let data: EmailData = {};
      try {
        data = JSON.parse(q.data || "{}");
      } catch {
        data = {};
      }
      ready.push({ row: q, mail: mailFor(shop, c, store, from, kind, m.email, m.id, wordsFor(c, store.currency, m.points, data), q.id) });
    }
  }
  for (const [why, ids] of reasons) await skip(ids, why);
  if (!ready.length) return out;
  const results = await provider.send(ready.map((r) => r.mail));
  for (let i = 0; i < ready.length; i++) {
    const r = results[i] ?? { ok: false, id: "", error: "Not sent" };
    await db.loyaltyEmail.update({ where: { id: ready[i].row.id }, data: r.ok ? { status: "sent", to: ready[i].mail.to, providerId: r.id, sentAt: now } : { status: "failed", to: ready[i].mail.to, reason: r.error.slice(0, 200) } });
    if (r.ok) out.sent++;
    else out.failed++;
  }
  return out;
}

/** A test email of one kind with sample words, to an address the store types (logged as a test). */
export async function sendTest(admin: AdminClient, shop: string, c: LoyaltyConfig, kind: EmailKind, to: string, provider: MailProvider = mailProvider()) {
  if (!validEmail(to)) throw new Error("Type the address to send the test to.");
  if (!provider.ready()) throw new Error("The email service is not set up yet.");
  if ((await emailsThisMonth(shop)) >= MONTHLY_EMAILS) throw new Error("This month's emails are used up.");
  const store = await storeInfo(admin);
  const from = await fromFor(shop, c, store, provider);
  const row = await db.loyaltyEmail.create({ data: { shop, memberId: null, kind, to, status: "queued", reason: "Test", data: "{}" } });
  const words = { ...SAMPLE_WORDS, unit: c.unit.many, balance: pointsLabel(c, 1250), points: pointsLabel(c, 120), gift: pointsLabel(c, 200) };
  const mail = mailFor(shop, c, store, from, kind, to, 0, words, row.id);
  const [r] = await provider.send([{ ...mail, subject: `[Test] ${mail.subject}` }]);
  await db.loyaltyEmail.update({ where: { id: row.id }, data: r?.ok ? { status: "sent", providerId: r.id, sentAt: new Date() } : { status: "failed", reason: (r?.error ?? "Not sent").slice(0, 200) } });
  if (!r?.ok) throw new Error(r?.error || "The test email was not sent.");
  return { from: from.from };
}

/** The Emails page: this month's count and the latest emails. */
export async function emailLog(shop: string, take = 30) {
  const [month, latest] = await Promise.all([emailsThisMonth(shop), db.loyaltyEmail.findMany({ where: { shop, status: { not: "queued" } }, orderBy: { id: "desc" }, take })]);
  return { month, latest: latest.map((e) => ({ id: e.id, kind: e.kind, to: e.to, status: e.status, reason: e.reason, date: (e.sentAt ?? e.createdAt).toISOString() })) };
}

/** The log keeps 90 days. */
export const pruneEmails = (now = new Date()) => db.loyaltyEmail.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * DAY) } } });
