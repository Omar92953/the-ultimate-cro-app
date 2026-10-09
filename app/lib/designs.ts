/**
 * Section designs edited in the app (the app is the editor; the theme editor only switches the
 * embed on or places the block). Stored as JSON in $app:cro_design (handle = section), together
 * with a ready-made CSS-variable string the storefront applies. Shared by client and server.
 * First: the countdown bar.
 */

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i;
export const color = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fallback);
export const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
export const str = (v: unknown, fallback = "", max = 300) => (typeof v === "string" ? v.slice(0, max) : fallback);
export const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export type CountdownBarConfig = {
  on: boolean;
  timer: {
    mode: "fixed" | "evergreen" | "daily";
    end: string; // "YYYY-MM-DDTHH:mm", store time zone
    hours: number; // evergreen: each visitor gets
    cutoff: string; // daily: "HH:mm"
    ended: "hide" | "message" | "restart";
    endedText: string;
    style: NumberStyle;
    labels: boolean;
    labelText: { d: string; h: string; m: string; s: string };
    showDays: boolean;
  };
  text: { show: boolean; value: string };
  button: { show: boolean; text: string; action: "link" | "scroll"; link: string };
  layout: { position: "top" | "bottom"; slim: boolean; dismissible: boolean };
  where: { pages: ("home" | "product" | "collection" | "cart" | "other")[]; all: boolean; handles: string; devices: "all" | "desktop" | "mobile" };
  look: {
    bg: string;
    text: string;
    boxBg: string;
    boxText: string;
    buttonBg: string;
    buttonText: string;
    height: number; // vertical padding
    textSize: number;
    numberSize: number;
    labelSize: number;
    buttonSize: number;
    radius: number; // number boxes
    font: FontKey;
    textWeight: number;
    numberWeight: number;
    upper: boolean;
    buttonRadius: number;
    buttonStyle: "filled" | "outline";
  };
};

