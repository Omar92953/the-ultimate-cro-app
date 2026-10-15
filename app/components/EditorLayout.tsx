/**
 * Editors: the form on the left, a narrow sticky column on the right (status, preview, help).
 * Use this instead of `<s-section slot="aside">`: Polaris only shows the aside on `inlineSize="base"`
 * pages, and our editors are `"large"`, so aside content was never visible.
 */
import type { ReactNode } from "react";
import { helpUrl } from "../lib/site";
import styles from "./EditorLayout.module.css";

/** `preview`: settings in a narrower column on the left and a wide live preview on the right. */
export function EditorLayout({ children, side, preview = false, help }: { children: ReactNode; side: ReactNode; preview?: boolean; help?: string }) {
  return (
    <div className={`${styles.editor} ${preview ? styles.withPreview : ""}`}>
      <div className={styles.main}>{children}</div>
      <div className={styles.side}>
        {side}
        {help ? (
          <s-section heading="Help">
            <s-link href={helpUrl(help)} target="_blank">
              Read the help article
            </s-link>
          </s-section>
        ) : null}
      </div>
    </div>
  );
}
