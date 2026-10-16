/** Names of the offer groups that can have a style per offer (see offer-style.server.ts). Safe for the browser. */
export type StyleGroup = "upsell" | "cross_sell" | "bundles";
export const STYLE_GROUPS: Record<StyleGroup, { title: string; base: string; design: string; noun: string }> = {
  upsell: { title: "Upsell", base: "upsell", design: "/app/designs/upsell", noun: "upsell offer" },
  cross_sell: { title: "Cross sell", base: "cross_sell", design: "/app/designs/cross-sell", noun: "cross sell offer" },
  bundles: { title: "Bundles", base: "bundles", design: "/app/designs/bundles", noun: "bundle" },
};
export const isStyleGroup = (v: unknown): v is StyleGroup => typeof v === "string" && v in STYLE_GROUPS;

export type StyleOffer = { handle: string; name: string; active: boolean; design: number };
