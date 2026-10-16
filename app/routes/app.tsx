import { AREAS } from "../lib/catalog";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, isRouteErrorResponse, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getPlan, getPlanState, keepWithinPlan } from "../lib/billing.server";
import { remember } from "../lib/short-cache.server";
import { PLANS } from "../lib/plans";
import { pageLock } from "../lib/plan-gate";
import { LockedPage } from "../components/Upgrade";
import frame from "../components/AppFrame.module.css";
import { ErrorPage, FAILED, NOT_FOUND } from "../components/ErrorPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  // Shopify adds ?plan_handle=… when it sends the merchant back from the plan selection page.
  const info = await getPlan(admin, session.shop, new URL(request.url).searchParams.has("plan_handle"));
  // Free stores try 1 next-plan feature of their choice (plans.ts `trialFeatures`).
  const trial = PLANS[info.plan].limits.trialFeatures ? (await remember(session.shop, "trial", 60000, () => getPlanState(admin).then((s) => s.trial ?? null)).catch(() => null)) : null;
  // After a plan change: switch off what's over the new limits, or back on after an upgrade (background).
  keepWithinPlan(admin, session.shop, info);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", plan: info.plan, planUrl: info.planUrl, trial };
};

export default function App() {
  const { apiKey, plan, trial } = useLoaderData<typeof loader>();
  const location = useLocation();
  // Pages the plan doesn't include show what they do and an upgrade card instead (lib/plans.ts).
  const lock = pageLock(plan, location.pathname, location.search, trial);

  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Same map as the hubs and every page's breadcrumb: app/lib/catalog.ts (Home plus 5 items: Shopify shows 7 before "View more"). */}
      <s-app-nav>
        {/* rel="home": the app's name in the sidebar is Home, so no item lights up on every page (the typings lack rel). */}
        <s-link href="/app" {...({ rel: "home" } as object)}>
          Home
        </s-link>
        {AREAS.map((a) => (
          <s-link key={a.key} href={a.href}>
            {a.title}
          </s-link>
        ))}
        <s-link href="/app/analytics">Analytics</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <div className={frame.page}>{lock ? <LockedPage lock={lock} /> : <Outlet />}</div>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  // Our own "not found" answers get a friendly page; Shopify's auth responses must go through its boundary.
  if (isRouteErrorResponse(error) && error.status === 404) return <ErrorPage {...NOT_FOUND} />;
  if (isRouteErrorResponse(error)) return boundary.error(error);
  return <ErrorPage {...FAILED} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
