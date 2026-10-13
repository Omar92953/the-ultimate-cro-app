/**
 * "Create offer": pick the type, grouped by where it shows (lib/offer-types.ts), then its editor opens.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { OFFER_TYPES, OFFER_TYPE_KEYS, OFFER_WHERE } from "../lib/offer-types";
import { LinkTiles } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function NewOffer() {
  return (
    <s-page heading="Create offer" inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/app/offers">
        Offers
      </s-link>
      <s-stack gap="base">
        {OFFER_WHERE.map((w) => (
          <s-section key={w.key} heading={w.title}>
            <LinkTiles
              items={OFFER_TYPE_KEYS.filter((k) => OFFER_TYPES[k].where === w.key).map((k) => ({
                key: k,
                title: OFFER_TYPES[k].title,
                sub: OFFER_TYPES[k].about,
                href: OFFER_TYPES[k].create,
                end: "Create",
              }))}
            />
          </s-section>
        ))}
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
