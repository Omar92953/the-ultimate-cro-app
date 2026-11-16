/**
 * The website's "Email me at launch" form (crotoolbox.com → POST /site/notify). The list gets one email on launch
 * day and is then deleted (site privacy page). Free: stored in the app's own database.
 */
import db from "../db.server";
import { tooMany } from "./proxy-guard.server";

/** Where the form may be sent from: the site, its www name and Cloudflare preview builds. */
export function siteOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return /^https:\/\/((www\.)?crotoolbox\.com|([a-z0-9-]+\.)?crotoolbox\.pages\.dev)$/.test(origin) ? origin : null;
}

/** A plausible email, lower case, or null. */
export function cleanEmail(raw: unknown): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return e.length <= 254 && /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(e) ? e : null;
}

/** The page path the form was on ("/pricing/"), or null. */
export function cleanPage(raw: unknown): string | null {
  const p = String(raw ?? "").trim();
  return /^\/[A-Za-z0-9/_-]{0,120}$/.test(p) ? p : null;
}

/** Most new sign ups in one hour from everyone together: a flood is refused instead of filling the table. */
export const SIGNUPS_PER_HOUR = 200;

/** Saves the email (again is fine). False when the hourly cap is reached. */
export async function addLaunchSignup(email: string, page: string | null): Promise<boolean> {
  const recent = await db.launchSignup.count({ where: { createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= SIGNUPS_PER_HOUR) return false;
  await db.launchSignup.upsert({ where: { email }, create: { email, page }, update: {} });
  return true;
}

export const SITE = "https://crotoolbox.com";

function answer(js: boolean, origin: string | null, ok: boolean, message: string, status = 200) {
  if (js) {
    const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" };
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    return new Response(JSON.stringify({ ok, message }), { status, headers });
  }
  const title = ok ? "You're on the list" : "That didn't work";
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>` +
      `<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111}main{max-width:420px;margin:24px;padding:32px;background:#fff;border-radius:16px;text-align:center}h1{font-size:22px;margin:0 0 10px}p{color:#555;line-height:1.5}a{color:#111;font-weight:600}</style></head>` +
      `<body><main><h1>${title}</h1><p>${message}</p><p><a href="${origin ?? SITE}/">Back to CRO Toolbox</a></p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
  );
}

/** The whole form handler (the route only calls it). */
export async function handleSignup(request: Request): Promise<Response> {
  const origin = siteOrigin(request.headers.get("origin"));
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return answer(false, origin, false, "Please try again.", 400);
  }
  const js = form.get("js") === "1";
  if (request.method !== "POST" || !origin) return answer(js, origin, false, "Please use the form on crotoolbox.com.", 403);
  // Bots fill the hidden field: pretend it worked.
  if (String(form.get("company") ?? "")) return answer(js, origin, true, "We'll email you once, on launch day.");
  const email = cleanEmail(form.get("email"));
  if (!email) return answer(js, origin, false, "Please enter a valid email address.", 400);
  if (tooMany(request, "site", "notify", 5)) return answer(js, origin, false, "Too many tries. Please wait a few minutes.", 429);
  const saved = await addLaunchSignup(email, cleanPage(form.get("page"))).catch((e) => {
    console.error("Launch sign up failed:", e);
    return null;
  });
  if (saved === null) return answer(js, origin, false, "Something went wrong on our side. Please try again later.", 500);
  if (!saved) return answer(js, origin, false, "We're getting a lot of sign ups right now. Please try again in an hour.", 429);
  return answer(js, origin, true, "We'll email you once, on launch day.");
}
