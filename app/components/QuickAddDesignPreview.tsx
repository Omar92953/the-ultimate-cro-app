/**
 * Live preview of Quick add: product cards with the button (same classes and stylesheet,
 * ucs-quick-add.css, as ucs-quick-add.js) and the "Added to your cart" popup. Clicking a card's
 * button shows the popup for that product, like on the store.
 */
import { useState, type CSSProperties } from "react";
import type { QuickAddDesign } from "../lib/quick-add-design";

export type QuickAddProduct = { title: string; image: string | null; price: string };

const S = (w: number, d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  bag: S(1.5, "M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"),
  plus: S(2.2, "M12 5v14M5 12h14"),
  cart: S(1.8, "M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2l1.7-7.3H6.2"),
};
const TINTS = ["linear-gradient(145deg,#ffd6a5,#f4a261)", "linear-gradient(145deg,#bde0fe,#6c9bd2)", "linear-gradient(145deg,#cdb4db,#9b72b0)"];
export const SAMPLE_QA: QuickAddProduct[] = [
  { title: "Canvas tote", image: null, price: "$34.00" },
  { title: "Travel mug", image: null, price: "$22.00" },
  { title: "Linen cap", image: null, price: "$26.00" },
];

export function QuickAddDesignPreview({ config: c, products }: { config: QuickAddDesign; products: QuickAddProduct[] }) {
  const list = products.length ? products : SAMPLE_QA;
  const [added, setAdded] = useState<number | null>(0);
  const p = c.popup;
  const popVars = {
    "--ucs-vc-bg": p.vcBg,
    "--ucs-vc-text": p.vcText,
    "--ucs-vc-border": p.vcBorder,
    "--ucs-co-bg": p.coBg,
    "--ucs-co-text": p.coText,
    "--ucs-co-border": p.coBorder,
    "--ucs-btn-bw": `${p.border}px`,
    "--ucs-btn-radius": `${p.radius}px`,
    position: "relative",
    right: "auto",
    bottom: "auto",
    width: "min(340px, 100%)",
    margin: "34px auto 8px",
  } as CSSProperties;
  const item = added === null ? null : list[added];
  return (
    <div style={{ padding: 16, fontSize: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {list.slice(0, 3).map((it, i) => (
          <div key={i} className={c.button.show === "hover" ? "ucs-qa-host--hover" : undefined} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", background: it.image ? "#eee" : TINTS[i % 3] }}>
              {it.image ? <img src={`${it.image}${it.image.includes("?") ? "&" : "?"}width=300`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
              <button
                type="button"
                className={`ucs-qa ucs-qa--${c.button.position}${c.button.addedState && added === i ? " is-added" : ""}`}
                aria-label={`Add ${it.title} to cart`}
                onClick={() => setAdded(i)}
                style={{ width: c.button.size, height: c.button.size, "--ucs-qa-bg": c.button.bg, "--ucs-qa-fg": c.button.fg, "--ucs-qa-radius": c.button.shape === "square" ? "8px" : "50%", opacity: 1 } as CSSProperties}
              >
                <span className="ucs-qa__icon">{ICONS[c.button.icon]}</span>
                <span className="ucs-qa__done">{S(2.4, "M5 12.5l4.5 4.5L19 7.5")}</span>
              </button>
            </div>
            <span style={{ fontWeight: 600 }}>{it.title}</span>
            <span style={{ opacity: 0.75 }}>{it.price}</span>
          </div>
        ))}
      </div>
      {c.after.mode === "toast" && item ? (
        <div className="ucs-toast is-open" style={popVars} role="status">
          <button type="button" className="ucs-toast__close" aria-label="Close" onClick={() => setAdded(null)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="ucs-toast__head">
            <span className="ucs-toast__tick">{S(2.4, "M5 12.5l4.5 4.5L19 7.5")}</span>
            {c.after.added}
          </div>
          <div className="ucs-toast__item">
            {item.image ? <img src={`${item.image}${item.image.includes("?") ? "&" : "?"}width=160`} alt="" /> : <span style={{ width: 70, height: 70, borderRadius: 6, background: TINTS[(added ?? 0) % 3], flex: "none" }} />}
            <div>
              <p className="ucs-toast__name">{item.title}</p>
              <p className="ucs-toast__price">{item.price}</p>
            </div>
          </div>
          <div className={`ucs-toast__actions${c.after.checkout ? "" : " is-one"}`}>
            <a className="ucs-toast__vc" href="#preview" onClick={(e) => e.preventDefault()}>
              {c.after.viewCart}
            </a>
            {c.after.checkout ? (
              <a className="ucs-toast__co" href="#preview" onClick={(e) => e.preventDefault()}>
                {c.after.checkoutText}
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p style={{ margin: "16px 0 0", textAlign: "center", color: "#616161" }}>{c.after.mode === "theme" ? "After adding, your theme's cart drawer opens." : c.after.mode === "cart" ? "After adding, shoppers go to the cart page." : "Click a button to see the popup."}</p>
      )}
    </div>
  );
}
