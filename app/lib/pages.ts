/**
 * Pages: full-page designs edited in the app (the app is the editor; the theme editor only places
 * the block). First page: the contact form. Settings are stored as JSON in $app:cro_page
 * (handle = page type); the storefront block reads them, plus a ready-made CSS-variable string.
 * Shared by client and server.
 */
import { schemeId } from "./theme-style";

export type PageType = "contact" | "product" | "collection" | "header";

export const PAGE_TYPES: { key: PageType; title: string; text: string; ready: boolean }[] = [
  { key: "contact", title: "Contact page", text: "A contact form with your fields, colours and sizes, plus your email, phone, WhatsApp and opening hours.", ready: true },
  { key: "product", title: "Product page", text: "Product page layouts built from the app's sections.", ready: false },
  { key: "collection", title: "Collection page", text: "Collection layouts with filters and badges.", ready: false },
  { key: "header", title: "Headers", text: "Ready-made headers: rounded, glass look and more.", ready: false },
];

export type ContactFieldKey = "name" | "email" | "phone" | "subject" | "order" | "body";
export type ContactField = {
  key: ContactFieldKey;
  on: boolean;
  required: boolean;
  label: string;
  placeholder: string;
  half: boolean; // half width on desktop (two fields side by side)
};

/** Shopify's contact form field names (what the store owner sees in the email). */
export const FIELD_META: Record<ContactFieldKey, { name: string; type: string; auto: string; title: string }> = {
  name: { name: "name", type: "text", auto: "name", title: "Name" },
  email: { name: "email", type: "email", auto: "email", title: "Email" },
  phone: { name: "Phone", type: "tel", auto: "tel", title: "Phone" },
  subject: { name: "Subject", type: "text", auto: "off", title: "Subject" },
  order: { name: "Order number", type: "text", auto: "off", title: "Order number" },
  body: { name: "body", type: "textarea", auto: "off", title: "Message" },
};

export type ContactConfig = {
  /** The theme colour scheme its colours were matched to ("" = its own colours). */
  scheme: string;
  heading: string;
  text: string;
  fields: ContactField[];
  button: string;
  success: string;
  privacy: string;
  layout: { width: "narrow" | "medium" | "wide"; align: "left" | "center"; style: "card" | "plain"; labels: "above" | "inside" };
  info: { show: boolean; side: "left" | "right"; title: string; text: string; email: string; phone: string; whatsapp: string; address: string; hours: string };
  look: {
    bgType: "color" | "gradient";
    bg: string;
    bg2: string;
    card: string;
    text: string;
    fieldBg: string;
    fieldBorder: string;
    accent: string;
    accentText: string;
    fieldStyle: "outlined" | "filled" | "underline";
    radius: number;
    headingSize: number;
    textSize: number;
    fieldHeight: number;
    buttonSize: number;
    padding: number;
  };
};

const field = (key: ContactFieldKey, on: boolean, required: boolean, half = false): ContactField => ({
  key,
  on,
  required,
  label: FIELD_META[key].title,
  placeholder: "",
  half,
});

