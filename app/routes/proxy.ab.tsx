/**
 * The offer blocks tell the app which version of an A/B test a shopper saw (/apps/ucro/ab), once a day per
 * shopper and test. Only running tests of this store are counted; nothing about the shopper is stored.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { json, readJson, tooMany } from "../lib/proxy-guard.server";
import { remember } from "../lib/short-cache.server";
import { countView, listTests } from "../lib/ab-tests.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  if (!admin || !session) return json({ ok: false }, 503);
  const body = await readJson(request);
  const t = String(body?.t ?? ""), g = body?.g;
  if (!/^ab_[a-z0-9]{4,16}$/.test(t) || (g !== "A" && g !== "B")) return json({ ok: false }, 400);
  if (tooMany(request, session.shop, "ab", 40)) return json({ ok: false }, 429);
  try {
    const running = await remember(session.shop, "ab_running", 60_000, async () => (await listTests(admin)).filter((x) => x.status === "running").map((x) => x.id));
    if (!running.includes(t)) return json({ ok: true, counted: false });
    await countView(session.shop, t, g);
    return json({ ok: true, counted: true });
  } catch (e) {
    console.error(`[proxy/ab] ${session.shop}:`, e instanceof Error ? e.message : e);
    return json({ ok: false }, 500);
  }
};
