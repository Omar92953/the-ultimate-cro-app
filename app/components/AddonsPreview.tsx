/**
 * Live preview of the add-ons: the same markup and stylesheet as ucs-addons.js, under a stand-in
 * product's Add to cart button. Tick boxes work so the merchant can try them.
 */
import { useState, type CSSProperties } from "react";
import { addonsVars, type AddonsConfig } from "../lib/addons";

export function AddonsPreview({ config: c }: { config: AddonsConfig }) {
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  const [msg, setMsg] = useState(false);
  const on = (i: number) => ticked[i] ?? c.items[i].checked;
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>
      <div style={{ fontSize: 22, fontWeight: 600 }}>Classic watch</div>
      <div style={{ margin: "4px 0 16px", fontSize: 18 }}>$129.00</div>
      <div style={{ padding: "13px 0", textAlign: "center", color: "#fff", background: "#121212", borderRadius: 999, fontWeight: 600 }}>Add to cart</div>
      {c.items.length || c.message.on ? (
        <div className={`ucs ucs-ao ucs-ao--${c.style}`} style={addonsVars(c) as CSSProperties}>
          {c.heading ? <p className="ucs-ao__h">{c.heading}</p> : null}
          <div className="ucs-ao__list">
            {c.items.map((a, i) => {
              const price = a.variants.find((v) => v.id === a.variantId)?.price;
              return (
                <label key={i} className="ucs-ao__item">
                  <input type="checkbox" className="ucs-ao__check" checked={on(i)} onChange={(e) => setTicked((t) => ({ ...t, [i]: e.target.checked }))} />
                  {a.image ? <img className="ucs-ao__img" src={`${a.image}${a.image.includes("?") ? "&" : "?"}width=120`} alt="" width={48} height={48} /> : null}
                  <span className="ucs-ao__body">
                    <span className="ucs-ao__t">{a.label || a.title}</span>
                    {a.text ? <span className="ucs-ao__x">{a.text}</span> : null}
                  </span>
                  <span className="ucs-ao__p">{price ? `+$${Number(price).toFixed(2)}` : ""}</span>
                </label>
              );
            })}
          </div>
          {c.message.on ? (
            <div className="ucs-ao__msg">
              <label className="ucs-ao__item ucs-ao__msgtoggle" aria-label={c.message.label}>
                <input type="checkbox" className="ucs-ao__check" checked={msg} onChange={(e) => setMsg(e.target.checked)} />
                <span className="ucs-ao__body">
                  <span className="ucs-ao__t">{c.message.label}</span>
                </span>
              </label>
              {msg ? <textarea className="ucs-ao__text" rows={3} maxLength={c.message.max} placeholder={c.message.placeholder} aria-label={c.message.label} /> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p style={{ marginTop: 16, textAlign: "center", color: "#616161" }}>Add an add-on on the left to see it here.</p>
      )}
    </div>
  );
}
