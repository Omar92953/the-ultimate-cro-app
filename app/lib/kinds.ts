import type { RuleKind } from "./types";

export const KINDS: Record<string, { kind: RuleKind; title: string; singular: string; intro: string }> = {
  "cross-sell": {
    kind: "cross_sell",
    title: "Cross-sell offers",
    singular: "cross-sell offer",
    intro:
      "Suggest products that go well with what the shopper is looking at. They tick the ones they want and add them in one click, optionally with a discount.",
  },
  upsell: {
    kind: "upsell",
    title: "Upsell offers",
    singular: "upsell offer",
    intro:
      "Reward shoppers for buying more, such as “Buy 2, save 10%”, or for choosing a bigger size. The discount is applied at checkout automatically.",
  },
};
