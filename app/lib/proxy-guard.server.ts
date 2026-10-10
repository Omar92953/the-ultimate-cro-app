/** Small helpers shared by the app proxy routes (store → app): JSON answers and a per-visitor rate limit. */
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const recent = new Map<string, number[]>();
/** `max` tries per visitor per 10 minutes (per server process). */
export function tooMany(request: Request, shop: string, bucket: string, max: number) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const key = `${bucket}|${shop}|${ip}`;
  const now = Date.now();
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= max) return true;
  recent.set(key, [...list, now]);
  if (recent.size > 5000) recent.clear();
  return false;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await request.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
