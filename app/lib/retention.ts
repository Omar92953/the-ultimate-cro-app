/** Retention periods in days for shoppers' personal data: enforced by retention.server.ts, shown on the privacy page. */
export const RETENTION_DAYS = {
  stockAlertSent: 30, // back in stock request, after the shopper was told
  stockAlertWaiting: 365, // back in stock request never sent
  returnRequest: 730, // return requests
  reviewerEmail: 730, // email typed by the merchant for the verified buyer check
  trackingCache: 90, // live tracking answers, after the last check
  trackCode: 30, // Track page discount codes, after they end
} as const;
