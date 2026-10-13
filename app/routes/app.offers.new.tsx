/**
 * "Create offer": pick the type, grouped like the Offers hub (catalog.ts OFFER_GROUPS), then its
 * editor opens. Add-ons and personalization are set up once, so they say "Set up".
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { OFFER_TYPES, OFFER_TYPE_KEYS } from "../lib/offer-types";
import { OFFER_GROUPS, feature, featureHref, type FeatureKey } from "../lib/catalog";
import { FEATURE_PLAN, PLANS, canUse } from "../lib/plans";
import { LinkTiles, Pill } from "../components/ui";
import { usePlan } from "../components/Upgrade";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/** Set up once rather than created one by one. */
const SET_UP: FeatureKey[] = ["addons", "personalize"];

export default function NewOffer() {
  const { plan } = usePlan();
  return (
    <s-page heading="Create offer" inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app/offers">
        Offers
      </s-link>
      <s-stack gap="base">
        {OFFER_GROUPS.map((g) => (
          <s-section key={g.key} heading={g.title}>
            <LinkTiles
              items={[
                ...OFFER_TYPE_KEYS.filter((k) => OFFER_TYPES[k].group === g.key).map((k) => ({
                  key: k,
                  title: OFFER_TYPES[k].title,
                  sub: OFFER_TYPES[k].about,
                  href: OFFER_TYPES[k].create,
                  end: "Create",
                })),
                ...SET_UP.filter((f) => g.features.includes(f)).map((f) => ({
                  key: f,
                  title: feature(f).title,
                  sub: feature(f).about,
                  href: featureHref(f),
                  end: canUse(plan, f) ? "Set up" : <Pill>{`${PLANS[FEATURE_PLAN[f]].name} plan`}</Pill>,
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
