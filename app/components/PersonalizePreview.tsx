/** Live preview of Personalization: the fields (try typing) and the text on the product picture. */
import { useState, type CSSProperties } from "react";
import { personalizeClass, personalizeVars, type PersonalizeDesign } from "../lib/personalize-design";

export function PersonalizePreview({ config: c, image }: { config: PersonalizeDesign; image: string | null }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const sample = (label: string) => (/name|engrav|text/i.test(label) ? "Mariam" : "");
  const shown = c.fields.filter((f) => f.preview && f.type !== "color").map((f) => values[f.id] ?? sample(f.label)).filter(Boolean);
  const colorField = c.fields.find((f) => f.type === "color");
  const pickedColor = colorField ? values[colorField.id] : "";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: 20, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Engraved bottle</div>
        <div>EGP 650.00</div>
        <div className={personalizeClass(c)} style={personalizeVars(c) as CSSProperties}>
          {c.heading ? <p className="ucs-pz__h">{c.heading}</p> : null}
          <div className="ucs-pz__fields">
            {c.fields.map((f) => {
              const opts = f.options.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
              const v = values[f.id] ?? "";
              const set = (x: string) => setValues((all) => ({ ...all, [f.id]: x }));
              return (
                <div key={f.id} className="ucs-pz__field" role="group" aria-label={f.label}>
                  <span>
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  {f.type === "textarea" ? (
                    <textarea aria-label={f.label} rows={3} maxLength={f.max} value={v} onChange={(e) => set(e.target.value)} />
                  ) : f.type === "select" ? (
                    <select aria-label={f.label} value={v} onChange={(e) => set(e.target.value)}>
                      <option value="" />
                      {opts.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : f.type === "color" ? (
                    <span className="ucs-pz__colors">
                      {opts.map((o) => (
                        <label key={o} className="ucs-pz__swatch" title={o}>
                          <input type="radio" name={`pv-${f.id}`} aria-label={o} checked={v === o} onChange={() => set(o)} />
                          <span style={{ background: o }} />
                        </label>
                      ))}
                    </span>
                  ) : (
                    <input type="text" aria-label={f.label} maxLength={f.max} placeholder={sample(f.label)} value={v} onChange={(e) => set(e.target.value)} />
                  )}
                  {f.type === "text" || f.type === "textarea" ? <small className="ucs-pz__count">{v.length} / {f.max}</small> : null}
                </div>
              );
            })}
          </div>
          {c.fee.on && c.fee.note ? <p className="ucs-pz__note">{c.fee.note}</p> : null}
        </div>
        <button type="button" style={{ minHeight: 44, border: 0, borderRadius: 999, background: "#121212", color: "#fff", font: "inherit", fontWeight: 600 }}>
          Add to cart
        </button>
      </div>
      {c.preview.on ? (
        <div className={personalizeClass(c)} style={{ ...(personalizeVars(c) as CSSProperties), padding: 0, background: "none" }}>
          <div className="ucs-pz__preview">
            <span className="ucs-pz__plabel">{c.preview.label}</span>
            {image ? <img src={`${image}${image.includes("?") ? "&" : "?"}width=700`} alt="" /> : <div style={{ aspectRatio: "1", background: "linear-gradient(145deg,#3b3b3b,#111)" }} />}
            <span className="ucs-pz__text" style={pickedColor ? { color: pickedColor } : undefined}>
              {shown.join("\n")}
            </span>
          </div>
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
