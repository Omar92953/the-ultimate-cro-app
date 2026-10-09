/**
 * Live preview of the Upsell offers block: the same markup and stylesheet (ucro.css) as
 * ucro-upsell.liquid, with one of the merchant's rules (or a sample) and example prices.
 * Click an offer to select it, like on the store.
 */
import { useState, type CSSProperties } from "react";
import { upsellHeadingClass, upsellVars, type UpsellDesign } from "../lib/upsell-design";
import type { PreviewTheme } from "../lib/theme-style";

export type PreviewOffer = {
  headline: string;
  subheadline: string;
  variant: boolean; // tiers are option values (e.g. sizes)
  optionName?: string;
  tiers: { qty: number; pct: number; label?: string; badge?: string; value?: string }[];
};

export const SAMPLE_OFFER: PreviewOffer = {
  headline: "Buy more, save more",
  subheadline: "",
  variant: false,
  tiers: [
    { qty: 1, pct: 0 },
    { qty: 2, pct: 10, badge: "Most popular" },
    { qty: 3, pct: 15 },
  ],
};

/** The product the offer shows on (a real one from the store when there is one). */
export type PreviewProductLite = { title: string; image: string | null; cents: number; variants: { cents: number; options: Record<string, string> }[] };
const SAMPLE_PRODUCT: PreviewProductLite = { title: "Everyday tee", image: null, cents: 4000, variants: [] };

/** page: the store's page look; block: the chosen colour scheme's look (null = none). */
export function UpsellDesignPreview({ config: c, offer = SAMPLE_OFFER, product, currency = "USD", page, block }: { config: UpsellDesign; offer?: PreviewOffer; product?: PreviewProductLite | null; currency?: string; page: PreviewTheme; block: PreviewTheme | null }) {
  const [picked, setPicked] = useState(1);
  const p = product ?? SAMPLE_PRODUCT;
  const UNIT = p.cents / 100;
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };
  const optionPrice = (value: string | undefined, i: number) => {
    const name = (offer.optionName || "").toLowerCase();
    const v = p.variants.find((x) => value && (x.options[name] || "").toLowerCase() === value.toLowerCase());
    return v ? v.cents / 100 : UNIT + (product ? 0 : 10 * i);
  };
  const list = c.offers.style === "list";
  const look = block ?? page;
  const vars = {
    ...(c.look.themeRadius ? { "--ucro-radius": `${look.radius}px` } : {}),
    ...(c.look.themeColors ? { "--ucro-accent": look.accent, "--ucro-on-text": look.accentText } : {}),
    ...(block ? { background: block.bg, color: block.text, paddingInline: 14, borderRadius: c.look.themeRadius ? look.radius : c.look.radius } : {}),
    ...upsellVars(c),
  } as CSSProperties;
  const selected = Math.min(picked, offer.tiers.length - 1);
  const rows = offer.tiers.map((t, i) => {
    const qty = offer.variant ? 1 : Math.max(1, t.qty || 1);
    const was = (offer.variant ? optionPrice(t.value, i) : UNIT) * qty;
    const total = was * (1 - (t.pct || 0) / 100);
    const label = t.label || (offer.variant ? t.value || `Option ${i + 1}` : c.offers.label.replace(/\[quantity\]/g, String(qty)));
    const save = t.pct > 0 && c.offers.showSaving ? c.offers.saving.replace(/\[percent\]/g, String(t.pct)) : "";
    return { qty, was, total, label, save, badge: t.badge || "", pct: t.pct || 0 };
  });
  const sel = rows[selected];

  return (
    <div style={{ padding: "12px 20px", fontSize: 15, lineHeight: 1.5 }}>
      <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 14, alignItems: "center", margin: "0 0 6px" }}>
        <span style={{ width: 88, height: 88, borderRadius: page.radius, overflow: "hidden", background: "linear-gradient(145deg,#e8e8e8,#cfcfcf)" }}>
          {p.image ? <img src={`${p.image}${p.image.includes("?") ? "&" : "?"}width=200`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
        </span>
        <span>
          <strong style={{ display: "block", fontSize: 20, fontFamily: page.headingFont, fontWeight: page.headingWeight, lineHeight: 1.25 }}>{p.title}</strong>
          <span style={{ opacity: 0.75 }}>{money(UNIT)}</span>
        </span>
      </div>
      <div
        className={`ucro ucro-upsell${list ? " ucro-upsell--list" : ""}`}
        style={vars}
      >
        {offer.headline ? <h2 className={`ucro__heading ${upsellHeadingClass(c)}`}>{offer.headline}</h2> : null}
        {offer.subheadline ? <p className="ucro__sub">{offer.subheadline}</p> : null}
        <div className="ucro-tiers" role="radiogroup" aria-label={offer.headline || "Offers"}>
          {rows.map((r, i) => (
            <div key={i} className="ucro-tier-wrap">
              <button type="button" className={`ucro-tier${i === selected ? " is-selected" : ""}`} role="radio" aria-checked={i === selected} onClick={() => setPicked(i)}>
                <span className="ucro-tier__radio" aria-hidden="true" />
                {list ? (
                  <>
                    <span className="ucro-tier__main">
                      <span className="ucro-tier__line">
                        <span className="ucro-tier__label">{r.label}</span>
                        {r.badge ? <span className="ucro-tier__badge">{r.badge}</span> : null}
                      </span>
                      {r.save ? <span className="ucro-tier__save-text">{r.save}</span> : null}
                    </span>
                    <span className="ucro-tier__price ucro-tier__price--stack">
                      {r.pct ? <s className="ucro-was">{money(r.was)}</s> : null}
                      <strong className="ucro-tier__total">{money(r.total)}</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="ucro-tier__label">{r.label}</span>
                    <span className="ucro-tier__price">
                      {r.pct ? <s className="ucro-was">{money(r.was)}</s> : null}
                      <strong className="ucro-tier__total">{money(r.total)}</strong>
                    </span>
                  </>
                )}
              </button>
              {!list && (r.save || r.badge) ? (
                <span className="ucro-tier__tags">
                  {r.save ? <span className="ucro-tier__save">{r.save}</span> : null}
                  {r.badge ? <span className="ucro-tier__badge">{r.badge}</span> : null}
                </span>
              ) : null}
              {c.offers.perItem && !offer.variant && i === selected && r.qty > 1 ? (
                <div className="ucro-tier__items">
                  {Array.from({ length: r.qty }, (_, n) => (
                    <label key={n} className="ucro-item">
                      <span className="ucro-item__n">{c.offers.itemLabel.replace(/\[n\]/g, String(n + 1))}</span>
                      <select className="ucro-select ucro-item__select" defaultValue="M" aria-label={`Size for item ${n + 1}`}>
                        <option>S</option>
                        <option>M</option>
                        <option>L</option>
                      </select>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {c.offers.ownButton ? (
          <button type="button" className="ucro-btn ucro-upsell__add" style={{ width: "100%", padding: "12px 16px", font: "inherit", fontWeight: 600, color: page.accentText, background: page.accent, border: 0, borderRadius: page.buttonRadius, cursor: "pointer" }}>
            {c.offers.button}
          </button>
        ) : null}
      </div>
      <div style={{ padding: "12px 16px", margin: "8px 0", textAlign: "center", fontWeight: 600, color: page.accentText, background: page.accent, borderRadius: page.buttonRadius, opacity: c.offers.ownButton ? 0.35 : 1 }}>
        {c.offers.ownButton ? "Your theme's Add to cart" : `Add to cart · ${sel ? money(sel.total) : ""}`}
      </div>
    </div>
  );
}
