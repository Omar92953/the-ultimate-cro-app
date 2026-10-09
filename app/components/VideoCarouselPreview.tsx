/**
 * Live preview of the video carousel: the same markup and stylesheet (ucro.css) as
 * ucro-video-carousel.liquid, with the merchant's own slides (video posters) and products.
 * "Phone" shows the mobile slide count; the arrows scroll like on the store.
 */
import { useRef, useState, type CSSProperties } from "react";
import { videoCarouselVars, type VideoCarouselDesign } from "../lib/video-carousel-design";

export type PreviewSlide = { kind: "video" | "image"; image: string | null; caption: string; product: { title: string; price: string } | null };

const TINTS = ["linear-gradient(160deg,#ffd6a5,#f4a261)", "linear-gradient(160deg,#bde0fe,#6c9bd2)", "linear-gradient(160deg,#cdb4db,#9b72b0)", "linear-gradient(160deg,#b7e4c7,#52b788)", "linear-gradient(160deg,#ffc8dd,#e07a9a)"];
export const SAMPLE_SLIDES: PreviewSlide[] = ["Unboxing", "How to style it", "In use", "Close-up", "Behind the scenes"].map((caption, i) => ({
  kind: "video",
  image: null,
  caption,
  product: i % 2 === 0 ? { title: ["Canvas tote", "Travel mug", "Linen cap"][i / 2], price: ["$34.00", "$22.00", "$26.00"][i / 2] } : null,
}));

const Chevron = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function VideoCarouselPreview({ config: c, slides, phone }: { config: VideoCarouselDesign; slides: PreviewSlide[]; phone?: boolean }) {
  const track = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(1);
  const list = slides.length ? slides : SAMPLE_SLIDES;
  const vars = { ...videoCarouselVars(c), ...(phone ? { "--ucro-vc-desktop": c.layout.mobile } : {}) } as CSSProperties;
  const go = (dir: number) => {
    const t = track.current;
    const first = t?.querySelector(".ucro-vc__slide") as HTMLElement | null;
    if (t && first) t.scrollBy({ left: dir * (first.offsetWidth + c.layout.gap), behavior: "smooth" });
  };
  const onScroll = () => {
    const t = track.current;
    const first = t?.querySelector(".ucro-vc__slide") as HTMLElement | null;
    if (t && first) setCurrent(Math.min(list.length, Math.round(t.scrollLeft / (first.offsetWidth + c.layout.gap)) + 1));
  };

  return (
    <div style={{ maxWidth: phone ? 390 : undefined, margin: "0 auto", padding: "0 16px", color: "#121212", background: "#fff", fontSize: 15, lineHeight: 1.5 }}>
      <div className="ucro ucro-vc" style={vars}>
        {c.text.heading ? <h2 className={`ucro__heading ucro__heading--${c.text.size}`}>{c.text.heading}</h2> : null}
        {c.text.sub ? <p className="ucro__sub">{c.text.sub}</p> : null}
        <ul className="ucro-vc__track" ref={track} onScroll={onScroll}>
          {list.map((s, i) => (
            <li key={i} className="ucro-vc__slide">
              <div className="ucro-vc__card">
                <div className="ucro-vc__media" style={s.image ? undefined : { background: TINTS[i % TINTS.length] }}>
                  {s.image ? <img src={`${s.image}${s.image.includes("?") ? "&" : "?"}width=540`} alt={s.caption || s.product?.title || ""} /> : null}
                  {s.kind === "video" && !s.product ? <span className="ucro-vc__play" aria-hidden="true" /> : null}
                </div>
                {s.caption ? <p className="ucro-vc__caption">{s.caption}</p> : null}
              </div>
              {s.product && c.videos.product ? (
                <div className="ucro-vc__product">
                  <span className="ucro-vc__title">{s.product.title}</span>
                  <span className="ucro-vc__price">{s.product.price}</span>
                  {c.videos.add ? (
                    <button type="button" className="ucro-btn ucro-vc__add" style={{ font: "inherit", fontWeight: 600, color: "#fff", background: "#121212", border: 0, borderRadius: 6 }}>
                      {c.videos.addLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {c.layout.arrows && list.length > 1 ? (
          <div className="ucro-vc__nav">
            <button type="button" className="ucro-vc__arrow" aria-label="Previous" onClick={() => go(-1)}>
              <Chevron d="M12.5 4.5 7 10l5.5 5.5" />
            </button>
            <span className="ucro-vc__counter" aria-hidden="true">
              {current} / {list.length}
            </span>
            <button type="button" className="ucro-vc__arrow" aria-label="Next" onClick={() => go(1)}>
              <Chevron d="M7.5 4.5 13 10l-5.5 5.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
