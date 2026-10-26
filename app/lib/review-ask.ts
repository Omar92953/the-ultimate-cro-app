/**
 * When Home asks for an App Store review (Shopify's own review modal, App Bridge `shopify.reviews.request()`): only
 * once the app has shown it works, at least REVIEW_MIN_ORDERS orders with the app's items in the last 30 days, never
 * again after the merchant reviewed (or can't), and at most once in REVIEW_GAP_DAYS. Shopify adds its own limits on
 * top (24 hours after install, once in 60 days, three times a year), so a request may show nothing. Nothing is offered
 * in return for a review (Shopify forbids incentives).
 */
export const REVIEW_MIN_ORDERS = 3;
export const REVIEW_GAP_DAYS = 60;

export type ReviewState = { reviewAt: string | null; reviewDone: boolean };

export function reviewDue(state: ReviewState, appOrders: number | null | undefined, now = new Date()): boolean {
  if (state.reviewDone) return false;
  if (!appOrders || appOrders < REVIEW_MIN_ORDERS) return false;
  if (!state.reviewAt) return true;
  const last = new Date(state.reviewAt).getTime();
  return !Number.isFinite(last) || now.getTime() - last >= REVIEW_GAP_DAYS * 86400000;
}

/**
 * What a review request's answer changes: shown or held back by Shopify's limits counts as asked; already reviewed or
 * not allowed to review stops asking; anything else (mobile, too soon after install, closed while opening) tries again
 * on the next visit.
 */
export function afterReview(code: string, now = new Date()): Partial<ReviewState> | null {
  if (code === "already-reviewed" || code === "merchant-ineligible") return { reviewDone: true };
  if (code === "success" || code === "cooldown-period" || code === "annual-limit-reached") return { reviewAt: now.toISOString() };
  return null;
}
