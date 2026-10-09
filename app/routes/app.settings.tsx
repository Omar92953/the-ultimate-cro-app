import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, getDiscountStatus, getThemeStatus, setDiscountMode } from "../lib/cro.server";
import type { DiscountMode } from "../lib/types";
import { errorMessage } from "../lib/admin.server";
import { Button, Select } from "../components/fields";
import { Card, CardGrid, CardText, Explainer, Pill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [discount, theme] = await Promise.allSettled([getDiscountStatus(admin), getThemeStatus(admin)]);
  return {
    links: editorLinks(session.shop),
    discount: discount.status === "fulfilled" ? discount.value : null,
    discountError: discount.status === "rejected" ? errorMessage(discount.reason) : null,
    theme: theme.status === "fulfilled" ? theme.value : null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const mode = String(form.get("mode")) as DiscountMode;
  if (!["auto", "function", "native"].includes(mode)) return { ok: false, error: "Unknown discount mode." };
  try {
    await setDiscountMode(admin, mode);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data?.ok) shopify.toast.show("Saved");
    if (fetcher.data?.error) shopify.toast.show(fetcher.data.error, { isError: true });
  }, [fetcher.data, shopify]);

  const discount = data.discount;
  const mode = fetcher.formData ? String(fetcher.formData.get("mode")) : (discount?.mode ?? "auto");
  const drawerOn = !!data.theme?.installed?.drawer;

  return (
    <s-page heading="Settings" inlineSize="large">
      <s-stack gap="base">
        <CardGrid cols={2}>
          <Card
            title="Cart drawer offers"
            badge={data.theme ? <Pill tone={drawerOn ? "ok" : "muted"}>{drawerOn ? "On in your theme" : "Off"}</Pill> : null}
            actions={
              <Button href={data.links.drawer} target="_top" variant="primary">
                {drawerOn ? "Open in theme editor" : "Turn on in theme editor"}
              </Button>
            }
          >
            <CardText>
              Shows your cross-sell offers inside the slide-out cart. Turn it on once in the theme editor (App embeds), then tick
              “Cart drawer” on the cross-sell offers you want there. Works with Dawn and themes built on it.
            </CardText>
          </Card>
          <Card title="Checkout discounts" badge={discount ? <Pill tone="ok">{discount.engine === "native" ? "Shopify discounts" : "App Function"}</Pill> : null}>
            {discount ? (
              <CardText>
                Your offers’ discounts are applied at checkout by {discount.engine === "native" ? "Shopify's own automatic discounts" : "the app's discount Function"}. {discount.reason}
              </CardText>
            ) : (
              <s-banner tone="warning">Discount status unavailable: {data.discountError}</s-banner>
            )}
            <Select
              label="Discount method"
              value={mode}
              onValue={(m) => fetcher.submit({ mode: m }, { method: "post" })}
              options={[
                { value: "auto", label: "Automatic (recommended)" },
                { value: "function", label: "Shopify Functions" },
                { value: "native", label: "Native Shopify discounts" },
              ]}
              details="Leave this on Automatic unless you were told otherwise."
            />
          </Card>
        </CardGrid>
        <Explainer
          what="Everything you set here is saved in your own Shopify store and read by your theme directly."
          how={
            discount?.engine === "native"
              ? "Discounts are real Shopify discounts: the app creates one automatic discount per upsell tier and cross-sell offer. You'll see them under Discounts; edit them here, not there."
              : "Discounts are real Shopify discounts, applied at checkout by one automatic discount called “CRO Toolbox offers” (under Discounts)."
          }
          example="Native mode differences: an upsell's minimum quantity counts all its products together, and an “All products” cross-sell discounts the offered products even when bought alone."
        />
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
