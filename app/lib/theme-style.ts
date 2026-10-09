/**
 * The live theme's style (colour schemes, fonts, corners), read from its settings by
 * theme-style.server.ts. Design pages use it for "Match my theme" and to draw previews that look like
 * the store. Shared by client and server.
 */
export type ThemeScheme = { id: string; name: string; bg: string; text: string; button: string; buttonText: string; link: string };
export type ThemeFont = { family: string; weight: number; italic: boolean };
export type ThemeStyle = {
  theme: string;
  /** "schemes": Online Store 2.0 colour schemes (class color-scheme-1…); "legacy": older themes' colour classes (color-background-1…). */
  kind: "schemes" | "legacy";
  schemes: ThemeScheme[];
  fonts: { heading: ThemeFont; body: ThemeFont };
  radius: { button: number; card: number; input: number; media: number; pill: number };
  buttonBorder: number;
};

export const FALLBACK_STYLE: ThemeStyle = {
  theme: "",
  kind: "schemes",
  schemes: [{ id: "scheme-1", name: "Scheme 1", bg: "#ffffff", text: "#121212", button: "#121212", buttonText: "#ffffff", link: "#121212" }],
  fonts: { heading: { family: "", weight: 600, italic: false }, body: { family: "", weight: 400, italic: false } },
  radius: { button: 6, card: 10, input: 6, media: 10, pill: 20 },
  buttonBorder: 1,
};

const SYSTEM = new Set(["helvetica", "helvetica neue", "arial", "times new roman", "times", "courier new", "courier", "georgia", "garamond", "palatino", "monaco", "lucida grande", "sans-serif", "serif", "monospace", "system-ui"]);

/** "playfair_display_n7" → Playfair Display, 700. */
export function parseFont(handle: unknown, fallbackWeight: number): ThemeFont {
  const h = typeof handle === "string" ? handle : "";
  const m = /^(.*)_([ni])(\d)$/.exec(h);
  const name = (m ? m[1] : h).replace(/_/g, " ").trim();
  return {
    family: name.replace(/\b\w/g, (c) => c.toUpperCase()),
    weight: m ? Number(m[3]) * 100 : fallbackWeight,
    italic: m ? m[2] === "i" : false,
  };
}

const stack = (f: ThemeFont, generic: string) => (f.family ? `"${f.family}", ${generic}` : generic);
export const fontStack = (f: ThemeFont) => stack(f, /serif|garamond|times|georgia|playfair|lora|merriweather|baskerville|caslon/i.test(f.family) && !/sans/i.test(f.family) ? "serif" : "sans-serif");

/** A Google Fonts stylesheet for the theme's fonts (best effort: Shopify's licensed fonts simply fall back). */
export function googleFontsHref(s: ThemeStyle): string | null {
  const fams = new Map<string, Set<number>>();
  for (const f of [s.fonts.heading, s.fonts.body]) {
    if (!f.family || SYSTEM.has(f.family.toLowerCase())) continue;
    const w = fams.get(f.family) ?? new Set<number>();
    w.add(f.weight);
    w.add(f === s.fonts.body ? 700 : f.weight);
    fams.set(f.family, w);
  }
  if (!fams.size) return null;
  const q = [...fams].map(([fam, w]) => `family=${encodeURIComponent(fam).replace(/%20/g, "+")}:wght@${[...w].sort((a, b) => a - b).join(";")}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/** A theme colour scheme id ("scheme-1", "background-1"…), or "" for none (stored in each design). */
export const schemeId = (v: unknown) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : "");

export const schemeOf = (s: ThemeStyle, id: string) => s.schemes.find((x) => x.id === id) ?? null;

/** Black or white, whichever reads better on a colour. */
export function readableOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? "#121212" : "#ffffff";
}

/**
 * How a design page's preview is drawn so it looks like the store: the theme's fonts, the chosen
 * scheme's colours (or the first scheme) and the theme's corners.
 */
export type PreviewTheme = { font: string; headingFont: string; headingWeight: number; bg: string; text: string; accent: string; accentText: string; radius: number; buttonRadius: number };

export function previewTheme(s: ThemeStyle | null | undefined, schemeId = ""): PreviewTheme {
  const st = s ?? FALLBACK_STYLE;
  const sc = (schemeId && schemeOf(st, schemeId)) || st.schemes[0] || FALLBACK_STYLE.schemes[0];
  return {
    font: fontStack(st.fonts.body),
    headingFont: fontStack(st.fonts.heading),
    headingWeight: st.fonts.heading.weight,
    bg: sc.bg,
    text: sc.text,
    accent: sc.button,
    accentText: sc.buttonText,
    radius: Math.min(st.radius.card, 24),
    buttonRadius: Math.min(st.radius.button, 40),
  };
}
