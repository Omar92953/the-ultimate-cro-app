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
    <s-page heading="Settings">
      <s-section heading="Cart drawer offers">
        <s-stack gap="base">
          <s-paragraph>
            Shows your cross-sell offers inside the slide-out cart. Turn it on once in the theme editor (App embeds),
            then tick “Cart drawer” on the cross-sell offers you want there. Works with Dawn and themes built on it.
          </s-paragraph>
          <s-stack direction="inline" gap="base" alignItems="center">
            {data.theme ? (
              <s-badge tone={drawerOn ? "success" : "neutral"}>{drawerOn ? "On in your theme" : "Off"}</s-badge>
            ) : null}
            <Button href={data.links.drawer} target="_top" icon="theme-edit">
              {drawerOn ? "Open in theme editor" : "Turn on in theme editor"}
            </Button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Checkout discounts">
        <s-stack gap="base">
          {discount ? (
            <s-paragraph>
              Your offers’ discounts are applied at checkout by{" "}
              <s-text type="strong">
                {discount.engine === "native" ? "Shopify's own automatic discounts" : "the app's discount Function"}
              </s-text>
              . {discount.reason}
            </s-paragraph>
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
            details="Leave this on Automatic unless you were told otherwise. Native discounts work on every plan for custom installs, with small differences: an upsell's minimum quantity counts all its products together, and an 'All products' cross-sell discounts the offered products even when bought alone."
          />
        </s-stack>
      </s-section>

      <s-section heading="How it works">
        <s-paragraph>
          Everything you set in this app is stored in your own Shopify store and read by your theme directly, so offers
          load as fast as the rest of your pages.
        </s-paragraph>
        <s-paragraph>
          {discount?.engine === "native"
            ? "Discounts are real Shopify discounts: the app creates one automatic discount per upsell tier and cross-sell offer. You can see them under Discounts, but edit them here, not there."
            : "Discounts are real Shopify discounts, applied at checkout by the “Ultimate CRO offers” automatic discount. You can see it under Discounts."}
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
