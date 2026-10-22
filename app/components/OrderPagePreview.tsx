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

/** What the Track page sells, as the preview needs it (the settings in lib/track-sell.ts and the live Track page offers). */
export type PreviewSells = { next: boolean; buyAgain: boolean; after: boolean; late: boolean; creditBonus?: number; offers: { above: PreviewOffer | null; below: PreviewOffer | null } };
export type PreviewOffer = { headline: string; text: string; button: string; kind: string };
export const NO_SELLS: PreviewSells = { next: false, buyAgain: false, after: false, late: false, offers: { above: null, below: null } };
/** The sample orders the editor shows: on its way, delivered (after delivery mode) and late (delay message). */
export type SampleOrder = "transit" | "delivered" | "delayed";

export function OrderPagePreview({ config: c, step, sample = "transit", sells = NO_SELLS }: { config: OrderPageDesign; step: "form" | "result"; sample?: SampleOrder; sells?: PreviewSells }) {
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
                <span className="ucs-op__pill">{sample === "delivered" ? "Delivered" : "Shipped"}</span>
                <span className="ucs-op__pill ucs-op__pill--soft">Paid</span>
              </p>
              {sample === "delayed" && sells.late ? (
                <div className="ucs-op__after ucs-op__late">
                  <p className="ucs-op__t"><b>{t.delayText}</b></p>
                </div>
              ) : null}
              {sample === "delivered" && sells.after ? (
                <div className="ucs-op__after">
                  <p className="ucs-op__t"><b>{t.afterTitle}</b></p>
                  <p className="ucs-op__t">{t.afterSub}</p>
                  <p className="ucs-op__links"><span className="ucs-btn">{t.reviewButton}</span></p>
                  <p className="ucs-op__t"><u>{t.returnLink}</u>{sells.creditBonus ? <small> {t.creditNote.replace("{bonus}", `${sells.creditBonus}%`)}</small> : null}</p>
                </div>
              ) : null}
              {sells.offers.above ? <SampleOffer o={sells.offers.above} /> : null}
              <div className="ucs-op__ship">
                <span className="ucs-op__pill">{sample === "delivered" ? "Delivered" : sample === "delayed" ? "In transit, late" : "In transit"}</span>
                <p className="ucs-op__t">
                  {t.shipped}: <b>EG123456789</b> · Aramex
                </p>
                {sample === "delivered" ? (
                  <p className="ucs-op__t">{t.delivered}: Oct 7, 2026</p>
                ) : c.show.estimate ? (
                  <p className="ucs-op__t">{t.estimated}: {sample === "delayed" ? "Oct 6, 2026" : "Oct 8, 2026"}</p>
                ) : null}
                {sample !== "delivered" && c.show.place ? (
                  <p className="ucs-op__t">
                    {t.where}: <b>Cairo, Egypt</b>
                  </p>
                ) : null}
                {c.show.timeline ? (
                  <>
                    <p className="ucs-op__t">
                      <b>{t.history}</b>
                    </p>
                    <ol className="ucs-op__tl">
                      {(sample === "delivered" ? [["statusDelivered", "Oct 7, 2:10 PM", "Delivered · Giza, Egypt"]] : []).concat([["statusTransit", "Oct 5, 9:40 AM", "Arrived at the hub · Cairo, Egypt"], ["statusInfo", "Oct 4, 6:15 PM", "Label created"]]).map(([s, at, text]) => (
                        <li key={at} className={`ucs-op__ev ucs-op__ev--${s === "statusDelivered" ? "delivered" : s === "statusTransit" ? "transit" : "info"}`}>
                          <span className="ucs-op__evh">
                            {t[s]} <small>{at}</small>
                          </span>
                          <span className="ucs-op__evt">{text}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : null}
                {c.show.link ? (
                  <a className="ucs-btn ucs-btn--outline" href="#preview" onClick={(e) => e.preventDefault()}>
                    {t.trackLink}
                  </a>
                ) : null}
              </div>
              {sells.offers.below ? <SampleOffer o={sells.offers.below} /> : null}
              {c.show.items ? (
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
              ) : null}
              {c.prices ? (
                <div className="ucs-op__prices">
                  <div className="ucs-op__pr"><span>{t.priceSubtotal}</span><span>$130.00</span></div>
                  <div className="ucs-op__pr"><span>{t.priceShipping}</span><span>{t.priceFree}</span></div>
                  <div className="ucs-op__pr"><span>{t.priceDiscount}</span><span>−$13.00</span></div>
                  <div className="ucs-op__pr ucs-op__pr--total"><span>{t.priceTotal}</span><span>$117.00</span></div>
                </div>
              ) : null}
              {sells.next ? (
                <div className="ucs-op__next">
                  <p className="ucs-op__t"><b>{t.nextTitle.replace("{percent}", "10%")}</b></p>
                  <p className="ucs-op__t"><code className="ucs-op__code">NEXT-3FA9C2D1</code> <button type="button" className="ucs-btn ucs-btn--outline">{t.nextCopy}</button></p>
                  <p className="ucs-op__t"><small>{t.nextUntil.replace("{date}", "Nov 18, 2026")}</small></p>
                </div>
              ) : null}
              {sells.buyAgain ? <div className="ucs-op__again-buy"><button type="button" className="ucs-btn">{t.buyAgain}</button></div> : null}
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
        {t.brand ? (
          <ul className="ucs-op__brand">
            {t.brand.split("\n").filter(Boolean).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** A Track page offer as the shopper sees it (sample products and code). */
function SampleOffer({ o }: { o: PreviewOffer }) {
  return (
    <div className="ucs-op__offer">
      <p className="ucs-op__t"><b>{o.headline}</b></p>
      {o.text ? <p className="ucs-op__t">{o.text}</p> : null}
      {o.kind === "cross_sell" ? (
        <ul className="ucs-op__rg">
          {SAMPLE_RECS.slice(0, 2).map((p) => (
            <li key={p.title} className="ucs-op__rc">
              <span className="ucs-op__ph" />
              <span className="ucs-op__rn">{p.title}</span>
              <span className="ucs-op__rp">{p.price}</span>
              <button type="button" className="ucs-btn ucs-btn--outline">{o.button}</button>
            </li>
          ))}
        </ul>
      ) : (
        <p><span className="ucs-btn">{o.button}</span></p>
      )}
      <p className="ucs-op__t"><code className="ucs-op__code">TRACK-3FA9C2D1</code> <small>Valid until Oct 22, 3:00 PM.</small></p>
    </div>
  );
}
