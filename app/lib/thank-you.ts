/**
 * Thank-you page modules (Checkout → Thank-you page), shown by the cro-thank-you checkout UI
 * extension after an order. Saved in the shop metafield $app:thank_you, which the extension reads.
 * Works on every Shopify plan. Shared by client and server.
 */

export type SocialLink = { label: string; url: string };
export type ThankYouModule =
  | { id: string; type: "code"; on: boolean; heading: string; text: string; code: string }
  | { id: string; type: "note"; on: boolean; heading: string; text: string; tone: "info" | "success" }
  | { id: string; type: "social"; on: boolean; heading: string; text: string; links: SocialLink[] }
  | { id: string; type: "products"; on: boolean; heading: string; collection: string; count: number; button: string };
export type ModuleType = ThankYouModule["type"];
export type ThankYouConfig = { modules: ThankYouModule[] };

export const MODULE_TYPES: { type: ModuleType; title: string; help: string }[] = [
  { type: "code", title: "Discount for the next order", help: "A code with a copy button, so they come back." },
  { type: "note", title: "Message", help: "A note from you, e.g. when the order ships or how to reach you." },
  { type: "social", title: "Follow us", help: "Buttons to your Instagram, TikTok, WhatsApp…" },
  { type: "products", title: "You may also like", help: "Products from a collection, linking to your store." },
];

let seq = 0;
const newId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function newModule(type: ModuleType): ThankYouModule {
  const id = newId();
  switch (type) {
    case "code":
      return { id, type, on: true, heading: "A thank-you gift", text: "Use this code for 10% off your next order.", code: "" };
    case "note":
      return { id, type, on: true, heading: "What happens next", text: "We'll pack your order within 1 to 2 days and send you the tracking link.", tone: "info" };
    case "social":
      return { id, type, on: true, heading: "Follow us", text: "New drops and offers first.", links: [{ label: "Instagram", url: "" }] };
    case "products":
      return { id, type, on: true, heading: "You may also like", collection: "all", count: 4, button: "Shop now" };
  }
}

export const DEFAULT_THANK_YOU: ThankYouConfig = { modules: [] };

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function withThankYouDefaults(raw: unknown): ThankYouConfig {
  const list = Array.isArray(obj(raw).modules) ? (obj(raw).modules as unknown[]) : [];
  const modules = list.slice(0, 10).flatMap((x): ThankYouModule[] => {
    const m = obj(x);
    const base = { id: s(m.id, 30) || newId(), on: m.on !== false, heading: s(m.heading, 80) };
    switch (m.type) {
      case "code":
        return [{ ...base, type: "code", text: s(m.text, 240), code: s(m.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "") }];
      case "note":
        return [{ ...base, type: "note", text: s(m.text, 400), tone: m.tone === "success" ? "success" : "info" }];
      case "social":
        return [
          {
            ...base,
            type: "social",
            text: s(m.text, 240),
            links: (Array.isArray(m.links) ? m.links : []).slice(0, 6).map((l) => ({ label: s(obj(l).label, 30), url: s(obj(l).url, 300) })),
          },
        ];
      case "products": {
        const count = Math.round(Number(m.count));
        return [
          {
            ...base,
            type: "products",
            collection: s(m.collection, 120).toLowerCase().replace(/[^a-z0-9-]/g, "") || "all",
            count: Number.isFinite(count) ? Math.min(6, Math.max(1, count)) : 4,
            button: s(m.button, 30),
          },
        ];
      }
      default:
        return [];
    }
  });
  return { modules };
}

/** What the extension reads: switched-off modules and incomplete links are left out. */
export function toExtensionConfig(c: ThankYouConfig) {
  return {
    modules: c.modules
      .filter((m) => m.on)
      .map((m) => (m.type === "social" ? { ...m, links: m.links.filter((l) => /^https:\/\//.test(l.url)) } : m)),
  };
}
