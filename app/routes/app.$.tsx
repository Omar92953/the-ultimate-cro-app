/**
 * Any /app address that isn't a page (an old link, a typo): a friendly "not found" inside the app
 * frame, so the menu stays and the merchant can carry on.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { Button } from "../components/fields";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function NotFound() {
  return (
    <s-page heading="Page not found" inlineSize="base">
      <s-section>
        <s-stack gap="base" alignItems="start">
          <s-paragraph>This page doesn&apos;t exist. It may have moved when the menu changed.</s-paragraph>
          <Button href="/app" variant="primary">
            Go to Home
          </Button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
