/**
 * Preview of the Track order / Returns page: the lookup form, or the result for a sample order
 * (status and tracking, or items to choose). Same markup and stylesheet as ucs-orders.js.
 */
import type { CSSProperties } from "react";
import { orderPageClass, orderPageVars, type OrderPageDesign } from "../lib/order-pages";

const ITEMS = [
  { title: "Linen shirt", variant: "Medium / Sand", quantity: 1 },
  { title: "Classic tee", variant: "Large", quantity: 2 },
];

export function OrderPagePreview({ config: c, step }: { config: OrderPageDesign; step: "form" | "result" }) {
  const t = c.text;
  const thumb = <span className="ucs-op__ph" />;
  return (
    <div className={orderPageClass(c)} style={orderPageVars(c) as CSSProperties}>
      <div className="ucs-wrap ucs-op__wrap">
        <div className="ucs-op__card">
          {step === "form" ? (
            <>
              <h2 className="ucs-op__h">{t.heading}</h2>
              {t.sub ? <p className="ucs-op__t">{t.sub}</p> : null}
              <form className="ucs-op__form" onSubmit={(e) => e.preventDefault()}>
                <label className="ucs-op__field">
                  <span>{t.order}</span>
                  <input />
                </label>
                <label className="ucs-op__field">
                  <span>{t.email}</span>
                  <input type="email" />
                </label>
                <button type="submit" className="ucs-btn">
                  {t.button}
                </button>
              </form>
            </>
          ) : c.kind === "track" ? (
            <>
              <h2 className="ucs-op__h">#1001</h2>
              <p className="ucs-op__t">{t.placed} Oct 3, 2026</p>
              <p className="ucs-op__pills">
                <span className="ucs-op__pill">Shipped</span>
                <span className="ucs-op__pill ucs-op__pill--soft">Paid</span>
              </p>
              <div className="ucs-op__ship">
                <span className="ucs-op__pill">In transit</span>
                <p className="ucs-op__t">
                  {t.shipped}: <b>EG123456789</b> · Aramex
                </p>
                <p className="ucs-op__t">{t.estimated}: Oct 8, 2026</p>
                <a className="ucs-btn ucs-btn--outline" href="#preview" onClick={(e) => e.preventDefault()}>
                  {t.trackLink}
                </a>
              </div>
              <ul className="ucs-op__items">
                {ITEMS.map((i) => (
                  <li key={i.title} className="ucs-op__item">
                    {thumb}
                    <span className="ucs-op__it">
                      <b>{i.title}</b>
                      <small>{i.variant}</small>
                    </span>
                    <span className="ucs-op__q">× {i.quantity}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="ucs-btn ucs-btn--outline">
                {t.again}
              </button>
            </>
          ) : (
            <>
              <h2 className="ucs-op__h">#1001</h2>
              <p className="ucs-op__t">
                <b>{t.pick}</b>
              </p>
              <form className="ucs-op__form" onSubmit={(e) => e.preventDefault()}>
                <ul className="ucs-op__items">
                  {ITEMS.map((i, n) => (
                    <li key={i.title} className="ucs-op__item">
                      <input type="checkbox" defaultChecked={n === 0} aria-label={i.title} />
                      {thumb}
                      <span className="ucs-op__it">
                        <b>{i.title}</b>
                        <small>{i.variant}</small>
                      </span>
                      {i.quantity > 1 ? (
                        <select aria-label="Quantity">
                          <option>1</option>
                          <option>2</option>
                        </select>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <label className="ucs-op__field">
                  <span>{t.reason}</span>
                  <select>
                    {(t.reasons || "").split("\n").filter(Boolean).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="ucs-op__field">
                  <span>{t.note}</span>
                  <textarea rows={2} />
                </label>
                <button type="submit" className="ucs-btn">
                  {t.send}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
