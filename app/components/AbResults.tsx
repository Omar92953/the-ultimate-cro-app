import css from "./AnalyticsOverview.module.css";
import { MIN_ORDERS, MIN_VIEWS, type AbResult } from "../lib/ab-tests";

const n = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "none yet" : v.toFixed(digits));

/** One column per version (A, B and C, D when the test has them). */
export function AbResults({ r, money }: { r: AbResult; money: (v: number) => string }) {
  const per100 = (x: number | null | undefined) => (x === null || x === undefined ? "none yet" : n(x * 100));
  const cols = r.order;
  const rows: [string, (g: (typeof cols)[number]) => string | number][] = [
    ["Shoppers who saw it", (g) => r.groups[g]?.views ?? 0],
    ["Added the offer (orders)", (g) => r.groups[g]?.adds ?? 0],
    ["Orders", (g) => r.groups[g]?.orders ?? 0],
    ["Orders per 100 shoppers", (g) => per100(r.rate[g])],
    ["Revenue", (g) => money(r.groups[g]?.revenue ?? 0)],
    ["Revenue per shopper", (g) => (r.perView[g] === null || r.perView[g] === undefined ? "none yet" : money(r.perView[g]!))],
  ];
  return (
    <s-stack gap="small-200">
      <table className={css.table}>
        <thead>
          <tr>
            <th> </th>
            {cols.map((g) => (
              <th key={g} className={css.num}>{`Version ${g}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cell]) => (
            <tr key={label}>
              <td>{label}</td>
              {cols.map((g) => (
                <td key={g} className={css.num}>
                  {cell(g)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <s-text>
        {r.verdict === "wait"
          ? `Not enough shoppers yet: each version needs ${MIN_VIEWS} shoppers and all of them together ${MIN_ORDERS} orders before one can be called ahead.`
          : r.verdict === "close"
            ? `No clear difference yet${r.leader ? ` (version ${r.leader} is slightly ahead, ${r.sure}% sure)` : ""}. Let it run longer.`
            : `Version ${r.leader} is ahead, ${r.sure}% sure${r.verdict === "likely" ? " (likely, not certain)" : ""}.`}
      </s-text>
    </s-stack>
  );
}
