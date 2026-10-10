/**
 * "Start from a template" for design pages, with the template currently in use highlighted (one is "in
 * use" when applying it would change nothing). With `render`, each look is the page's own live
 * preview with that look applied, scaled down, and its words drawn as bars (the design without the
 * text). Without it, a small drawn sample (accent colour, corners, layout).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Draws text as rounded bars in the text's own colour (Google's "Flow Rounded" placeholder font). */
const BARS_FONT = "https://fonts.googleapis.com/css2?family=Flow+Rounded&display=block";
const MINI_WIDTH = 760;

/** Adds the bars font and the mini-preview rules to the page head once. */
function useMiniStyles() {
  useEffect(() => {
    if (document.getElementById("look-mini-styles")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = BARS_FONT;
    const style = document.createElement("style");
    style.id = "look-mini-styles";
    style.textContent = `.lookMini, .lookMini * { font-family: "Flow Rounded", sans-serif !important; letter-spacing: 0 !important; } .lookMini *, .lookMini *::before, .lookMini *::after { animation: none !important; transition: none !important; }`;
    document.head.append(link, style);
  }, []);
}

/** A full-size preview shrunk to fit its box; not clickable or focusable. */
function MiniPreview({ children }: { children: ReactNode }) {
  useMiniStyles();
  const box = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(0.2);
  // Drawn only in the browser: live previews (timers, measured sizes) never match the server's HTML,
  // and a mismatch makes React redraw the whole page, which drops the app's styles in development.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Fires once straight away when observing starts, then on every resize.
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / MINI_WIDTH || 0.2);
      setReady(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={box} aria-hidden="true" style={{ display: "block", position: "relative", height: 118, overflow: "hidden", borderRadius: 6, background: "#fff", boxShadow: "inset 0 0 0 1px #ececec" }}>
      <span
        className="lookMini"
        {...({ inert: true } as object)}
        style={{ display: "block", position: "absolute", top: 0, left: 0, width: MINI_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}
      >
        {ready ? children : null}
      </span>
    </span>
  );
}
export type LookSwatch = {
  accent: string; // selected item / buttons
  radius: number; // card corners, px
  bg?: string; // section background
  text?: string;
  cards?: number; // how many cards in a row
  ratio?: number; // card height / width
  list?: boolean; // one box with rows instead of cards
};

export function LookPicker<C>({ presets, config, apply, swatch, render, onPick }: { presets: { key: string; title: string }[]; config: C; apply: (c: C, key: string) => C; swatch?: (c: C) => LookSwatch; render?: (c: C) => ReactNode; onPick: (key: string) => void }) {
  const now = JSON.stringify(config);
  return (
    <s-section heading="Start from a template">
      <p style={{ margin: "0 0 10px", color: "#616161", fontSize: 13 }}>An easy start: pick one, then change anything in the other tabs.</p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${render ? 160 : 130}px, 1fr))`, gap: 10 }} role="radiogroup" aria-label="Templates">
        {presets.map((p) => {
          const next = apply(config, p.key);
          const on = JSON.stringify(next) === now;
          const s = swatch ? swatch(next) : { accent: "#303030", radius: 8 };
          const n = Math.max(2, Math.min(4, s.cards ?? 3));
          const r = Math.min(s.radius, 14);
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Use the ${p.title} template`}
              onClick={() => onPick(p.key)}
              style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6, font: "inherit", textAlign: "left", cursor: "pointer", background: "#fff", border: on ? "2px solid #303030" : "1px solid #d4d4d4", borderRadius: 10, minWidth: 0 }}
            >
              {render ? <MiniPreview>{render(next)}</MiniPreview> : <span aria-hidden="true" style={{ display: "flex", flexDirection: s.list ? "column" : "row", gap: s.list ? 0 : 5, height: 64, padding: 6, background: s.bg ?? "#f6f6f7", borderRadius: 6, overflow: "hidden" }}>
                {Array.from({ length: s.list ? 3 : n }, (_, i) => {
                  const sel = i === 0;
                  if (s.list) {
                    return (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, padding: "0 6px", background: sel ? `color-mix(in srgb, ${s.accent} 14%, #fff)` : "#fff", boxShadow: sel ? `inset 3px 0 0 ${s.accent}` : undefined, borderTop: i ? "1px solid #e6e6e6" : undefined, borderRadius: i === 0 ? `${r}px ${r}px 0 0` : i === 2 ? `0 0 ${r}px ${r}px` : 0 }}>
                        <i style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${sel ? s.accent : "#c9c9c9"}` }} />
                        <i style={{ flex: 1, height: 4, borderRadius: 2, background: "#d9d9d9" }} />
                      </span>
                    );
                  }
                  return (
                    <span key={i} style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0, padding: 3, background: "#fff", border: `1px solid ${sel ? s.accent : "#e3e3e3"}`, boxShadow: sel ? `0 0 0 1px ${s.accent}` : undefined, borderRadius: r }}>
                      <i style={{ flex: s.ratio ? `0 0 ${Math.round(30 * Math.min(s.ratio, 1.6))}px` : 1, maxHeight: 34, borderRadius: Math.max(0, r - 2), background: ["#f4c99b", "#b9d3f2", "#d2bfe0", "#bfe3cb"][i % 4] }} />
                      <i style={{ height: 7, borderRadius: Math.min(r, 6), background: sel ? s.accent : "transparent", border: sel ? undefined : "1px solid #d9d9d9" }} />
                    </span>
                  );
                })}
              </span>}
              <span style={{ fontSize: 13, fontWeight: 600, color: "#303030" }}>
                {p.title}
                {on ? <span style={{ fontWeight: 400, color: "#616161" }}> · in use</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </s-section>
  );
}
