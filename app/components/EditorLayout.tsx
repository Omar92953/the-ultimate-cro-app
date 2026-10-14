/**
 * Editors: the form on the left, a narrow sticky column on the right (status, preview, help).
 * Use this instead of `<s-section slot="aside">`: Polaris only shows the aside on `inlineSize="base"`
 * pages, and our editors are `"large"`, so aside content was never visible.
 */
import type { ReactNode } from "react";
import styles from "./EditorLayout.module.css";

export function EditorLayout({ children, side }: { children: ReactNode; side: ReactNode }) {
  return (
    <div className={styles.editor}>
      <div className={styles.main}>{children}</div>
      <div className={styles.side}>{side}</div>
    </div>
  );
}
