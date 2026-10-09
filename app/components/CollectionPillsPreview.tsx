/** Live preview of the collection pills: same markup and stylesheet as ucs-collection-pills.js. */
import { useState, type CSSProperties } from "react";
import { pillsClass, pillsVars, type CollectionPillsConfig } from "../lib/collection-pills";

export function CollectionPillsPreview({ config: c }: { config: CollectionPillsConfig }) {
  const [on, setOn] = useState(0);
  if (!c.items.length) return <p style={{ padding: 24, textAlign: "center", color: "#616161" }}>Add collections on the left to see the pills.</p>;
  return (
    <div style={{ padding: "20px 0", background: "#fff" }}>
      <p style={{ margin: "0 0 4px", textAlign: "center", fontSize: 22, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{c.items[on]?.label || c.items[on]?.title}</p>
      <div className={pillsClass(c)} style={pillsVars(c) as CSSProperties}>
        <div className="ucs-wrap">
          {c.heading ? (
            <div className="ucs-head">
              <h2>{c.heading}</h2>
            </div>
          ) : null}
          <div className="ucs-cp__vp">
            <nav className="ucs-cp__row" aria-label="Collections">
              {c.items.map((x, i) => (
                <a
                  key={x.handle}
                  href="#preview"
                  className={`ucs-cp__pill${i === on ? " is-on" : ""}`}
                  aria-current={i === on ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setOn(i);
                  }}
                >
                  {c.layout.images && x.image ? <img src={`${x.image}${x.image.includes("?") ? "&" : "?"}width=80`} alt="" width={28} height={28} /> : null}
                  <span>{x.label || x.title}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <p style={{ margin: "6px 0 0", textAlign: "center", fontSize: 13, color: "#616161" }}>Click a pill to see how the current collection looks.</p>
    </div>
  );
}
