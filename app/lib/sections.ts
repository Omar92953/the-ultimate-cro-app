/**
 * Store sections whose content is a list the merchant manages in the app (reviews, FAQ, logos,
 * announcement messages). Each list is a set of app-owned metaobjects declared in
 * shopify.app.toml; the theme blocks in extensions/cro-sections read them directly.
 *
 * This file describes each list's fields once; the list page, the edit form and the server code
 * are all driven from it. Shared by client and server (no server-only imports).
 */

export type SectionKind = "reviews" | "faq" | "logos" | "announcements";
export const SECTION_KINDS: SectionKind[] = ["reviews", "faq", "logos", "announcements"];

export type MediaRef = { id: string; url: string | null; kind: "image" | "video"; title: string };
export type ProductRef = { id: string; title: string; image: string | null };
export type Value = string | number | boolean | MediaRef | ProductRef | null;

export type FieldType =
  | "text" // single line
  | "textarea"
  | "rating" // 1–5 stars, 0 = none
  | "select"
  | "url" // absolute link (https://…)
  | "link" // store path or absolute link
  | "date" // YYYY-MM-DD
  | "datetime" // date in the form, stored as a date-time in the shop's time zone
  | "bool"
  | "media" // image or video from Files
  | "image" // image from Files
  | "product";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  details?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** datetime only: the start or the end of the chosen day */
  edge?: "start" | "end";
  default?: Value;
};

export type SectionItem = {
  id: string | null;
  handle: string | null;
  position: number;
  values: Record<string, Value>;
};

export const SOURCES = [
  { value: "", label: "Not shown" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "x", label: "X (Twitter)" },
  { value: "snapchat", label: "Snapchat" },
  { value: "youtube", label: "YouTube" },
  { value: "email", label: "Email" },
  { value: "website", label: "Your website" },
];

export const ANNOUNCE_ICONS = [
  { value: "none", label: "No icon" },
  { value: "truck", label: "Delivery truck" },
  { value: "gift", label: "Gift" },
  { value: "percent", label: "Percent" },
  { value: "clock", label: "Clock" },
  { value: "star", label: "Star" },
  { value: "heart", label: "Heart" },
  { value: "shield", label: "Shield (guarantee)" },
  { value: "fire", label: "Fire (hot)" },
];

type SectionConfig = {
  /** metaobject type */
  type: string;
  /** theme block (or embed) handle in extensions/cro-sections */
  block: string;
  embed?: boolean;
  /** template the "Add to theme" link opens */
  template: "index" | "product";
  title: string;
  singular: string;
  plural: string;
  addLabel: string;
  /** which value is the row title / thumbnail / "shown" switch */
  titleKey: string;
  thumbKey?: string;
  activeKey?: string;
  fields: FieldDef[];
  help: { what: string; how: string; example: string };
  empty: string;
  limit: number;
};

