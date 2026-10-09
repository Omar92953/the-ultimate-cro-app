/** Live preview of the free shipping bar: same markup and stylesheet as ucs-shipping-bar.js. */
import type { CSSProperties } from "react";
import { shippingBarClass, shippingBarVars, shippingMessage, type ShippingBarConfig } from "../lib/shipping-bar";

const ICON = {
  truck: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7z" />
      <circle cx="6.5" cy="17.5" r="1.7" />
      <circle cx="17" cy="17.5" r="1.7" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 9h17v3.5h-17zM5 12.5h14V20H5zM12 9v11M12 9c-1.5-3.5-5.5-3.5-5.5-1S10 9 12 9c1.5-3.5 5.5-3.5 5.5-1S14 9 12 9" />
    </svg>
  ),
};

/** `where`: the top bar (default) or a copy inside the cart drawer / cart page. */
export function ShippingBarPreview({ config: c, total, currency = "USD", where }: { config: ShippingBarConfig; total: number; currency?: string; where?: "drawer" | "page" }) {
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };
  if (total <= 0 && !c.show.whenEmpty) return <p style={{ padding: 16, textAlign: "center", color: "#616161" }}>Hidden while the cart is empty.</p>;
  return (
    <div className={`${shippingBarClass(c)}${where ? ` ucs-fsb--${where}${c.show.cartPos === "bottom" ? " ucs-fsb--bottom" : ""}` : ""}${total >= c.goal ? " is-done" : ""}`} style={shippingBarVars(c) as CSSProperties} role="status">
      <div className="ucs-fsb__in">
        {c.show.icon !== "none" ? <span className="ucs-fsb__icon">{ICON[c.show.icon]}</span> : null}
        <span className="ucs-fsb__msg">{shippingMessage(c, total, c.goal, fmt)}</span>
      </div>
      {c.show.bar ? (
        <div className="ucs-fsb__track">
          <i className="ucs-fsb__fill" style={{ width: `${Math.min(100, (total / c.goal) * 100)}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** The bar inside a cart drawer, with the shopper's items and the checkout button. */
export function ShippingBarCartPreview({ config: c, total, currency = "USD" }: { config: ShippingBarConfig; total: number; currency?: string }) {
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };
  const bar = <ShippingBarPreview config={c} total={total} currency={currency} where="drawer" />;
  const items = total > 0 ? [{ name: "Classic watch", tint: "linear-gradient(145deg,#e6e6e6,#bdbdbd)", share: 0.65 }, { name: "Sunglasses", tint: "linear-gradient(145deg,#ffd6a5,#f4a261)", share: 0.35 }] : [];
  return (
    <div style={{ display: "flex", minHeight: 420, background: "#d9d9dc", fontSize: 14, color: "#121212" }}>
      <div style={{ flex: 1, minWidth: 40, opacity: 0.5, background: "repeating-linear-gradient(180deg,#ececec 0 10px,transparent 10px 26px)", backgroundClip: "content-box", padding: 24 }} aria-hidden="true" />
      <div style={{ display: "flex", flexDirection: "column", width: "min(360px, 78%)", background: "#fff", boxShadow: "-6px 0 24px rgba(0,0,0,.14)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 14px" }}>
          <strong style={{ fontSize: 18 }}>Your cart</strong>
          <span aria-hidden="true" style={{ fontSize: 18, opacity: 0.6 }}>×</span>
        </div>
        {c.show.drawer && c.show.cartPos === "top" ? bar : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 20px", flex: 1 }}>
          {items.length ? (
            items.map((it) => (
              <div key={it.name} style={{ display: "grid", gridTemplateColumns: "52px 1fr auto", gap: 12, alignItems: "center" }}>
                <span style={{ width: 52, height: 52, borderRadius: 8, background: it.tint }} />
                <span>
                  <span style={{ display: "block", fontWeight: 600 }}>{it.name}</span>
                  <span style={{ opacity: 0.6, fontSize: 13 }}>Qty 1</span>
                </span>
                <span>{fmt(Math.round(total * it.share * 100) / 100)}</span>
              </div>
            ))
          ) : (
            <p style={{ margin: "24px 0", textAlign: "center", opacity: 0.6 }}>Your cart is empty</p>
          )}
        </div>
        <div style={{ padding: "14px 20px 20px", borderTop: "1px solid #ececec" }}>
          {c.show.drawer && c.show.cartPos === "bottom" ? bar : null}
          <div style={{ display: "flex", justifyContent: "space-between", margin: "0 0 12px" }}>
            <span>Subtotal</span>
            <strong>{fmt(total)}</strong>
          </div>
          <div style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "#fff", background: "#121212", borderRadius: 8 }}>Check out</div>
        </div>
      </div>
    </div>
  );
}
