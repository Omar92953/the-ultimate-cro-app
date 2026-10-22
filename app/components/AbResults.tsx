import { MIN_ORDERS, MIN_VIEWS, type AbResult } from "../lib/ab-tests";

const n = (v: number | null, digits = 1) => (v === null ? "none yet" : v.toFixed(digits));

export function AbResults({ r, money }: { r: AbResult; money: (v: number) => string }) {
  const per100 = (x: number | null) => (x === null ? "none yet" : n(x * 100));
  return (
    <s-stack gap="small-200">
      <s-grid gridTemplateColumns="2fr 1fr 1fr" gap="small-200">
        <s-text color="subdued"> </s-text>
        <s-text type="strong">Version A</s-text>
        <s-text type="strong">Version B</s-text>
        <s-text>Shoppers who saw it</s-text>
        <s-text>{r.a.views}</s-text>
        <s-text>{r.b.views}</s-text>
        <s-text>Added the offer (orders)</s-text>
        <s-text>{r.a.adds}</s-text>
        <s-text>{r.b.adds}</s-text>
        <s-text>Orders</s-text>
        <s-text>{r.a.orders}</s-text>
        <s-text>{r.b.orders}</s-text>
        <s-text>Orders per 100 shoppers</s-text>
        <s-text>{per100(r.rate.a)}</s-text>
        <s-text>{per100(r.rate.b)}</s-text>
        <s-text>Revenue</s-text>
        <s-text>{money(r.a.revenue)}</s-text>
        <s-text>{money(r.b.revenue)}</s-text>
        <s-text>Revenue per shopper</s-text>
        <s-text>{r.perView.a === null ? "none yet" : money(r.perView.a)}</s-text>
        <s-text>{r.perView.b === null ? "none yet" : money(r.perView.b)}</s-text>
      </s-grid>
      <s-text>
        {r.verdict === "wait"
          ? `Not enough shoppers yet: each version needs ${MIN_VIEWS} shoppers and the two together ${MIN_ORDERS} orders before we say which is ahead.`
          : r.verdict === "close"
            ? `No clear difference yet${r.leader ? ` (version ${r.leader} is slightly ahead, ${r.sure}% sure)` : ""}. Let it run longer.`
            : `Version ${r.leader} is ahead and we are ${r.sure}% sure${r.verdict === "likely" ? " (likely, not certain)" : ""}.`}
      </s-text>
    </s-stack>
  );
}
