/** Keys the merchant pastes are stored encrypted (AES-256-GCM) and shown as the last 4 characters only. */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { appSecret } from "../app-secret.server";

// TRACKING_KEY_SECRET is its own secret; until it is set, the app's API secret stands in (never printed).
const key = () => createHash("sha256").update(process.env.TRACKING_KEY_SECRET || appSecret()).digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(cipher: string): string | null {
  try {
    const [iv, tag, body] = cipher.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const last4 = (v: string) => v.slice(-4);
export const newSecret = () => randomBytes(24).toString("base64url");
export function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
