/**
 * Live preview of the announcement bar: the same markup and stylesheet (ucs-sections.css) as
 * ucs-announcement.liquid / .js, with the merchant's own messages rotating at the chosen speed, the
 * arrows and close button, and the free-shipping message (from the Free shipping bar's goal).
 */
import { useEffect, useState, type CSSProperties } from "react";
import { announcementClass, announcementVars, type AnnouncementDesign } from "../lib/announcement-design";

export type AnnouncementMessage = { text: string; link: boolean; icon: string };
export type FreeShippingInfo = { goal: number; empty: string; progress: string; done: string; currency: string };

export function AnnouncementDesignPreview({ config: c, messages, freeShipping }: { config: AnnouncementDesign; messages: AnnouncementMessage[]; freeShipping: FreeShippingInfo | null }) {
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en", { style: "currency", currency: freeShipping?.currency || "USD", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
    } catch {
      return n.toFixed(2);
    }
  };
  const list: AnnouncementMessage[] = [];
  const total = freeShipping ? Math.round(freeShipping.goal * 0.6) : 0;
  if (c.freeShipping.on && freeShipping) list.push({ text: freeShipping.progress.replace(/\{left\}/g, money(freeShipping.goal - total)).replace(/\{goal\}/g, money(freeShipping.goal)), link: false, icon: "truck" });
  list.push(...(messages.length ? messages : [{ text: "Add messages in Boosters → Announcement bar", link: false, icon: "none" }]));
  const [at, setAt] = useState(0);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setAt((i) => (i + 1) % list.length), c.behaviour.interval * 1000);
    return () => clearInterval(t);
  }, [list.length, c.behaviour.interval]);
  const current = at % list.length;
  if (closed)
    return (
      <p style={{ padding: 16, textAlign: "center", color: "#616161" }}>
        Closed for this visit.{" "}
        <button type="button" onClick={() => setClosed(false)} style={{ font: "inherit", textDecoration: "underline", background: "none", border: 0, cursor: "pointer" }}>
          Show again
        </button>
      </p>
    );
  return (
    <div className={`ucs ucs-ab is-ready ${announcementClass(c)}`} style={{ ...announcementVars(c), position: "relative" } as CSSProperties} role="region" aria-label="Announcements">
      <div className="ucs-ab__inner">
        {c.behaviour.arrows && list.length > 1 ? (
          <button type="button" className="ucs-ab__nav" aria-label="Previous" onClick={() => setAt((i) => (i - 1 + list.length) % list.length)}>
            <span className="ucs-i ucs-i--chev-l" aria-hidden="true" />
          </button>
        ) : null}
        <div className="ucs-ab__track" aria-live="polite">
          {list.map((m, i) => (
            <div key={i} className={`ucs-ab__msg${i === current ? " is-on" : ""}`}>
              {m.link ? (
                <a href="#preview" onClick={(e) => e.preventDefault()}>
                  {m.icon !== "none" ? <span className={`ucs-i ucs-i--${m.icon}`} aria-hidden="true" /> : null}
                  <span>{m.text}</span>
                </a>
              ) : (
                <>
                  {m.icon !== "none" ? <span className={`ucs-i ucs-i--${m.icon}`} aria-hidden="true" /> : null}
                  <span>{m.text}</span>
                </>
              )}
            </div>
          ))}
        </div>
        {c.behaviour.arrows && list.length > 1 ? (
          <button type="button" className="ucs-ab__nav" aria-label="Next" onClick={() => setAt((i) => (i + 1) % list.length)}>
            <span className="ucs-i ucs-i--chev-r" aria-hidden="true" />
          </button>
        ) : null}
        {c.behaviour.dismissible ? (
          <button type="button" className="ucs-ab__close" aria-label="Close" onClick={() => setClosed(true)}>
            <span className="ucs-i ucs-i--close" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {c.freeShipping.on && freeShipping && c.freeShipping.bar ? <div className="ucs-ab__bar" aria-hidden="true" style={{ "--ucs-ab-p": "60%" } as CSSProperties} /> : null}
    </div>
  );
}
