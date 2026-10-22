/** The services the loyalty program connects to, and the events they get. Shared by client and server. */
export const INTEGRATIONS = ["klaviyo", "omnisend", "judgeme"] as const;
export type IntegrationKind = (typeof INTEGRATIONS)[number];
export const EVENT_TARGETS: IntegrationKind[] = ["klaviyo", "omnisend"];
export const INTEGRATION_INFO: Record<IntegrationKind, { title: string; key: string; where: string }> = {
  klaviyo: { title: "Klaviyo", key: "Private API key", where: "Klaviyo → Settings → API keys → Create Private API Key (Events and Profiles: full access)" },
  omnisend: { title: "Omnisend", key: "API key", where: "Omnisend → Store settings → API keys → Create API key (Contacts and Events)" },
  judgeme: { title: "Judge.me", key: "Private API token", where: "Judge.me → Settings → Integrations → View API tokens" },
};

/** The loyalty event each email kind sends to Klaviyo and Omnisend (the monthly summary sends none). */
export const EVENT_NAMES: Record<string, string> = {
  welcome: "Loyalty member joined",
  earned: "Loyalty points earned",
  ready: "Loyalty reward ready",
  reward: "Loyalty reward redeemed",
  credit: "Loyalty reward redeemed",
  tier: "Loyalty tier changed",
  tierDown: "Loyalty tier changed",
  referral: "Loyalty referral reward",
  birthday: "Loyalty birthday points",
  expiring: "Loyalty points expiring",
};