export const DEFAULT_CONTACT: ContactConfig = {
  scheme: "",
  heading: "Get in touch",
  text: "Questions about an order, sizes or delivery? Send us a message and we'll reply within a day.",
  fields: [field("name", true, false, true), field("email", true, true, true), field("phone", true, false), field("subject", false, false, true), field("order", false, false), field("body", true, true)],
  button: "Send message",
  success: "Thanks! We got your message and will reply soon.",
  privacy: "",
  layout: { width: "medium", align: "center", style: "card", labels: "above" },
  info: { show: false, side: "left", title: "Contact us", text: "", email: "", phone: "", whatsapp: "", address: "", hours: "" },
  look: {
    bgType: "color",
    bg: "#f6f6f7",
    bg2: "#e8eefc",
    card: "#ffffff",
    text: "#121212",
    fieldBg: "#ffffff",
    fieldBorder: "#c9cccf",
    accent: "#121212",
    accentText: "#ffffff",
    fieldStyle: "outlined",
    radius: 10,
    headingSize: 32,
    textSize: 15,
    fieldHeight: 46,
    buttonSize: 15,
    padding: 48,
  },
};

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i;
const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const str = (v: unknown, fallback = "", max = 500) => (typeof v === "string" ? v.slice(0, max) : fallback);
const pick = <T extends string>(v: unknown, options: T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

/** Fills gaps and cleans values (colours must be hex, sizes within range) — also guards the CSS. */
export function withContactDefaults(raw: unknown): ContactConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ContactConfig>;
  const d = DEFAULT_CONTACT;
  const l = (r.layout ?? {}) as Partial<ContactConfig["layout"]>;
  const i = (r.info ?? {}) as Partial<ContactConfig["info"]>;
  const k = (r.look ?? {}) as Partial<ContactConfig["look"]>;
  const saved = Array.isArray(r.fields) ? r.fields : [];
  const fields = d.fields.map((def) => {
    const f = (saved.find((x) => x && x.key === def.key) ?? {}) as Partial<ContactField>;
    return {
      key: def.key,
      on: def.key === "email" ? true : typeof f.on === "boolean" ? f.on : def.on, // Shopify needs the email
      required: def.key === "email" ? true : typeof f.required === "boolean" ? f.required : def.required,
      label: str(f.label, def.label, 80) || def.label,
      placeholder: str(f.placeholder, "", 120),
      half: typeof f.half === "boolean" ? f.half : def.half,
    };
  });
  // Keep the merchant's order.
  const order = saved.map((f) => f && f.key).filter((key): key is ContactFieldKey => fields.some((f) => f.key === key));
  fields.sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99));
  return {
    scheme: schemeId((r as { scheme?: unknown }).scheme),
    heading: str(r.heading, d.heading, 160),
    text: str(r.text, d.text, 1000),
    fields,
    button: str(r.button, d.button, 60) || d.button,
    success: str(r.success, d.success, 300) || d.success,
    privacy: str(r.privacy, d.privacy, 500),
    layout: {
      width: pick(l.width, ["narrow", "medium", "wide"], d.layout.width),
      align: pick(l.align, ["left", "center"], d.layout.align),
      style: pick(l.style, ["card", "plain"], d.layout.style),
      labels: pick(l.labels, ["above", "inside"], d.layout.labels),
    },
    info: {
      show: typeof i.show === "boolean" ? i.show : d.info.show,
      side: pick(i.side, ["left", "right"], d.info.side),
      title: str(i.title, d.info.title, 120),
      text: str(i.text, "", 600),
      email: str(i.email, "", 120),
      phone: str(i.phone, "", 40),
      whatsapp: str(i.whatsapp, "", 40),
      address: str(i.address, "", 300),
      hours: str(i.hours, "", 300),
    },
    look: {
      bgType: pick(k.bgType, ["color", "gradient"], d.look.bgType),
      bg: color(k.bg, d.look.bg),
      bg2: color(k.bg2, d.look.bg2),
      card: color(k.card, d.look.card),
      text: color(k.text, d.look.text),
      fieldBg: color(k.fieldBg, d.look.fieldBg),
      fieldBorder: color(k.fieldBorder, d.look.fieldBorder),
      accent: color(k.accent, d.look.accent),
      accentText: color(k.accentText, d.look.accentText),
      fieldStyle: pick(k.fieldStyle, ["outlined", "filled", "underline"], d.look.fieldStyle),
      radius: num(k.radius, 0, 32, d.look.radius),
      headingSize: num(k.headingSize, 16, 64, d.look.headingSize),
      textSize: num(k.textSize, 12, 22, d.look.textSize),
      fieldHeight: num(k.fieldHeight, 34, 70, d.look.fieldHeight),
      buttonSize: num(k.buttonSize, 12, 22, d.look.buttonSize),
      padding: num(k.padding, 0, 120, d.look.padding),
    },
  };
}

export const WIDTHS = { narrow: 520, medium: 720, wide: 1040 } as const;

/** The CSS variables the storefront block and the app preview both use. */
export function contactVars(c: ContactConfig): Record<string, string> {
  const k = c.look;
  return {
    "--uc-bg": k.bgType === "gradient" ? `linear-gradient(135deg, ${k.bg}, ${k.bg2})` : k.bg,
    "--uc-card": c.layout.style === "card" ? k.card : "transparent",
    "--uc-fg": k.text,
    "--uc-fbg": k.fieldBg,
    "--uc-fbd": k.fieldBorder,
    "--uc-ac": k.accent,
    "--uc-act": k.accentText,
    "--uc-r": `${k.radius}px`,
    "--uc-hs": `${k.headingSize}px`,
    "--uc-ts": `${k.textSize}px`,
    "--uc-fh": `${k.fieldHeight}px`,
    "--uc-bs": `${k.buttonSize}px`,
    "--uc-pad": `${k.padding}px`,
    "--uc-w": `${WIDTHS[c.layout.width] + (c.info.show ? 320 : 0)}px`,
  };
}

/** What the storefront reads: the cleaned settings plus ready-made CSS and links. */
export function toStorefrontContact(c: ContactConfig) {
  const css = Object.entries(contactVars(c))
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  const digits = c.info.whatsapp.replace(/\D/g, "");
  return {
    ...c,
    fields: c.fields.map((f) => ({
      ...f,
      ...FIELD_META[f.key],
      // What the storefront shows in the field. Labels inside the field: the label becomes the
      // hint (the label itself stays for screen readers). "placeholder" keeps the merchant's own.
      ph: c.layout.labels === "inside" && !f.placeholder ? f.label : f.placeholder,
    })),
    css,
    wa: digits ? `https://wa.me/${digits}` : "",
    tel: c.info.phone.replace(/[^\d+]/g, ""),
  };
}
