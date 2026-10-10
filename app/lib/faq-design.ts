/**
 * FAQ section, designed in the app (moved out of the theme editor). The questions are still the list
 * in Sections → FAQ; per placement the theme editor keeps only "Only this group", an optional
 * heading and the Google structured-data switch. Stored in $app:cro_design "faq" (storefront: short
 * keys read by ucs-faq.liquid) and "faq_editor". Shared by client and server.
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";

export type FaqDesign = {
  scheme: string;
  text: { heading: string; sub: string; headingSize: number; align: "left" | "center"; contactText: string; contactLabel: string; contactLink: string };
  questions: { tabs: boolean; search: boolean; oneOpen: boolean; openFirst: boolean; columns: 1 | 2 };
  look: {
    style: "lines" | "cards";
    icon: "plus" | "chevron";
    iconLeft: boolean;
    questionSize: number;
    maxWidth: number;
    radius: number;
    accent: string;
    ownBg: boolean;
    bg: string;
    ownCard: boolean;
    cardBg: string;
    ownText: boolean;
    fg: string;
  };
  space: { top: number; bottom: number; devices: "all" | "desktop" | "mobile" };
};

export const DEFAULT_FAQ: FaqDesign = {
  scheme: "",
  text: { heading: "Frequently asked questions", sub: "", headingSize: 30, align: "center", contactText: "Still have a question?", contactLabel: "Contact us", contactLink: "" },
  questions: { tabs: true, search: true, oneOpen: true, openFirst: false, columns: 1 },
  look: { style: "lines", icon: "plus", iconLeft: false, questionSize: 16, maxWidth: 860, radius: 10, accent: "#121212", ownBg: false, bg: "#ffffff", ownCard: false, cardBg: "#f4f4f4", ownText: false, fg: "#121212" },
  space: { top: 40, bottom: 40, devices: "all" },
};

type Look = FaqDesign["look"];
export const FAQ_PRESETS: { key: string; title: string; look: Partial<Look> }[] = [
  { key: "lines", title: "Clean lines", look: { style: "lines", icon: "plus", iconLeft: false, ownBg: false, ownCard: false, ownText: false, accent: "#121212" } },
  { key: "cards", title: "Soft cards", look: { style: "cards", icon: "chevron", iconLeft: false, radius: 12, ownBg: false, ownCard: true, cardBg: "#f4f4f4", ownText: false, accent: "#121212" } },
  { key: "pill", title: "Round cards", look: { style: "cards", icon: "plus", iconLeft: false, radius: 24, ownBg: false, ownCard: true, cardBg: "#eef2ff", ownText: true, fg: "#1e1b4b", accent: "#4f46e5" } },
  { key: "warm", title: "Warm", look: { style: "cards", icon: "chevron", iconLeft: false, radius: 6, ownBg: true, bg: "#f6efe6", ownCard: true, cardBg: "#fffaf3", ownText: true, fg: "#3b2a1a", accent: "#c2410c" } },
  { key: "dark", title: "Dark", look: { style: "lines", icon: "plus", iconLeft: false, ownBg: true, bg: "#111111", ownCard: false, ownText: true, fg: "#ffffff", accent: "#ffffff" } },
  { key: "left", title: "Icon on the left", look: { style: "lines", icon: "chevron", iconLeft: true, ownBg: false, ownCard: false, ownText: false, accent: "#121212" } },
];

export function applyFaqPreset(c: FaqDesign, key: string): FaqDesign {
  const p = FAQ_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function withFaqDefaults(raw: unknown): FaqDesign {
  const r = obj(raw);
  const d = DEFAULT_FAQ;
  const t = obj(r.text), q = obj(r.questions), k = obj(r.look), s = obj(r.space);
  return {
    scheme: schemeId(r.scheme),
    text: {
      heading: str(t.heading, d.text.heading, 120),
      sub: str(t.sub, d.text.sub, 240),
      headingSize: num(t.headingSize, 18, 56, d.text.headingSize),
      align: pick(t.align, ["left", "center"] as const, d.text.align),
      contactText: str(t.contactText, d.text.contactText, 120),
      contactLabel: str(t.contactLabel, d.text.contactLabel, 40),
      contactLink: str(t.contactLink, d.text.contactLink, 300).trim().replace(/^javascript:/i, ""),
    },
    questions: {
      tabs: bool(q.tabs, d.questions.tabs),
      search: bool(q.search, d.questions.search),
      oneOpen: bool(q.oneOpen, d.questions.oneOpen),
      openFirst: bool(q.openFirst, d.questions.openFirst),
      columns: Number(q.columns) === 2 ? 2 : 1,
    },
    look: {
      style: pick(k.style, ["lines", "cards"] as const, d.look.style),
      icon: pick(k.icon, ["plus", "chevron"] as const, d.look.icon),
      iconLeft: bool(k.iconLeft, d.look.iconLeft),
      questionSize: num(k.questionSize, 13, 24, d.look.questionSize),
      maxWidth: num(k.maxWidth, 560, 1400, d.look.maxWidth),
      radius: num(k.radius, 0, 24, d.look.radius),
      accent: color(k.accent, d.look.accent),
      ownBg: bool(k.ownBg, d.look.ownBg),
      bg: color(k.bg, d.look.bg),
      ownCard: bool(k.ownCard, d.look.ownCard),
      cardBg: color(k.cardBg, d.look.cardBg),
      ownText: bool(k.ownText, d.look.ownText),
      fg: color(k.fg, d.look.fg),
    },
    space: { top: num(s.top, 0, 100, d.space.top), bottom: num(s.bottom, 0, 100, d.space.bottom), devices: pick(s.devices, ["all", "desktop", "mobile"] as const, d.space.devices) },
  };
}

/** Black or white text for buttons in this colour (same threshold as the old Liquid). */
function onColor(hex: string) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#121212" : "#ffffff";
}

export const faqClass = (c: FaqDesign) =>
  [`ucs-faq--${c.look.style}`, `ucs-faq--${c.look.icon}`, c.look.iconLeft ? "ucs-faq--icon-left" : "", c.space.devices === "mobile" ? "ucs-hide-desktop" : c.space.devices === "desktop" ? "ucs-hide-mobile" : ""].filter(Boolean).join(" ");

export function faqVars(c: FaqDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pt": `${c.space.top}px`,
    "--ucs-pb": `${c.space.bottom}px`,
    "--ucs-h": `${c.text.headingSize}px`,
    "--ucs-align": c.text.align,
    "--ucs-max": `${c.look.maxWidth}px`,
    "--ucs-faq-q": `${c.look.questionSize}px`,
    "--ucs-faq-radius": `${c.look.radius}px`,
    "--ucs-accent": c.look.accent,
    "--ucs-on-accent": onColor(c.look.accent),
  };
  if (c.look.ownBg) v.background = c.look.bg;
  if (c.look.ownCard) v["--ucs-faq-card"] = c.look.cardBg;
  if (c.look.ownText) v.color = c.look.fg;
  return v;
}

/** The storefront copy: short keys, read by ucs-faq.liquid. */
export function toStorefrontFaq(c: FaqDesign) {
  return {
    cls: ` ${faqClass(c)}`,
    css: Object.entries(faqVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    h: c.text.heading,
    sub: c.text.sub,
    tb: c.questions.tabs,
    se: c.questions.search,
    oo: c.questions.oneOpen,
    of: c.questions.openFirst,
    col: c.questions.columns,
    ct: c.text.contactText,
    cl: c.text.contactLabel,
    cu: c.text.contactLink,
  };
}
