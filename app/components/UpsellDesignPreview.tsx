/**
 * Live preview of the Upsell offers block: the same markup and stylesheet (ucro.css) as
 * ucro-upsell.liquid, with one of the merchant's rules (or a sample) and example prices.
 * Click an offer to select it, like on the store.
 */
import { useState, type CSSProperties } from "react";
import { upsellHeadingClass, upsellVars, type UpsellDesign } from "../lib/upsell-design";

export type PreviewOffer = {
  headline: string;
  subheadline: string;
  variant: boolean; // tiers are option values (e.g. sizes)
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

const UNIT = 40;
const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

export function UpsellDesignPreview({ config: c, offer = SAMPLE_OFFER }: { config: UpsellDesign; offer?: PreviewOffer }) {
  const [picked, setPicked] = useState(1);
  const list = c.offers.style === "list";
  const vars = { ...upsellVars(c), ...(c.look.themeRadius ? { "--ucro-radius": "10px" } : {}), ...(c.look.themeColors ? { "--ucro-accent": "#111111" } : {}) } as CSSProperties;
  const selected = Math.min(picked, offer.tiers.length - 1);
  const rows = offer.tiers.map((t, i) => {
    const qty = offer.variant ? 1 : Math.max(1, t.qty || 1);
    const was = (offer.variant ? UNIT + 10 * i : UNIT) * qty;
    const total = was * (1 - (t.pct || 0) / 100);
    const label = t.label || (offer.variant ? t.value || `Option ${i + 1}` : c.offers.label.replace(/\[quantity\]/g, String(qty)));
    const save = t.pct > 0 && c.offers.showSaving ? c.offers.saving.replace(/\[percent\]/g, String(t.pct)) : "";
    return { qty, was, total, label, save, badge: t.badge || "", pct: t.pct || 0 };
  });
  const sel = rows[selected];

  return (
    <div style={{ padding: "8px 20px", color: "#121212", background: "#fff", fontSize: 15, lineHeight: 1.5 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", margin: "4px 0 2px" }}>
        <strong style={{ fontSize: 20 }}>Everyday tee</strong>
        <span style={{ opacity: 0.7 }}>{money(UNIT)}</span>
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
          <button type="button" className="ucro-btn ucro-upsell__add" style={{ width: "100%", padding: "12px 16px", font: "inherit", fontWeight: 600, color: "#fff", background: "#111", border: 0, borderRadius: c.look.themeRadius ? 10 : c.look.radius, cursor: "pointer" }}>
            {c.offers.button}
          </button>
        ) : null}
      </div>
      <div style={{ padding: "12px 16px", marginBottom: 8, textAlign: "center", fontWeight: 600, border: "1px solid #121212", borderRadius: 8, opacity: c.offers.ownButton ? 0.35 : 1 }}>
        {c.offers.ownButton ? "Your theme's Add to cart" : `Add to cart · ${sel ? money(sel.total) : ""}`}
      </div>
    </div>
  );
}
