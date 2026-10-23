/**
 * Loyalty emails (Pro): which emails go out, their words, and the HTML each one becomes. Pure and shared by
 * client (the Emails page preview) and server (lib/loyalty/mailer.server.ts sends them).
 *
 * Account emails go to every member; reminders only to members subscribed to email marketing in Shopify.
 * Every email has a one-click unsubscribe. {unit} is what the store calls points, {store} its name.
 * Customer names are never read, so emails don't greet by name.
 */
import { color, str } from "../designs";

export const EMAIL_KINDS = ["welcome", "earned", "ready", "reward", "credit", "tier", "tierDown", "referral", "birthday", "expiring", "summary"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];
/** Reminders: only to members subscribed to email marketing (Postmark's broadcast stream). */
export const REMINDER_KINDS: readonly EmailKind[] = ["birthday", "expiring", "summary"];
export const isReminder = (k: string) => (REMINDER_KINDS as readonly string[]).includes(k);
/** Fair use per store and calendar month. */
export const MONTHLY_EMAILS = 10_000;

export type EmailText = { on: boolean; subject: string; heading: string; body: string; button: string };

export const EMAIL_INFO: Record<EmailKind, { title: string; when: string; words: string[] }> = {
  welcome: { title: "Welcome", when: "A customer joins the program", words: ["store", "balance"] },
  earned: { title: "Points earned", when: "An order earns points or store credit", words: ["store", "points", "order", "date", "balance"] },
  ready: { title: "Reward ready", when: "A member has enough for a reward (at most once in 30 days)", words: ["store", "balance", "reward"] },
  reward: { title: "Reward code", when: "A member gets a discount code with their points", words: ["store", "reward", "code", "date"] },
  credit: { title: "Store credit added", when: "A member gets store credit with their points", words: ["store", "reward"] },
  tier: { title: "New VIP tier", when: "A member reaches a higher tier", words: ["store", "tier"] },
  tierDown: { title: "Tier changed", when: "A member moves down a tier (tiers over 12 months)", words: ["store", "tier"] },
  referral: { title: "Referral reward", when: "A friend's first order rewards the member", words: ["store", "gift", "balance"] },
  birthday: { title: "Birthday", when: "Birthday points are given", words: ["store", "points", "balance"] },
  expiring: { title: "Points expiring", when: "14 days before points expire", words: ["store", "balance", "date"] },
  summary: { title: "Monthly summary", when: "The first day of each month, to members with points", words: ["store", "balance"] },
};

export const DEFAULT_EMAIL_TEXTS: Record<EmailKind, EmailText> = {
  welcome: { on: true, subject: "Welcome to {store} rewards", heading: "You are in", body: "You earn {unit} on every order and spend them on rewards. Your balance: {balance}.", button: "See your rewards" },
  earned: { on: true, subject: "You earned {points}", heading: "{points} for order {order}", body: "They can be used from {date}. Your balance: {balance}.", button: "See your rewards" },
  ready: { on: true, subject: "You can get a reward", heading: "{balance} to spend", body: "That is enough for {reward}.", button: "Get your reward" },
  reward: { on: true, subject: "Your reward: {reward}", heading: "{reward}", body: "Your code is {code}. Use it at checkout before {date}.", button: "Shop now" },
  credit: { on: true, subject: "{reward} added to your store credit", heading: "{reward}", body: "It is in your store credit and used at checkout by itself.", button: "Shop now" },
  tier: { on: true, subject: "You reached {tier}", heading: "Welcome to {tier}", body: "Your new tier gives you more on every order.", button: "See your perks" },
  tierDown: { on: false, subject: "Your tier is now {tier}", heading: "Your tier is now {tier}", body: "Order again to move back up.", button: "Shop now" },
  referral: { on: true, subject: "Your friend ordered", heading: "You earned {gift}", body: "Thanks for sharing {store}. Your balance: {balance}.", button: "See your rewards" },
  birthday: { on: true, subject: "Happy birthday from {store}", heading: "Happy birthday", body: "Here are {points} to celebrate. Your balance: {balance}.", button: "Treat yourself" },
  expiring: { on: true, subject: "Your {unit} expire soon", heading: "{balance} expire on {date}", body: "Place an order or get a reward before then to keep them.", button: "Use them" },
  summary: { on: false, subject: "Your {store} rewards", heading: "You have {balance}", body: "Spend them on a reward on your next order.", button: "See your rewards" },
};

export type EmailSettings = {
  /** Emails are sent at all (off until the store turns them on). */
  on: boolean;
  /** The store's own sender ("" = the app's default sender with the store's address as Reply To). */
  sender: { email: string; name: string };
  /** Logo at the top (an https image link; "" = the store's name in text). */
  logo: string;
  accent: string;
  /** The small print at the bottom, before the unsubscribe link. */
  footer: string;
  /** The unsubscribe link's word in another language (languages.ts `inLanguage`); "Unsubscribe" when empty. */
  unsubscribe?: string;
  texts: Record<EmailKind, EmailText>;
};

