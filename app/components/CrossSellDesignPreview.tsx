/**
 * Live preview of the Cross-sell offers block: the same markup and stylesheet (ucro.css) as
 * ucro-cross-sell.liquid / ucro-offer-row.liquid, with one of the merchant's rules (real products
 * and prices) or a sample. Ticking works like on the store; nothing starts ticked.
 */
import { useState, type CSSProperties } from "react";
import { crossSellClass, crossSellVars, drawerVars, type CrossSellDesign } from "../lib/cross-sell-design";
import type { PreviewTheme } from "../lib/theme-style";

export type CrossSellItem = { title: string; image: string | null; cents: number };
export type CrossSellOffer = { headline: string; subheadline: string; button: string; pct: number; items: CrossSellItem[] };

const TINTS = ["linear-gradient(145deg,#ffd6a5,#f4a261)", "linear-gradient(145deg,#bde0fe,#6c9bd2)", "linear-gradient(145deg,#cdb4db,#9b72b0)"];
export const SAMPLE_CROSS_SELL: CrossSellOffer = {
  headline: "Pairs well with",
  subheadline: "",
  button: "",
  pct: 10,
  items: [
    { title: "Canvas tote", image: null, cents: 3800 },
    { title: "Travel mug", image: null, cents: 2500 },
    { title: "Linen cap", image: null, cents: 2900 },
  ],
};

export function CrossSellDesignPreview({ config: c, offer = SAMPLE_CROSS_SELL, currency = "USD", page, block }: { config: CrossSellDesign; offer?: CrossSellOffer; currency?: string; page: PreviewTheme; block: PreviewTheme | null }) {
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const money = (cents: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const look = block ?? page;
  const vars = {
    ...(c.look.themeColors ? { "--ucro-accent": look.accent, "--ucro-on-text": look.accentText } : {}),
    ...(c.look.themeRadius ? { "--ucro-radius": `${look.radius}px` } : {}),
    ...(block && c.look.themeColors ? { "--ucro-panel": block.bg, color: block.text } : {}),
    "--ucro-bg": "#fff",
    ...crossSellVars(c),
  } as CSSProperties;
  const count = Object.values(ticked).filter(Boolean).length;
  const label = offer.button || c.products.button;
  return (
    <div style={{ padding: "12px 20px", fontSize: 15, lineHeight: 1.5 }}>
      <div className={`ucro ucro-cross ${crossSellClass(c)}`} style={vars}>
        {offer.headline ? <h2 className={`ucro__heading ucro__heading--${c.heading.size}`}>{offer.headline}</h2> : null}
        {offer.subheadline ? <p className="ucro__sub">{offer.subheadline}</p> : null}
        <ul className="ucro-cross__list">
          {offer.items.map((it, i) => {
            const now = Math.round(it.cents * (1 - offer.pct / 100));
            return (
              <li key={i} className="ucro-offer">
                <label className="ucro-offer__row">
                  <input type="checkbox" className="ucro-offer__check" checked={!!ticked[i]} onChange={(e) => setTicked((t) => ({ ...t, [i]: e.target.checked }))} />
                  <span className="ucro-offer__box" aria-hidden="true" />
                  <span className="ucro-offer__img" style={it.image ? undefined : { background: TINTS[i % TINTS.length] }}>
                    {it.image ? <img src={`${it.image}${it.image.includes("?") ? "&" : "?"}width=200`} alt="" /> : null}
                  </span>
                  <span className="ucro-offer__body">
                    <span className="ucro-offer__title">{it.title}</span>
                    <span className="ucro-offer__prices">
                      <span className="ucro-offer__price">{money(now)}</span>
                      {offer.pct > 0 ? <s className="ucro-was">{money(it.cents)}</s> : null}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <button type="button" className="ucro-btn ucro-cross__add" disabled={!count} style={{ marginTop: 12, padding: "12px 16px", font: "inherit", fontWeight: 600, color: page.accentText, background: page.accent, border: 0, borderRadius: page.buttonRadius, opacity: count ? 1 : 0.6 }}>
          {label}
          {count ? ` (${count})` : ""}
        </button>
      </div>
    </div>
  );
}

/** The same offer as it shows in the theme's slide-out cart ("Cart drawer offers", ucro-drawer.js markup). */
export function CrossSellDrawerPreview({ config: c, offer = SAMPLE_CROSS_SELL, currency = "USD", page }: { config: CrossSellDesign; offer?: CrossSellOffer; currency?: string; page: PreviewTheme }) {
  const money = (cents: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const own = drawerVars(c);
  const accent = own["--ucro-accent"] ?? page.accent;
  const vars = { "--ucro-soft": "rgba(127,127,127,0.08)", "--ucro-radius": `${page.radius}px`, ...own } as CSSProperties;
  return (
    <div style={{ padding: "4px 20px 16px", fontSize: 14, lineHeight: 1.5 }}>
      <div style={{ maxWidth: 380, marginLeft: "auto", padding: "14px 16px", border: "1px solid rgba(127,127,127,0.25)", borderRadius: 10, background: "#fff" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Your cart</p>
        <div className="ucro ucro-drawer" style={vars}>
          <p className="ucro-drawer__heading">{offer.headline || c.drawer.heading}</p>
          <ul className="ucro-drawer__list">
            {offer.items.slice(0, c.drawer.max).map((it, i) => (
              <li key={i} className="ucro-drawer__item">
                {it.image ? <img src={`${it.image}${it.image.includes("?") ? "&" : "?"}width=160`} alt="" width={56} height={56} /> : <span style={{ width: 56, height: 56, borderRadius: 6, background: TINTS[i % TINTS.length] }} />}
                <span className="ucro-drawer__body">
                  <a className="ucro-drawer__title" href="#preview" onClick={(e) => e.preventDefault()}>
                    {it.title}
                  </a>
                  <span className="ucro-drawer__prices">
                    <span>{money(Math.round(it.cents * (1 - offer.pct / 100)))}</span>
                    {offer.pct > 0 ? <s className="ucro-was">{money(it.cents)}</s> : null}
                  </span>
                </span>
                <button type="button" className="ucro-btn ucro-drawer__add" style={{ font: "inherit", fontWeight: 600, color: own["--ucro-accent"] ? "#fff" : page.accentText, background: accent, border: 0, borderRadius: page.buttonRadius }}>
                  {c.drawer.add}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
