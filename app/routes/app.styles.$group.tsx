/**
 * The Style tab of an offer group (Upsell, Cross sell, Bundles): every thing in the group that has a look,
 * one small heading per kind, active first. Picking a row opens that style editor (Templates, Content and
 * Style panes with the live preview). This is the only place a look is set. Offers and types without a look
 * (after purchase, upgrades, discounts) are not listed. Locked kinds show a lock and the upgrade card.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { isStyleGroup, STYLE_GROUPS } from "../lib/offer-style";
import { styleSections } from "../lib/offer-style.server";
import { getPlan } from "../lib/billing.server";
import { CategoryCrumb, FeatureTabs } from "../components/FeatureNav";
import { GroupTitle, LinkTiles, Pill } from "../components/ui";
import { UpgradeButton, UpgradeCard, usePlan } from "../components/Upgrade";
import { feature, type FeatureKey } from "../lib/catalog";
import { isLocked } from "../lib/plan-gate";
import { FEATURE_PLAN, PLANS, limitOf } from "../lib/plans";
import { DemoButton } from "../components/DemoButton";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  if (!isStyleGroup(params.group)) throw new Response("Not found", { status: 404 });
  const plan = (await getPlan(admin, session.shop)).plan;
  return { group: params.group, sections: await styleSections(admin, params.group, limitOf(plan, "designsPerSection") ?? 5) };
};

const FEATURE: Record<string, FeatureKey> = { upsell: "upsell", cross_sell: "cross_sell", bundles: "bundles" };

export default function StylePicker() {
  const { group, sections } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const meta = STYLE_GROUPS[group];
  const { plan, trial } = usePlan();
  const allowed = limitOf(plan, "designsPerSection") ?? 5;
  return (
    <s-page heading={`${meta.title} style`} inlineSize="base">
      <CategoryCrumb feature={FEATURE[group]} />
      <DemoButton feature={FEATURE[group]} />
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
        {allowed <= 1 ? (
          <s-banner tone="info" heading="Your plan has one style">
            <s-stack gap="small-200">
              <s-text>Every {meta.noun} shares the default style. Paid plans give each offer its own style.</s-text>
              <UpgradeButton variant="secondary">See plans and upgrade</UpgradeButton>
            </s-stack>
          </s-banner>
        ) : null}
        <s-section heading="What are you styling?">
          <s-stack gap="base">
            <s-text color="subdued">Pick one to change how it looks. Everything about how things look is set here; the other tabs only hold the items and settings.</s-text>
            {sections.map((sec) => {
              const key = sec.feature as FeatureKey;
              const locked = isLocked(plan, key, trial);
              const needs = FEATURE_PLAN[key];
              return (
                <s-stack key={sec.key} gap="small-200">
                  <GroupTitle>{sec.title}</GroupTitle>
                  {locked ? <UpgradeCard needs={needs} title={`${feature(key).title} is on the ${PLANS[needs].name} plan`} text={`${feature(key).about} Its look can be changed once your plan includes it.`} /> : null}
                  <LinkTiles
                    items={sec.rows.map((r) => ({
                      key: r.key,
                      title: r.title,
                      sub: r.sub,
                      href: r.href,
                      locked,
                      end: locked ? <Pill>{`${PLANS[needs].name} plan`}</Pill> : <Pill tone={r.pill === "Own style" ? "ok" : "muted"}>{r.pill}</Pill>,
                    }))}
                  />
                  {sec.key === "offers" && sec.rows.length === 1 ? <s-text color="subdued">No {meta.noun}s yet. Create one first, then style it here.</s-text> : null}
                </s-stack>
              );
            })}
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
