/**
 * One numbered step of an editor ("1 Bundle", "2 Where it shows"…): a header that opens and closes
 * it, a one-line summary while it's closed, and a tick once it's filled in. Editors open one at a
 * time (accordion), so a long form stays short.
 */
import type { ReactNode } from "react";
import styles from "./EditorSection.module.css";

export function EditorSection(props: { n: number; title: string; summary?: string; done?: boolean; open: boolean; onToggle: () => void; onNext?: () => void; children: ReactNode }) {
  const id = `editor-section-${props.n}`;
  return (
    <section className={`${styles.section} ${props.open ? styles.open : ""}`} aria-labelledby={`${id}-title`}>
      <button type="button" className={styles.head} aria-expanded={props.open} aria-controls={id} onClick={props.onToggle}>
        <span className={`${styles.badge} ${props.done ? styles.done : ""}`} aria-hidden="true">
          {props.done ? "✓" : props.n}
        </span>
        <span className={styles.text}>
          <span id={`${id}-title`} className={styles.title}>{props.title}</span>
          {!props.open && props.summary ? <span className={styles.summary}>{props.summary}</span> : null}
        </span>
        <svg className={styles.chevron} viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.5 8L10 12.5 14.5 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {props.open ? (
        <div id={id} className={styles.body}>
          {props.children}
          {props.onNext ? (
            <div className={styles.next}>
              <button type="button" className={styles.nextButton} onClick={props.onNext}>
                Continue
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
