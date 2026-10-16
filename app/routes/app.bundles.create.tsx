/**
 * "Create bundle": the 6 recipes (lib/bundle-recipes.ts); each opens its editor with presets.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { BundleRecipes } from "../components/BundleRecipes";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function CreateBundle() {
  return (
    <s-page heading="Create bundle offer" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/bundles">
        Bundles
      </s-link>
      <s-stack gap="base">
        <s-text color="subdued">What do you want to sell? Pick a recipe; you can change everything in the next step.</s-text>
        <BundleRecipes />
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
