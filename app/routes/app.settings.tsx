import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { editorLinks, getDiscountStatus, getThemeStatus, setDiscountMode } from "../lib/cro.server";
import { sectionLinks } from "../lib/sections.server";
import { getPlan } from "../lib/billing.server";
import { getReferral } from "../lib/referral.server";
import { PLANS } from "../lib/plans";
import { UpgradeButton, planPriceText } from "../components/Upgrade";
import type { DiscountMode } from "../lib/types";
import { errorMessage } from "../lib/admin.server";
import { Button, Select } from "../components/fields";
import { Explainer, LinkTiles, Pill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [discount, theme, plan, referral] = await Promise.allSettled([getDiscountStatus(admin), getThemeStatus(admin, session.shop), getPlan(admin, session.shop), getReferral(admin, session.shop)]);
  const links = editorLinks(session.shop);
  const sl = sectionLinks(session.shop);
  return {
    links,
    // Every app embed (switched on once in the theme editor's App embeds).
    embeds: [
      { key: "boosters", title: "Conversion boosters", about: "Sticky add to cart, trust badges, sales pop-ups, stock urgency, wishlist hearts and the holdout test.", href: sl.boosters },
      { key: "cart_tools", title: "CRO Toolbox cart drawer", about: "The app's slide-out cart.", href: sl.cart_tools },
      { key: "drawer", title: "Offers in your theme's cart", about: "Cross-sell offers inside your theme's own cart drawer.", href: links.drawer },
      { key: "announcements", title: "Announcement bar", about: "Messages at the top of every page.", href: sl.announcements },
      { key: "quick_add", title: "Quick add to cart", about: "A button on every product card.", href: sl.quick_add },
      { key: "bundle_tray", title: "Bundle tray", about: "Build mix & match bundles from any page.", href: links.bundle_tray },
    ] as const,
    plan: plan.status === "fulfilled" ? plan.value.plan : null,
    referral: referral.status === "fulfilled" ? referral.value : null,
    supportEmail: process.env.SUPPORT_EMAIL || "",
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
  const installed = data.theme?.installed;

  return (
    <s-page heading="Settings" inlineSize="base">
      <s-stack gap="base">
        <s-section heading="Theme and app embeds">
          <s-stack gap="small-200">
            <s-text color="subdued">
              {data.theme?.themeName ? `Your live theme: ${data.theme.themeName}. ` : ""}App embeds are switched on once in the theme editor (App embeds); sections are added from each feature&apos;s page.
            </s-text>
            <LinkTiles
              items={data.embeds.map((e) => {
                const on = installed ? installed[e.key] : null;
                return {
                  key: e.key,
                  title: e.title,
                  sub: e.about,
                  href: e.href,
                  external: true,
                  badge: on === null ? null : <Pill tone={on ? "ok" : "muted"}>{on ? "On" : "Off"}</Pill>,
                  end: on ? "Open" : "Turn on",
                };
              })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Checkout discounts">
          <s-stack gap="base">
            {discount ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <Pill tone="ok">{discount.engine === "native" ? "Shopify discounts" : "App Function"}</Pill>
                <s-text>
                  Your offers’ discounts are applied at checkout by {discount.engine === "native" ? "Shopify's own automatic discounts" : "the app's discount Function"}. {discount.reason}
                </s-text>
              </s-stack>
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
            <Explainer
              what="Everything you set in the app is saved in your own Shopify store and read by your theme directly."
              how={
                discount?.engine === "native"
                  ? "Discounts are real Shopify discounts: the app creates one automatic discount per upsell tier and cross-sell offer. You'll see them under Discounts; edit them here, not there."
                  : "Discounts are real Shopify discounts, applied at checkout by one automatic discount called “CRO Toolbox offers” (under Discounts)."
              }
              example="Native mode differences: an upsell's minimum quantity counts all its products together, and an “All products” cross-sell discounts the offered products even when bought alone."
            />
          </s-stack>
        </s-section>

        <s-section heading="Plan and billing">
          <s-stack gap="base">
            {data.plan ? (
              <s-stack gap="small-100">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-text type="strong">{PLANS[data.plan].name}</s-text>
                  <s-text color="subdued">{planPriceText(data.plan)}</s-text>
                </s-stack>
                <s-text color="subdued">{PLANS[data.plan].job}</s-text>
              </s-stack>
            ) : null}
            <s-stack direction="inline" gap="small-200">
              <Button href="/app/plans" variant="primary">
                Compare plans
              </Button>
              <UpgradeButton variant="secondary">Change plan</UpgradeButton>
            </s-stack>
            <ReferralBox referral={data.referral} />
          </s-stack>
        </s-section>

        <s-section heading="Help">
          <s-stack gap="small-200">
            {data.supportEmail ? (
              <s-link href={`mailto:${data.supportEmail}`} target="_blank">
                Email support
              </s-link>
            ) : null}
            <s-link href="/privacy" target="_blank">
              Privacy policy
            </s-link>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

/** Refer a merchant (moved here from Home). The reward and how it's applied: plans.ts REFERRAL. */
function ReferralBox({ referral }: { referral: { code: string; link: string; reward: string; howItWorks: string } | null }) {
  const shopify = useAppBridge();
  if (!referral) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(referral.link);
      shopify.toast.show("Link copied");
    } catch {
      shopify.toast.show("Copy didn't work. Select the link and copy it", { isError: true });
    }
  };
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">Refer a merchant</s-text>
          <Pill tone="ok">{referral.reward}</Pill>
        </s-stack>
        <s-text color="subdued">{referral.howItWorks}</s-text>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text>{referral.link}</s-text>
          <Button onClick={copy} icon="clipboard" variant="tertiary">
            Copy link
          </Button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
