/**
 * Preview of the loyalty widget and the Rewards page: the same markup and stylesheet as ucs-loyalty.js, with
 * a sample member (1,250 points) or a shopper who isn't signed in.
 */
import type { CSSProperties } from "react";
import type { LoyaltyConfig } from "../lib/loyalty/config";

export type LoyaltyView = "member" | "guest" | "page";

export function LoyaltyPreview({ config: c, view }: { config: LoyaltyConfig; view: LoyaltyView }) {
  const t = c.widget.texts;
  const unit = (n: number) => (n === 1 ? c.unit.one : c.unit.many);
  const pts = (n: number) => `${n.toLocaleString("en-US")} ${unit(n)}`;
  const fill = (s: string, n: number) => s.replace("{n}", pts(n));
  const have = view === "member" ? 1250 : null;
  const vars = { "--ucs-loy-a": c.widget.accent, "--ucs-loy-oa": c.widget.onAccent, "--ucs-loy-r": `${c.widget.radius}px` } as CSSProperties;
  const r = c.referral;
  const offer = r.friend.kind === "percent" ? t.offPercent.replace("{x}", String(r.friend.value)) : r.friend.kind === "amount" ? t.offAmount.replace("{x}", `$${r.friend.value}`) : t.freeShip;
  const gift = r.gift.kind === "credit" ? t.creditGift.replace("{x}", `$${r.gift.value}`) : pts(r.gift.value);
  const ways = [c.earn.order.on ? [t.orderWay, `${pts(c.earn.order.perUnit)} / $1`] : null, c.earn.signup.on ? [t.signupWay, pts(c.earn.signup.points)] : null, c.earn.firstOrder.on ? [t.firstWay, pts(c.earn.firstOrder.points)] : null, r.on ? [t.referWay, gift] : null, c.earn.review.on ? [t.reviewWay, pts(c.earn.review.points)] : null].filter(Boolean) as string[][];
  const link = "https://your-store.com/?ref=K7M2QXP";
  const referEl = r.on ? (
    <>
      <h3>{t.referTitle}</h3>
      <p className="ucs-loy__ref-x">{t.referText.replace("{friend}", offer).replace("{gift}", gift)}</p>
      <div className="ucs-loy__ref">
        <input readOnly value={link} aria-label={t.referLink} />
        <button type="button" className="ucs-loy__btn">
          {t.copy}
        </button>
      </div>
      <p className="ucs-loy__share">
        {["WhatsApp", "X", "Facebook", t.email].map((x) => (
          <a key={x} href="#preview" onClick={(e) => e.preventDefault()}>
            {x}
          </a>
        ))}
      </p>
    </>
  ) : null;
  const waysEl = (
    <>
      <h3>{t.earn}</h3>
      <ul className="ucs-loy__list">
        {ways.map(([a, b]) => (
          <li key={a}>
            <span>{a}</span>
            <b>{b}</b>
          </li>
        ))}
      </ul>
    </>
  );
  const rewardsEl = (
    <>
      <h3>{t.rewards}</h3>
      <ul className="ucs-loy__list">
        {c.rewards.filter((r) => r.on).map((r) => (
          <li key={r.id}>
            <span>{r.title}</span>
            {have === null ? <b>{pts(r.points)}</b> : r.points > have ? <small>{fill(t.more, r.points - have)}</small> : <button type="button" className="ucs-loy__btn">{`${t.get} · ${pts(r.points)}`}</button>}
          </li>
        ))}
      </ul>
    </>
  );

  if (view === "page") {
    return (
      <div className="ucs-loyp" style={vars}>
        <section className="ucs-loyp__hero">
          <h1>{c.page.title}</h1>
          {c.page.sub ? <p>{c.page.sub}</p> : null}
          <p className="ucs-loyp__cta">
            <a className="ucs-loy__btn" href="#preview" onClick={(e) => e.preventDefault()}>
              {t.join}
            </a>{" "}
            <a className="ucs-loy__link" href="#preview" onClick={(e) => e.preventDefault()}>
              {t.signIn}
            </a>
          </p>
        </section>
        {c.page.how.length ? (
          <ol className="ucs-loyp__how">
            {c.page.how.map((x, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <b>{x.t}</b>
                <small>{x.x}</small>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="ucs-loyp__cols">
          <section>{waysEl}</section>
          <section>{rewardsEl}</section>
        </div>
        {c.page.faq.length ? (
          <section className="ucs-loyp__faq">
            {c.page.faq.map((x, i) => (
              <details key={i} open={i === 0}>
                <summary>{x.q}</summary>
                <p>{x.a}</p>
              </details>
            ))}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 640, background: "#fafafa" }}>
      <div className={`ucs-loy ucs-loy--${c.widget.position}`} style={{ ...vars, position: "absolute" }}>
        <div className="ucs-loy__panel" role="dialog" aria-label={t.title}>
          <div className="ucs-loy__top">
            <b>{t.title}</b>
            <button type="button" className="ucs-loy__x" aria-label="Close">
              ×
            </button>
          </div>
          <div className="ucs-loy__body">
            {have !== null ? (
              <div className="ucs-loy__head">
                <small>{t.have}</small>
                <strong>{pts(have)}</strong>
                <small>{fill(t.pending, 80)}</small>
              </div>
            ) : (
              <div className="ucs-loy__head">
                <strong>{t.guestTitle}</strong>
                <small>{t.guestText}</small>
                <a className="ucs-loy__btn ucs-loy__btn--wide" href="#preview" onClick={(e) => e.preventDefault()}>
                  {t.join}
                </a>
                <a className="ucs-loy__link" href="#preview" onClick={(e) => e.preventDefault()}>
                  {t.signIn}
                </a>
              </div>
            )}
            {rewardsEl}
            {have !== null ? referEl : null}
            {waysEl}
          </div>
        </div>
        <button type="button" className={`ucs-loy__launch${c.widget.launcher === "icon" ? " ucs-loy__launch--icon" : ""}`} aria-label={t.launcher}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" />
          </svg>
          <span>{t.launcher}</span>
        </button>
      </div>
    </div>
  );
}
