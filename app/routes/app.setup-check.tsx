/**
 * Home's setup guide re-checks the theme without a reload: this reads the theme fresh (not from
 * the short cache, which can be 10 minutes old) and answers which theme steps are done. The fresh
 * result also replaces the cached theme status, so the next page already shows it.
 */
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getThemeStatus } from "../lib/cro.server";
import { forgetShop, prime } from "../lib/short-cache.server";
import { themeSteps } from "../lib/setup-steps";
import { timedLoader } from "../lib/timing.server";

export const loader = timedLoader("app.setup-check", async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  try {
    // No shop argument: a direct read that bypasses remember().
    const theme = await getThemeStatus(admin);
    prime(session.shop, "status", theme);
    forgetShop(session.shop, ["hub"]);
    return { ok: true as const, ...themeSteps(theme.installed) };
  } catch {
    return { ok: false as const, embed: false, place: false };
  }
});
