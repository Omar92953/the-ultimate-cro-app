/**
 * The four steps at the top of every section page (Section library → a section): pick a style, customise and
 * save, add it to the theme, see it live. Each step ticks itself from the page's real state: saved, unsaved
 * changes, and whether the theme has the block (getThemeStatus). "Check again" re-reads the theme.
 */
import { useRevalidator } from "react-router";
import styles from "./SetupSteps.module.css";

type Step = { title: string; text: string; done: boolean; action?: { label: string; href?: string; onClick?: () => void; top?: boolean; blank?: boolean } };

export function SetupSteps(props: {
  /** Saved at least once (the store has a live copy). */
  saved: boolean;
  /** Unsaved changes on the page. */
  dirty: boolean;
  /** In the theme: true, false, or null when the app can't tell (it then can't tick step 3 itself). */
  inTheme: boolean | null;
  /** Theme editor deep link that adds the block or switches the embed on. */
  addLink?: string;
  /** "Add to theme" by default; embeds say "Turn on in theme". */
  addLabel?: string;
  /** Opens the Templates tab. */
  onStyles?: () => void;
  /** Preview on the store: a draft preview (onClick) and where it opens (href). */
  preview?: { href: string; onClick?: () => void };
}) {
  const revalidator = useRevalidator();
  const added = props.inTheme === true;
  const steps: Step[] = [
    { title: "Choose a style", text: "Start from a ready made style.", done: props.saved, action: props.onStyles ? { label: "See styles", onClick: props.onStyles } : undefined },
    { title: "Customise and save", text: props.dirty ? "You have unsaved changes." : "Change texts, colours and sizes, then save.", done: props.saved && !props.dirty },
    {
      title: "Add it to your theme",
      text: added ? "It's in your theme." : props.inTheme === null ? "Place it in the theme editor." : "One click opens the theme editor with it added.",
      done: added,
      action: props.addLink ? { label: added ? "Open in theme editor" : props.addLabel ?? "Add to theme", href: props.addLink, top: true } : undefined,
    },
    {
      title: "See it live",
      text: added && props.saved ? "Shoppers can see it now." : "Preview it on your store.",
      done: added && props.saved && !props.dirty,
      action: props.preview ? { label: "Preview on store", href: props.preview.href, onClick: props.preview.onClick, blank: true } : undefined,
    },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <section className={styles.wrap} aria-label="Steps to put it on your store">
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s.title} className={`${styles.step} ${s.done ? styles.done : ""} ${i === next ? styles.current : ""}`}>
            <span className={styles.num} aria-hidden="true">
              {s.done ? "✓" : i + 1}
            </span>
            <span className={styles.body}>
              <span className={styles.title}>
                {s.title}
                <span className={styles.sr}>{s.done ? " (done)" : ""}</span>
              </span>
              <span className={styles.text}>{s.text}</span>
              {s.action ? (
                s.action.href ? (
                  <a
                    className={styles.action}
                    href={s.action.href}
                    target={s.action.top ? "_top" : s.action.blank ? "_blank" : undefined}
                    rel={s.action.blank ? "noreferrer" : undefined}
                    onClick={s.action.onClick}
                  >
                    {s.action.label}
                  </a>
                ) : (
                  <button type="button" className={styles.action} onClick={s.action.onClick}>
                    {s.action.label}
                  </button>
                )
              ) : null}
              {i === 2 && !added && props.inTheme !== null ? (
                <button type="button" className={styles.check} onClick={() => revalidator.revalidate()} disabled={revalidator.state !== "idle"}>
                  {revalidator.state !== "idle" ? "Checking" : "Check again"}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
