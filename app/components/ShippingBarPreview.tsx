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

export function ShippingBarPreview({ config: c, total, currency = "USD" }: { config: ShippingBarConfig; total: number; currency?: string }) {
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };
  if (total <= 0 && !c.show.whenEmpty) return <p style={{ padding: 16, textAlign: "center", color: "#616161" }}>Hidden while the cart is empty.</p>;
  return (
    <div className={`${shippingBarClass(c)}${total >= c.goal ? " is-done" : ""}`} style={shippingBarVars(c) as CSSProperties} role="status">
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
