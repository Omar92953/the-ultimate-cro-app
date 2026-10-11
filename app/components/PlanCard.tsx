/**
 * One plan as a card: name, price, what it's for, then "Features" with a check mark on every line
 * (Omar's reference style). Used by the Plans page, Home and upgrade cards. Content: lib/plans.ts.
 */
import type { ReactNode } from "react";
import { GUARANTEE, PLANS, price, type PlanKey } from "../lib/plans";
import { Pill } from "./ui";
import styles from "./PlanCard.module.css";

function Check() {
  return (
    <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

export function PlanCard({ plan, current, yearly = false, limit, action }: { plan: PlanKey; current?: boolean; yearly?: boolean; limit?: number; action?: ReactNode }) {
  const p = PLANS[plan];
  const amount = yearly ? p.yearly : p.monthly;
  return (
    <div className={`${styles.card} ${current ? styles.current : ""}`}>
      <div className={styles.head}>
        <span className={styles.name}>{p.name}</span>
        {current ? <Pill tone="ok">Current plan</Pill> : null}
      </div>
      <p className={styles.price}>
        {price(amount)}
        {amount ? <span className={styles.per}>{yearly ? "/year" : "/month"}</span> : null}
      </p>
      <p className={styles.sub}>{p.job}</p>
      {p.trialDays ? <p className={styles.sub}>{`${p.trialDays}-day free trial`}</p> : null}
      <h3 className={styles.featuresTitle}>Features</h3>
      <PlanFeatures plan={plan} limit={limit} />
      {p.monthly ? <p className={styles.guarantee}>{GUARANTEE}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
