/**
 * "Match my theme" for every design page: one button that applies the live theme's colours, corners
 * and fonts, and a colour scheme picker (the section then uses that scheme's colours on the store,
 * and follows it if the theme's colours change later). Plus ThemeLook, which dresses a preview
 * like the store.
 */
import type { CSSProperties, ReactNode } from "react";
import { googleFontsHref, previewTheme, type ThemeStyle } from "../lib/theme-style";

export function ThemeStylePanel({ style, scheme, onScheme, onMatch, noneLabel = "None (same as the page)" }: { style: ThemeStyle; scheme: string; onScheme: (id: string) => void; onMatch: () => void; noneLabel?: string }) {
  const f = style.fonts;
  const font = (x: ThemeStyle["fonts"]["body"]) => (x.family ? `${x.family} ${x.weight}` : "theme default");
  return (
    <s-section heading="Match my theme">
      <s-stack gap="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button variant="primary" icon="wand" onClick={onMatch}>
            Match my theme style
          </s-button>
          <s-text color="subdued">{style.theme ? `From “${style.theme}”: ` : ""}colours, corners and fonts.</s-text>
        </s-stack>
        <div>
          <s-text type="strong">Colour scheme</s-text>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 8, marginTop: 8 }} role="radiogroup" aria-label="Colour scheme">
            {[{ id: "", name: noneLabel, bg: "transparent", text: "#616161", button: "#c9c9c9", buttonText: "#fff", link: "" }, ...style.schemes].map((s) => {
              const on = s.id === scheme;
              return (
                <button
                  key={s.id || "none"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onScheme(s.id)}
                  style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6, font: "inherit", textAlign: "left", cursor: "pointer", background: "#fff", border: on ? "2px solid #303030" : "1px solid #d4d4d4", borderRadius: 10, minWidth: 0 }}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 6, background: s.id ? s.bg : "repeating-linear-gradient(45deg,#f4f4f4 0 6px,#fff 6px 12px)", color: s.text, border: "1px solid rgba(0,0,0,.08)", fontWeight: 600 }} aria-hidden="true">
                    Aa
                    <i style={{ width: 22, height: 12, borderRadius: 3, background: s.button, display: "inline-block" }} />
                  </span>
                  <span style={{ fontSize: 12, color: "#303030", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <s-text color="subdued">
          Fonts: {font(f.heading)} for headings, {font(f.body)} for text (the section always uses your theme’s fonts on the store). Corners: buttons {style.radius.button}px, cards {style.radius.card}px.
        </s-text>
      </s-stack>
    </s-section>
  );
}

/** Wraps a preview so it looks like the store: the theme's fonts, page colours and heading font. */
export function ThemeLook({ style, children, pad = 0 }: { style: ThemeStyle; children: ReactNode; pad?: number }) {
  const t = previewTheme(style);
  const href = googleFontsHref(style);
  return (
    <div
      style={{ fontFamily: t.font, background: t.bg, color: t.text, padding: pad, "--font-heading-family": t.headingFont, "--font-heading-weight": String(t.headingWeight), "--font-body-family": t.font } as CSSProperties}
    >
      {href ? <link rel="stylesheet" href={href} /> : null}
      {children}
    </div>
  );
}
