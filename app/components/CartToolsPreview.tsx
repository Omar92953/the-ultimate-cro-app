/** Preview of the app's cart drawer: same markup and styles as ucs-cart.js, with two sample items. */
import type { CSSProperties } from "react";
import { cartToolsVars, type CartToolsDesign } from "../lib/cart-tools-design";

const ITEMS = [
  { title: "Linen shirt", opts: "Medium / Sand", qty: 1, price: "EGP 650.00" },
  { title: "Classic tee", opts: "Large", qty: 2, price: "EGP 900.00" },
];

export function CartToolsPreview({ config: c }: { config: CartToolsDesign }) {
  const d = c.drawer;
  return (
    <div style={{ position: "relative", height: 620, overflow: "hidden", background: "#f1f1f1" }}>
      <div className={`ucs-cd ucs-cd--${d.side} is-open`} style={{ ...(cartToolsVars(c) as CSSProperties), position: "absolute" }}>
        <div className="ucs-cd__overlay" />
        <aside className="ucs-cd__panel" style={{ width: Math.min(d.width, 440) }}>
          <header className="ucs-cd__head">
            <h2 className="ucs-cd__title">{d.title}</h2>
            <button type="button" className="ucs-cd__x" aria-label="Close">
              ×
            </button>
          </header>
          <div className="ucs-cd__body">
            <ul className="ucs-cd__items">
              {ITEMS.map((i) => (
                <li key={i.title} className="ucs-cd__item">
                  <span className="ucs-cd__ph" />
                  <div className="ucs-cd__info">
                    <a href="#preview" onClick={(e) => e.preventDefault()}>
                      {i.title}
                    </a>
                    <small>{i.opts}</small>
                    <span className="ucs-cd__qty">
                      <button type="button">−</button>
                      <span>{i.qty}</span>
                      <button type="button">+</button>
                      <button type="button" className="ucs-cd__rm">
                        Remove
                      </button>
                    </span>
                  </div>
                  <span className="ucs-cd__price">{i.price}</span>
                </li>
              ))}
            </ul>
          </div>
          <footer className="ucs-cd__foot">
            {c.discount.on && c.discount.codes ? <p className="ucs-cd__note">{c.discount.applied.replace("{code}", c.discount.codes.split(/,\s*/)[0])}</p> : null}
            <p className="ucs-cd__sub">
              <span>{d.subtotal}</span>
              <b>EGP 1,550.00</b>
            </p>
            <p className="ucs-cd__tax">{d.taxes}</p>
            <span className="ucs-btn ucs-cd__go">{d.checkout}</span>
            {c.express.on ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <span style={{ padding: "10px 0", borderRadius: 6, background: "#5a31f4", color: "#fff", textAlign: "center", fontWeight: 700 }}>Shop Pay</span>
                <span style={{ padding: "10px 0", borderRadius: 6, background: "#000", color: "#fff", textAlign: "center", fontWeight: 700 }}> Pay</span>
              </div>
            ) : null}
            {c.share.on ? (
              <button type="button" className="ucs-cd__share">
                {c.share.button}
              </button>
            ) : null}
          </footer>
        </aside>
      </div>
    </div>
  );
}
