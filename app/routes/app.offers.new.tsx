/**
 * "Create offer": pick the type, grouped like the Offers hub (catalog.ts OFFER_GROUPS), then its
 * editor opens. Add-ons and personalization are set up once, so they say "Set up".
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { OFFER_TYPES, OFFER_TYPE_KEYS } from "../lib/offer-types";
import { OFFER_GROUPS, feature, featureHref, featuresForPath, type FeatureKey } from "../lib/catalog";
import { FEATURE_PLAN, PLANS } from "../lib/plans";
import { isLocked } from "../lib/plan-gate";
import { LinkTiles, Pill } from "../components/ui";
import { BUNDLE_RECIPES } from "../lib/bundle-recipes";
import { usePlan } from "../components/Upgrade";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/** Set up once rather than created one by one. */
const SET_UP: FeatureKey[] = ["addons", "personalize"];

export default function NewOffer() {
  const { plan, trial } = usePlan();
  // The plan that a page's features need, or null when the page is open to this shop.
  const lockOf = (href: string) => {
    const fs = featuresForPath(href);
    return fs.length && fs.every((f) => isLocked(plan, f, trial)) ? fs.map((f) => FEATURE_PLAN[f])[0] : null;
  };
  const endOf = (href: string, open: string) => {
    const needs = lockOf(href);
    return needs ? <Pill>{`${PLANS[needs].name} plan`}</Pill> : open;
  };
  return (
    <s-page heading="Create offer" inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app/offers">
        Offers
      </s-link>
      <s-stack gap="base">
        {OFFER_GROUPS.map((g) => (
          <s-section key={g.key} heading={g.title}>
            <LinkTiles
              items={g.key === "bundles" ? BUNDLE_RECIPES.map((r) => ({ key: r.key, title: r.title, sub: r.about, href: r.href, locked: !!lockOf("/app/bundles"), end: endOf("/app/bundles", "Create") })) : [
                ...OFFER_TYPE_KEYS.filter((k) => OFFER_TYPES[k].group === g.key).map((k) => ({
                  key: k,
                  title: OFFER_TYPES[k].title,
                  sub: OFFER_TYPES[k].about,
                  href: OFFER_TYPES[k].create,
                  locked: !!lockOf(OFFER_TYPES[k].create),
                  end: endOf(OFFER_TYPES[k].create, "Create"),
                })),
                ...SET_UP.filter((f) => g.features.includes(f)).map((f) => ({
                  key: f,
                  title: feature(f).title,
                  sub: feature(f).about,
                  href: featureHref(f),
                  locked: isLocked(plan, f, trial),
                  end: isLocked(plan, f, trial) ? <Pill>{`${PLANS[FEATURE_PLAN[f]].name} plan`}</Pill> : "Set up",
                })),
              ]}
            />
          </s-section>
        ))}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
