import { CATEGORIES } from "../lib/catalog";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useLocation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { getPlan, keepWithinPlan } from "../lib/billing.server";
import { pageLock } from "../lib/plan-gate";
import { LockedPage } from "../components/Upgrade";
import frame from "../components/AppFrame.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  // Shopify adds ?plan_handle=… when it sends the merchant back from the plan selection page.
  const info = await getPlan(admin, session.shop, new URL(request.url).searchParams.has("plan_handle"));
  // After a plan change: switch off what's over the new limits, or back on after an upgrade (background).
  keepWithinPlan(admin, session.shop, info);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", plan: info.plan, planUrl: info.planUrl };
};

export default function App() {
  const { apiKey, plan } = useLoaderData<typeof loader>();
  const location = useLocation();
  // Pages the plan doesn't include show what they do and an upgrade card instead (lib/plans.ts).
  const lock = pageLock(plan, location.pathname, location.search);

  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Same map as Home's groups and every page's breadcrumb: app/lib/catalog.ts */}
      <s-app-nav>
        {/* rel="home": the app's name in the sidebar is Home, so no item lights up on every page (the typings lack rel). */}
        <s-link href="/app" {...({ rel: "home" } as object)}>
          Home
        </s-link>
        <s-link href="/app/features">All features</s-link>
        {CATEGORIES.map((c) => (
          <s-link key={c.key} href={c.href}>
            {c.title}
          </s-link>
        ))}
        <s-link href="/app/results">Results</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <div className={frame.page}>{lock ? <LockedPage lock={lock} /> : <Outlet />}</div>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
