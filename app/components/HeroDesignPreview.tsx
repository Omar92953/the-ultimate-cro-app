/**
 * Live preview of a hero banner: the same markup and stylesheet (ucs-sections.css) as
 * ucs-hero.liquid. The phone view reuses the desktop rules with the mobile values (the admin is
 * wider than the theme's 750px phone breakpoint), so both can be shown side by side.
 */
import { useState, type CSSProperties } from "react";
import { HEIGHTS, heroClass, heroVars, type HeroDesign } from "../lib/hero-design";

const PREVIEW_FULL = { desktop: "560px", mobile: "620px" };

export function HeroDesignPreview({ config: c, device }: { config: HeroDesign; device: "desktop" | "mobile" }) {
  const [ratio, setRatio] = useState<Record<string, number>>({});
  const mobile = device === "mobile";
  const img = mobile ? (c.images.mobile ?? c.images.desktop) : c.images.desktop;
  const url = img?.url ? `${img.url}${img.url.includes("?") ? "&" : "?"}width=${mobile ? 750 : 1500}` : null;
  const height = mobile ? c.layout.heightMobile : c.layout.heightDesktop;
  const h = height === "adapt" ? "auto" : height === "full" ? PREVIEW_FULL[device] : HEIGHTS[height][device];
  const ar = height === "adapt" ? String((url && ratio[url]) || (mobile ? 0.8 : 2.4)) : "auto";
  const vars = {
    ...heroVars(c),
    "--ucs-hero-hd": h,
    "--ucs-hero-ard": ar,
    ...(mobile ? { "--ucs-hero-hs": `${Math.round(c.text.headingSize * 0.66)}px` } : {}),
  } as CSSProperties;
  const spot = mobile ? c.layout.spotMobile : c.layout.spotDesktop;
  const cls = heroClass(c, spot, c.layout.spotMobile).replace(/ucs-hide-(desktop|mobile)/, "");
  return (
    <div className={`ucs ucs-hero ${cls}`} style={vars}>
      <div className="ucs-hero__frame">
        <picture className="ucs-hero__media">
          {url ? (
            <img
              className="ucs-hero__img"
              src={url}
              alt=""
              onLoad={(e) => {
                const t = e.currentTarget;
                if (t.naturalWidth && t.naturalHeight) setRatio((r) => ({ ...r, [url]: t.naturalWidth / t.naturalHeight }));
              }}
            />
          ) : (
            <span className="ucs-hero__img ucs-hero__ph" style={{ display: "block", background: "linear-gradient(135deg,#c9d6df,#8ea6b4)" }} />
          )}
        </picture>
        <div className="ucs-hero__overlay" aria-hidden="true" />
        {c.text.heading || c.text.text || c.text.b1 || c.text.b2 ? (
          <div className="ucs-hero__content">
            <div className="ucs-hero__inner">
              {c.text.heading ? <h2 className="ucs-hero__title">{c.text.heading}</h2> : null}
              {c.text.text ? (
                <div className="ucs-hero__text">
                  <p style={{ whiteSpace: "pre-line" }}>{c.text.text}</p>
                </div>
              ) : null}
              {c.text.b1 || c.text.b2 ? (
                <div className="ucs-hero__buttons">
                  {c.text.b1 ? (
                    <a className="ucs-btn" href="#preview" onClick={(e) => e.preventDefault()}>
                      {c.text.b1}
                    </a>
                  ) : null}
                  {c.text.b2 ? (
                    <a className="ucs-btn ucs-btn--outline" href="#preview" onClick={(e) => e.preventDefault()}>
                      {c.text.b2}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
