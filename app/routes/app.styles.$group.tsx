/**
 * Style tab of an offer group (Upsell, Cross sell, Bundles): "Which offer are you styling?". Active
 * offers first, then the rest; picking one opens its own style (app.styles.$group.$handle.tsx). The
 * group's default style is the first row: offers without a style of their own use it.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { isStyleGroup, STYLE_GROUPS, styleOffers } from "../lib/offer-style.server";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { LinkTiles, Pill } from "../components/ui";
import { UpgradeButton, usePlan } from "../components/Upgrade";
import { limitOf } from "../lib/plans";
import type { FeatureKey } from "../lib/catalog";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  if (!isStyleGroup(params.group)) throw new Response("Not found", { status: 404 });
  return { group: params.group, offers: await styleOffers(admin, params.group) };
};

const FEATURE: Record<string, FeatureKey> = { upsell: "upsell", cross_sell: "cross_sell", bundles: "bundles" };

export default function StylePicker() {
  const { group, offers } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const meta = STYLE_GROUPS[group];
  const { plan } = usePlan();
  const allowed = limitOf(plan, "designsPerSection") ?? 5;
  const own = allowed > 1;
  return (
    <s-page heading={`${meta.title} style`} inlineSize="base">
      <CategoryCrumb feature={FEATURE[group]} />
      <s-stack gap="base">
        <FeatureTabs feature={FEATURE[group]} />
        {params.get("full") ? (
          <s-banner tone="warning" heading="No free style left">
            <s-stack gap="small-200">
              <s-text>Your plan includes {allowed} styles for {meta.title.toLowerCase()}, and each one is already used. Open an offer that has its own style, or upgrade for more.</s-text>
              <UpgradeButton variant="secondary">See plans and upgrade</UpgradeButton>
            </s-stack>
          </s-banner>
        ) : null}
        {!own ? (
          <s-banner tone="info" heading="Your plan has one style">
            <s-stack gap="small-200">
              <s-text>Every {meta.noun} shares the default style. Paid plans give each offer its own style.</s-text>
              <UpgradeButton variant="secondary">See plans and upgrade</UpgradeButton>
            </s-stack>
          </s-banner>
        ) : null}
        <s-section heading="Which offer are you styling?">
          <s-stack gap="small-200">
            <s-text color="subdued">Each offer can have its own look. An offer without its own style uses the default style.</s-text>
            <LinkTiles
              items={[
                { key: "default", title: "Default style", sub: `Used by every ${meta.noun} that has no style of its own`, href: meta.design, end: <Pill>All offers</Pill> },
                ...offers.map((o) => ({
                  key: o.handle,
                  title: o.name,
                  sub: o.active ? "Active" : "Paused",
                  href: own ? `/app/styles/${group}/${o.handle}` : meta.design,
                  end: o.design > 1 ? <Pill tone="ok">Own style</Pill> : <Pill>Default style</Pill>,
                })),
              ]}
            />
            {!offers.length ? <s-text color="subdued">No {meta.noun}s yet. Create one first, then style it here.</s-text> : null}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
