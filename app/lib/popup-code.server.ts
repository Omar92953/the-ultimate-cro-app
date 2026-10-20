/** The email pop up's welcome codes (routes/proxy.subscribe.tsx). */
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** "WELCOME-7K2QF9": the same for the same shop and email, unguessable without the app's secret. */
export function popupCode(shop: string, email: string, secret = process.env.SHOPIFY_API_SECRET ?? "") {
  const h = createHmac("sha256", secret).update(`popup|${shop}|${email}`).digest();
  return `WELCOME-${Array.from(h.subarray(0, 6), (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}
