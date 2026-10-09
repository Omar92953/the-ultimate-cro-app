/**
 * Live preview of the bundle builder: the same markup and stylesheet (ucro.css) as
 * ucro-bundle-builder.liquid, with one of the merchant's bundles (or a sample). Picking items,
 * the counts, the summary and the button text behave like on the store.
 */
import { useState, type CSSProperties } from "react";
import { bundleClass, bundleVars, type BundleDesign } from "../lib/bundle-design";
import type { PreviewTheme } from "../lib/theme-style";

export type PreviewItem = { title: string; image: string | null; cents: number };
export type PreviewBundle = { name: string; handle?: string; price: number; pricing?: { kind: "fixed" | "percent"; percent: number }; steps: { label: string; min: number; max: number; items: PreviewItem[] }[] };

const TINTS = ["linear-gradient(145deg,#ffd6a5,#f4a261)", "linear-gradient(145deg,#bde0fe,#6c9bd2)", "linear-gradient(145deg,#cdb4db,#9b72b0)", "linear-gradient(145deg,#b7e4c7,#52b788)", "linear-gradient(145deg,#ffc8dd,#e07a9a)"];
export const SAMPLE_BUNDLE: PreviewBundle = {
  name: "Example bundle",
  price: 6000,
  steps: [
    { label: "Choose 2 candles", min: 2, max: 2, items: ["Fig", "Amber", "Cedar", "Linen"].map((t, i) => ({ title: `${t} candle`, image: null, cents: 2400 + i * 100 })) },
    { label: "Add a holder (optional)", min: 0, max: 1, items: ["Brass holder", "Glass holder"].map((t) => ({ title: t, image: null, cents: 1800 })) },
  ],
};

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\[(\w+)\]/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** page: the store's page look; block: the chosen colour scheme's look (null = none). */
export function BundlePreview({ config: c, bundle = SAMPLE_BUNDLE, currency = "USD", phone, page, block }: { config: BundleDesign; bundle?: PreviewBundle; currency?: string; phone?: boolean; page: PreviewTheme; block: PreviewTheme | null }) {
  const [picked, setPicked] = useState<Record<string, boolean>>({ "0-0": true });
  const money = (cents: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const look = block ?? page;
  const vars = {
    ...(c.look.themeAccent ? { "--ucro-accent": look.accent, "--ucro-on-text": look.accentText } : {}),
    ...(c.look.themeRadius ? { "--ucro-radius": `${look.radius}px` } : {}),
    ...(block ? { background: block.bg, color: block.text, paddingInline: 14, paddingBlock: 12, borderRadius: c.look.themeRadius ? look.radius : c.look.radius } : {}),
    ...bundleVars(c),
    ...(phone ? { "--ucro-cols-d": String(c.products.mobile) } : {}),
  } as CSSProperties;
  const steps = bundle.steps.map((s, si) => {
    const count = s.items.filter((_, i) => picked[`${si}-${i}`]).length;
    return { ...s, count, min: Math.max(0, s.min), max: Math.max(1, s.max, s.min) };
  });
  const remaining = steps.reduce((n, s) => n + Math.max(0, s.min - s.count), 0);
  const ready = remaining === 0;
  const chosen = steps.flatMap((s, si) => s.items.filter((_, i) => picked[`${si}-${i}`]));
  const value = chosen.reduce((n, it) => n + it.cents, 0);
  const saving = value - bundle.price;
  const toggle = (si: number, i: number) =>
    setPicked((p) => {
      const key = `${si}-${i}`;
      if (p[key]) return { ...p, [key]: false };
      if (steps[si].count >= steps[si].max) return p;
      return { ...p, [key]: true };
    });

  return (
    <div style={{ maxWidth: phone ? 390 : undefined, margin: "0 auto", padding: "4px 16px", fontSize: 15, lineHeight: 1.5 }}>
      <div className={`ucro ucro-bundle ${bundleClass(c)}`} style={vars}>
        {c.text.heading ? <h2 className={`ucro__heading ucro__heading--${c.text.size}`}>{c.text.heading}</h2> : null}
        {c.text.sub ? <p className="ucro__sub">{c.text.sub}</p> : null}
        {steps.map((s, si) => (
          <fieldset key={si} className="ucro-bundle__step">
            <legend className="ucro-bundle__legend">
              <span className="ucro-bundle__label">{s.label}</span>
              <span className="ucro-bundle__count">
                {s.count} / {s.max}
              </span>
            </legend>
            <ul className="ucro-bundle__grid">
              {s.items.map((it, i) => {
                const on = !!picked[`${si}-${i}`];
                return (
                  <li key={i} className={`ucro-bundle__card${on ? " is-picked" : ""}`}>
                    <span className="ucro-bundle__img" style={it.image ? undefined : { background: TINTS[(si * 3 + i) % TINTS.length] }}>
                      {it.image ? <img src={`${it.image}${it.image.includes("?") ? "&" : "?"}width=300`} alt={it.title} /> : null}
                    </span>
                    <span className="ucro-bundle__name">{it.title}</span>
                    <span className="ucro-bundle__price">{money(it.cents)}</span>
                    <span className="ucro-bundle__actions">
                      <button type="button" className="ucro-bundle__pick" aria-pressed={on} onClick={() => toggle(si, i)}>
                        {on ? c.products.picked : c.products.pick}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
        <div className={`ucro-bundle__summary${c.summary.sticky ? " is-sticky" : ""}`}>
          {c.summary.show ? (
            <>
              {chosen.length ? (
                <ul className="ucro-bundle__picks">
                  {chosen.map((it, i) => (
                    <li key={i}>{it.title}</li>
                  ))}
                </ul>
              ) : null}
              <p className="ucro-bundle__totals">
                <span data-value>{ready && saving > 0 ? fill(c.summary.value, { amount: money(value) }) : ""}</span>
                <strong>{money(bundle.price)}</strong>
              </p>
              {ready && saving > 0 ? <p className="ucro-bundle__save">{fill(c.summary.save, { amount: money(saving), percent: Math.round((saving / value) * 100) })}</p> : null}
            </>
          ) : null}
          {c.button.theme ? (
            <p style={{ margin: 0, padding: "10px 12px", textAlign: "center", border: "1px dashed #8a8a8a", borderRadius: 8, opacity: 0.8 }}>Your theme&rsquo;s Add to cart button adds the bundle once it&rsquo;s complete.</p>
          ) : (
            <button type="button" className="ucro-btn ucro-bundle__add" disabled={!ready} style={{ padding: "12px 16px", font: "inherit", fontWeight: 600, color: page.accentText, background: page.accent, border: "1px solid transparent", borderRadius: page.buttonRadius, opacity: ready ? 1 : 0.6 }}>
              {ready ? c.button.label : fill(c.button.remaining, { remaining })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
