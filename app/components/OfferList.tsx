/**
 * Every offer list in the app (All offers, Upsell, Cross sell, each discount type, bundles): name and what it does,
 * type, status, sales and orders of the last 30 days (results.server.ts byOffer), actions, and a Create button
 * inside the list as well as at the top of the page.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "./fields";
import styles from "./OfferList.module.css";
export { offerStats } from "../lib/offer-stats";

export type OfferListRow = {
  key: string;
  name: string;
  href: string;
  active: boolean;
  /** What it does or where it shows, one line. */
  detail?: string;
  /** The offer's type, shown as a small label (All offers only). */
  type?: string;
  /** Last 30 days; null = not measured for this kind of offer. */
  stats?: { revenue: number; orders: number } | null;
  actions?: ReactNode;
};

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
};

export function OfferList(props: {
  title: string;
  rows: OfferListRow[];
  currency: string;
  create?: { href: string; label: string };
  /** Filters shown above the rows. */
  filters?: ReactNode;
  /** Shown instead of the rows when there are none at all. */
  empty?: { title: string; text: string };
  /** Shown when filters hide every row. */
  noMatch?: string;
  /** Whether sales can be shown yet (orders readable). */
  measured?: boolean;
}) {
  const measured = props.measured !== false;
  const hasActions = props.rows.some((r) => r.actions);
  return (
    <section className={styles.list}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          {props.title}
          <span className={styles.count}>{props.rows.length}</span>
        </h2>
        {props.create ? (
          <Button href={props.create.href} variant="primary">
            {props.create.label}
          </Button>
        ) : null}
      </div>
      {props.filters ? <div className={styles.filters}>{props.filters}</div> : null}
      {props.rows.length ? (
        <div className={styles.table} role="table" aria-label={props.title}>
          <div className={`${styles.row} ${styles.header} ${hasActions ? styles.withActions : ""}`} role="row">
            <span role="columnheader">Offer</span>
            <span role="columnheader">Status</span>
            <span role="columnheader" className={styles.num}>Sales, 30 days</span>
            <span role="columnheader" className={styles.num}>Orders</span>
            {hasActions ? <span role="columnheader" className={styles.end}>Actions</span> : null}
          </div>
          {props.rows.map((r) => (
            <div key={r.key} className={`${styles.row} ${hasActions ? styles.withActions : ""}`} role="row">
              <span className={styles.main} role="cell">
                <Link to={r.href} prefetch="intent" className={styles.name}>
                  {r.name}
                </Link>
                <span className={styles.sub}>
                  {r.type ? <span className={styles.type}>{r.type}</span> : null}
                  {r.detail ? <span className={styles.detail}>{r.detail}</span> : null}
                </span>
              </span>
              <span role="cell" className={styles.status}>
                <span className={`${styles.dot} ${r.active ? styles.on : ""}`} aria-hidden="true" />
                {r.active ? "On" : "Off"}
              </span>
              <span role="cell" className={`${styles.num} ${styles.stat}`} data-label="Sales, 30 days">
                {!measured || r.stats === null ? <span className={styles.muted}>Not measured</span> : r.stats ? money(r.stats.revenue, props.currency) : <span className={styles.muted}>No sales yet</span>}
              </span>
              <span role="cell" className={`${styles.num} ${styles.stat}`} data-label="Orders">
                {!measured || r.stats === null ? "" : r.stats ? r.stats.orders : "0"}
              </span>
              {hasActions ? (
                <span role="cell" className={styles.end}>
                  {r.actions}
                </span>
              ) : null}
            </div>
          ))}
          {props.noMatch ? <p className={styles.noMatch}>{props.noMatch}</p> : null}
        </div>
      ) : props.empty ? (
        <div className={styles.empty}>
          <strong>{props.empty.title}</strong>
          <span>{props.empty.text}</span>
          {props.create ? (
            <Button href={props.create.href} variant="primary">
              {props.create.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
