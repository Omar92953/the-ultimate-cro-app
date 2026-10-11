/**
 * Live preview of the reviews section: the same markup and stylesheet as ucs-reviews.js, built from
 * the merchant's real reviews (up to the design's limit). Carousels scroll with their arrows.
 */
import { useRef, type CSSProperties } from "react";
import { reviewsClass, reviewsVars, type ReviewsDesign } from "../lib/reviews-design";

export type PreviewReview = {
  name: string;
  text: string;
  rating: number;
  source: string;
  location: string;
  date: string; // already formatted
  verified: boolean;
  featured: boolean;
  media: { kind: "image" | "video"; url: string } | null;
  /** This review's own photo fit ("" = the design's): whole, or crop keeping center / top / bottom. */
  photoFit: string;
  product: { title: string; image: string | null } | null;
};

const SRC: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", google: "Google", x: "X", snapchat: "Snapchat", email: "Email" };
const sized = (u: string, w: number) => `${u}${u.includes("?") ? "&" : "?"}width=${w}`;
const Stars = ({ r }: { r: number }) => (
  <span className="ucs-rv__stars" style={{ "--r": r } as CSSProperties} role="img" aria-label={`${r} out of 5 stars`}>
    ★★★★★
  </span>
);

export function ReviewsPreview({ config: c, reviews }: { config: ReviewsDesign; reviews: PreviewReview[] }) {
  const track = useRef<HTMLDivElement>(null);
  let list = reviews;
  if (c.which.filter === "featured") list = list.filter((r) => r.featured);
  const rated = list.filter((r) => r.rating > 0);
  const avg = rated.length ? Math.round((rated.reduce((a, r) => a + r.rating, 0) / rated.length) * 10) / 10 : 0;
  const isList = c.layout.mode === "list";
  const shown = list.slice(0, isList ? Math.min(c.which.limit, c.list.perPage) : c.which.limit);
  const sm = c.summary;
  const showSummary = sm.show && rated.length > 0 && (sm.average || sm.stars || sm.count);
  const vars = reviewsVars(c) as CSSProperties;
  const go = (dir: number) => {
    const t = track.current;
    const first = t?.querySelector(".ucs-rv__card") as HTMLElement | null;
    if (t && first) t.scrollBy({ left: dir * (first.offsetWidth + 16), behavior: "smooth" });
  };

  const summaryEl = showSummary ? (
    <div className="ucs-rv__summary">
      {sm.average ? <span className="ucs-rv__avg">{avg}</span> : null}
      {sm.stars ? <Stars r={avg} /> : null}
      {sm.count ? <span className="ucs-rv__count">{c.text.basedOn.replace(/\{count\}/g, String(rated.length))}</span> : null}
    </div>
  ) : null;
  // On the store the button shows on product pages only.
  const writeEl = c.write.on ? (
    <div className="ucs-rv__write-at">
      <button type="button" className="ucs-btn">
        {c.write.button}
      </button>
    </div>
  ) : null;

  const sides = c.layout.mode === "carousel" && c.layout.nav === "sides";
  const navEl =
    c.layout.mode === "carousel" && c.layout.nav !== "swipe" ? (
          <div className="ucs-rv__nav">
            {c.layout.nav !== "dots" ? (
              <button type="button" className="ucs-rv__arrow" aria-label="Previous" onClick={() => go(-1)}>
                <span className="ucs-i ucs-i--chev-l" aria-hidden="true" />
              </button>
            ) : null}
            {c.layout.nav === "dots" || c.layout.nav === "both" ? (
              <span className="ucs-rv__dots">
                {shown.slice(0, Math.max(1, shown.length - c.layout.perDesktop + 1)).map((_, i) => (
                  <button key={i} type="button" className="ucs-rv__dot" aria-label={`Go to review ${i + 1}`} aria-current={i === 0} />
                ))}
              </span>
            ) : null}
            {c.layout.nav !== "dots" ? (
              <button type="button" className="ucs-rv__arrow" aria-label="Next" onClick={() => go(1)}>
                <span className="ucs-i ucs-i--chev-r" aria-hidden="true" />
              </button>
            ) : null}
          </div>
    ) : null;

  if (c.layout.mode === "badge")
    return (
      <div className={reviewsClass(c)} style={vars}>
        {rated.length ? (
          <span className="ucs-rv__badge">
            {sm.stars ? <Stars r={avg} /> : null}
            {sm.average ? <span className="ucs-rv__avg">{avg}</span> : null}
            {sm.count ? <span className="ucs-rv__count">{c.text.basedOn.replace(/\{count\}/g, String(rated.length))}</span> : null}
          </span>
        ) : (
          <span style={{ color: "#616161" }}>Shows when this product has reviews with stars.</span>
        )}
      </div>
    );
  if (!reviews.length) return <p style={{ padding: 24, textAlign: "center", color: "#616161" }}>Add reviews in Storefront → Customer reviews to see them here.</p>;
  return (
    <div className={`${reviewsClass(c)} is-sized`} style={{ ...vars, "--ucs-rv-media-h": "260px" } as CSSProperties}>
      <div className="ucs-wrap">
        {c.text.heading || c.text.sub || showSummary || c.write.on ? (
          <div className="ucs-head ucs-rv__head">
            {c.text.heading ? <h2>{c.text.heading}</h2> : null}
            {c.text.sub ? <p>{c.text.sub}</p> : null}
            {isList ? (
              <div className="ucs-rv__overview">
                {summaryEl}
                {c.list.bars && rated.length ? (
                  <div className="ucs-rv__bars">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const k = rated.filter((r) => Math.round(r.rating) === n).length;
                      return (
                        <div key={n} className="ucs-rv__bar">
                          <span>{n} ★</span>
                          <span className="ucs-rv__bar-track">
                            <span style={{ width: `${Math.round((k / rated.length) * 100)}%` }} />
                          </span>
                          <span>{k}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {writeEl}
              </div>
            ) : (
              <>
                {summaryEl}
                {writeEl}
              </>
            )}
          </div>
        ) : null}
        {isList && c.list.sort && list.length > 1 ? (
          <div className="ucs-rv__tools">
            <label>
              {c.list.sortBy}{" "}
              <select className="ucs-rv__sort" defaultValue="newest">
                {[c.list.newest, c.list.highest, c.list.lowest, c.list.photos].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="ucs-rv__viewport">
          <div className="ucs-rv__track" ref={track}>
            {shown.map((r, i) => {
              const fromProd = !r.media && !!r.product?.image;
              const media = r.media ?? (fromProd ? { kind: "image" as const, url: r.product!.image! } : null);
              const showMedia = c.card.media && media;
              const pf = r.photoFit || (c.card.photoFit === "crop" ? c.card.photoFocus : "whole");
              const whole = !fromProd && media?.kind !== "video" && pf === "whole";
              const textEl = c.card.text && r.text ? <div className="ucs-rv__text">{r.text}</div> : null;
              const meta = [c.card.location ? r.location : "", c.card.date ? r.date : ""].filter(Boolean).join(" · ");
              return (
                <article key={i} className={`ucs-rv__card ucs-rv__card--${c.card.style}${showMedia ? " has-media" : ""}`}>
                  {showMedia ? (
                    <div className={`ucs-rv__media${whole ? " ucs-rv__media--shot" : ""}`} style={!whole && (pf === "top" || pf === "bottom") ? ({ "--ucs-rv-focus": `center ${pf}` } as CSSProperties) : undefined}>
                      {media.kind === "video" ? <video className="ucs-rv__video" src={media.url} muted playsInline /> : <img className="ucs-rv__img" src={sized(media.url, 540)} alt={r.name} />}
                    </div>
                  ) : null}
                  {c.card.style === "snippet" ? (
                    <div className="ucs-rv__body">
                      {c.card.stars && r.rating > 0 ? (
                        <div className="ucs-rv__top">
                          <Stars r={r.rating} />
                        </div>
                      ) : null}
                      {textEl}
                      <div className="ucs-rv__who">
                        <span className="ucs-rv__name">{r.name}</span>
                        {c.card.verified && r.verified ? (
                          <span className="ucs-rv__tick" title={c.text.verified}>
                            <span className="ucs-i ucs-i--verified" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                      {c.card.product && r.product ? (
                        <span className="ucs-rv__prod">
                          <span>
                            <span className="ucs-rv__for">{c.text.reviewFor} </span>
                            {r.product.title}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  ) : (
                  <div className="ucs-rv__body">
                    {c.card.textFirst ? textEl : null}
                    {(c.card.stars && r.rating > 0) || (c.card.source && r.source && r.source !== "other") ? (
                      <div className="ucs-rv__top">
                        {c.card.stars && r.rating > 0 ? <Stars r={r.rating} /> : null}
                        {c.card.source && r.source && r.source !== "other" ? (
                          <span className={`ucs-rv__src ucs-rv__src--${r.source}${c.icon.custom[r.source] ? " has-img" : ""}`} title={SRC[r.source] ?? r.source}>
                            {c.icon.custom[r.source]?.url ? <img src={sized(c.icon.custom[r.source].url!, 96)} alt="" /> : <span className={`ucs-i ucs-i--${r.source}`} aria-hidden="true" />}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {c.card.textFirst ? null : textEl}
                    <footer className="ucs-rv__who">
                      <span className="ucs-rv__name">{r.name}</span>
                      {c.card.verified && r.verified ? (
                        <span className="ucs-rv__ver">
                          <span className="ucs-i ucs-i--verified" aria-hidden="true" />
                          {c.text.verified}
                        </span>
                      ) : null}
                      {meta ? <span className="ucs-rv__meta">{meta}</span> : null}
                    </footer>
                    {c.card.product && r.product ? (
                      <span className="ucs-rv__prod">
                        {r.product.image && !fromProd ? <img src={sized(r.product.image, 96)} width={40} height={40} alt="" /> : null}
                        <span>
                          <span className="ucs-rv__for">{c.text.reviewFor} </span>
                          {r.product.title}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  )}
                </article>
              );
            })}
          </div>
          {sides ? navEl : null}
        </div>
        {isList && list.length > shown.length ? (
          <div className="ucs-rv__more-at">
            <button type="button" className="ucs-btn ucs-btn--outline">
              {c.list.more}
            </button>
          </div>
        ) : null}
        {sides ? null : navEl}
      </div>
    </div>
  );
}
