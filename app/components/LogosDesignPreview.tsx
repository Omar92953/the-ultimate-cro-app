/**
 * Live preview of "Scrolling logos and text": the same markup and stylesheet (ucs-sections.css) as
 * ucs-logos.liquid, with the merchant's own logos, the same repeat count and loop speed.
 */
import type { CSSProperties } from "react";
import { logosClass, logosVars, marqueeTiming, type LogosDesign } from "../lib/logos-design";

export type PreviewLogo = { name: string; url: string | null };

const SAMPLE: PreviewLogo[] = ["Vogue", "Elle", "Forbes", "Wired", "GQ"].map((name) => ({ name, url: null }));

function Item({ logo, height, ghost }: { logo: PreviewLogo; height: number; ghost: boolean }) {
  return (
    <li className="ucs-logos__item" aria-hidden={ghost || undefined}>
      {logo.url ? (
        <img className="ucs-logos__img" src={`${logo.url}${logo.url.includes("?") ? "&" : "?"}height=${height * 2}`} alt={ghost ? "" : logo.name} height={height} />
      ) : (
        <span className="ucs-logos__img ucs-logos__text">{logo.name}</span>
      )}
    </li>
  );
}

export function LogosDesignPreview({ config: c, logos }: { config: LogosDesign; logos: PreviewLogo[] }) {
  const list = logos.length ? logos : SAMPLE;
  const { reps, duration } = marqueeTiming(c, list.length);
  const marquee = c.layout.mode === "marquee";
  const shift = Math.floor(list.length / 2);
  const track = (items: PreviewLogo[], line: number, rev: boolean) => (
    <div className={`ucs-logos__viewport${line === 2 ? " ucs-logos__viewport--2" : ""}`}>
      <ul className={`ucs-logos__track${rev ? " ucs-logos__track--rev" : ""}`}>
        {Array.from({ length: reps * 2 }, (_, copy) => items.map((l, i) => <Item key={`${copy}-${i}`} logo={l} height={c.logos.height} ghost={copy > 0} />))}
      </ul>
    </div>
  );
  return (
    <div className={`ucs ucs-logos ${logosClass(c)}`} style={{ ...logosVars(c), "--ucs-logo-dur": `${duration}s` } as CSSProperties}>
      <div className={`ucs-wrap${c.layout.fullWidth && marquee ? " ucs-logos__wide" : ""}`}>
        {c.text.heading ? (
          <div className="ucs-head">
            <h2>{c.text.heading}</h2>
          </div>
        ) : null}
        {marquee ? (
          <>
            {track(list, 1, false)}
            {c.layout.lines === 2 && list.length > 1 ? track([...list.slice(shift), ...list.slice(0, shift)], 2, c.layout.opposite) : null}
          </>
        ) : (
          <ul className="ucs-logos__grid">
            {list.map((l, i) => (
              <Item key={i} logo={l} height={c.logos.height} ghost={false} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
