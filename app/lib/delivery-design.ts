/**
 * Delivery date estimate (Boosters → Delivery estimate), on product pages and the cart:
 * "Order within 2h 15m — arrives Thu, Oct 16 – Sat, Oct 18". The date comes from the order cut-off
 * time (shop time zone), processing days and shipping days, skipping days off and holidays; shipping
 * days can differ by country (zones). Stored in $app:cro_design "delivery" (+ "_editor").
 * Shared by client and server; the storefront maths lives in ucs-delivery.js and DeliveryPreview.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const DELIVERY_SIZES: SizeSpec[] = [
  { key: "text", label: "Text", cssVar: "--ucs-dl-t", min: 10, max: 24, def: 14 },
  { key: "icon", label: "Icon", cssVar: "--ucs-dl-ic", min: 12, max: 40, def: 20 },
];

export type DeliveryZone = { id: string; countries: string; min: number; max: number };

export type DeliveryDesign = {
  scheme: string;
  rules: {
    cutoff: string; // "14:00", shop time
    processing: number; // working days before it ships (0 = same day when ordered before the cut-off)
    min: number; // shipping days
    max: number;
    daysOff: number[]; // 0 = Sunday … 6 = Saturday
    holidays: string; // "2026-12-25, 2027-01-01"
    zones: DeliveryZone[];
  };
  text: { line: string; countdown: string; arrives: string; range: string; hideAfterCutoff: boolean };
  look: { style: "line" | "box"; icon: "truck" | "clock" | "box" | "none"; accent: string; bg: string; radius: number; countdownBold: boolean };
  where: { product: boolean; cart: boolean };
  sizes: Sizes;
};

export const DEFAULT_DELIVERY: DeliveryDesign = {
  scheme: "",
  rules: { cutoff: "14:00", processing: 1, min: 2, max: 4, daysOff: [5], holidays: "", zones: [] },
  text: { line: "{countdown} {arrives}", countdown: "Order within {time}", arrives: "and get it {dates}", range: "{from} – {to}", hideAfterCutoff: false },
  look: { style: "box", icon: "truck", accent: "#1a7f37", bg: "#f3f8f4", radius: 10, countdownBold: true },
  where: { product: true, cart: true },
  sizes: defaultSizes(DELIVERY_SIZES),
};

type Patch = { look?: Partial<DeliveryDesign["look"]> };
export const DELIVERY_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "green", title: "Soft green box", patch: { look: { style: "box", icon: "truck", accent: "#1a7f37", bg: "#f3f8f4", radius: 10 } } },
  { key: "line", title: "Simple line", patch: { look: { style: "line", icon: "truck", accent: "#121212", radius: 0 } } },
  { key: "blue", title: "Blue box", patch: { look: { style: "box", icon: "clock", accent: "#1d4ed8", bg: "#eff4ff", radius: 12 } } },
  { key: "warm", title: "Warm", patch: { look: { style: "box", icon: "box", accent: "#c2410c", bg: "#fff6ea", radius: 16 } } },
];

export function applyDeliveryPreset(c: DeliveryDesign, key: string): DeliveryDesign {
  const p = DELIVERY_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const time = (v: unknown, fallback: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : fallback);
const countries = (v: unknown) =>
  String(v ?? "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((c) => c.length === 2)
    .join(", ");

export function withDeliveryDefaults(raw: unknown): DeliveryDesign {
  const r = obj(raw);
  const d = DEFAULT_DELIVERY;
  const ru = obj(r.rules), t = obj(r.text), k = obj(r.look), w = obj(r.where);
  const min = num(ru.min, 0, 60, d.rules.min);
  return {
    scheme: schemeId(r.scheme),
    rules: {
      cutoff: time(ru.cutoff, d.rules.cutoff),
      processing: num(ru.processing, 0, 30, d.rules.processing),
      min,
      max: Math.max(min, num(ru.max, 0, 60, d.rules.max)),
      daysOff: Array.isArray(ru.daysOff) ? [...new Set((ru.daysOff as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].slice(0, 6) : d.rules.daysOff,
      holidays: String(ru.holidays ?? "")
        .split(/[\s,]+/)
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
        .slice(0, 60)
        .join(", "),
      zones: Array.isArray(ru.zones)
        ? (ru.zones as unknown[]).slice(0, 12).map((z, i) => {
            const o = obj(z);
            const zmin = num(o.min, 0, 60, min);
            return { id: str(o.id, `z${i}`, 20) || `z${i}`, countries: countries(o.countries), min: zmin, max: Math.max(zmin, num(o.max, 0, 60, zmin)) };
          })
        : [],
    },
    text: {
      line: str(t.line, d.text.line, 120),
      countdown: str(t.countdown, d.text.countdown, 80),
      arrives: str(t.arrives, d.text.arrives, 80),
      range: str(t.range, d.text.range, 40),
      hideAfterCutoff: bool(t.hideAfterCutoff, d.text.hideAfterCutoff),
    },
    look: {
      style: pick(k.style, ["line", "box"] as const, d.look.style),
      icon: pick(k.icon, ["truck", "clock", "box", "none"] as const, d.look.icon),
      accent: color(k.accent, d.look.accent),
      bg: color(k.bg, d.look.bg),
      radius: num(k.radius, 0, 30, d.look.radius),
      countdownBold: bool(k.countdownBold, d.look.countdownBold),
    },
    where: { product: bool(w.product, d.where.product), cart: bool(w.cart, d.where.cart) },
    sizes: withSizes(r.sizes, DELIVERY_SIZES),
  };
}

export function deliveryVars(c: DeliveryDesign): Record<string, string> {
  const v: Record<string, string> = { "--ucs-dl-accent": c.look.accent, "--ucs-dl-bg": c.look.bg, "--ucs-dl-r": `${c.look.radius}px` };
  Object.assign(v, sizeVars(c.sizes, DELIVERY_SIZES));
  return v;
}

export const deliveryClass = (c: DeliveryDesign) => `ucs ucs-dl ucs-dl--${c.look.style}${c.look.countdownBold ? " ucs-dl--bold" : ""}`;

/* ---------- the date maths (same as ucs-delivery.js) ---------- */
type Rules = DeliveryDesign["rules"];
const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** `shopNow`: the shop's wall-clock time as a UTC date (Date.now() + shop offset). */
export function estimate(r: Rules, shopNow: Date, country = "") {
  const off = new Set(r.daysOff);
  const holidays = new Set(r.holidays.split(/[\s,]+/).filter(Boolean));
  const working = (d: Date) => !off.has(d.getUTCDay()) && !holidays.has(ymd(d));
  const zone = r.zones.find((z) => z.countries.split(/,\s*/).includes(country.toUpperCase()));
  const [h, m] = r.cutoff.split(":").map(Number);
  const day = new Date(Date.UTC(shopNow.getUTCFullYear(), shopNow.getUTCMonth(), shopNow.getUTCDate()));
  const cutoff = new Date(day.getTime() + (h * 60 + m) * 60_000);
  // The order "starts" today if it's a working day and before the cut-off, else the next working day.
  let start = new Date(day);
  const before = working(day) && shopNow < cutoff;
  if (!before) {
    do start = new Date(start.getTime() + 86_400_000);
    while (!working(start));
  }
  const add = (from: Date, n: number) => {
    let d = new Date(from);
    for (let i = 0; i < n; ) {
      d = new Date(d.getTime() + 86_400_000);
      if (working(d)) i++;
    }
    return d;
  };
  const ships = add(start, r.processing);
  const min = zone ? zone.min : r.min, max = zone ? zone.max : r.max;
  // The countdown runs to today's cut-off (or the next working day's).
  const deadline = new Date(start.getTime() + (h * 60 + m) * 60_000);
  return { from: add(ships, min), to: add(ships, max), deadline, today: before, msLeft: deadline.getTime() - shopNow.getTime() };
}

/** The storefront copy, read by ucs-delivery.liquid / ucs-delivery.js. */
export function toStorefrontDelivery(c: DeliveryDesign) {
  return {
    cls: deliveryClass(c),
    css: Object.entries(deliveryVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    r: c.rules,
    t: c.text,
    ic: c.look.icon,
    w: c.where,
  };
}
