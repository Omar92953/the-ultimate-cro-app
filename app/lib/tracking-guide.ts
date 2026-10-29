/**
 * "Copy guide" on the Tracking source page: a prompt the merchant pastes into their own AI assistant (ChatGPT, Claude,
 * Gemini) to get walked through connecting their shipping company. The webhook link stays out of it: it is a secret.
 * Written as the merchant speaking to their assistant, so it is in the first person (test/app/ui-wording.test.ts skips it).
 */
export function trackingGuide(store: string) {
  return [
    `I run a Shopify store (${store}) and use the CRO Toolbox app for my order Track page. Help me connect my shipping company so my customers see live delivery updates there. First ask me which shipping company or courier I use and in which country, then pick the best way below for it and walk me through it one step at a time, waiting for me after each step.`,
    "",
    "The ways CRO Toolbox can get tracking (in the app: Tracking & Returns, then Where tracking comes from):",
    "1. My own tracking service key. CRO Toolbox accepts a key from 17TRACK, AfterShip, TrackingMore or Ship24. Each of these follows thousands of carriers worldwide. Help me check whether one of them supports my carrier, create an account, find the API key (usually Settings, then API or Developers) and paste it into the Key field in CRO Toolbox, then press Test and save.",
    "2. A webhook link, for a shipping company, warehouse or 3PL that can send updates to a link. CRO Toolbox shows me a private link under Webhook link (I will copy it from the app myself; never ask me to paste it here). The sender POSTs JSON to it. Updates from 17TRACK, AfterShip, TrackingMore and Ship24 are read as they are. Otherwise the format is:",
    '   { "number": "TRACKING123", "status": "transit", "estimated": "2026-11-05", "events": [ { "status": "transit", "city": "Cairo", "province": "", "country": "EG", "message": "Arrived at the sorting center", "at": "2026-11-02T10:30:00Z" } ] }',
    "   status is one of: info, transit, out, delivered, problem. Help me write a short message to my shipping company asking whether they can send this, or set it up in a tool like Zapier or Make.",
    "3. A link to the courier's own tracking page, for a courier Shopify has no tracking link for: under Carriers without a tracking link, add the carrier's name as it shows on my fulfillments and its tracking page address with {number} where the tracking number goes. Help me find that address.",
    "4. Updates I type myself, for a courier with no tracking system: in Shipments, Add update on a shipment.",
    "",
    "Whatever I choose, the Track page always falls back to Shopify's own tracking data, so nothing breaks while I set it up. Keep your answers short and simple.",
  ].join("\n");
}
