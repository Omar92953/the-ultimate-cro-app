import css from "./AnalyticsOverview.module.css";
import { MIN_ORDERS, MIN_VIEWS, type AbResult } from "../lib/ab-tests";

const n = (v: number | null, digits = 1) => (v === null ? "none yet" : v.toFixed(digits));

export function AbResults({ r, money }: { r: AbResult; money: (v: number) => string }) {
  const per100 = (x: number | null) => (x === null ? "none yet" : n(x * 100));
  return (
    <s-stack gap="small-200">
      <table className={css.table}>
        <thead>
          <tr><th> </th><th className={css.num}>Version A</th><th className={css.num}>Version B</th></tr>
        </thead>
        <tbody>
          {[
            ["Shoppers who saw it", r.a.views, r.b.views],
            ["Added the offer (orders)", r.a.adds, r.b.adds],
            ["Orders", r.a.orders, r.b.orders],
            ["Orders per 100 shoppers", per100(r.rate.a), per100(r.rate.b)],
            ["Revenue", money(r.a.revenue), money(r.b.revenue)],
            ["Revenue per shopper", r.perView.a === null ? "none yet" : money(r.perView.a), r.perView.b === null ? "none yet" : money(r.perView.b)],
          ].map(([label, a, b]) => (
            <tr key={String(label)}><td>{label}</td><td className={css.num}>{a}</td><td className={css.num}>{b}</td></tr>
          ))}
        </tbody>
      </table>
      <s-text>
        {r.verdict === "wait"
          ? `Not enough shoppers yet: each version needs ${MIN_VIEWS} shoppers and the two together ${MIN_ORDERS} orders before one can be called ahead.`
          : r.verdict === "close"
            ? `No clear difference yet${r.leader ? ` (version ${r.leader} is slightly ahead, ${r.sure}% sure)` : ""}. Let it run longer.`
            : `Version ${r.leader} is ahead, ${r.sure}% sure${r.verdict === "likely" ? " (likely, not certain)" : ""}.`}
      </s-text>
    </s-stack>
  );
}
