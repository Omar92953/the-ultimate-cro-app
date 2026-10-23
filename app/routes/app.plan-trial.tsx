/**
 * "Try it free": a Free store picks the 1 Starter feature it can use now (plans.ts `trialFeatures`,
 * stored in plan_state.trial). Posted from the upgrade card (components/Upgrade.tsx TryCard).
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPlan, setTrialFeature } from "../lib/billing.server";
import { forgetShop } from "../lib/short-cache.server";
import { FEATURE_KEYS, type FeatureKey } from "../lib/catalog";
import { canTry } from "../lib/plan-gate";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request);
  return redirect("/app/plans");
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);
  const form = await request.formData();
  const key = String(form.get("feature") ?? "") as FeatureKey;
  const back = String(form.get("back") ?? "/app");
  const { plan } = await getPlan(admin, session.shop);
  if (!FEATURE_KEYS.includes(key) || !canTry(plan, key)) throw new Response("This feature can't be tried on your plan.", { status: 400 });
  await setTrialFeature(admin, key, session.shop);
  forgetShop(session.shop);
  return redirect(back.startsWith("/app") ? back : "/app");
};
