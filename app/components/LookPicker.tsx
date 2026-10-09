/**
 * "Start from a look" for design pages: each ready-made look as a small drawn sample (its accent
 * colour, corners and layout), with the look currently in use highlighted. A look is "in use" when
 * applying it would change nothing.
 */
export type LookSwatch = {
  accent: string; // selected item / buttons
  radius: number; // card corners, px
  bg?: string; // section background
  text?: string;
  cards?: number; // how many cards in a row
  ratio?: number; // card height / width
  list?: boolean; // one box with rows instead of cards
};

export function LookPicker<C>({ presets, config, apply, swatch, onPick }: { presets: { key: string; title: string }[]; config: C; apply: (c: C, key: string) => C; swatch: (c: C) => LookSwatch; onPick: (key: string) => void }) {
  const now = JSON.stringify(config);
  return (
    <s-section heading="Start from a look">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }} role="radiogroup" aria-label="Looks">
        {presets.map((p) => {
          const next = apply(config, p.key);
          const on = JSON.stringify(next) === now;
          const s = swatch(next);
          const n = Math.max(2, Math.min(4, s.cards ?? 3));
          const r = Math.min(s.radius, 14);
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Use the ${p.title} look`}
              onClick={() => onPick(p.key)}
              style={{ display: "flex", flexDirection: "column", gap: 6, padding: 6, font: "inherit", textAlign: "left", cursor: "pointer", background: "#fff", border: on ? "2px solid #303030" : "1px solid #d4d4d4", borderRadius: 10, minWidth: 0 }}
            >
              <span aria-hidden="true" style={{ display: "flex", flexDirection: s.list ? "column" : "row", gap: s.list ? 0 : 5, height: 64, padding: 6, background: s.bg ?? "#f6f6f7", borderRadius: 6, overflow: "hidden" }}>
                {Array.from({ length: s.list ? 3 : n }, (_, i) => {
                  const sel = i === 0;
                  if (s.list) {
                    return (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, padding: "0 6px", background: sel ? `color-mix(in srgb, ${s.accent} 14%, #fff)` : "#fff", boxShadow: sel ? `inset 3px 0 0 ${s.accent}` : undefined, borderTop: i ? "1px solid #e6e6e6" : undefined, borderRadius: i === 0 ? `${r}px ${r}px 0 0` : i === 2 ? `0 0 ${r}px ${r}px` : 0 }}>
                        <i style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${sel ? s.accent : "#c9c9c9"}` }} />
                        <i style={{ flex: 1, height: 4, borderRadius: 2, background: "#d9d9d9" }} />
                      </span>
                    );
                  }
                  return (
                    <span key={i} style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0, padding: 3, background: "#fff", border: `1px solid ${sel ? s.accent : "#e3e3e3"}`, boxShadow: sel ? `0 0 0 1px ${s.accent}` : undefined, borderRadius: r }}>
                      <i style={{ flex: s.ratio ? `0 0 ${Math.round(30 * Math.min(s.ratio, 1.6))}px` : 1, maxHeight: 34, borderRadius: Math.max(0, r - 2), background: ["#f4c99b", "#b9d3f2", "#d2bfe0", "#bfe3cb"][i % 4] }} />
                      <i style={{ height: 7, borderRadius: Math.min(r, 6), background: sel ? s.accent : "transparent", border: sel ? undefined : "1px solid #d9d9d9" }} />
                    </span>
                  );
                })}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#303030" }}>
                {p.title}
                {on ? <span style={{ fontWeight: 400, color: "#616161" }}> · in use</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </s-section>
  );
}
