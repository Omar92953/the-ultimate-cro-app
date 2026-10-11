/** Preview of the wishlist: product cards with hearts, the product-page button and the floating count. */
import { useState, type CSSProperties } from "react";
import { wishlistVars, type WishlistDesign } from "../lib/wishlist-design";

const ICON = {
  heart: "M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z",
  bookmark: "M6.5 3.5h11v17L12 16.5l-5.5 4z",
};
const CARDS = [
  { title: "Linen shirt", price: "EGP 650", bg: "#e5e5e5" },
  { title: "Classic tee", price: "EGP 450", bg: "#d8dee8" },
  { title: "Canvas tote", price: "EGP 300", bg: "#efe7da" },
];

export function WishlistPreview({ config: c }: { config: WishlistDesign }) {
  const [on, setOn] = useState<Record<string, boolean>>({ "Linen shirt": true });
  const count = Object.values(on).filter(Boolean).length;
  const svg = <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[c.look.icon]} /></svg>;
  const vars = wishlistVars(c) as CSSProperties;
  return (
    <div style={{ position: "relative", padding: 24, minHeight: 380 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {CARDS.map((p) => (
          <div key={p.title} style={{ display: "grid", gap: 6 }}>
            <div style={{ position: "relative", aspectRatio: "1", borderRadius: 10, background: p.bg }}>
              {c.where.cards ? (
                <button type="button" className={`ucs-wl-btn ucs-wl-btn--card${on[p.title] ? " is-on" : ""}`} style={vars} aria-pressed={!!on[p.title]} aria-label={on[p.title] ? c.text.saved : c.text.add} onClick={() => setOn((o) => ({ ...o, [p.title]: !o[p.title] }))}>
                  {svg}
                </button>
              ) : null}
            </div>
            <b>{p.title}</b>
            <span>{p.price}</span>
          </div>
        ))}
      </div>
      {c.where.product ? (
        <div className="ucs-wl-row" style={{ marginTop: 24 }}>
          <button type="button" className={`ucs-wl-btn ucs-wl-btn--text${on["Linen shirt"] ? " is-on" : ""}`} style={vars} onClick={() => setOn((o) => ({ ...o, "Linen shirt": !o["Linen shirt"] }))}>
            {svg}
            <span className="ucs-wl-label">{on["Linen shirt"] ? c.text.saved : c.text.add}</span>
          </button>
        </div>
      ) : null}
      {c.where.floating && count ? (
        <span className={`ucs-wl-float ucs-wl-float--${c.where.floatPos}`} style={{ ...vars, position: "absolute" }}>
          {svg}
          <b>{count}</b>
        </span>
      ) : null}
    </div>
  );
}
