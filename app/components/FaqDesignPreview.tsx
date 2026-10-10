/**
 * Live preview of the FAQ section: the same markup and stylesheet (ucs-sections.css) as
 * ucs-faq.liquid, with the merchant's own questions. Search and group buttons work like ucs-faq.js.
 */
import { useState, type CSSProperties } from "react";
import { faqClass, faqVars, type FaqDesign } from "../lib/faq-design";

export type PreviewQuestion = { q: string; a: string; group: string };

const SAMPLE: PreviewQuestion[] = [
  { q: "How long does delivery take?", a: "2–4 working days in the city, 4–7 days elsewhere.", group: "Shipping" },
  { q: "Can I pay cash on delivery?", a: "Yes — cash or card when your order arrives.", group: "Payment" },
  { q: "What is your return policy?", a: "Return any unused item within 14 days for a full refund.", group: "Returns" },
  { q: "Do you ship abroad?", a: "We ship to most countries; costs show at checkout.", group: "Shipping" },
];

export function FaqDesignPreview({ config: c, questions }: { config: FaqDesign; questions: PreviewQuestion[] }) {
  const list = questions.length ? questions : SAMPLE;
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const groups = [...new Set(list.map((x) => x.group.trim()).filter(Boolean))];
  const showTabs = c.questions.tabs && groups.length > 1;
  const q = query.trim().toLowerCase();
  const shown = list.filter((x) => (!group || x.group.trim() === group) && (!q || `${x.q} ${x.a}`.toLowerCase().includes(q)));
  return (
    <div className={`ucs ucs-faq ${faqClass(c)}`} style={faqVars(c) as CSSProperties}>
      <div className="ucs-wrap">
        {c.text.heading || c.text.sub ? (
          <div className="ucs-head">
            {c.text.heading ? <h2>{c.text.heading}</h2> : null}
            {c.text.sub ? <p>{c.text.sub}</p> : null}
          </div>
        ) : null}
        {c.questions.search || showTabs ? (
          <div className="ucs-faq__tools">
            {c.questions.search ? (
              <label className="ucs-faq__search">
                <span className="ucs-i ucs-i--search" aria-hidden="true" />
                <input type="search" placeholder="Search questions" aria-label="Search questions" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
            ) : null}
            {showTabs ? (
              <div className="ucs-faq__tabs" role="group">
                {["", ...groups].map((g) => (
                  <button key={g || "all"} type="button" className="ucs-faq__tab" aria-pressed={group === g} onClick={() => setGroup(g)}>
                    {g || "All"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className={`ucs-faq__list ucs-faq__list--${c.questions.columns}`}>
          {shown.map((x, i) => (
            // Re-mount when "open the first answer" changes, so the preview shows it.
            <details key={`${x.q}-${c.questions.openFirst}`} className="ucs-faq__item" name={c.questions.oneOpen ? "ucs-faq-preview" : undefined} open={c.questions.openFirst && i === 0}>
              <summary className="ucs-faq__q">
                <span>{x.q}</span>
                <span className="ucs-faq__icon" aria-hidden="true" />
              </summary>
              <div className="ucs-faq__a" style={{ whiteSpace: "pre-line" }}>
                {x.a}
              </div>
            </details>
          ))}
          {!shown.length ? <p className="ucs-faq__none">No questions match.</p> : null}
        </div>
        {c.text.help && c.text.contactLabel ? (
          <div className="ucs-faq__help">
            {c.text.contactText ? <p>{c.text.contactText}</p> : null}
            <a className="ucs-btn" href="#preview" onClick={(e) => e.preventDefault()}>
              {c.text.contactLabel}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
