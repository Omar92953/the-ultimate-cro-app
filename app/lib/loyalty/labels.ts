/** What each kind of points change is called in the admin and on the member's history. Shared by client and server. */
export const EVENT_LABEL: Record<string, string> = {
  order: "Order",
  first_order: "First order bonus",
  signup: "Account created",
  refund: "Refund",
  cancel: "Order cancelled",
  expire: "Points expired",
  adjust: "Changed by the store",
  import: "Imported",
  redeem: "Reward",
  birthday: "Birthday",
  review: "Review",
  social: "Followed on social media",
  referral: "Referral",
  flow: "Shopify Flow",
  campaign: "Bonus campaign",
  tier: "New tier bonus",
};

export const eventLabel = (kind: string, note: string) => {
  const base = EVENT_LABEL[kind] ?? kind;
  return note && (kind === "order" || kind === "refund" || kind === "cancel" || kind === "first_order") ? `${base} ${note}` : note && kind === "adjust" ? `${base}: ${note}` : base;
};