export const SECTIONS: Record<SectionKind, SectionConfig> = {
  reviews: {
    type: "$app:cro_review",
    block: "ucs-reviews",
    template: "index",
    title: "Customer reviews",
    singular: "review",
    plural: "reviews",
    addLabel: "Add review",
    titleKey: "name",
    thumbKey: "media",
    activeKey: "active",
    limit: 250,
    fields: [
      { key: "name", label: "Customer name", type: "text", required: true, placeholder: "Mariam A." },
      { key: "text", label: "What they said", type: "textarea", details: "Paste the message as they wrote it." },
      { key: "rating", label: "Stars", type: "rating", default: 5 },
      { key: "media", label: "Photo or video", type: "media", details: "A photo of the product in use, a screenshot of the chat, or a short video." },
      { key: "source", label: "Where it came from", type: "select", options: SOURCES, default: "", details: "Shows the WhatsApp, Instagram… icon on the card." },
      { key: "source_url", label: "Link to the original post", type: "url", placeholder: "https://www.instagram.com/p/…", details: "Optional. The icon links to it." },
      { key: "product", label: "Product", type: "product", details: "Optional. Shows the product on the card, and the review on that product's page." },
      { key: "location", label: "Location", type: "text", placeholder: "Cairo" },
      { key: "date", label: "Date", type: "date" },
      { key: "verified", label: "Verified buyer", type: "bool", default: true },
      { key: "featured", label: "Featured", type: "bool", default: false, details: "Sections set to “Featured reviews only” show just these." },
      { key: "active", label: "Shown on the store", type: "bool", default: true },
    ],
    help: {
      what: "Reviews and testimonials from your customers — text, photos or videos — with the icon of where they came from (WhatsApp, Instagram, TikTok…).",
      how: "Add reviews here, then add the “Customer reviews” section in the theme editor. Choose there whether it shows all reviews, featured ones, or the product's own reviews on product pages.",
      example: "A WhatsApp screenshot from Mariam in Cairo, 5 stars, linked to the Basic tee — shown on the home page and on the tee's page.",
    },
    empty: "No reviews yet. Add your first one — a WhatsApp message or an Instagram comment works great.",
  },
  faq: {
    type: "$app:cro_faq",
    block: "ucs-faq",
    template: "index",
    title: "FAQ",
    singular: "question",
    plural: "questions",
    addLabel: "Add question",
    titleKey: "question",
    activeKey: "active",
    limit: 250,
    fields: [
      { key: "question", label: "Question", type: "text", required: true, placeholder: "How long does delivery take?" },
      { key: "answer", label: "Answer", type: "textarea" },
      { key: "group", label: "Group", type: "text", placeholder: "Shipping", details: "Optional. Questions with the same group get their own button (Shipping, Returns, Payment…)." },
      { key: "active", label: "Shown on the store", type: "bool", default: true },
    ],
    help: {
      what: "Answers to the questions customers ask before buying, as a tidy accordion with optional search and group buttons.",
      how: "Add questions here, then add the “FAQ” section to any page in the theme editor. It also tells Google about your questions so they can appear in search results.",
      example: "Shipping: “How long does delivery take?” · Payment: “Can I pay cash on delivery?” · Returns: “What is your return policy?”",
    },
    empty: "No questions yet. Start with delivery time, payment methods and returns.",
  },
  logos: {
    type: "$app:cro_logo",
    block: "ucs-logos",
    template: "index",
    title: "Trusted-by logos",
    singular: "logo",
    plural: "logos",
    addLabel: "Add logo",
    titleKey: "name",
    thumbKey: "image",
    limit: 100,
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Vogue Arabia", details: "Read out to screen readers." },
      { key: "image", label: "Logo", type: "image", required: true, details: "A PNG or SVG with a transparent background looks best." },
      { key: "link", label: "Link", type: "url", placeholder: "https://…", details: "Optional, e.g. the article that mentioned you." },
    ],
    help: {
      what: "A strip of logos — press that featured you, partners, or well-known customers — that scrolls endlessly or sits in a grid.",
      how: "Upload logos here, then add the “Trusted by logos” section in the theme editor. Speed, size and grey-until-hover are set there.",
      example: "“As seen in” with five magazine logos scrolling slowly under the hero image.",
    },
    empty: "No logos yet. Upload a few — magazines, partners or brands you work with.",
  },
  announcements: {
    type: "$app:cro_announce",
    block: "ucs-announcement",
    embed: true,
    template: "index",
    title: "Announcements",
    singular: "message",
    plural: "messages",
    addLabel: "Add message",
    titleKey: "message",
    activeKey: "active",
    limit: 50,
    fields: [
      { key: "message", label: "Message", type: "text", required: true, placeholder: "Free delivery in Cairo over LE 1,000" },
      { key: "link", label: "Link", type: "link", placeholder: "/collections/sale", details: "Optional. A page in your store (/collections/sale) or a full link." },
      { key: "icon", label: "Icon", type: "select", options: ANNOUNCE_ICONS, default: "none" },
      { key: "starts_at", label: "Show from", type: "datetime", edge: "start", details: "Optional. Leave empty to show it now." },
      { key: "ends_at", label: "Show until", type: "datetime", edge: "end", details: "Optional. It disappears after this day." },
      { key: "active", label: "Shown on the store", type: "bool", default: true },
    ],
    help: {
      what: "A bar at the very top of your store with rotating messages: offers, delivery info, new arrivals.",
      how: "Add messages here (each can have a link, an icon and dates), then switch on “Announcement bar” in the theme editor's App embeds. Colours, speed and the free-shipping progress are set there.",
      example: "“Free delivery over LE 1,000” all month, plus “Eid sale: 20% off” only from the 5th to the 10th.",
    },
    empty: "No messages yet. Until you add some, the bar shows the texts from its theme editor settings.",
  },
};

