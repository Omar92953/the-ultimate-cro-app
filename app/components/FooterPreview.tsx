/**
 * Live preview of the footer: the same markup and stylesheet (ucs-sections.css) as ucs-footer.liquid,
 * with the store's real menus (Online Store → Navigation).
 */
import type { CSSProperties } from "react";
import { copyrightText, footerClass, footerVars, SOCIALS, type FooterDesign } from "../lib/footer-design";

export type PreviewMenu = { handle: string; title: string; items: { title: string; url: string }[] };

const SAMPLE_LINKS = ["Search", "About us", "Shipping", "Returns", "Contact"].map((title) => ({ title, url: "#" }));
const PAY = ["Visa", "Mastercard", "Apple Pay", "PayPal"];

export function FooterPreview({ config: c, menus, shop }: { config: FooterDesign; menus: PreviewMenu[]; shop: string }) {
  const links = (handle: string) => menus.find((m) => m.handle === handle)?.items ?? (menus.length ? [] : SAMPLE_LINKS);
  const socials = SOCIALS.filter((s) => c.social[s]);
  return (
    <footer className={footerClass(c)} style={footerVars(c) as CSSProperties}>
      <div className="ucs-ft__wrap">
        <div className="ucs-ft__cols">
          {c.columns.map((col) => (
            <div key={col.id} className={`ucs-ft__col ucs-ft__col--${col.kind}`}>
              {col.title ? <h2 className="ucs-ft__title">{col.title}</h2> : null}
              {col.kind === "menu" ? (
                links(col.menu).length ? (
                  <ul className="ucs-ft__links">
                    {links(col.menu).map((l, i) => (
                      <li key={i}>
                        <a href="#preview" onClick={(e) => e.preventDefault()}>
                          {l.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ucs-ft__text">Menu “{col.menu}” not found.</p>
                )
              ) : null}
              {col.kind === "logo" ? (
                <span className="ucs-ft__logo">{c.logo.image?.url ? <img src={`${c.logo.image.url}${c.logo.image.url.includes("?") ? "&" : "?"}width=480`} alt={shop} /> : <span>{shop}</span>}</span>
              ) : null}
              {col.text && col.kind !== "menu" ? <p className="ucs-ft__text" style={{ whiteSpace: "pre-line" }}>{col.text}</p> : null}
              {col.kind === "social" ? (
                <div className="ucs-ft__social">
                  {(socials.length ? socials : (["instagram", "facebook", "tiktok"] as const)).map((s) => (
                    <a key={s} href="#preview" aria-label={s} onClick={(e) => e.preventDefault()} style={socials.length ? undefined : { opacity: 0.35 }}>
                      <span className={`ucs-i ucs-i--${s}`} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              ) : null}
              {col.kind === "newsletter" ? (
                <form className="ucs-ft__news" onSubmit={(e) => e.preventDefault()}>
                  <div className="ucs-ft__field">
                    <input type="email" placeholder={c.newsletter.placeholder} aria-label={c.newsletter.placeholder} />
                    <button type="submit" className="ucs-btn">
                      {c.newsletter.button}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ))}
        </div>
        <div className="ucs-ft__bottom">
          {c.bottom.copyright ? <p className="ucs-ft__copy">{copyrightText(c, shop)}</p> : null}
          {c.bottom.policies ? (
            <ul className="ucs-ft__policies">
              {["Refund policy", "Privacy policy", "Terms of service"].map((p) => (
                <li key={p}>
                  <a href="#preview" onClick={(e) => e.preventDefault()}>
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {c.bottom.payments ? (
            <ul className="ucs-ft__pay" aria-label="Payment methods">
              {PAY.map((p) => (
                <li key={p}>
                  <svg viewBox="0 0 38 24" role="img" aria-label={p}>
                    <rect width="38" height="24" rx="3" fill="#fff" stroke="rgba(0,0,0,.15)" />
                    <text x="19" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="#333" fontFamily="sans-serif">
                      {p.split(" ")[0].toUpperCase().slice(0, 6)}
                    </text>
                  </svg>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
