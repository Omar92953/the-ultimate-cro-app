/**
 * Live preview of "Back in stock & pre-order": a product page's buy area, sold out (with the
 * "Notify me" box) or out of stock but sellable (Pre-order button and note). Same markup as ucs-stock.js.
 */
import type { CSSProperties } from "react";
import { stockClass, stockVars, type StockDesign } from "../lib/stock-design";

export function StockPreview({ config: c, mode }: { config: StockDesign; mode: "soldout" | "preorder" }) {
  const n = c.notify;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: 24, alignItems: "start" }}>
      <div style={{ aspectRatio: "1", borderRadius: 10, background: "linear-gradient(145deg,#ececec,#d3d3d3)" }} />
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Linen shirt</div>
        <div style={{ fontSize: 16 }}>EGP 650.00</div>
        <button type="button" disabled={mode === "soldout"} style={{ minHeight: 46, border: 0, borderRadius: 999, background: mode === "soldout" ? "#e5e5e5" : "#121212", color: mode === "soldout" ? "#777" : "#fff", font: "inherit", fontWeight: 600 }}>
          {mode === "soldout" ? "Sold out" : c.preorder.on ? c.preorder.button : "Add to cart"}
        </button>
        <div className={stockClass(c)} style={stockVars(c) as CSSProperties}>
          {mode === "preorder" ? (
            c.preorder.on && c.preorder.note ? <p className="ucs-st__note">{c.preorder.note}</p> : null
          ) : n.on ? (
            <form className="ucs-st__form" onSubmit={(e) => e.preventDefault()}>
              {n.heading ? <p className="ucs-st__h">{n.heading}</p> : null}
              {n.text ? <p className="ucs-st__t">{n.text}</p> : null}
              <div className="ucs-st__field">
                <input type="email" placeholder={n.placeholder} aria-label={n.placeholder} />
                <button type="submit" className="ucs-btn">
                  {n.button}
                </button>
              </div>
              {n.privacy ? <p className="ucs-st__small">{n.privacy}</p> : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
