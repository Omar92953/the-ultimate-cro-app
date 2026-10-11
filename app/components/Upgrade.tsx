/**
 * Plan pieces used across pages: the shop's plan (from the app frame's loader), the upgrade card
 * shown instead of a page the plan doesn't include, and the "Upgrade" link for limit messages.
 * Upgrading always happens on Shopify's plan selection page (it must open with target="_top").
 */
import { useLocation, useRouteLoaderData } from "react-router";
import { Button } from "./fields";
import { Card, CardText, Pill } from "./ui";
import { CategoryCrumb } from "./FeatureNav";
import { feature } from "../lib/catalog";
import { PLANS, price, type PlanKey } from "../lib/plans";
import type { PageLock } from "../lib/plan-gate";
import type { loader as appLoader } from "../routes/app";

/** The shop's plan and Shopify's plan page URL (set by routes/app.tsx for every page). */
export function usePlan(): { plan: PlanKey; planUrl: string } {
  const data = useRouteLoaderData<typeof appLoader>("routes/app");
  return { plan: data?.plan ?? "free", planUrl: data?.planUrl ?? "" };
}

/** "$9.99/month · 14-day free trial" */
export function planPriceText(key: PlanKey) {
  const p = PLANS[key];
  if (!p.monthly) return "Free";
  return `${price(p.monthly)}/month${p.trialDays ? ` · ${p.trialDays}-day free trial` : ""}`;
}

export function UpgradeButton({ to, children, variant = "primary" }: { to?: PlanKey; children?: string; variant?: "primary" | "secondary" | "tertiary" }) {
  const { planUrl } = usePlan();
  return (
    <Button href={planUrl} target="_top" variant={variant}>
      {children ?? (to ? `Upgrade to ${PLANS[to].name}` : "Change plan")}
    </Button>
  );
}

/** A card explaining that `needs` unlocks something, with the upgrade button. */
export function UpgradeCard({ needs, title, text }: { needs: PlanKey; title: string; text: string }) {
  return (
    <Card title={title} badge={<Pill tone="warn">{`${PLANS[needs].name} plan`}</Pill>} actions={<><UpgradeButton to={needs} /><Button href="/app#plans" variant="tertiary">Compare plans</Button></>}>
      <CardText>{text}</CardText>
      <CardText>{`${PLANS[needs].name}: ${planPriceText(needs)}. You can change or cancel your plan at any time.`}</CardText>
    </Card>
  );
}

/** Shown by the app frame instead of a page the plan doesn't include — never an error page. */
export function LockedPage({ lock }: { lock: PageLock }) {
  const { plan } = usePlan();
  const { pathname } = useLocation();
  if (lock.kind === "design") {
    return (
      <s-page heading={`Design ${lock.slot}`} inlineSize="large">
        <s-stack gap="base">
          <UpgradeCard
            needs={lock.needs}
            title="More designs for this section"
            text={`Your ${PLANS[plan].name} plan includes ${lock.allowed} design${lock.allowed === 1 ? "" : "s"} per section. Designs you made before stay on your store as they are; upgrade to edit them or add more.`}
          />
          <s-stack direction="inline" gap="small-200">
            <Button href={`${pathname}?design=1`}>Open design 1</Button>
          </s-stack>
        </s-stack>
      </s-page>
    );
  }
  const f = feature(lock.feature);
  return (
    <s-page heading={f.title} inlineSize="large">
      <CategoryCrumb feature={lock.feature} />
      <s-stack gap="base">
        <UpgradeCard
          needs={lock.needs}
          title={`${f.title} is on the ${PLANS[lock.needs].name} plan`}
          text={`${f.about} Your store is on the ${PLANS[plan].name} plan. If you set this up before, it keeps working on your store as it is; upgrade to change it.`}
        />
      </s-stack>
    </s-page>
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
