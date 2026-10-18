/**
 * Preview of the Track order / Returns page: the lookup form, or the result for a sample order
 * (status and tracking, or items to choose). Same markup and stylesheet as ucs-orders.js.
 */
import type { CSSProperties } from "react";
import { orderPageClass, orderPageVars, type OrderPageDesign } from "../lib/order-pages";

const SAMPLE_RECS = [
  { title: "Linen shorts", price: "$39.00" },
  { title: "Canvas cap", price: "$22.00" },
  { title: "Wool socks", price: "$14.00" },
  { title: "Tote bag", price: "$18.00" },
];

const ITEMS = [
  { title: "Linen shirt", variant: "Medium / Sand", quantity: 1, unit: 70 },
  { title: "Classic tee", variant: "Large", quantity: 2, unit: 30 },
];

export function OrderPagePreview({ config: c, step, showNext = false, showBuyAgain = false, showAfter = false, showLate = false }: { config: OrderPageDesign; step: "form" | "result"; /** The next order discount is on in what the page sells. */ showNext?: boolean; showBuyAgain?: boolean; showAfter?: boolean; showLate?: boolean }) {
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
                    <span className="ucs-op__q">× {i.quantity}{c.prices ? ` · $${(i.quantity * i.unit).toFixed(2)}` : ""}</span>
                  </li>
                ))}
              </ul>
              {c.prices ? (
                <div className="ucs-op__prices">
                  <div className="ucs-op__pr"><span>{t.priceSubtotal}</span><span>$130.00</span></div>
                  <div className="ucs-op__pr"><span>{t.priceShipping}</span><span>{t.priceFree}</span></div>
                  <div className="ucs-op__pr"><span>{t.priceDiscount}</span><span>−$13.00</span></div>
                  <div className="ucs-op__pr ucs-op__pr--total"><span>{t.priceTotal}</span><span>$117.00</span></div>
                </div>
              ) : null}
              {showNext ? (
              <div className="ucs-op__next">
                <p className="ucs-op__t"><b>{t.nextTitle.replace("{percent}", "10%")}</b></p>
                <p className="ucs-op__t"><code className="ucs-op__code">NEXT-3FA9C2D1</code> <button type="button" className="ucs-btn ucs-btn--outline">{t.nextCopy}</button></p>
                <p className="ucs-op__t"><small>{t.nextUntil.replace("{date}", "Nov 18, 2026")}</small></p>
              </div>
              ) : null}
              {showLate ? (
                <div className="ucs-op__after ucs-op__late">
                  <p className="ucs-op__t"><b>{t.delayText}</b></p>
                </div>
              ) : null}
              {showAfter ? (
                <div className="ucs-op__after">
                  <p className="ucs-op__t"><b>{t.afterTitle}</b></p>
                  <p className="ucs-op__t">{t.afterSub}</p>
                  <p className="ucs-op__links"><span className="ucs-btn">{t.reviewButton}</span></p>
                  <p className="ucs-op__t"><u>{t.returnLink}</u></p>
                </div>
              ) : null}
              {showBuyAgain ? <div className="ucs-op__again-buy"><button type="button" className="ucs-btn">{t.buyAgain}</button></div> : null}
              {c.recs.like.on || c.recs.complete.on
                ? (["like", "complete"] as const)
                    .filter((k) => c.recs[k].on)
                    .map((k) => (
                      <div key={k} className="ucs-op__recs">
                        <p className="ucs-op__t">
                          <b>{c.recs[k].heading}</b>
                        </p>
                        <ul className="ucs-op__rg">
                          {SAMPLE_RECS.slice(k === "like" ? 0 : 2, (k === "like" ? 0 : 2) + Math.min(c.recs.count, 2)).map((p) => (
                            <li key={p.title} className="ucs-op__rc">
                              {thumb}
                              <span className="ucs-op__rn">{p.title}</span>
                              <span className="ucs-op__rp">{p.price}</span>
                              <button type="button" className="ucs-btn ucs-btn--outline">
                                {c.recs.button}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                : null}
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
