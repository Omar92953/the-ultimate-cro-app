/**
 * Live preview of the image carousel: the same markup and stylesheet as ucs-image-carousel.js,
 * with working arrows and dots. `phone` shows the mobile layout (the storefront switches with a
 * media query, so the preview sets the phone column count itself).
 */
import { useRef, useState, type CSSProperties } from "react";
import { imageCarouselClass, imageCarouselVars, sized, type ImageCarouselConfig } from "../lib/image-carousel";

const Chevron = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ImageCarouselPreview({ config: c, phone }: { config: ImageCarouselConfig; phone: boolean }) {
  const track = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  const slides = c.slides.filter((s) => s.image?.url);
  const per = phone ? c.layout.perMobile + 0.15 : c.layout.perDesktop;
  const pages = Math.max(1, Math.ceil(slides.length - per) + 1);
  const fits = slides.length <= per;
  const vars = imageCarouselVars(c) as CSSProperties & Record<string, string>;
  if (phone) vars["--ucs-ic-n"] = String(per);

  const step = () => {
    const first = track.current?.children[0] as HTMLElement | undefined;
    return first ? first.offsetWidth + c.layout.gap : 0;
  };
  const go = (dir: number) => {
    const t = track.current;
    if (!t) return;
    const end = t.scrollLeft + t.clientWidth >= t.scrollWidth - 4;
    if (dir > 0 && end) t.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir < 0 && t.scrollLeft < 4) t.scrollTo({ left: t.scrollWidth, behavior: "smooth" });
    else t.scrollBy({ left: dir * step(), behavior: "smooth" });
  };

  if (!slides.length) {
    return <p style={{ padding: 24, textAlign: "center", color: "#616161" }}>Add images on the left to see the carousel.</p>;
  }
  return (
    <div className={`${imageCarouselClass(c)}${fits ? " ucs-ic--fits" : ""}`} style={vars}>
      <div className="ucs-wrap">
        {c.heading.show && (c.heading.text || c.heading.sub) ? (
          <div className="ucs-head">
            {c.heading.text ? <h2>{c.heading.text}</h2> : null}
            {c.heading.sub ? <p>{c.heading.sub}</p> : null}
          </div>
        ) : null}
        <div className="ucs-ic__vp">
          <ul className="ucs-ic__track" ref={track} onScroll={(e) => setAt(Math.round(e.currentTarget.scrollLeft / (step() || 1)))}>
            {slides.map((s, i) => (
              <li key={i} className="ucs-ic__slide">
                <div className="ucs-ic__card">
                  <span className="ucs-ic__media">
                    <img src={sized(s.image!.url!, 540)} alt={s.alt || s.title} />
                  </span>
                  {s.title || s.text || s.button ? (
                    <span className="ucs-ic__cap">
                      {s.title ? <span className="ucs-ic__title">{s.title}</span> : null}
                      {s.text ? <span className="ucs-ic__text">{s.text}</span> : null}
                      {s.button ? <span className="ucs-ic__btn">{s.button}</span> : null}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="ucs-ic__arrow ucs-ic__arrow--prev" aria-label="Previous" onClick={() => go(-1)}>
            <Chevron />
          </button>
          <button type="button" className="ucs-ic__arrow ucs-ic__arrow--next" aria-label="Next" onClick={() => go(1)}>
            <Chevron />
          </button>
        </div>
        <div className="ucs-ic__dots">
          {pages > 1
            ? Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className="ucs-ic__dot"
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === at}
                  onClick={() => track.current?.scrollTo({ left: i * step(), behavior: "smooth" })}
                />
              ))
            : null}
        </div>
      </div>
    </div>
  );
}