export type NumberStyle = "boxes" | "plain" | "circles" | "outline" | "cards" | "pill";
export const NUMBER_STYLES: { value: NumberStyle; label: string }[] = [
  { value: "boxes", label: "Boxes" },
  { value: "outline", label: "Outlined boxes" },
  { value: "circles", label: "Circles" },
  { value: "cards", label: "Flip cards" },
  { value: "pill", label: "All in one pill" },
  { value: "plain", label: "Plain numbers" },
];
export type FontKey = "theme" | "sans" | "rounded" | "serif" | "mono" | "condensed";
export const FONTS: { value: FontKey; label: string; css: string }[] = [
  { value: "theme", label: "Your theme's font", css: "inherit" },
  { value: "sans", label: "Clean (sans-serif)", css: '"Inter", "Helvetica Neue", Arial, sans-serif' },
  { value: "rounded", label: "Rounded", css: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", sans-serif' },
  { value: "serif", label: "Elegant (serif)", css: 'Georgia, "Times New Roman", serif' },
  { value: "mono", label: "Digital (monospace)", css: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  { value: "condensed", label: "Condensed", css: '"Arial Narrow", "Roboto Condensed", sans-serif-condensed, sans-serif' },
];

const in30days = () => {
  const d = new Date(Date.now() + 30 * 86400000);
  return `${d.toISOString().slice(0, 10)}T23:59`;
};

export const DEFAULT_COUNTDOWN_BAR: CountdownBarConfig = {
  on: true,
  timer: {
    mode: "fixed",
    end: "",
    hours: 24,
    cutoff: "17:00",
    ended: "hide",
    endedText: "This offer has ended.",
    style: "boxes",
    labels: false,
    labelText: { d: "Days", h: "Hours", m: "Min", s: "Sec" },
    showDays: true,
  },
  text: { show: true, value: "Sale ends in" },
  button: { show: true, text: "Shop now", action: "link", link: "/collections/all" },
  layout: { position: "top", slim: true, dismissible: true },
  where: { all: true, pages: [], handles: "", devices: "all" },
  look: {
    bg: "#b42318",
    text: "#ffffff",
    boxBg: "#ffffff",
    boxText: "#b42318",
    buttonBg: "#ffffff",
    buttonText: "#b42318",
    height: 6,
    textSize: 14,
    numberSize: 14,
    labelSize: 9,
    buttonSize: 13,
    radius: 5,
    font: "theme",
    textWeight: 600,
    numberWeight: 700,
    upper: false,
    buttonRadius: 999,
    buttonStyle: "filled",
  },
};

type BarPatch = { timer?: Partial<CountdownBarConfig["timer"]>; look?: Partial<CountdownBarConfig["look"]>; layout?: Partial<CountdownBarConfig["layout"]> };
/** Ready-made looks: colours, number style, font and button together. Everything stays editable. */
export const COUNTDOWN_BAR_PRESETS: { key: string; title: string; patch: BarPatch }[] = [
  { key: "red", title: "Bold red", patch: { timer: { style: "boxes" }, look: { bg: "#b42318", text: "#ffffff", boxBg: "#ffffff", boxText: "#b42318", buttonBg: "#ffffff", buttonText: "#b42318", radius: 5, font: "theme", textWeight: 600, numberWeight: 700, upper: false, buttonRadius: 999, buttonStyle: "filled" } } },
  { key: "gold", title: "Black and gold", patch: { timer: { style: "outline" }, look: { bg: "#111111", text: "#f1d38a", boxBg: "#f1d38a", boxText: "#111111", buttonBg: "#f1d38a", buttonText: "#111111", radius: 3, font: "serif", textWeight: 500, numberWeight: 600, upper: true, buttonRadius: 2, buttonStyle: "filled" } } },
  { key: "flip", title: "Flip clock", patch: { timer: { style: "cards" }, look: { bg: "#1d1d1f", text: "#ffffff", boxBg: "#2f2f33", boxText: "#ffffff", buttonBg: "#ffffff", buttonText: "#1d1d1f", radius: 6, font: "sans", textWeight: 600, numberWeight: 700, upper: false, buttonRadius: 8, buttonStyle: "filled" } } },
  { key: "minimal", title: "Minimal light", patch: { timer: { style: "plain" }, look: { bg: "#f3f3f1", text: "#111111", boxBg: "#111111", boxText: "#ffffff", buttonBg: "#111111", buttonText: "#111111", radius: 0, font: "mono", textWeight: 500, numberWeight: 600, upper: true, buttonRadius: 0, buttonStyle: "outline" } } },
  { key: "pastel", title: "Soft pink", patch: { timer: { style: "circles" }, look: { bg: "#fde2e4", text: "#7a2e3a", boxBg: "#ffffff", boxText: "#7a2e3a", buttonBg: "#7a2e3a", buttonText: "#ffffff", radius: 999, font: "rounded", textWeight: 600, numberWeight: 700, upper: false, buttonRadius: 999, buttonStyle: "filled" } } },
  { key: "green", title: "Green pill", patch: { timer: { style: "pill" }, look: { bg: "#0f5132", text: "#ffffff", boxBg: "#ffffff", boxText: "#0f5132", buttonBg: "#d7f25c", buttonText: "#0f5132", radius: 999, font: "sans", textWeight: 600, numberWeight: 700, upper: false, buttonRadius: 999, buttonStyle: "filled" } } },
  { key: "neon", title: "Neon", patch: { timer: { style: "outline" }, look: { bg: "#0b0b0b", text: "#39ff14", boxBg: "#39ff14", boxText: "#0b0b0b", buttonBg: "#39ff14", buttonText: "#0b0b0b", radius: 4, font: "mono", textWeight: 600, numberWeight: 700, upper: true, buttonRadius: 4, buttonStyle: "outline" } } },
  { key: "condensed", title: "Sport", patch: { timer: { style: "boxes" }, look: { bg: "#ffd400", text: "#111111", boxBg: "#111111", boxText: "#ffd400", buttonBg: "#111111", buttonText: "#ffd400", radius: 2, font: "condensed", textWeight: 700, numberWeight: 800, upper: true, buttonRadius: 2, buttonStyle: "filled" } } },
];

export function applyCountdownBarPreset(c: CountdownBarConfig, key: string): CountdownBarConfig {
  const p = COUNTDOWN_BAR_PRESETS.find((x) => x.key === key);
  if (!p) return c;
  return {
    ...c,
    timer: { ...c.timer, ...p.patch.timer },
    look: { ...c.look, ...p.patch.look },
    layout: { ...c.layout, ...p.patch.layout },
  };
}

const PAGES = ["home", "product", "collection", "cart", "other"] as const;

export function withCountdownBarDefaults(raw: unknown): CountdownBarConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CountdownBarConfig>;
  const d = DEFAULT_COUNTDOWN_BAR;
  const t = (r.timer ?? {}) as Partial<CountdownBarConfig["timer"]>;
  const lt = (t.labelText ?? {}) as Partial<CountdownBarConfig["timer"]["labelText"]>;
  const x = (r.text ?? {}) as Partial<CountdownBarConfig["text"]>;
  const b = (r.button ?? {}) as Partial<CountdownBarConfig["button"]>;
  const l = (r.layout ?? {}) as Partial<CountdownBarConfig["layout"]>;
  const w = (r.where ?? {}) as Partial<CountdownBarConfig["where"]>;
  const k = (r.look ?? {}) as Partial<CountdownBarConfig["look"]>;
  const end = str(t.end, "", 16);
  return {
    on: bool(r.on, d.on),
    timer: {
      mode: pick(t.mode, ["fixed", "evergreen", "daily"] as const, d.timer.mode),
      end: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(end) ? end : in30days(),
      hours: num(t.hours, 1, 168, d.timer.hours),
      cutoff: /^\d{1,2}:\d{2}$/.test(str(t.cutoff)) ? str(t.cutoff) : d.timer.cutoff,
      ended: pick(t.ended, ["hide", "message", "restart"] as const, d.timer.ended),
      endedText: str(t.endedText, d.timer.endedText, 160),
      style: pick(t.style, NUMBER_STYLES.map((x) => x.value), d.timer.style),
      labels: bool(t.labels, d.timer.labels),
      labelText: {
        d: str(lt.d, d.timer.labelText.d, 16) || d.timer.labelText.d,
        h: str(lt.h, d.timer.labelText.h, 16) || d.timer.labelText.h,
        m: str(lt.m, d.timer.labelText.m, 16) || d.timer.labelText.m,
        s: str(lt.s, d.timer.labelText.s, 16) || d.timer.labelText.s,
      },
      showDays: bool(t.showDays, d.timer.showDays),
    },
    text: { show: bool(x.show, d.text.show), value: str(x.value, d.text.value, 120) },
    button: {
      show: bool(b.show, d.button.show),
      text: str(b.text, d.button.text, 40) || d.button.text,
      action: pick(b.action, ["link", "scroll"] as const, d.button.action),
      link: safeLink(str(b.link, d.button.link, 500)),
    },
    layout: {
      position: pick(l.position, ["top", "bottom"] as const, d.layout.position),
      slim: bool(l.slim, d.layout.slim),
      dismissible: bool(l.dismissible, d.layout.dismissible),
    },
    where: {
      all: bool(w.all, d.where.all),
      pages: Array.isArray(w.pages) ? w.pages.filter((p): p is (typeof PAGES)[number] => (PAGES as readonly string[]).includes(p)) : [],
      handles: str(w.handles, "", 600),
      devices: pick(w.devices, ["all", "desktop", "mobile"] as const, d.where.devices),
    },
    look: {
      bg: color(k.bg, d.look.bg),
      text: color(k.text, d.look.text),
      boxBg: color(k.boxBg, d.look.boxBg),
      boxText: color(k.boxText, d.look.boxText),
      buttonBg: color(k.buttonBg, d.look.buttonBg),
      buttonText: color(k.buttonText, d.look.buttonText),
      height: num(k.height, 0, 30, d.look.height),
      textSize: num(k.textSize, 10, 24, d.look.textSize),
      numberSize: num(k.numberSize, 10, 32, d.look.numberSize),
      labelSize: num(k.labelSize, 7, 14, d.look.labelSize),
      buttonSize: num(k.buttonSize, 10, 20, d.look.buttonSize),
      radius: num(k.radius, 0, 999, d.look.radius),
      font: pick(k.font, FONTS.map((x) => x.value), d.look.font),
      textWeight: num(k.textWeight, 300, 800, d.look.textWeight),
      numberWeight: num(k.numberWeight, 300, 900, d.look.numberWeight),
      upper: bool(k.upper, d.look.upper),
      buttonRadius: num(k.buttonRadius, 0, 999, d.look.buttonRadius),
      buttonStyle: pick(k.buttonStyle, ["filled", "outline"] as const, d.look.buttonStyle),
    },
  };
}

/** Store paths, full https links or #anchors only (never javascript: and the like). */
export function safeLink(v: string) {
  const s = v.trim();
  if (!s) return "";
  if (s.startsWith("/") || s.startsWith("#")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}

export function countdownBarVars(c: CountdownBarConfig): Record<string, string> {
  const k = c.look;
  return {
    "--ucs-cdb-bg": k.bg,
    "--ucs-cdb-fg": k.text,
    "--ucs-cdb-fs": `${k.textSize}px`,
    "--ucs-cdb-pad": `${k.height}px`,
    "--ucs-accent": k.boxBg,
    "--ucs-on-accent": k.boxText,
    "--ucs-cdb-ns": `${k.numberSize}px`,
    "--ucs-cdb-ls": `${k.labelSize}px`,
    "--ucs-cdb-btn-bg": k.buttonBg,
    "--ucs-cdb-btn-fg": k.buttonText,
    "--ucs-cdb-bs": `${k.buttonSize}px`,
    "--ucs-cd-radius": `${k.radius}px`,
    "--ucs-cdb-font": FONTS.find((f) => f.value === k.font)?.css ?? "inherit",
    "--ucs-cdb-fw": String(k.textWeight),
    "--ucs-cd-nw": String(k.numberWeight),
    "--ucs-cdb-btn-r": `${k.buttonRadius}px`,
  };
}

/** Extra classes on the bar (shared by the storefront script and the preview). */
export function countdownBarClasses(c: CountdownBarConfig) {
  return `${c.look.upper ? " ucs-cdb--upper" : ""}${c.look.buttonStyle === "outline" ? " ucs-cdb--btn-outline" : ""}`;
}

/** What the storefront reads: settings + CSS + page targeting lists. */
export function toStorefrontCountdownBar(c: CountdownBarConfig) {
  return {
    ...c,
    xcls: countdownBarClasses(c),
    css: Object.entries(countdownBarVars(c))
      .map(([key, v]) => `${key}: ${v}`)
      .join("; "),
    handleList: c.where.handles
      .toLowerCase()
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  };
}