export const DEFAULT_EMAILS: EmailSettings = {
  on: false,
  sender: { email: "", name: "" },
  logo: "",
  accent: "#111111",
  footer: "You get this email as a member of {store} rewards.",
  texts: DEFAULT_EMAIL_TEXTS,
};

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const EMAIL_RE = /^[^\s@<>"]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
export const validEmail = (v: string) => EMAIL_RE.test(v);

export function withEmailDefaults(raw: unknown): EmailSettings {
  const r = obj(raw), s = obj(r.sender), t = obj(r.texts), d = DEFAULT_EMAILS;
  const email = str(s.email, "", 254).trim().toLowerCase();
  const logo = str(r.logo, "", 500).trim();
  return {
    on: bool(r.on, d.on),
    sender: { email: validEmail(email) ? email : "", name: str(s.name, "", 60).replace(/[<>"\r\n]/g, "").trim() },
    logo: /^https:\/\/\S+$/.test(logo) ? logo : "",
    accent: color(r.accent, d.accent),
    footer: str(r.footer, d.footer, 300).trim() || d.footer,
    texts: Object.fromEntries(
      EMAIL_KINDS.map((k) => {
        const x = obj(t[k]), dk = DEFAULT_EMAIL_TEXTS[k];
        const line = (v: unknown, def: string, max: number) => str(v, def, max).replace(/[\r\n]+/g, " ").trim() || def;
        return [k, { on: bool(x.on, dk.on), subject: line(x.subject, dk.subject, 120), heading: line(x.heading, dk.heading, 120), body: str(x.body, dk.body, 600).trim() || dk.body, button: line(x.button, dk.button, 40) }];
      }),
    ) as Record<EmailKind, EmailText>,
  };
}

/** Free mailbox domains can't publish DNS records, so they can't be a verified sender. */
const FREE_DOMAINS = ["gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "mail.com", "yandex.com", "zoho.com"];
export const isFreeMailbox = (email: string) => FREE_DOMAINS.includes(email.split("@")[1]?.toLowerCase() ?? "") || /^yahoo\.|^hotmail\.|^outlook\./i.test(email.split("@")[1] ?? "");

/* ----------------------------------------------------------------- render -- */
/** `address`: the store's postal address, always under the small print (CAN-SPAM asks for it in marketing emails). */
export type EmailStore = { name: string; url: string; address?: string };
export type RenderedEmail = { subject: string; html: string; text: string };

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** {word} → its value; words without a value are left out. */
export const fillWords = (s: string, words: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => words[k] ?? "");

/** Black or white text on the accent colour, whichever reads better. */
function onColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? "#111111" : "#ffffff";
}

/**
 * One email, ready to send: the subject, a simple HTML layout (logo or store name, heading, text, button, small
 * print with the unsubscribe link) and the plain text version.
 */
export function renderEmail(s: EmailSettings, kind: EmailKind, store: EmailStore, words: Record<string, string>, unsubscribeUrl: string, link = ""): RenderedEmail {
  const t = s.texts[kind];
  const w = { store: store.name, ...words };
  const subject = fillWords(t.subject, w).replace(/\s+/g, " ").trim();
  const heading = fillWords(t.heading, w).trim();
  const body = fillWords(t.body, w).trim();
  const footer = fillWords(s.footer, w).trim();
  const href = link || store.url;
  const btn = onColor(s.accent);
  const top = s.logo ? `<img src="${escHtml(s.logo)}" alt="${escHtml(store.name)}" style="max-height:48px;max-width:200px;border:0">` : `<span style="font-size:20px;font-weight:700;color:#111111">${escHtml(store.name)}</span>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px">` +
    `<tr><td align="center" style="padding:28px 28px 8px">${top}</td></tr>` +
    `<tr><td align="center" style="padding:16px 28px 0"><h1 style="margin:0;font-size:26px;line-height:1.25;color:#111111">${escHtml(heading)}</h1></td></tr>` +
    `<tr><td align="center" style="padding:14px 28px 0;font-size:16px;line-height:1.55;color:#333333">${escHtml(body).replace(/\n/g, "<br>")}</td></tr>` +
    (t.button && href ? `<tr><td align="center" style="padding:24px 28px 8px"><a href="${escHtml(href)}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:${s.accent};color:${btn};font-weight:600;font-size:15px;text-decoration:none">${escHtml(fillWords(t.button, w))}</a></td></tr>` : "") +
    `<tr><td align="center" style="padding:24px 28px 28px;font-size:12px;line-height:1.5;color:#777777">${escHtml(footer)}${store.address ? `<br>${escHtml(store.name)}, ${escHtml(store.address)}` : ""}<br><a href="${escHtml(unsubscribeUrl)}" style="color:#777777">${escHtml(s.unsubscribe || "Unsubscribe")}</a></td></tr>` +
    `</table></td></tr></table></body></html>`;
  const text = [store.name, "", heading, "", body, ...(t.button && href ? ["", `${fillWords(t.button, w)}: ${href}`] : []), "", footer, ...(store.address ? [`${store.name}, ${store.address}`] : []), `${s.unsubscribe || "Unsubscribe"}: ${unsubscribeUrl}`].join("\n");
  return { subject, html, text };
}

/** Sample words for the preview and the test email. */
export const SAMPLE_WORDS: Record<string, string> = { points: "120 points", balance: "1,250 points", order: "#1042", date: "November 30", reward: "10% off your order", code: "RWD-4F2A9C1B", tier: "Gold", gift: "200 points" };
