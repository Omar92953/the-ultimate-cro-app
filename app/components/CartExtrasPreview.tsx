/** Preview of Gift note & delivery date in a cart: the same markup and styles as ucs-cart-extras.js. */
import { useState, type CSSProperties } from "react";

// A fixed "today" so the preview renders the same on the server and in the browser.
const TODAY = Date.UTC(2026, 9, 12, 12);
import { cartExtrasClass, cartExtrasVars, type CartExtrasDesign } from "../lib/cart-extras-design";

export function CartExtrasPreview({ config: c }: { config: CartExtrasDesign }) {
  const [gift, setGift] = useState(true);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState("");
  const days: string[] = [];
  const off = new Set(c.date.daysOff);
  for (let i = c.date.minDays; days.length < 5 && i <= c.date.maxDays; i++) {
    const d = new Date(TODAY + i * 86_400_000);
    if (!off.has(d.getUTCDay())) days.push(d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }));
  }
  const slots = c.date.slots.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ display: "grid", gap: 12, padding: 20, maxWidth: 420 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
        <span>Subtotal</span>
        <span>EGP 1,250.00</span>
      </div>
      <div className={cartExtrasClass(c)} style={cartExtrasVars(c) as CSSProperties}>
        {c.heading ? <p className="ucs-ce__h">{c.heading}</p> : null}
        {c.gift.on ? (
          <label className="ucs-ce__check">
            <input type="checkbox" checked={gift} onChange={(e) => setGift(e.target.checked)} /> <span>{c.gift.label}</span>
          </label>
        ) : null}
        {c.note.on && (!c.note.onlyGift || !c.gift.on || gift) ? (
          <label className="ucs-ce__field">
            <span>{c.note.label}</span>
            <textarea rows={3} maxLength={c.note.max} placeholder={c.note.placeholder} />
          </label>
        ) : null}
        {c.code.on ? (
          <div className="ucs-ce__code">
            <label className="ucs-ce__field">
              <span>{c.code.label}</span>
              <span className="ucs-ce__codeRow">
                <input type="text" placeholder={c.code.placeholder} value={code} onChange={(e) => setCode(e.target.value)} />
                <button type="button" className="ucs-btn" onClick={() => code.trim() && (setApplied(code.trim().toUpperCase()), setCode(""))}>
                  {c.code.button}
                </button>
              </span>
            </label>
            {applied ? (
              <ul className="ucs-ce__applied">
                <li className="ucs-ce__tag">
                  <span>{c.code.applied.replace("{code}", applied)}</span>
                  <button type="button" className="ucs-ce__rm" onClick={() => setApplied("")}>
                    {c.code.remove}
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        ) : null}
        {c.date.on ? (
          <div className="ucs-ce__row">
            <label className="ucs-ce__field">
              <span>
                {c.date.label}
                {c.date.required ? " *" : ""}
              </span>
              <select defaultValue="">
                <option value="" />
                {days.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            {slots.length ? (
              <label className="ucs-ce__field">
                <span>{c.date.slotLabel}</span>
                <select defaultValue="">
                  <option value="" />
                  {slots.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
      <button type="button" style={{ minHeight: 46, border: 0, borderRadius: 999, background: "#121212", color: "#fff", font: "inherit", fontWeight: 600 }}>
        Check out
      </button>
    </div>
  );
}
