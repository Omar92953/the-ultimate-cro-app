/**
 * Plan pieces (Omar's reference style): a paid plan's card (name, badge, revenue line, ✓ list,
 * price and a full-width button at the bottom), the Free plan as one slim row, and Home's plan bar.
 * Content: lib/plans.ts.
 */
import type { ReactNode } from "react";
import { PLANS, ordersLine, price, type PlanKey } from "../lib/plans";
import { Pill } from "./ui";
import styles from "./PlanCard.module.css";

function Check() {
  return (
    <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The ✓ list on its own (also used inside upgrade cards). `limit` shows only the first lines. */
export function PlanFeatures({ plan, limit }: { plan: PlanKey; limit?: number }) {
  const lines = PLANS[plan].highlights.slice(0, limit);
  return (
    <ul className={styles.list}>
      {lines.map((h) => (
        <li key={h} className={styles.item}>
          <Check />
          <span>{h}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Up to **500** orders monthly" */
export function OrdersLine({ plan }: { plan: PlanKey }) {
  const r = ordersLine(plan);
  return (
    <p className={styles.limitLine}>
      {r.amount === "Unlimited" ? null : "Up to "}
      <b>{r.amount}</b>
      {r.rest}
    </p>
  );
}

export function PlanCard({ plan, current, yearly = false, action }: { plan: PlanKey; current?: boolean; yearly?: boolean; action?: ReactNode }) {
  const p = PLANS[plan];
  const amount = yearly ? p.yearly : p.monthly;
  return (
    <div className={`${styles.card} ${current ? styles.current : ""}`}>
      <div className={styles.head}>
        <span className={styles.name}>{p.name}</span>
        {p.badge ? <span className={styles.badge}>{p.badge}</span> : null}
        {current ? <Pill tone="ok">Your plan</Pill> : null}
      </div>
      <OrdersLine plan={plan} />
      <PlanFeatures plan={plan} />
      <div className={styles.bottom}>
        <p className={styles.price}>
          {price(amount)}
          {amount ? <span className={styles.per}>{yearly ? "/year" : "/month"}</span> : null}
        </p>
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </div>
  );
}

/** The Free plan as one slim row under the paid cards. */
export function FreeRow({ current, action }: { current: boolean; action?: ReactNode }) {
  const p = PLANS.free;
  return (
    <div className={`${styles.freeRow} ${current ? styles.current : ""}`}>
      <div className={styles.freeText}>
        <span className={styles.head}>
          <span className={styles.name}>{p.name}</span>
          {current ? <Pill tone="ok">Your plan</Pill> : null}
        </span>
        <OrdersLine plan="free" />
        <span className={styles.freeLines}>{p.highlights.join(" · ")}</span>
      </div>
      {action ? <div className={styles.freeAction}>{action}</div> : null}
    </div>
  );
}

/**
 * Home's plan bar: the plan, this month's orders against its limit, and "See plans".
 * `orders` null = the count couldn't be read (then only the limit is shown).
 */
export function PlanBar({ plan, orders, trialEndsAt, action }: { plan: PlanKey; orders: number | null; trialEndsAt: string | null; action: ReactNode }) {
  const p = PLANS[plan];
  const limit = p.limits.monthlyOrders;
  const pct = limit && orders !== null ? Math.min(100, (orders / limit) * 100) : null;
  return (
    <div className={styles.planBar}>
      <div className={styles.planBarText}>
        <span className={styles.head}>
          <span className={styles.name}>{`${p.name} plan`}</span>
          {trialEndsAt ? <Pill tone="ok">{`Free trial until ${new Date(trialEndsAt).toLocaleDateString()}`}</Pill> : null}
        </span>
        <span className={styles.planBarLine}>
          {limit === null
            ? `Unlimited orders${orders !== null ? ` · ${orders.toLocaleString("en-US")} this month` : ""}`
            : orders === null
              ? `Up to ${limit.toLocaleString("en-US")} orders monthly`
              : `${orders.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} orders this month`}
        </span>
        {pct !== null ? (
          <span className={styles.meter} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Orders this month against your plan">
            <span className={`${styles.meterFill} ${pct >= 100 ? styles.meterFull : ""}`} style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </div>
      <div className={styles.freeAction}>{action}</div>
    </div>
  );
}
