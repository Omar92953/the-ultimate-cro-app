/** Live preview of the size guide: the links on a product, and the window with the same markup and styles as ucs-size-guide.js. */
import { useState, type CSSProperties } from "react";
import { convertCell, finderAsks, OUTLINE_PATH, recommendSize, sizeGuideClass, sizeGuideVars, type Chart, type Fit, type SizeGuideDesign } from "../lib/size-guide";

/** `tab`: which part the window opens on (the editor shows the finder while you edit the finder). */
export function SizeGuidePreview({ config: c, chartId, tab: startTab = "chart" }: { config: SizeGuideDesign; chartId?: string; tab?: "chart" | "rec" }) {
  const chart: Chart | undefined = c.charts.find((x) => x.id === chartId) ?? c.charts[0];
  const [tab, setTab] = useState<"chart" | "rec">(startTab);
  const [shownFor, setShownFor] = useState(startTab);
  if (shownFor !== startTab) {
    setShownFor(startTab);
    setTab(startTab);
  }
  const [usual, setUsual] = useState("");
  const [unit, setUnit] = useState<"cm" | "in" | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const [answer, setAnswer] = useState<{ text: string; ok: boolean } | null>(null);
  if (!chart) return <div style={{ padding: 24 }}>Add a size chart to see it here.</div>;
  const t = c.text;
  const shownUnit = unit ?? chart.unit;
  const hasChart = chart.rows.length > 0 && chart.columns.length > 0;
  const q = finderAsks(chart);
  const hasRec = chart.rec.on && (q.height || q.weight || q.usual);
  const tabNow = tab === "rec" && hasRec ? "rec" : hasChart ? "chart" : "rec";
  const find = () => {
    const h = parseFloat(height), w = parseFloat(weight);
    if (!usual && ((q.height && !(h > 0)) || (q.weight && !(w > 0)))) return setAnswer({ text: t.fillIn, ok: false });
    const r = recommendSize(chart, q.height && h > 0 ? h : null, q.weight && w > 0 ? w : null, fit, usual || null);
    setAnswer(r ? { text: t.result.replace("{size}", r.size), ok: true } : { text: t.noMatch, ok: false });
  };
  const vars = sizeGuideVars(c) as CSSProperties;
  return (
    <div style={{ display: "grid", gap: 14, padding: 24, maxWidth: 560 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Classic tee</div>
      <div>EGP 450.00</div>
      <div style={{ display: "flex", gap: 8 }}>
        {["S", "M", "L", "XL"].map((s) => (
          <span key={s} style={{ padding: "6px 14px", border: "1px solid #ccc", borderRadius: 999 }}>
            {s}
          </span>
        ))}
      </div>
      <div className={sizeGuideClass(c)} style={vars}>
        <span className="ucs-sg__links">
          {hasChart ? (
            <button type="button" className="ucs-sg__link" onClick={() => setTab("chart")}>
              {t.chartLink}
            </button>
          ) : null}
          {hasRec ? (
            <button type="button" className="ucs-sg__link" onClick={() => setTab("rec")}>
              {t.recLink}
            </button>
          ) : null}
        </span>
      </div>
      <div className={sizeGuideClass(c)} style={vars}>
        <div className="ucs-sg__dlg" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.12)" }}>
          <div className="ucs-sg__top">
            <h2 className="ucs-sg__h">{t.title}</h2>
            <span className="ucs-sg__x" style={{ display: "grid", placeItems: "center" }}>
              ×
            </span>
          </div>
          {hasChart && hasRec ? (
            <div className="ucs-sg__tabs" role="tablist">
              <button type="button" className={tabNow === "chart" ? "is-on" : ""} onClick={() => setTab("chart")}>
                {t.chartTab}
              </button>
              <button type="button" className={tabNow === "rec" ? "is-on" : ""} onClick={() => setTab("rec")}>
                {t.recTab}
              </button>
            </div>
          ) : null}
          <div className="ucs-sg__panel">
            {tabNow === "chart" ? (
              <div className="ucs-sg__chart">
                {chart.image?.url ? (
                  <img className="ucs-sg__art" src={chart.image.url} alt="" />
                ) : chart.outline !== "none" ? (
                  <svg className="ucs-sg__art ucs-sg__art--line" viewBox="0 0 100 100" aria-hidden="true">
                    <path d={OUTLINE_PATH[chart.outline]} />
                  </svg>
                ) : null}
                <div>
                  {chart.unitSwitch ? (
                    <div className="ucs-sg__units" role="group">
                      <button type="button" aria-pressed={shownUnit === "cm"} onClick={() => setUnit("cm")}>
                        {t.cm}
                      </button>
                      <button type="button" aria-pressed={shownUnit === "in"} onClick={() => setUnit("in")}>
                        {t.inch}
                      </button>
                    </div>
                  ) : null}
                  <div className="ucs-sg__scroll">
                    <table className="ucs-sg__table">
                      <tbody>
                        <tr>
                          <th>{t.sizeColumn}</th>
                          {chart.columns.map((col, i) => (
                            <th key={i}>{col}</th>
                          ))}
                        </tr>
                        {chart.rows.map((r, i) => (
                          <tr key={i}>
                            <th scope="row">{r.size}</th>
                            {chart.columns.map((_, j) => (
                              <td key={j}>{convertCell(r.values[j] ?? "", chart.unit, shownUnit)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {chart.note ? <p className="ucs-sg__note">{chart.note}</p> : null}
                </div>
              </div>
            ) : (
              <form className="ucs-sg__form" onSubmit={(e) => (e.preventDefault(), find())}>
                {q.usual ? (
                  <label className="ucs-sg__usual">
                    {t.usual}
                    <select value={usual} onChange={(e) => setUsual(e.target.value)}>
                      <option value="">{t.usualPick}</option>
                      {chart.rec.usual.answers.filter((a) => a.answer && a.size).map((a) => (
                        <option key={a.answer} value={a.answer}>
                          {a.answer}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {q.height || q.weight ? (
                <div className="ucs-sg__row">
                  {q.height ? (
                  <label>
                    {t.height}
                    <span className="ucs-sg__in">
                      <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
                      <select defaultValue="cm">
                        <option>cm</option>
                        <option>in</option>
                      </select>
                    </span>
                  </label>
                  ) : null}
                  {q.weight ? (
                  <label>
                    {t.weight}
                    <span className="ucs-sg__in">
                      <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                      <select defaultValue="kg">
                        <option>kg</option>
                        <option>lb</option>
                      </select>
                    </span>
                  </label>
                  ) : null}
                </div>
                ) : null}
                {chart.rec.fit ? (
                  <fieldset className="ucs-sg__fit">
                    <legend>{t.fit}</legend>
                    {(["snug", "regular", "relaxed"] as const).map((f) => (
                      <label key={f}>
                        <input type="radio" name="sg-fit" checked={fit === f} onChange={() => setFit(f)} />
                        <span>{t[f]}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : null}
                <button type="submit" className="ucs-sg__go">
                  {t.find}
                </button>
                {answer ? (
                  <div className={`ucs-sg__result ${answer.ok ? "is-ok" : "is-bad"}`}>
                    <strong>{answer.text}</strong>
                    {answer.ok && chart.fitNote ? <span>{chart.fitNote}</span> : null}
                  </div>
                ) : null}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