export function isKind(v: string | undefined): v is SectionKind {
  return !!v && (SECTION_KINDS as string[]).includes(v);
}

export function blankItem(kind: SectionKind): SectionItem {
  const values: Record<string, Value> = {};
  for (const f of SECTIONS[kind].fields) values[f.key] = f.default ?? (f.type === "bool" ? false : f.type === "rating" ? 0 : ["media", "image", "product"].includes(f.type) ? null : "");
  return { id: null, handle: null, position: 0, values };
}

/** "Live", "Scheduled", "Ended" or "Hidden" for the list. */
export function itemStatus(kind: SectionKind, item: SectionItem, now = Date.now()): { tone: "ok" | "warn" | "muted"; text: string } {
  const cfg = SECTIONS[kind];
  if (cfg.activeKey && item.values[cfg.activeKey] === false) return { tone: "muted", text: "Hidden" };
  const from = item.values.starts_at ? Date.parse(String(item.values.starts_at)) : NaN;
  const until = item.values.ends_at ? Date.parse(String(item.values.ends_at)) : NaN;
  if (Number.isFinite(from) && from > now) return { tone: "warn", text: `Starts ${new Date(from).toLocaleDateString()}` };
  if (Number.isFinite(until) && until < now) return { tone: "muted", text: "Ended" };
  return { tone: "ok", text: "Shown" };
}

/** "2026-10-05" + "+03:00" → "2026-10-05T00:00:00+03:00" (or 23:59:59 for an end date). */
export function dayToDateTime(day: string, offset: string, edge: "start" | "end" = "start") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  return `${day}T${edge === "end" ? "23:59:59" : "00:00:00"}${offset}`;
}

/** A stored date-time back to its day in the shop's time zone. */
export function dateTimeToDay(value: string, offsetMinutes: number) {
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return "";
  return new Date(t + offsetMinutes * 60000).toISOString().slice(0, 10);
}

/** "+0300" (Shopify's shop.timezoneOffset) → { iso: "+03:00", minutes: 180 } */
export function parseOffset(raw: string | null | undefined) {
  const m = /([+-])(\d{2}):?(\d{2})/.exec(raw || "");
  if (!m) return { iso: "+00:00", minutes: 0 };
  const sign = m[1] === "-" ? -1 : 1;
  return { iso: `${m[1]}${m[2]}:${m[3]}`, minutes: sign * (Number(m[2]) * 60 + Number(m[3])) };
}

/** Accept "www.site.com" as a link; Shopify's url type needs the https:// part. */
export function normalizeUrl(v: string) {
  const s = v.trim();
  if (!s) return "";
  if (/^(https?:|mailto:|tel:|sms:)/i.test(s)) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}

/** Store paths stay as they are; anything else becomes a full link. */
export function normalizeLink(v: string) {
  const s = v.trim();
  if (!s || s.startsWith("/") || s.startsWith("#")) return s;
  return normalizeUrl(s);
}
