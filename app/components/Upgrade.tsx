/**
 * Plan pieces used across pages: the shop's plan (from the app frame's loader), the upgrade card
 * shown instead of a page the plan doesn't include, and the "Upgrade" link for limit messages.
 * Upgrading always starts on the app's own Plans page (/app/plans), never Shopify's pricing_plans page.
 */
import { useFetcher, useLocation, useRouteLoaderData } from "react-router";
import { Button } from "./fields";
import { Card, CardText, Pill } from "./ui";
import { CategoryCrumb, FeatureTabs } from "./FeatureNav";
import { DemoButton } from "./DemoButton";
import { PreviewStage } from "./SectionShowcase";
import { SHOWCASES } from "./showcases";
import { PlanFeatures } from "./PlanCard";
import { feature, featuresForPath, offerGroupOf, type FeatureKey } from "../lib/catalog";
import { GUARANTEE, PLANS, price, type PlanKey } from "../lib/plans";
import { canTry, type PageLock } from "../lib/plan-gate";
import type { loader as appLoader } from "../routes/app";

/** The shop's plan and the Plans page as a full admin URL (set by routes/app.tsx for every page). */
export function usePlan(): { plan: PlanKey; planUrl: string; trial: FeatureKey | null } {
  const data = useRouteLoaderData<typeof appLoader>("routes/app");
  return { plan: data?.plan ?? "free", planUrl: data?.planUrl ?? "", trial: data?.trial ?? null };
}

/** "$9.99/month · 14-day free trial" */
export function planPriceText(key: PlanKey) {
  const p = PLANS[key];
  if (!p.monthly) return "Free";
  return `${price(p.monthly)}/month${p.trialDays ? ` · ${p.trialDays}-day free trial` : ""}`;
}

export function UpgradeButton({ to, children, variant = "primary" }: { to?: PlanKey; children?: string; variant?: "primary" | "secondary" | "tertiary" }) {
  return (
    <Button href="/app/plans" variant={variant}>
      {children ?? (to ? `Upgrade to ${PLANS[to].name}` : "Change plan")}
    </Button>
  );
}

/** A card explaining that `needs` unlocks something, with the upgrade button. */
export function UpgradeCard({ needs, title, text }: { needs: PlanKey; title: string; text: string }) {
  return (
    <Card title={title} badge={<Pill tone="warn">{`${PLANS[needs].name} plan`}</Pill>} actions={<><UpgradeButton to={needs} /><Button href="/app/plans" variant="tertiary">Compare plans</Button></>}>
      <CardText>{text}</CardText>
      <CardText>{`${PLANS[needs].name}: ${planPriceText(needs)}`}</CardText>
      <PlanFeatures plan={needs} limit={4} />
      <CardText>{GUARANTEE}</CardText>
    </Card>
  );
}

/**
 * The top of a locked page: for an offer, the group's tabs and a link back to the group the
 * merchant came from (Upsell, Cross sell, Bundles, Discounts); otherwise the usual category crumb.
 */
function LockedTop({ feature: key, pathname }: { feature: FeatureKey; pathname: string }) {
  const group = offerGroupOf(key);
  if (!group) return <CategoryCrumb feature={key} />;
  const back = group.tabs[0].href;
  // On the group's first tab itself a link back to it would go nowhere: use the Offers hub.
  const here = pathname.replace(/\/+$/, "") === back;
  return (
    <s-link slot="breadcrumb-actions" href={here ? "/app/offers" : back}>
      {here ? "Offers" : group.title}
    </s-link>
  );
}

/** Shown by the app frame instead of a page the plan doesn't include — never an error page. */
export function LockedPage({ lock }: { lock: PageLock }) {
  const { plan } = usePlan();
  const { pathname } = useLocation();
  if (lock.kind === "design") {
    const owner = featuresForPath(pathname)[0];
    return (
      <s-page heading={`Style ${lock.slot}`} inlineSize="large">
        {owner ? <LockedTop feature={owner} pathname={pathname} /> : null}
        <s-stack gap="base">
          {owner ? <FeatureTabs feature={owner} /> : null}
          <UpgradeCard
            needs={lock.needs}
            title="More styles for this section"
            text={`Your ${PLANS[plan].name} plan includes ${lock.allowed} style${lock.allowed === 1 ? "" : "s"} per section. Styles you made before stay on your store as they are; upgrade to edit them or add more.`}
          />
          <s-stack direction="inline" gap="small-200">
            <Button href={`${pathname}?design=1`}>Open style 1</Button>
          </s-stack>
        </s-stack>
      </s-page>
    );
  }
  const f = feature(lock.feature);
  return (
    <s-page heading={f.title} inlineSize="large">
      <LockedTop feature={lock.feature} pathname={pathname} />
      <s-stack gap="base">
        <FeatureTabs feature={lock.feature} />
        <LockedPreview feature={lock.feature} />
        {canTry(plan, lock.feature) ? <TryCard feature={lock.feature} /> : null}
        <UpgradeCard
          needs={lock.needs}
          title={`${f.title} is on the ${PLANS[lock.needs].name} plan`}
          text={`${f.about} Your store is on the ${PLANS[plan].name} plan. If you set this up before, it is off on your store for now and every setting is kept; upgrade to turn it back on.`}
        />
      </s-stack>
    </s-page>
  );
}

/** What the locked feature looks like (its showcase pictures) and its live demo, above the upgrade card. */
function LockedPreview({ feature: key }: { feature: FeatureKey }) {
  const looks = SHOWCASES[key];
  if (!looks?.length) return <DemoButton feature={key} slot="" variant="secondary" />;
  return (
    <s-section heading="What it looks like">
      <s-stack gap="base">
        <PreviewStage title={feature(key).title} previews={looks.map((L, i) => <L key={i} />)} />
        <s-stack direction="inline">
          <DemoButton feature={key} slot="" variant="secondary" />
        </s-stack>
      </s-stack>
    </s-section>
  );
}

/**
 * Free stores use 1 next-plan feature of their choice now (plans.ts `trialFeatures`). Picking
 * another one moves the trial; the old one keeps working on the store but can't be edited.
 */
function TryCard({ feature: key }: { feature: FeatureKey }) {
  const { plan, trial } = usePlan();
  const fetcher = useFetcher();
  const { pathname, search } = useLocation();
  const needs = PLANS[plan === "free" ? "starter" : plan].name;
  return (
    <Card
      title="Try it free"
      badge={<Pill tone="ok">{`1 ${needs} feature included`}</Pill>}
      actions={
        <Button
          variant="primary"
          loading={fetcher.state !== "idle"}
          onClick={() => fetcher.submit({ feature: key, back: pathname + search }, { method: "post", action: "/app/plan-trial" })}
        >
          {trial ? `Switch the free ${needs} feature to this` : `Use this as the free ${needs} feature`}
        </Button>
      }
    >
      <CardText>{`Your ${PLANS[plan].name} plan includes 1 ${needs} feature of your choice, free. Pick this one to set it up now.`}</CardText>
      {trial ? (
        <CardText>{`Your free ${needs} feature is ${feature(trial).title} now. If you switch, ${feature(trial).title} keeps working on your store as it is, but you can't change it.`}</CardText>
      ) : null}
    </Card>
  );
}

/** Under a save error caused by a plan limit: the way out. */
export function LimitUpgrade({ show }: { show: unknown }) {
  return show ? (
    <s-stack direction="inline" gap="small-200">
      <UpgradeButton variant="secondary">See plans and upgrade</UpgradeButton>
    </s-stack>
  ) : null;
}
