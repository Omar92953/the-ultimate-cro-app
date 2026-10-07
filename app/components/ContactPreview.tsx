/**
 * Live preview of the contact form: the same markup and the same stylesheet as the storefront
 * block (extensions/cro-storefront/assets/ucs-contact.css), so what you see here is what shoppers see.
 */
import type { CSSProperties } from "react";
import { FIELD_META, contactVars, type ContactConfig } from "../lib/pages";

export function ContactPreview({ config: c }: { config: ContactConfig }) {
  const cls = [
    "ucs-ct",
    `ucs-ct--${c.layout.style}`,
    `ucs-ct--${c.layout.align}`,
    `ucs-ct--f-${c.look.fieldStyle}`,
    c.layout.labels === "inside" ? "ucs-ct--inside" : "",
    c.info.show ? `ucs-ct--info ucs-ct--info-${c.info.side}` : "",
  ].join(" ");
  const i = c.info;
  return (
    <div className={cls} style={contactVars(c) as CSSProperties}>
      <div className="ucs-ct__in">
        {i.show ? (
          <aside className="ucs-ct__info">
            {i.title ? <h3>{i.title}</h3> : null}
            {i.text ? <p>{i.text}</p> : null}
            <ul>
              {i.email ? <Row icon="mail">{i.email}</Row> : null}
              {i.phone ? <Row icon="phone">{i.phone}</Row> : null}
              {i.whatsapp ? <Row icon="wa">WhatsApp</Row> : null}
              {i.address ? <Row icon="pin">{i.address}</Row> : null}
              {i.hours ? <Row icon="clock">{i.hours}</Row> : null}
            </ul>
          </aside>
        ) : null}
        <div className="ucs-ct__main">
          {c.heading ? <h2 className="ucs-ct__h">{c.heading}</h2> : null}
          {c.text ? <p className="ucs-ct__t">{c.text}</p> : null}
          <form className="ucs-ct__form" onSubmit={(e) => e.preventDefault()}>
            <div className="ucs-ct__grid">
              {c.fields
                .filter((f) => f.on)
                .map((f) => {
                  const ph = c.layout.labels === "inside" && !f.placeholder ? f.label : f.placeholder;
                  const id = `preview-${f.key}`;
                  return (
                    <div key={f.key} className={`ucs-ct__f${f.half ? " is-half" : ""}`}>
                      <label htmlFor={id}>
                        {f.label}
                        {f.required ? <span aria-hidden="true"> *</span> : null}
                      </label>
                      {FIELD_META[f.key].type === "textarea" ? (
                        <textarea id={id} rows={5} placeholder={ph} readOnly />
                      ) : (
                        <input id={id} type={FIELD_META[f.key].type} placeholder={ph} readOnly />
                      )}
                    </div>
                  );
                })}
            </div>
            {c.privacy ? <p className="ucs-ct__note">{c.privacy}</p> : null}
            <button type="submit" className="ucs-ct__btn">
              {c.button}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: string; children: string }) {
  return (
    <li>
      <span className={`ucs-ct__ic ucs-ct__ic--${icon}`} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
