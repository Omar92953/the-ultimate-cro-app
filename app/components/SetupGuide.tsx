/**
 * Home's setup guide: a progress bar, then the steps. The first step not done yet is open on a grey
 * panel with its button and "Mark as done"; the others are one line each (click to open). Steps
 * tick themselves when the app sees they're done; "Mark as done" is the fallback.
 */
import { useState, type ReactNode } from "react";
import styles from "./SetupGuide.module.css";
import { HomeRow } from "./ui";

export type GuideStep = { key: string; title: string; text: string; done: boolean; action: ReactNode };

function Circle({ done }: { done: boolean }) {
  return done ? (
    <svg className={styles.circle} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#303030" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg className={styles.circle} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="#8a8a8a" strokeWidth="1.5" strokeDasharray="3.2 2.6" />
    </svg>
  );
}

export function SetupGuide(props: { steps: GuideStep[]; onManual: (key: string) => void; onHide: () => void }) {
  const { steps } = props;
  const done = steps.filter((s) => s.done).length;
  const firstOpen = steps.findIndex((s) => !s.done);
  // null: the first step not done yet. A click opens any step, done or not.
  const [open, setOpen] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const shown = open ?? firstOpen;

  const tools = (
    <div className={styles.tools}>
      <div className={styles.menuWrap}>
        <button type="button" className={styles.iconButton} aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="5" cy="10" r="1.5" fill="currentColor" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            <circle cx="15" cy="10" r="1.5" fill="currentColor" />
          </svg>
        </button>
        {menu ? (
          <div className={styles.menu} role="menu">
            <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { setMenu(false); props.onHide(); }}>
              Hide setup guide
            </button>
          </div>
        ) : null}
      </div>
      <button type="button" className={styles.iconButton} aria-label={collapsed ? "Show steps" : "Hide steps"} aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
        <svg viewBox="0 0 20 20" aria-hidden="true" style={{ transform: collapsed ? "rotate(180deg)" : undefined }}>
          <path d="M5.5 12.5L10 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );

  return (
    <HomeRow
      title={done === steps.length ? "Setup complete" : "Setup guide"}
      subtitle={done === steps.length ? "Your offers are live. Analytics shows what they bring in." : "Follow these steps to start selling more with CRO Toolbox."}
      action={tools}
    >
    <div aria-label="Setup guide">
      <div className={styles.progress}>
        <span className={styles.count}>{`${done} / ${steps.length} completed`}</span>
        <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Setup progress">
          <span className={styles.fill} style={{ width: `${(done / steps.length) * 100}%` }} />
        </span>
      </div>

      {!collapsed ? (
        <ol className={styles.steps}>
          {steps.map((s, i) =>
            i === shown ? (
              <li key={s.key} className={`${styles.step} ${styles.stepOpen}`}>
                <Circle done={s.done} />
                <div className={styles.body}>
                  <span className={styles.stepTitle}>{s.title}</span>
                  <span className={styles.stepText}>{s.text}</span>
                  <span className={styles.actions}>
                    {s.action}
                    {s.done ? null : (
                      <button type="button" className={styles.manual} onClick={() => { setOpen(null); props.onManual(s.key); }}>
                        Mark as done
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ) : (
              <li key={s.key} className={styles.step}>
                <button type="button" className={styles.stepButton} onClick={() => setOpen(i)} aria-label={`${s.title}${s.done ? " (done)" : ""}`}>
                  <Circle done={s.done} />
                  <span className={`${styles.stepTitle} ${s.done ? styles.titleDone : ""}`}>{s.title}</span>
                </button>
              </li>
            ),
          )}
        </ol>
      ) : null}
    </div>
    </HomeRow>
  );
}
