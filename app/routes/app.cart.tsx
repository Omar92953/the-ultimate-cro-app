/**
 * Cart: first the one choice that matters — keep the theme's own cart and add offers to it, or use
 * the app's cart drawer — then every cart module as a card (lib/catalog.ts, area "cart").
 * Both carts are app embeds (no new theme blocks).
 */
import type { HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { FeatureHub, type loader } from "./app.storefront";
import { Button } from "../components/fields";
import { Pill } from "../components/ui";

export { action, loader, shouldRevalidate } from "./app.storefront";

function CartChoice() {
  const data = useLoaderData<typeof loader>();
  const installed = data.theme?.installed;
  const options = [
    {
      key: "theme",
      title: "Keep my theme's cart, add offers to it",
      text: `Cross-sell offers show inside your theme's own cart drawer (Dawn and themes built on it). ${data.counts.drawer ? `${data.counts.drawer} offer${data.counts.drawer === 1 ? "" : "s"} set to show there.` : "Tick “Cart drawer” on a cross-sell offer to show it there."}`,
      on: installed?.drawer ?? null,
      href: data.links.drawer,
      edit: { label: "Cross-sell offers", href: "/app/offers/cross-sell" },
    },
    {
      key: "app",
      title: "Use the CRO Toolbox cart drawer",
      text: "A slide-out cart that works with any theme: offers, free-shipping bar, express checkout buttons, best discount and a shareable cart.",
      on: installed?.cart_tools ?? null,
      href: data.sectionLinks.cart_tools,
      edit: { label: "Cart drawer design", href: "/app/designs/cart-tools" },
    },
  ];
  const both = !!installed?.drawer && !!installed?.cart_tools;
  return (
    <s-section heading="Which cart?">
      <s-stack gap="base">
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
          {options.map((o) => (
            <s-box key={o.key} padding="base" borderWidth="base" borderRadius="base">
              <s-stack gap="small-200">
                <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
                  <s-text type="strong">{o.title}</s-text>
                  {o.on === null ? null : <Pill tone={o.on ? "ok" : "muted"}>{o.on ? "On in your theme" : "Off"}</Pill>}
                </s-stack>
                <s-text color="subdued">{o.text}</s-text>
                <s-stack direction="inline" gap="small-200">
                  <Button href={o.href} target="_top" variant={o.on ? "secondary" : "primary"}>
                    {o.on ? "Open in theme editor" : "Turn on"}
                  </Button>
                  <Button href={o.edit.href} variant="tertiary">
                    {o.edit.label}
                  </Button>
                </s-stack>
              </s-stack>
            </s-box>
          ))}
        </s-grid>
        {both ? (
          <s-banner tone="warning">Both are on, so shoppers may see two carts. Turn one off in App embeds.</s-banner>
        ) : null}
      </s-stack>
    </s-section>
  );
}

export default function Cart() {
  return <FeatureHub area="cart" top={<CartChoice />} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
