/**
 * Preview of building a bundle from a collection page: the step's products as the theme's product
 * cards with "+ Add to bundle", and the bundle tray (same classes and stylesheet as
 * ucro-bundle-tray.js / ucro-bundle-tray.css). Clicking adds and removes like on the store.
 */
import { useState, type CSSProperties } from "react";
import { bundleVars, type BundleDesign } from "../lib/bundle-design";
import type { PreviewTheme } from "../lib/theme-style";
import { SAMPLE_BUNDLE, type PreviewBundle, type PreviewItem } from "./BundlePreview";

const TINTS = ["linear-gradient(145deg,#ffd6a5,#f4a261)", "linear-gradient(145deg,#bde0fe,#6c9bd2)", "linear-gradient(145deg,#cdb4db,#9b72b0)", "linear-gradient(145deg,#b7e4c7,#52b788)", "linear-gradient(145deg,#ffc8dd,#e07a9a)"];
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\[(\w+)\]/g, (m, k) => (k in vars ? String(vars[k]) : m));

export function BundleCollectionPreview({ config: c, bundle = SAMPLE_BUNDLE, currency = "USD", page, block, pricing }: { config: BundleDesign; bundle?: PreviewBundle; currency?: string; page: PreviewTheme; block: PreviewTheme | null; pricing?: { kind: "fixed" | "percent"; percent: number } }) {
  // The collection shown: the first step that lists products (a collection step on the store).
  const stepIndex = Math.max(0, bundle.steps.findIndex((s) => s.items.length > 0));
  const step = bundle.steps[stepIndex];
  const [picks, setPicks] = useState<{ s: number; item: PreviewItem }[]>(() => (step?.items[0] ? [{ s: stepIndex, item: step.items[0] }] : []));
  const [open, setOpen] = useState(true);
  const money = (cents: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const max = (i: number) => Math.max(bundle.steps[i].max, bundle.steps[i].min, 1);
  const count = (i: number) => picks.filter((p) => p.s === i).length;
  const left = bundle.steps.reduce((n, s, i) => n + Math.max(0, s.min - count(i)), 0);
  const value = picks.reduce((n, p) => n + p.item.cents, 0);
  const price = pricing?.kind === "percent" ? Math.round(value * (1 - pricing.percent / 100)) : Math.min(bundle.price || value, value || bundle.price);
  const total = bundle.steps.reduce((n, _s, i) => n + max(i), 0);
  const look = block ?? page;
  const vars = {
    ...bundleVars(c),
    "--ucro-accent": c.look.themeAccent ? look.accent : c.look.accent,
    "--ucro-on-text": c.look.themeAccent ? look.accentText : "#fff",
    "--ucro-radius": `${c.look.themeRadius ? look.radius : c.look.radius}px`,
    ...(block ? { "--ucro-bt-bg": block.bg, "--ucro-bt-fg": block.text } : {}),
  } as CSSProperties;
  const toggle = (item: PreviewItem) =>
    setPicks((ps) => {
      const at = ps.findIndex((p) => p.s === stepIndex && p.item === item);
      if (at >= 0) return ps.filter((_, i) => i !== at);
      if (count(stepIndex) >= max(stepIndex)) return ps;
      return [...ps, { s: stepIndex, item }];
    });

  return (
    <div style={{ position: "relative", minHeight: 560, padding: "16px 16px 120px", fontSize: 14, ...vars }}>
      <h2 style={{ margin: "0 0 4px", fontFamily: page.headingFont, fontWeight: page.headingWeight, fontSize: 22 }}>{step?.label || "Collection"}</h2>
      <p style={{ margin: "0 0 14px", opacity: 0.7 }}>{step?.items.length ?? 0} products</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
        {(step?.items ?? []).map((it, i) => {
          const on = picks.some((p) => p.s === stepIndex && p.item === it);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "block", aspectRatio: "1", borderRadius: page.radius, overflow: "hidden", background: it.image ? "#eee" : TINTS[i % TINTS.length] }}>
                {it.image ? <img src={`${it.image}${it.image.includes("?") ? "&" : "?"}width=300`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
              </span>
              <span style={{ fontWeight: 600 }}>{it.title}</span>
              <span style={{ opacity: 0.75 }}>{money(it.cents)}</span>
              <button type="button" className={`ucro-atb-card${on ? " is-in" : ""}`} style={{ margin: "4px 0 0", width: "100%" }} onClick={() => toggle(it)}>
                {on ? "✓ In your bundle" : `+ ${c.tray.add}`}
              </button>
            </div>
          );
        })}
      </div>

      <aside className={`ucro-bt ucro-bt--${c.tray.position}`} style={{ position: "absolute", ...(c.tray.position === "right" ? { right: 12, left: "auto" } : {}) }} aria-label="Your bundle">
        <button type="button" className="ucro-bt__bar" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="ucro-bt__thumbs">
            {picks.slice(0, 5).map((p, i) => (p.item.image ? <img key={i} src={`${p.item.image}${p.item.image.includes("?") ? "&" : "?"}width=80`} alt="" width={36} height={36} /> : <span key={i} className="ucro-bt__ph" style={{ display: "inline-block", background: TINTS[i % TINTS.length] }} />))}
          </span>
          <span className="ucro-bt__title">
            <strong>{bundle.name}</strong>
            <span>
              {picks.length} of {total} chosen{left ? "" : " · ready"}
            </span>
          </span>
          <span className="ucro-bt__chev" aria-hidden="true" />
        </button>
        <div className="ucro-bt__panel" hidden={!open}>
          <div className="ucro-bt__steps" style={{ maxHeight: 260 }}>
            {bundle.steps.map((s, i) => (
              <div key={i} className="ucro-bt__step">
                <div className="ucro-bt__step-head">
                  <strong>{s.label}</strong>
                  <span>
                    {count(i)} / {max(i)}
                    {s.min === 0 ? " · optional" : ""}
                  </span>
                </div>
                {count(i) ? (
                  <ul className="ucro-bt__picks">
                    {picks
                      .filter((p) => p.s === i)
                      .map((p, n) => (
                        <li key={n}>
                          {p.item.image ? <img src={`${p.item.image}${p.item.image.includes("?") ? "&" : "?"}width=100`} alt="" width={44} height={44} /> : <span className="ucro-bt__ph" style={{ background: TINTS[n % TINTS.length] }} />}
                          <span className="ucro-bt__name">
                            {p.item.title}
                            <small>{money(p.item.cents)}</small>
                          </span>
                          <button type="button" className="ucro-bt__remove" aria-label={`Remove ${p.item.title}`} onClick={() => setPicks((ps) => ps.filter((x) => x !== p))}>
                            ×
                          </button>
                        </li>
                      ))}
                  </ul>
                ) : null}
                {count(i) < max(i) ? <span className="ucro-bt__browse">Browse more →</span> : null}
              </div>
            ))}
          </div>
          <div className="ucro-bt__foot">
            <p className="ucro-bt__total">
              {value > price ? <s>{money(value)}</s> : null} <strong>{money(price)}</strong>
              {value > price ? <span className="ucro-bt__save">You save {money(value - price)}</span> : null}
            </p>
            <div className="ucro-bt__actions">
              <button type="button" className="ucro-btn ucro-btn--fallback" disabled={left > 0} style={{ borderRadius: page.buttonRadius }}>
                {left ? fill(c.button.remaining, { remaining: left }) : c.tray.cart}
              </button>
              {left ? null : (
                <button type="button" className="ucro-btn ucro-btn--fallback" style={{ borderRadius: page.buttonRadius }}>
                  {c.tray.checkout}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
